import asyncio
import os
import sys

import anthropic
from dotenv import load_dotenv

from supermemory_bash import create_bash


SYSTEM_PROMPT = (
    "You are a customer support agent. The filesystem contains this customer's "
    "history — past tickets, account notes, and interaction logs. Use sgrep to "
    "find related past issues, cat to read details. Draft a helpful response "
    "that references their history. After responding, save this ticket to "
    "/tickets/ for future reference."
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


async def run_agent(customer_id: str, ticket: str) -> str:
    container_tag = f"support_{customer_id}"

    result = await create_bash(
        api_key=os.environ["SUPERMEMORY_API_KEY"],
        container_tag=container_tag,
    )
    bash = result.bash

    profile = await bash.exec("cat /profile.md")
    profile_summary = profile.stdout.strip() or "(no profile available yet)"

    user_message = (
        f"Customer ID: {customer_id}\n"
        f"Container profile:\n{profile_summary}\n\n"
        f"New ticket from customer:\n{ticket}\n\n"
        "Search their history, draft a response, and save the ticket."
    )

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

    if len(sys.argv) < 3:
        print('Usage: python agent.py <customer_id> "<ticket text>"')
        sys.exit(1)

    customer_id = sys.argv[1]
    ticket = " ".join(sys.argv[2:])

    print(f"\nCustomer: {customer_id}")
    print(f"Ticket: {ticket}\n")

    response = await run_agent(customer_id, ticket)
    print(f"\nResponse:\n{response}")


if __name__ == "__main__":
    asyncio.run(main())
