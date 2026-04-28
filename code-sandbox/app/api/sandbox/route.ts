import { NextRequest, NextResponse } from "next/server";
import { getDaytona } from "@/lib/daytona";

export const runtime = "nodejs";
export const maxDuration = 120;

// Bump this in one place to roll the example forward to a new SMFS release.
const SMFS_VERSION = "v0.0.1-rc2";

const SMFS_INSTALL = `mkdir -p $HOME/.local/bin && \
curl -sL https://github.com/supermemoryai/smfs/releases/download/${SMFS_VERSION}/smfs-linux-x64 -o $HOME/.local/bin/smfs && \
chmod +x $HOME/.local/bin/smfs && \
echo 'user_allow_other' | sudo tee -a /etc/fuse.conf > /dev/null`;

// Wait up to ~10s for the FUSE mount to come up. Polling `mountpoint -q` is
// far more reliable than a fixed `sleep` because mount latency varies with
// network/login speed.
const MOUNT_WAIT = `for i in $(seq 1 20); do \
  if mountpoint -q /home/daytona/memory; then exit 0; fi; \
  sleep 0.5; \
done; \
echo "smfs mount did not become ready in time" >&2; \
exit 1`;

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

    // Mount the memory directory in the background, then poll for readiness.
    await sandbox.process.executeCommand(
      `bash -c '$HOME/.local/bin/smfs mount code_sandbox --ephemeral --path /home/daytona/memory --foreground &' && bash -c ${JSON.stringify(MOUNT_WAIT)}`,
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
