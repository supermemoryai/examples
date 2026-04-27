import "dotenv/config";
import { generateText, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createBash } from "@supermemory/bash";
import { z } from "zod";

async function main() {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (!apiKey) {
    throw new Error("SUPERMEMORY_API_KEY is not set");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('Usage: npx tsx agent.ts "your question"');
    process.exit(1);
  }

  const { bash, toolDescription } = await createBash({
    apiKey,
    containerTag: "docs_agent",
  });

  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system:
      "You are a documentation expert. Use sgrep to search across docs, cat to read full pages. Answer questions by citing specific sections.",
    prompt: question,
    tools: {
      bash: tool({
        description: toolDescription,
        inputSchema: z.object({ cmd: z.string() }),
        execute: async ({ cmd }) => bash.exec(cmd),
      }),
    },
    stopWhen: stepCountIs(10),
  });

  console.log(result.text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
