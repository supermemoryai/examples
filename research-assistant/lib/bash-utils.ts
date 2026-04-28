import type { createBash } from "@supermemory/bash";

type BashHandle = Awaited<ReturnType<typeof createBash>>["bash"];

/**
 * Single-quote a string for safe inclusion in a bash command. Closes the
 * quoted span around any embedded single-quote.
 */
export function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Generate a heredoc tag that is extremely unlikely to collide with file
 * contents. We use a fresh suffix per write so even content that contains a
 * fixed marker like `__SM_EOF__` cannot prematurely close the heredoc.
 */
export function freshHeredocTag(prefix = "SMFS_EOF"): string {
  return `__${prefix}_${Math.random().toString(36).slice(2, 14)}__`;
}

/**
 * Write `content` to `targetPath` inside the sandbox using a heredoc with a
 * randomized delimiter. `targetPath` is shell-quoted, so it may contain
 * spaces and other metacharacters. Returns the bash exec result.
 */
export async function writeFileViaHeredoc(
  bash: BashHandle,
  targetPath: string,
  content: string,
) {
  const tag = freshHeredocTag();
  const cmd =
    `cat > ${shellQuote(targetPath)} <<'${tag}'\n` +
    `${content}\n` +
    `${tag}`;
  return bash.exec(cmd);
}
