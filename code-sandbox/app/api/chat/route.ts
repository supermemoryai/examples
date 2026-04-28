import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { getSandbox } from "@/lib/e2b";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT =
  "You are a coding assistant. You can execute commands in the user's sandbox and read/write to their persistent memory at /home/user/memory/. Help them debug, explain code, and save useful snippets to memory for future reference.";

export async function POST(req: Request) {
  const anthropicKey = requireEnv("ANTHROPIC_API_KEY");
  if (anthropicKey instanceof Response) return anthropicKey;
  const e2bKey = requireEnv("E2B_API_KEY");
  if (e2bKey instanceof Response) return e2bKey;

  const body = await req.json();
  const { messages, sandboxId } = body ?? {};

  if (!sandboxId || typeof sandboxId !== "string") {
    return new Response(
      JSON.stringify({ error: "sandboxId is required" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const sbx = await getSandbox(sandboxId);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages,
    maxSteps: 10,
    tools: {
      execute_in_sandbox: tool({
        description: "Execute a shell command in the sandbox",
        parameters: z.object({ command: z.string() }),
        execute: async ({ command }) => {
          try {
            const r = await sbx.commands.run(command);
            const out = r.stdout ?? "";
            const errOut = r.stderr ?? "";
            const merged = errOut ? `${out}${out ? "\n" : ""}${errOut}` : out;
            const code = typeof r.exitCode === "number" ? r.exitCode : 0;
            if (!merged)
              return code === 0 ? "(no output)" : `(no output, exit ${code})`;
            return code === 0 ? merged : `${merged}\n[exit ${code}]`;
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
        },
      }),
      read_memory: tool({
        description: "Read a file from persistent memory",
        parameters: z.object({ path: z.string() }),
        execute: async ({ path }) => {
          try {
            const r = await sbx.commands.run(
              `cat /home/user/memory/${path}`,
            );
            return r.stdout || "(empty)";
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
