"use client";

export interface OutputPanelProps {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  running: boolean;
  onClear: () => void;
}

export function OutputPanel({
  stdout,
  stderr,
  exitCode,
  running,
  onClear,
}: OutputPanelProps) {
  const empty =
    !running && !stdout && !stderr && exitCode === null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-700 bg-[#0b0f1a]">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Output
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={running}
          className="rounded-md border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      <div className="font-mono-code flex-1 overflow-auto px-3 py-2 text-xs leading-5">
        {running && (
          <div className="flex items-center gap-2 text-slate-400">
            <span className="spinner inline-block h-3 w-3 rounded-full border-2 border-slate-400" />
            Running…
          </div>
        )}

        {empty && (
          <div className="text-slate-500">
            No output yet. Click <span className="font-semibold">Run</span> to
            execute the code.
          </div>
        )}

        {stdout && (
          <pre className="whitespace-pre-wrap break-words text-slate-100">
            {stdout}
          </pre>
        )}

        {stderr && (
          <pre className="mt-2 whitespace-pre-wrap break-words text-red-400">
            {stderr}
          </pre>
        )}
      </div>

      {exitCode !== null && exitCode !== 0 && (
        <div className="border-t border-slate-700 bg-red-950/40 px-3 py-1.5 text-xs text-red-300">
          Process exited with code{" "}
          <span className="font-mono font-semibold">{exitCode}</span>
        </div>
      )}
    </div>
  );
}
