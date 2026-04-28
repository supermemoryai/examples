import { createBash } from "@supermemory/bash";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export async function POST(req: Request) {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "SUPERMEMORY_API_KEY is not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const formData = await req.formData();
  const containerTag =
    (formData.get("containerTag") as string | null) ?? "research";

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
    const target = shellQuote(`/documents/${filename}`);
    const result = await bash.exec(
      `cat > ${target} << '__SM_EOF__'\n${content}\n__SM_EOF__`,
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
