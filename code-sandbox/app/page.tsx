"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor, type Language } from "@/components/code-editor";
import { OutputPanel } from "@/components/output-panel";
import { ChatPanel } from "@/components/chat-panel";
import { FileBrowser } from "@/components/file-browser";

const STARTER_CODE: Record<Language, string> = {
  python:
    "# Your code runs in a Daytona sandbox.\n" +
    "# Persistent memory is mounted at /home/daytona/memory/.\n" +
    "import os\n\n" +
    "print('hello from python')\n" +
    "print('memory contents:', os.listdir('/home/daytona/memory'))\n",
  javascript:
    "// Your code runs in a Daytona sandbox.\n" +
    "// Persistent memory is mounted at /home/daytona/memory/.\n" +
    "const fs = require('fs');\n\n" +
    "console.log('hello from node');\n" +
    "console.log('memory contents:', fs.readdirSync('/home/daytona/memory'));\n",
};

export default function Home() {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState(STARTER_CODE.python);

  const [running, setRunning] = useState(false);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);

  const [chatCollapsed, setChatCollapsed] = useState(false);

  // Track whether the user has manually edited the code so we don't clobber
  // their work when switching languages.
  const codeDirtyRef = useRef(false);

  // Create the sandbox on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sandbox", { method: "POST" });
        const data = (await res.json()) as {
          sandboxId?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || data.error || !data.sandboxId) {
          setBootError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        setSandboxId(data.sandboxId);
      } catch (err) {
        if (cancelled) return;
        setBootError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Best-effort cleanup on tab close. The browser may not wait for the
  // request, so we use sendBeacon when available.
  useEffect(() => {
    if (!sandboxId) return;

    const cleanup = () => {
      const url = `/api/sandbox?sandboxId=${encodeURIComponent(sandboxId)}`;
      // sendBeacon only supports POST, so we use fetch with keepalive for
      // a best-effort DELETE on tab close.
      try {
        fetch(url, { method: "DELETE", keepalive: true });
      } catch {
        // ignore
      }
    };

    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
    };
  }, [sandboxId]);

  const handleLanguageChange = useCallback(
    (lang: Language) => {
      setLanguage(lang);
      if (!codeDirtyRef.current) {
        setCode(STARTER_CODE[lang]);
      }
    },
    [],
  );

  const handleCodeChange = useCallback(
    (next: string) => {
      codeDirtyRef.current = true;
      setCode(next);
    },
    [],
  );

  const handleRun = useCallback(async () => {
    if (!sandboxId || running) return;
    setRunning(true);
    setStdout("");
    setStderr("");
    setExitCode(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sandboxId, code, language }),
      });
      const data = (await res.json()) as {
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        error?: string;
      };
      if (!res.ok || data.error) {
        setStderr(data.error ?? `HTTP ${res.status}`);
        setExitCode(typeof data.exitCode === "number" ? data.exitCode : 1);
        return;
      }
      setStdout(data.stdout ?? "");
      setStderr(data.stderr ?? "");
      setExitCode(typeof data.exitCode === "number" ? data.exitCode : 0);
    } catch (err) {
      setStderr(err instanceof Error ? err.message : String(err));
      setExitCode(1);
    } finally {
      setRunning(false);
    }
  }, [sandboxId, code, language, running]);

  const handleClear = useCallback(() => {
    setStdout("");
    setStderr("");
    setExitCode(null);
  }, []);

  return (
    <main className="flex h-screen flex-col">
      {/* SMFS limitation banner */}
      <div className="border-b border-amber-700/40 bg-amber-900/30 px-4 py-2 text-xs text-amber-200">
        <span className="font-semibold">Note:</span> SMFS sync is currently
        limited from Daytona datacenter IPs. Memory operations work locally in
        the sandbox but may not sync to Supermemory cloud. For full sync
        support, see the Research Assistant example which uses{" "}
        <span className="font-mono">@supermemory/bash</span>.
      </div>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Code Sandbox with Memory
          </h1>
          <p className="text-[11px] text-slate-400">
            Edit, run, and debug code in a Daytona sandbox with persistent
            memory.
          </p>
        </div>
        <div className="rounded-full bg-slate-700 px-3 py-1 font-mono text-[11px] text-slate-200">
          {booting
            ? "booting…"
            : sandboxId
              ? `sandbox: ${sandboxId.slice(0, 8)}…`
              : "no sandbox"}
        </div>
      </header>

      {booting && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-300">
            <span className="spinner inline-block h-8 w-8 rounded-full border-4 border-blue-500" />
            <p className="text-sm">Setting up sandbox…</p>
            <p className="text-xs text-slate-500">
              Provisioning Daytona container, installing SMFS, and mounting
              memory.
            </p>
          </div>
        </div>
      )}

      {!booting && bootError && (
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="max-w-md rounded-lg border border-red-700 bg-red-950/40 p-4 text-sm text-red-200">
            <p className="font-semibold">Failed to start sandbox</p>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
              {bootError}
            </pre>
            <p className="mt-3 text-xs text-red-300">
              Make sure DAYTONA_API_KEY, SUPERMEMORY_API_KEY, and
              ANTHROPIC_API_KEY are set in your environment.
            </p>
          </div>
        </div>
      )}

      {!booting && !bootError && (
        <div className="flex flex-1 min-h-0">
          {/* Left + center column: editor on top, output+files row below */}
          <div className="flex flex-1 min-w-0 flex-col gap-2 p-2">
            <div className="min-h-0 flex-1">
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                language={language}
                onLanguageChange={handleLanguageChange}
                onRun={handleRun}
                running={running}
                disabled={!sandboxId}
              />
            </div>
            <div className="flex h-64 min-h-0 gap-2">
              <div className="flex-[2] min-w-0">
                <OutputPanel
                  stdout={stdout}
                  stderr={stderr}
                  exitCode={exitCode}
                  running={running}
                  onClear={handleClear}
                />
              </div>
              <div className="flex-1 min-w-0">
                <FileBrowser sandboxId={sandboxId} />
              </div>
            </div>
          </div>

          {/* Right column: chat */}
          <div
            className={`shrink-0 transition-all ${
              chatCollapsed ? "w-10" : "w-96"
            }`}
          >
            <ChatPanel
              sandboxId={sandboxId}
              collapsed={chatCollapsed}
              onToggle={() => setChatCollapsed((v) => !v)}
            />
          </div>
        </div>
      )}
    </main>
  );
}
