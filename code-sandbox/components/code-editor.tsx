"use client";

import { useMemo, useRef } from "react";
// `useRef` is used for the gutter; the textarea itself doesn't need a ref.

export type Language = "python" | "javascript";

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onRun: () => void;
  running?: boolean;
  disabled?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language,
  onLanguageChange,
  onRun,
  running = false,
  disabled = false,
}: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lineCount = useMemo(() => {
    const n = value.split("\n").length;
    return Math.max(n, 1);
  }, [value]);

  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.slice(0, start) + "  " + value.slice(end);
      onChange(next);
      // Restore cursor position after React re-render.
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-700 bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Editor
          </span>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            disabled={disabled}
            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || running}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          {running ? (
            <>
              <span className="spinner inline-block h-3 w-3 rounded-full border-2 border-white" />
              Running…
            </>
          ) : (
            <>
              <span aria-hidden="true">▶</span>
              Run
            </>
          )}
        </button>
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div
          ref={gutterRef}
          className="editor-gutter font-mono-code w-12 shrink-0 overflow-hidden border-r border-slate-700 px-2 py-3 text-right text-xs leading-6"
        >
          {lineNumbers.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          disabled={disabled}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          wrap="off"
          className="editor-bg font-mono-code flex-1 resize-none px-3 py-3 text-sm leading-6 outline-none placeholder:text-slate-500 disabled:opacity-60"
          placeholder={
            language === "python"
              ? "# write your Python code here\nprint('hello, sandbox')"
              : "// write your JavaScript code here\nconsole.log('hello, sandbox')"
          }
        />
      </div>
    </div>
  );
}
