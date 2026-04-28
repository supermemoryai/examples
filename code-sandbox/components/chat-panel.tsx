"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import type { Message as ChatMessage } from "ai";

interface ToolInvocationLike {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  state?: string;
  result?: unknown;
}

function ToolCallBlock({ invocation }: { invocation: ToolInvocationLike }) {
  const [open, setOpen] = useState(false);
  const args = invocation.args as { command?: string; path?: string } | undefined;
  const summary =
    args?.command ?? (args?.path ? `read: ${args.path}` : "");
  const result =
    typeof invocation.result === "string"
      ? invocation.result
      : invocation.result !== undefined
        ? JSON.stringify(invocation.result, null, 2)
        : "";
  const running = invocation.state !== "result";

  return (
    <div className="my-1 overflow-hidden rounded-md border border-slate-700 bg-slate-900 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-800"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-blue-400">
            {invocation.toolName}
          </span>
          <span className="truncate font-mono text-slate-300">
            {summary || "(no args)"}
          </span>
        </span>
        <span className="flex items-center gap-2 text-slate-500">
          {running && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
              running
            </span>
          )}
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-700 bg-slate-950 px-3 py-2">
          {summary && (
            <>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Args
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-300">
                {summary}
              </pre>
            </>
          )}
          {result && (
            <>
              <div className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Output
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-black p-2 font-mono text-xs text-slate-100">
                {result || "(no output)"}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MessageView({ message }: { message: ChatMessage }) {
  const role = message.role;
  const parts = message.parts as
    | { type: string; text?: string; toolInvocation?: ToolInvocationLike }[]
    | undefined;

  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isUser
            ? "rounded-br-sm bg-blue-600 text-white"
            : "rounded-bl-sm bg-slate-800 text-slate-100 ring-1 ring-slate-700"
        }`}
      >
        {parts && parts.length > 0 ? (
          <div className="space-y-1">
            {parts.map((p, i) => {
              if (p.type === "text") {
                return (
                  <div
                    key={i}
                    className="whitespace-pre-wrap break-words"
                  >
                    {p.text}
                  </div>
                );
              }
              if (p.type === "tool-invocation" && p.toolInvocation) {
                return (
                  <ToolCallBlock
                    key={p.toolInvocation.toolCallId}
                    invocation={p.toolInvocation}
                  />
                );
              }
              return null;
            })}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ChatPanelProps {
  sandboxId: string | null;
  collapsed: boolean;
  onToggle: () => void;
}

export function ChatPanel({ sandboxId, collapsed, onToggle }: ChatPanelProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      body: { sandboxId },
    });

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-l border-slate-700 bg-slate-900">
        <button
          type="button"
          onClick={onToggle}
          className="mt-3 rounded-md border border-slate-700 bg-slate-800 px-2 py-3 text-xs text-slate-300 hover:bg-slate-700"
          title="Show chat"
        >
          ◀<br />A<br />I
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-l border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          AI Assistant
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
          title="Hide chat"
        >
          ▶
        </button>
      </div>

      <div className="chat-scroll flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <div className="mb-2 text-3xl">💬</div>
            <p className="text-sm font-medium">Ask the assistant anything</p>
            <p className="mt-1 max-w-xs text-xs">
              The assistant can run shell commands in your sandbox and read
              files from persistent memory at{" "}
              <span className="font-mono">/home/user/memory/</span>.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <MessageView key={m.id} message={m} />
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-3 ring-1 ring-slate-700">
              <div className="dot-pulse flex gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="h-2 w-2 rounded-full bg-slate-400" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-700 bg-slate-900 p-2"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !isLoading && sandboxId) {
                  e.currentTarget.form?.requestSubmit();
                }
              }
            }}
            rows={2}
            placeholder={
              sandboxId ? "Ask the assistant…" : "Waiting for sandbox…"
            }
            disabled={!sandboxId || isLoading}
            className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!sandboxId || isLoading || !input.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {isLoading ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
