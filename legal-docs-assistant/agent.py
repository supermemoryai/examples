import asyncio
import os
import sys

import anthropic
from dotenv import load_dotenv

from supermemory_bash import create_bash


SYSTEM_PROMPT = (
    "You are a legal document analyst. The filesystem at /contracts holds the "
    "available contracts. Use sgrep for semantic search across them, find/ls "
    "to list, and cat to read full documents. Always cite the specific "
    "document and clause when answering."
)


def bash_tool(description: str) -> dict:
    return {
        "name": "bash",
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": {
                "cmd": {"type": "string", "description": "The bash command to run."}
            },
            "required": ["cmd"],
        },
    }


def format_tool_output(r) -> str:
    output = r.stdout
    if r.stderr:
        output += f"\n[stderr]: {r.stderr}"
    if r.exit_code != 0:
        output += f"\n[exit_code]: {r.exit_code}"
    return output or "(no output)"


async def run_agent(user_message: str) -> str:
    result = await create_bash(
        api_key=os.environ["SUPERMEMORY_API_KEY"],
        container_tag="legal_docs",
    )
    bash = result.bash

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    tools = [bash_tool(result.tool_description)]

    messages = [{"role": "user", "content": user_message}]

    for _ in range(10):
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text
            return ""

        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                cmd = block.input.get("cmd", "")
                print(f"  > {cmd}")
                r = await bash.exec(cmd)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": format_tool_output(r),
                    }
                )
        messages.append({"role": "user", "content": tool_results})

    return "(max steps reached)"


async def main() -> None:
    load_dotenv()

    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
    else:
        question = input("Question: ").strip()

    if not question:
        print("No question provided.")
        sys.exit(1)

    print(f"\nQuestion: {question}\n")
    answer = await run_agent(question)
    print(f"\nAnswer:\n{answer}")


if __name__ == "__main__":
    asyncio.run(main())
