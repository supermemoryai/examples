import { NextRequest, NextResponse } from "next/server";
import { getDaytona } from "@/lib/daytona";

export const runtime = "nodejs";
export const maxDuration = 60;

type Language = "python" | "javascript";

interface ExecuteBody {
  sandboxId?: string;
  code?: string;
  language?: Language;
}

const RUNTIMES: Record<Language, { ext: string; cmd: string }> = {
  python: { ext: "py", cmd: "python3" },
  javascript: { ext: "js", cmd: "node" },
};

/**
 * Single-quote a string for safe inclusion in a bash command. Closes the
 * quoted span around any embedded single-quote.
 */
function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExecuteBody;
    const { sandboxId, code, language } = body;

    if (!sandboxId || typeof sandboxId !== "string") {
      return NextResponse.json(
        { error: "sandboxId is required" },
        { status: 400 },
      );
    }
    if (typeof code !== "string") {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 },
      );
    }
    if (!language || !(language in RUNTIMES)) {
      return NextResponse.json(
        { error: "language must be 'python' or 'javascript'" },
        { status: 400 },
      );
    }

    const runtime = RUNTIMES[language];

    const daytona = getDaytona();
    const sandbox = await daytona.get(sandboxId);

    const tmpFile = `/tmp/run_${Date.now()}.${runtime.ext}`;

    // Use a per-request randomized heredoc tag so user code containing the
    // marker on its own line cannot prematurely close the heredoc.
    const heredocTag = `SMFS_CODE_EOF_${Math.random().toString(36).slice(2, 14)}`;

    // Build the script that the remote bash will run. We need *real* newlines
    // for the heredoc to work — `JSON.stringify` would turn them into `\n`
    // escape sequences and break the heredoc parser.
    const script =
      `cat > ${tmpFile} <<'${heredocTag}'\n` +
      `${code}\n` +
      `${heredocTag}\n` +
      `${runtime.cmd} ${tmpFile}`;

    // executeCommand takes a single shell-string command; we wrap our script
    // in `bash -c '<script>'` with the script safely single-quoted.
    const shellLine = `bash -c ${shellQuote(script)}`;

    const result = await sandbox.process.executeCommand(shellLine);

    // The Daytona SDK returns { exitCode, result } with merged stdout/stderr.
    // We surface a non-zero exit code's output as stderr so the UI can color
    // it red, otherwise treat the whole thing as stdout.
    const merged = result.result ?? "";
    const exitCode = typeof result.exitCode === "number" ? result.exitCode : 0;
    const stdout = exitCode === 0 ? merged : "";
    const stderr = exitCode === 0 ? "" : merged;

    return NextResponse.json({ stdout, stderr, exitCode });
  } catch (err) {
    console.error("[/api/execute] failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to execute code",
      },
      { status: 500 },
    );
  }
}
