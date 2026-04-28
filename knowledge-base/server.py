import json
import os
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
SYSTEM_PROMPT = (
    "You are a knowledge base assistant. Use the bash tool to search notes "
    "with `sgrep <query> /notes/`, read them with `cat`, and list them with "
    "`ls /notes/`. When answering, cite which note you found the information in."
)


def shell_quote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


def format_tool_output(r) -> str:
    output = r.stdout or ""
    if r.stderr:
        output += f"\n[stderr]: {r.stderr}"
    if r.exit_code != 0:
        output += f"\n[exit_code]: {r.exit_code}"
    return output or "(no output)"


async def get_bash():
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
    if not note.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    safe_title = note.title.replace("/", "_").strip()
    result = await get_bash()
    bash = result.bash

    # Ensure /notes exists, then write the note via heredoc.
    cmd = (
        "mkdir -p /notes && "
        f"cat > /notes/{shell_quote(safe_title + '.md')} << '__SM_EOF__'\n"
        f"# {safe_title}\n\n{note.content}\n"
        "__SM_EOF__"
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


async def chat_stream(req: ChatRequest) -> AsyncIterator[str]:
    try:
        result = await get_bash()
        bash = result.bash

        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        tools = [
            {
                "name": "bash",
                "description": result.tool_description,
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

        messages: list[dict] = []
        for m in req.history:
            messages.append({"role": m.role, "content": m.content})
        messages.append({"role": "user", "content": req.message})

        for _ in range(10):
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

            tool_results = []
            for block in response.content:
                if getattr(block, "type", None) == "tool_use":
                    cmd = block.input.get("cmd", "") if isinstance(block.input, dict) else ""
                    yield sse_event(
                        "tool_call",
                        {"name": "bash", "input": {"cmd": cmd}},
                    )
                    r = await bash.exec(cmd)
                    output = format_tool_output(r)
                    yield sse_event("tool_result", {"output": output})
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": output,
                        }
                    )

            if not tool_results:
                yield sse_event("done", {})
                return

            messages.append({"role": "user", "content": tool_results})

        yield sse_event("text", {"content": "\n\n(max steps reached)"})
        yield sse_event("done", {})
    except Exception as e:  # noqa: BLE001
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
