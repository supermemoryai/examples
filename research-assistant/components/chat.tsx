"use client";

import { useEffect, useRef } from "react";
import type { Message as ChatMessage } from "ai";
import { Message } from "./message";

export interface ChatProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export function Chat({ messages, isLoading = false }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
        <div className="mb-2 text-4xl">📚</div>
        <p className="text-sm font-medium">No messages yet</p>
        <p className="mt-1 max-w-sm text-xs">
          Upload some documents above and ask a question. The assistant will
          search them with <span className="font-mono">sgrep</span> and cite
          sources.
        </p>
      </div>
    );
  }

  return (
    <div className="chat-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
            <div className="dot-pulse flex gap-1 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="h-2 w-2 rounded-full bg-slate-400" />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
