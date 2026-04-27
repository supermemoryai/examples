import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createBash } from "@supermemory/bash";

async function main() {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (!apiKey) {
    throw new Error("SUPERMEMORY_API_KEY is not set");
  }

  const { bash } = await createBash({
    apiKey,
    containerTag: "docs_agent",
  });

  const docsDir = join(process.cwd(), "docs");
  const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));

  if (files.length === 0) {
    console.log("No markdown files found in docs/");
    return;
  }

  await bash.exec("mkdir -p /docs");

  for (const file of files) {
    const content = readFileSync(join(docsDir, file), "utf8");
    const escaped = content.replace(/'/g, `'\\''`);
    const result = await bash.exec(`cat > /docs/${file} <<'__SM_EOF__'\n${content}\n__SM_EOF__`);
    if (result.exitCode !== 0) {
      console.error(`Failed to write ${file}: ${result.stderr}`);
      // Fallback for content that might contain the heredoc terminator.
      const fallback = await bash.exec(`echo '${escaped}' > /docs/${file}`);
      if (fallback.exitCode !== 0) {
        console.error(`Fallback also failed: ${fallback.stderr}`);
        continue;
      }
    }
    console.log(`Ingested /docs/${file} (${content.length} bytes)`);
  }

  const ls = await bash.exec("ls -la /docs");
  console.log("\nContainer contents:");
  console.log(ls.stdout);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
