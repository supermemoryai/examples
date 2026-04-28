import { NextRequest, NextResponse } from "next/server";
import { createSandbox, getSandbox } from "@/lib/e2b";

export const runtime = "nodejs";
export const maxDuration = 120;

// Bump this in one place to roll the example forward to a new SMFS release.
const SMFS_VERSION = "v0.0.1-rc2";

const SMFS_INSTALL = `curl -fsSL https://smfs.ai/install | bash -s -- ${SMFS_VERSION}`;

// Wait up to ~10s for the FUSE mount to come up. Polling `mountpoint -q` is
// far more reliable than a fixed `sleep` because mount latency varies with
// network/login speed.
const MOUNT_WAIT = `for i in $(seq 1 20); do \
  if mountpoint -q /home/user/memory; then exit 0; fi; \
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

    const sbx = await createSandbox({
      SUPERMEMORY_API_KEY: supermemoryKey,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    });

    // /dev/fuse exists in E2B but is root-only by default; loosen perms so the
    // unprivileged `user` account can mount FUSE filesystems.
    await sbx.commands.run("sudo chmod 666 /dev/fuse");

    // Install SMFS binary
    await sbx.commands.run(SMFS_INSTALL, { timeoutMs: 60_000 });

    // Login with the API key
    await sbx.commands.run("smfs login --key $SUPERMEMORY_API_KEY");

    // Mount the memory directory in the background, then poll for readiness.
    await sbx.commands.run(
      "bash -c 'smfs mount code_sandbox --ephemeral --path /home/user/memory --foreground &' && " +
        MOUNT_WAIT,
    );

    return NextResponse.json({ sandboxId: sbx.sandboxId });
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

    const sbx = await getSandbox(sandboxId);
    await sbx.kill();

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
