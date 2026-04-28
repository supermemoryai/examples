import { createBash } from "@supermemory/bash";
import { CONTAINER_TAG } from "@/lib/config";
import { requireEnv } from "@/lib/env";
import { writeFileViaHeredoc } from "@/lib/bash-utils";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const apiKey = requireEnv("SUPERMEMORY_API_KEY");
  if (apiKey instanceof Response) return apiKey;

  const formData = await req.formData();
  const containerTag =
    (formData.get("containerTag") as string | null) ?? CONTAINER_TAG;

  const files: File[] = [];
  for (const value of formData.getAll("files")) {
    if (value instanceof File) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return new Response(JSON.stringify({ error: "No files provided" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { bash } = await createBash({ apiKey, containerTag });
  await bash.exec("mkdir -p /documents");

  const ingested: { filename: string; bytes: number }[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    const filename = file.name;
    const content = await file.text();
    // writeFileViaHeredoc uses a fresh randomized delimiter per call so
    // user content that happens to contain a previous marker cannot
    // prematurely close the heredoc.
    const result = await writeFileViaHeredoc(
      bash,
      `/documents/${filename}`,
      content,
    );
    if (result.exitCode !== 0) {
      errors.push({ filename, error: result.stderr || "unknown error" });
      continue;
    }
    ingested.push({ filename, bytes: content.length });
  }

  return new Response(
    JSON.stringify({
      ingested: ingested.length,
      files: ingested,
      errors,
    }),
    { headers: { "content-type": "application/json" } },
  );
}
