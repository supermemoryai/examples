import json
import os
import re
from typing import AsyncIterator

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from supermemory_bash import create_bash

load_dotenv()


CONTAINER_TAG = "knowledge_base"
MAX_AGENT_STEPS = 10
SYSTEM_PROMPT = (
    "You are a knowledge base assistant. Use the bash tool to search notes "
    "with `sgrep <query> /notes/`, read them with `cat`, and list them with "
    "`ls /notes/`. When answering, cite which note you found the information in."
)

# Anthropic SDK client is process-level so we don't pay construction cost on
# every request. The library is thread/async safe.
_anthropic_client: anthropic.Anthropic | None = None


def get_anthropic() -> anthropic.Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(
            api_key=os.environ["ANTHROPIC_API_KEY"]
        )
    return _anthropic_client


def shell_quote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


# Reject titles with path-traversal, separators, control chars, or that
# resolve to dot-special names. Mirrors `isSafeFilename` in the code-sandbox
# example.
_UNSAFE_CHARS = re.compile(r"[\x00-\x1f/\\`$;&|<>\"\n\r]")


def sanitize_note_title(raw: str) -> str:
    title = raw.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if title in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid title")
    if ".." in title:
        raise HTTPException(status_code=400, detail="Invalid title")
    if _UNSAFE_CHARS.search(title):
        raise HTTPException(
            status_code=400,
            detail="Title contains forbidden characters",
        )
    return title


def format_tool_output(r) -> str:
    output = r.stdout or ""
    if r.stderr:
        output += f"\n[stderr]: {r.stderr}"
    if r.exit_code != 0:
        output += f"\n[exit_code]: {r.exit_code}"
    return output or "(no output)"


async def get_bash():
    # NOTE: this currently re-establishes a bash session per request. The
    # supermemory_bash SDK is the right place to add per-container caching;
    # if/when that lands, hoist this to a module-level cache keyed by
    # container_tag. For a demo example the latency is acceptable.
    result = await create_bash(
        api_key=os.environ["SUPERMEMORY_API_KEY"],
        container_tag=CONTAINER_TAG,
    )
    return result


app = FastAPI(title="Personal Knowledge Base")


class NoteCreate(BaseModel):
    title: str
    content: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


@app.post("/api/notes")
async def create_note(note: NoteCreate):
    safe_title = sanitize_note_title(note.title)
    result = await get_bash()
    bash = result.bash

    # Write the note via printf so the content is passed as a shell-quoted
    # argument rather than through a heredoc. The supermemory_bash SDK does
    # not support the << heredoc operator (it tokenises << as two separate
    # LT tokens), so heredoc-based writes produce empty files.  printf '%s'
    # with a single-quoted argument is correctly parsed by the SDK tokeniser
    # and supports arbitrary content including newlines.
    note_body = f"# {safe_title}\n\n{note.content}\n"
    cmd = (
        "mkdir -p /notes && "
        f"printf '%s' {shell_quote(note_body)} > /notes/{shell_quote(safe_title + '.md')}"
    )
    r = await bash.exec(cmd)
    if r.exit_code != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write note: {r.stderr or r.stdout}",
        )

    return {"status": "ok", "path": f"/notes/{safe_title}.md"}


@app.get("/api/notes")
async def list_notes():
    result = await get_bash()
    bash = result.bash

    # mkdir -p so the first call doesn't fail with "no such file"
    r = await bash.exec("mkdir -p /notes && ls /notes/")
    if r.exit_code != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list notes: {r.stderr or r.stdout}",
        )

    notes = [line.strip() for line in (r.stdout or "").splitlines() if line.strip()]
    return {"notes": notes}


@app.get("/api/notes/{filename}")
async def read_note(filename: str):
    result = await get_bash()
    bash = result.bash

    r = await bash.exec(f"cat /notes/{shell_quote(filename)}")
    if r.exit_code != 0:
        raise HTTPException(
            status_code=404,
            detail=f"Note not found: {r.stderr or r.stdout}",
        )

    return {"content": r.stdout}


@app.delete("/api/notes/{filename}")
async def delete_note(filename: str):
    result = await get_bash()
    bash = result.bash

    r = await bash.exec(f"rm /notes/{shell_quote(filename)}")
    if r.exit_code != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete: {r.stderr or r.stdout}",
        )

    return {"status": "deleted"}


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _build_tools(tool_description: str) -> list[dict]:
    return [
        {
            "name": "bash",
            "description": tool_description,
            "input_schema": {
                "type": "object",
                "properties": {
                    "cmd": {
                        "type": "string",
                        "description": "The bash command to run.",
                    }
                },
                "required": ["cmd"],
            },
        }
    ]


def _messages_from_history(req: ChatRequest) -> list[dict]:
    messages: list[dict] = [
        {"role": m.role, "content": m.content} for m in req.history
    ]
    messages.append({"role": "user", "content": req.message})
    return messages


async def _run_tool_calls(response, bash) -> AsyncIterator[tuple[str, dict | list]]:
    """Yield ('sse', event) tuples for each tool call, then a single
    ('tool_results', list) tuple with the accumulated tool_result blocks for
    the next turn's user message. If no tool calls were made, the tool_results
    list is empty.
    """
    tool_results: list[dict] = []
    for block in response.content:
        if getattr(block, "type", None) != "tool_use":
            continue
        cmd = block.input.get("cmd", "") if isinstance(block.input, dict) else ""
        yield (
            "sse",
            sse_event("tool_call", {"name": "bash", "input": {"cmd": cmd}}),
        )
        r = await bash.exec(cmd)
        output = format_tool_output(r)
        yield ("sse", sse_event("tool_result", {"output": output}))
        tool_results.append(
            {
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": output,
            }
        )
    yield ("tool_results", tool_results)


async def chat_stream(req: ChatRequest) -> AsyncIterator[str]:
    try:
        result = await get_bash()
        bash = result.bash

        client = get_anthropic()
        tools = _build_tools(result.tool_description)
        messages = _messages_from_history(req)

        for _ in range(MAX_AGENT_STEPS):
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=tools,
                messages=messages,
            )

            # Emit text blocks first.
            for block in response.content:
                if getattr(block, "type", None) == "text":
                    yield sse_event("text", {"content": block.text})

            if response.stop_reason == "end_turn":
                yield sse_event("done", {})
                return

            messages.append({"role": "assistant", "content": response.content})

            tool_results: list[dict] = []
            async for kind, payload in _run_tool_calls(response, bash):
                if kind == "sse":
                    yield payload  # type: ignore[misc]
                else:
                    tool_results = payload  # type: ignore[assignment]

            if not tool_results:
                yield sse_event("done", {})
                return

            messages.append({"role": "user", "content": tool_results})

        yield sse_event("text", {"content": "\n\n(max steps reached)"})
        yield sse_event("done", {})
    except Exception as e:  # noqa: BLE001
        # Catch-all so the SSE stream always terminates cleanly with an
        # `error` + `done` pair instead of the connection hanging or
        # bubbling a 500. Truly unexpected exceptions are still logged to
        # stderr by uvicorn since we re-yield rather than swallow.
        yield sse_event("error", {"message": str(e)})
        yield sse_event("done", {})


@app.post("/api/chat")
async def chat(req: ChatRequest):
    return StreamingResponse(
        chat_stream(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# Mount static AFTER api routes so /api/* takes priority.
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
