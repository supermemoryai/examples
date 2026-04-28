"use client";

import { useCallback, useEffect, useState } from "react";

interface MemoryFile {
  name: string;
  size: number;
  isDir: boolean;
}

export interface FileBrowserProps {
  sandboxId: string | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBrowser({ sandboxId }: FileBrowserProps) {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MemoryFile | null>(null);
  const [content, setContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sandboxId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/files?sandboxId=${encodeURIComponent(sandboxId)}`,
      );
      const data = (await res.json()) as {
        files?: MemoryFile[];
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sandboxId]);

  useEffect(() => {
    if (sandboxId) {
      refresh();
    }
  }, [sandboxId, refresh]);

  const openFile = useCallback(
    async (f: MemoryFile) => {
      if (!sandboxId || f.isDir) return;
      setSelected(f);
      setContent("");
      setContentLoading(true);
      try {
        // /api/files returns directory contents by default; pass `file=` to
        // get a single file's body.
        const url = `/api/files?sandboxId=${encodeURIComponent(
          sandboxId,
        )}&file=${encodeURIComponent(f.name)}`;
        const res = await fetch(url);
        const data = (await res.json()) as {
          content?: string;
          error?: string;
        };
        if (!res.ok || data.error) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setContent(data.content ?? "");
      } catch (err) {
        setContent(
          `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setContentLoading(false);
      }
    },
    [sandboxId],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Memory ({files.length})
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={!sandboxId || loading}
          className="rounded-md border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2 text-xs">
        {error && (
          <div className="mb-2 rounded border border-red-700 bg-red-950/40 px-2 py-1 text-red-300">
            {error}
          </div>
        )}
        {!sandboxId && (
          <div className="text-slate-500">Waiting for sandbox…</div>
        )}
        {sandboxId && files.length === 0 && !loading && !error && (
          <div className="text-slate-500">
            No files in /home/user/memory/ yet.
          </div>
        )}
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.name}>
              <button
                type="button"
                onClick={() => openFile(f)}
                disabled={f.isDir}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="truncate font-mono text-slate-200">
                  {f.isDir ? "📁" : "📄"} {f.name}
                </span>
                {!f.isDir && (
                  <span className="shrink-0 text-slate-500">
                    {formatSize(f.size)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2">
              <span className="font-mono text-sm text-slate-100">
                {selected.name}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
            <div className="font-mono-code flex-1 overflow-auto px-4 py-3 text-xs text-slate-100">
              {contentLoading ? (
                <div className="text-slate-400">Loading…</div>
              ) : (
                <pre className="whitespace-pre-wrap break-words">
                  {content || "(empty)"}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
