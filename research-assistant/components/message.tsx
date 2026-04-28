"use client";

import { useState } from "react";
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
  const args = invocation.args as { cmd?: string } | undefined;
  const cmd = args?.cmd ?? "";
  const result =
    typeof invocation.result === "string"
      ? invocation.result
      : invocation.result !== undefined
        ? JSON.stringify(invocation.result, null, 2)
        : "";
  const running = invocation.state !== "result";

  return (
    <div className="my-1 overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100"
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {invocation.toolName}
          </span>
          <span className="truncate font-mono text-slate-700">
            {cmd || "(no command)"}
          </span>
        </span>
        <span className="flex items-center gap-2 text-slate-500">
          {running && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              running
            </span>
          )}
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-200 bg-white px-3 py-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Command
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-800">
            {cmd}
          </pre>
          {result !== "" && (
            <>
              <div className="mt-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Output
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-900 p-2 font-mono text-xs text-slate-100">
                {result || "(no output)"}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Message({ message }: { message: ChatMessage }) {
  const role = message.role;
  // Newer ai versions expose `parts`; older expose `content` + `toolInvocations`.
  // Handle both gracefully.
  const parts:
    | { type: string; text?: string; toolInvocation?: ToolInvocationLike }[]
    | undefined = (
    message as unknown as {
      parts?: {
        type: string;
        text?: string;
        toolInvocation?: ToolInvocationLike;
      }[];
    }
  ).parts;
  const toolInvocations: ToolInvocationLike[] | undefined = (
    message as unknown as { toolInvocations?: ToolInvocationLike[] }
  ).toolInvocations;

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (role === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200">
          {parts && parts.length > 0 ? (
            <div className="space-y-2">
              {parts.map((part, idx) => {
                if (part.type === "text") {
                  return (
                    <div
                      key={idx}
                      className="whitespace-pre-wrap leading-relaxed"
                    >
                      {part.text}
                    </div>
                  );
                }
                if (part.type === "tool-invocation" && part.toolInvocation) {
                  return (
                    <ToolCallBlock
                      key={part.toolInvocation.toolCallId || idx}
                      invocation={part.toolInvocation}
                    />
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <>
              {message.content && (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </div>
              )}
              {toolInvocations?.map((inv) => (
                <ToolCallBlock key={inv.toolCallId} invocation={inv} />
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // Fallback (system, data, etc.)
  return (
    <div className="flex justify-center">
      <div className="rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-500">
        {message.content}
      </div>
    </div>
  );
}
