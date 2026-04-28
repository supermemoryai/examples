import { anthropic } from "@ai-sdk/anthropic";
import { createBash } from "@supermemory/bash";
import { streamText, tool } from "ai";
import { z } from "zod";
import { CONTAINER_TAG, MAX_AGENT_STEPS } from "@/lib/config";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT =
  "You are a research assistant. Use the bash tool to search documents with `sgrep`, read them with `cat`, and list them with `ls /documents/`. Always cite which document and section you found information in.";

export async function POST(req: Request) {
  const apiKey = requireEnv("SUPERMEMORY_API_KEY");
  if (apiKey instanceof Response) return apiKey;
  const anthropicKey = requireEnv("ANTHROPIC_API_KEY");
  if (anthropicKey instanceof Response) return anthropicKey;

  const body = await req.json();
  const { messages, containerTag = CONTAINER_TAG } = body ?? {};

  const { bash, toolDescription } = await createBash({
    apiKey,
    containerTag,
  });

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages,
    maxSteps: MAX_AGENT_STEPS,
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
