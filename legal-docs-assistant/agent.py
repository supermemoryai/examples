import asyncio
import os
import sys

import anthropic
from dotenv import load_dotenv

from supermemory_bash import create_bash


SYSTEM_PROMPT = (
    "You are a legal document analyst. Use sgrep to search across contracts, "
    "cat to read full documents. Always cite the specific document and clause "
    "when answering."
)


async def run_agent(user_message: str) -> str:
    result = await create_bash(
        api_key=os.environ["SUPERMEMORY_API_KEY"],
        container_tag="legal_docs",
    )
    bash = result.bash

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    tools = [
        {
            "name": "bash",
            "description": result.tool_description,
            "input_schema": {
                "type": "object",
                "properties": {
                    "cmd": {"type": "string", "description": "The bash command to run."}
                },
                "required": ["cmd"],
            },
        }
    ]

    messages: list[dict] = [{"role": "user", "content": user_message}]

    for _ in range(15):
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
                output = r.stdout
                if r.stderr:
                    output += f"\n[stderr]: {r.stderr}"
                if r.exit_code != 0:
                    output += f"\n[exit_code]: {r.exit_code}"
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": output or "(no output)",
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
