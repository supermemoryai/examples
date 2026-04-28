import { anthropic } from "@ai-sdk/anthropic";
import { Daytona } from "@daytonaio/sdk";
import { streamText, tool } from "ai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT =
  "You are a coding assistant. You can execute commands in the user's sandbox and read/write to their persistent memory at /home/daytona/memory/. Help them debug, explain code, and save useful snippets to memory for future reference.";

function getDaytona() {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is not set");
  }
  return new Daytona({ apiKey });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  if (!process.env.DAYTONA_API_KEY) {
    return new Response(
      JSON.stringify({ error: "DAYTONA_API_KEY is not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const body = await req.json();
  const { messages, sandboxId } = body ?? {};

  if (!sandboxId || typeof sandboxId !== "string") {
    return new Response(
      JSON.stringify({ error: "sandboxId is required" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const daytona = getDaytona();
  const sandbox = await daytona.get(sandboxId);

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
            const r = await sandbox.process.executeCommand(command);
            const out = r.result ?? "";
            const code = typeof r.exitCode === "number" ? r.exitCode : 0;
            if (!out) return code === 0 ? "(no output)" : `(no output, exit ${code})`;
            return code === 0 ? out : `${out}\n[exit ${code}]`;
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
            const r = await sandbox.process.executeCommand(
              `cat /home/daytona/memory/${path}`,
            );
            return r.result || "(empty)";
          } catch (e) {
            return `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
