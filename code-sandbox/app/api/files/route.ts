import { Daytona } from "@daytonaio/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

function getDaytona() {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is not set");
  }
  return new Daytona({ apiKey });
}

export interface MemoryFile {
  name: string;
  size: number;
  isDir: boolean;
}

// Parse output of `ls -la` into structured entries.
function parseLs(output: string): MemoryFile[] {
  const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: MemoryFile[] = [];
  for (const line of lines) {
    if (line.startsWith("total ")) continue;

    // Standard `ls -la` format:
    // perms links owner group size date1 date2 date3 name
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;

    const perms = parts[0];
    const sizeStr = parts[4];
    const name = parts.slice(8).join(" ");
    if (name === "." || name === "..") continue;

    const size = Number.parseInt(sizeStr, 10);
    out.push({
      name,
      size: Number.isFinite(size) ? size : 0,
      isDir: perms.startsWith("d"),
    });
  }
  return out;
}

// Reject paths containing shell metacharacters or path traversal.
function isSafeFilename(name: string): boolean {
  if (!name) return false;
  if (name.includes("..")) return false;
  if (name.includes("/")) return false;
  if (/[`$;&|<>"\\\n\r]/.test(name)) return false;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const sandboxId = req.nextUrl.searchParams.get("sandboxId");
    const file = req.nextUrl.searchParams.get("file");

    if (!sandboxId) {
      return NextResponse.json(
        { error: "sandboxId query param is required" },
        { status: 400 },
      );
    }

    const daytona = getDaytona();
    const sandbox = await daytona.get(sandboxId);

    // If a `file` query param is provided, return that file's contents.
    if (file) {
      if (!isSafeFilename(file)) {
        return NextResponse.json(
          { error: "Invalid file name" },
          { status: 400 },
        );
      }

      const result = await sandbox.process.executeCommand(
        `cat /home/daytona/memory/${file}`,
      );
      const content = result.result ?? "";
      return NextResponse.json({ content });
    }

    // Otherwise, list the memory directory.
    const result = await sandbox.process.executeCommand(
      "ls -la /home/daytona/memory/",
    );

    const raw = result.result ?? "";
    const files = parseLs(raw);

    return NextResponse.json({ files });
  } catch (err) {
    console.error("[/api/files] failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to list files",
        files: [],
      },
      { status: 500 },
    );
  }
}
