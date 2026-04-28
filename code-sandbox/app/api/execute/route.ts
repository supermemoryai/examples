import { Daytona } from "@daytonaio/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Language = "python" | "javascript";

interface ExecuteBody {
  sandboxId?: string;
  code?: string;
  language?: Language;
}

function getDaytona() {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is not set");
  }
  return new Daytona({ apiKey });
}

const RUNTIMES: Record<Language, { ext: string; cmd: string }> = {
  python: { ext: "py", cmd: "python3" },
  javascript: { ext: "js", cmd: "node" },
};

// EOF marker that's extremely unlikely to appear in user code.
const HEREDOC_TAG = "SMFS_CODE_EOF_8a3c2d1b";

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

    // Write code via heredoc, then execute. We use a single shell -c command
    // so the heredoc is interpreted by the remote bash, not the SDK.
    // The 'TAG' is single-quoted so the heredoc is treated literally
    // (no $-expansion or backtick execution inside the user's code).
    const command = [
      "bash",
      "-c",
      `cat > ${tmpFile} <<'${HEREDOC_TAG}'\n${code}\n${HEREDOC_TAG}\n${runtime.cmd} ${tmpFile}`,
    ];

    // Daytona's executeCommand accepts a single shell-string command.
    const shellLine = `bash -c ${JSON.stringify(command[2])}`;

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
