import { Daytona } from "@daytonaio/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SMFS_INSTALL =
  "mkdir -p $HOME/.local/bin && " +
  "curl -sL https://github.com/supermemoryai/smfs/releases/download/" +
  "v0.0.1-rc2/smfs-linux-x64 -o $HOME/.local/bin/smfs && " +
  "chmod +x $HOME/.local/bin/smfs && " +
  "echo 'user_allow_other' | sudo tee -a /etc/fuse.conf > /dev/null";

function getDaytona() {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is not set");
  }
  return new Daytona({ apiKey });
}

export async function POST() {
  try {
    const supermemoryKey = process.env.SUPERMEMORY_API_KEY;
    if (!supermemoryKey) {
      return NextResponse.json(
        { error: "SUPERMEMORY_API_KEY is not set" },
        { status: 500 },
      );
    }

    const daytona = getDaytona();

    const sandbox = await daytona.create({
      envVars: {
        SUPERMEMORY_API_KEY: supermemoryKey,
      },
    });

    // Install SMFS binary
    await sandbox.process.executeCommand(SMFS_INSTALL);

    // Login with the API key
    await sandbox.process.executeCommand(
      "$HOME/.local/bin/smfs login --key $SUPERMEMORY_API_KEY",
    );

    // Mount the memory directory in the background
    await sandbox.process.executeCommand(
      "bash -c '$HOME/.local/bin/smfs mount code_sandbox --ephemeral --path /home/daytona/memory --foreground &' && sleep 3",
    );

    return NextResponse.json({ sandboxId: sandbox.id });
  } catch (err) {
    console.error("[/api/sandbox POST] failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create sandbox",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sandboxId = req.nextUrl.searchParams.get("sandboxId");
    if (!sandboxId) {
      return NextResponse.json(
        { error: "sandboxId query param is required" },
        { status: 400 },
      );
    }

    const daytona = getDaytona();
    const sandbox = await daytona.get(sandboxId);
    await daytona.delete(sandbox);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/sandbox DELETE] failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to delete sandbox",
      },
      { status: 500 },
    );
  }
}
