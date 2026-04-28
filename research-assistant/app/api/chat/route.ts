import { anthropic } from "@ai-sdk/anthropic";
import { createBash } from "@supermemory/bash";
import { streamText, tool } from "ai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT =
  "You are a research assistant. Use the bash tool to search documents with `sgrep`, read them with `cat`, and list them with `ls /documents/`. Always cite which document and section you found information in.";

export async function POST(req: Request) {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "SUPERMEMORY_API_KEY is not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const body = await req.json();
  const { messages, containerTag = "research" } = body ?? {};

  const { bash, toolDescription } = await createBash({
    apiKey,
    containerTag,
  });

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages,
    maxSteps: 10,
    tools: {
      bash: tool({
        description: toolDescription,
        parameters: z.object({ cmd: z.string() }),
        execute: async ({ cmd }) => {
          const r = await bash.exec(cmd);
          return r.stdout + (r.stderr ? `\n[stderr]: ${r.stderr}` : "");
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
