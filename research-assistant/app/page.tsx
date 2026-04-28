"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useState } from "react";
import { Chat } from "@/components/chat";
import { FileUpload, type UploadedFile } from "@/components/file-upload";
import { CONTAINER_TAG } from "@/lib/config";

interface UploadResponse {
  ingested?: number;
  files?: UploadedFile[];
  errors?: { filename: string; error: string }[];
  error?: string;
}

interface UploadResult {
  ok: boolean;
  data: UploadResponse;
  status: number;
  statusText: string;
}

/** Pure network call — POST the files and return the parsed JSON body. */
async function uploadFiles(files: File[]): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("containerTag", CONTAINER_TAG);
  for (const f of files) fd.append("files", f);

  const res = await fetch("/api/ingest", { method: "POST", body: fd });
  const data = (await res.json()) as UploadResponse;
  return { ok: res.ok, data, status: res.status, statusText: res.statusText };
}

/** Pure dedup-by-name merge of newly-ingested files into the existing list. */
function mergeUploadedFiles(
  prev: UploadedFile[],
  incoming: UploadedFile[] | undefined,
): UploadedFile[] {
  if (!incoming || incoming.length === 0) return prev;
  const map = new Map<string, UploadedFile>();
  for (const f of prev) map.set(f.name, f);
  for (const f of incoming) map.set(f.name, f);
  return Array.from(map.values());
}

/** Build the human-readable summary string posted into the chat. */
function formatUploadSummary(data: UploadResponse): string {
  const summary = `📄 Ingested ${data.ingested ?? 0} file(s): ${(
    data.files ?? []
  )
    .map((f) => f.name)
    .join(", ")}`;
  const errPart =
    data.errors && data.errors.length > 0
      ? `\n⚠️ Errors: ${data.errors
          .map((e) => `${e.filename} (${e.error})`)
          .join(", ")}`
      : "";
  return summary + errPart;
}

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/chat",
      body: { containerTag: CONTAINER_TAG },
    });

  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      setUploading(true);
      try {
        const { ok, data, statusText } = await uploadFiles(files);

        if (!ok || data.error) {
          await append({
            role: "system",
            content: `❌ Upload failed: ${data.error ?? statusText}`,
          });
          return;
        }

        setUploadedFiles((prev) => mergeUploadedFiles(prev, data.files));
        await append({
          role: "system",
          content: formatUploadSummary(data),
        });
      } catch (err) {
        await append({
          role: "system",
          content: `❌ Upload failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      } finally {
        setUploading(false);
      }
    },
    [append],
  );

  return (
    <main className="mx-auto flex h-screen max-w-4xl flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Research Assistant
          </h1>
          <p className="text-xs text-slate-500">
            Upload documents, ask questions, get cited answers.
          </p>
        </div>
        <div className="rounded-full bg-slate-200 px-3 py-1 text-xs font-mono text-slate-600">
          container: {CONTAINER_TAG}
        </div>
      </header>

      <section className="mb-4">
        <FileUpload
          onUpload={handleUpload}
          uploading={uploading}
          uploadedFiles={uploadedFiles}
        />
      </section>

      <section className="flex flex-1 flex-col overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
        <Chat messages={messages} isLoading={isLoading} />

        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200 bg-white p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }
              }}
              rows={1}
              placeholder="Ask a question about your documents…"
              className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isLoading ? "…" : "Send"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
