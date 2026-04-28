# Research Assistant

A polished, chat-based research assistant built with Next.js, the Vercel AI SDK, and [`@supermemory/bash`](https://www.npmjs.com/package/@supermemory/bash). Upload `.txt` or `.md` documents, and chat with Claude — it searches your documents with `sgrep`, reads them with `cat`, and cites the source for every answer.

## Features

- 📥 Drag-and-drop file upload (`.txt`, `.md`)
- 💬 Streaming chat UI with auto-scroll
- 🛠️ Collapsible tool-call inspector — see exactly what `bash` commands the model ran and what came back
- 🔍 Documents are stored in a Supermemory bash sandbox under `/documents/` and searched with `sgrep`
- 🎯 Every answer cites the source document and section

## Prerequisites

- Node.js 18 or newer
- A Supermemory API key — get one at [supermemory.ai](https://supermemory.ai)
- An Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your keys
cp .env.example .env
# then edit .env and set:
#   SUPERMEMORY_API_KEY=...
#   ANTHROPIC_API_KEY=...
```

## Usage

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000):

1. Drop a few `.txt` / `.md` files onto the upload zone (or click to browse).
2. Wait for the "Ingested N file(s)" confirmation in the chat.
3. Ask questions about your documents — for example:
   - *"Summarize the main argument in chapter 2."*
   - *"Which document mentions our refund policy and what does it say?"*
   - *"Find every reference to GDPR and list them by file."*

The assistant will run `sgrep` / `cat` / `ls` commands inside the Supermemory bash sandbox. Click any tool-call in the transcript to expand it and see the exact command and stdout.

## Architecture

```
┌──────────────────┐         ┌─────────────────────┐         ┌────────────────────┐
│  Browser (chat   │  POST   │  Next.js API routes │  exec   │  @supermemory/bash │
│  + file uploads) │ ─────►  │  /api/ingest        │ ──────► │  sandbox           │
│                  │         │  /api/chat (stream) │         │  /documents/       │
└──────────────────┘ ◄─────  └─────────────────────┘ ◄────── └────────────────────┘
                       SSE / JSON          stdout/stderr
```

1. **Ingest (`/api/ingest`)** — Accepts `multipart/form-data`. For each file, it opens a bash sandbox tagged `research`, then writes the content to `/documents/<filename>` using a heredoc (`cat > … << '__SM_EOF__' …`).
2. **Chat (`/api/chat`)** — Uses Anthropic Claude via the AI SDK with a single `bash` tool wired up through `createBash({ containerTag: "research" })`. The system prompt instructs the model to use `sgrep`, `cat`, and `ls /documents/` and to cite sources. Responses stream back as a Vercel AI SDK Data Stream.
3. **UI** — A `useChat` hook drives the chat. Tool invocations are rendered as collapsible blocks so users can inspect every command and its output.

The same `containerTag` (`"research"`) is used by both routes so ingested files are visible to the chat sandbox.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/) (`@import "tailwindcss"`)
- [Vercel AI SDK (`ai`)](https://sdk.vercel.ai/) + [`@ai-sdk/react`](https://www.npmjs.com/package/@ai-sdk/react) + [`@ai-sdk/anthropic`](https://www.npmjs.com/package/@ai-sdk/anthropic)
- [`@supermemory/bash`](https://www.npmjs.com/package/@supermemory/bash) — sandboxed bash with `sgrep` and friends
- [Zod](https://zod.dev/) for tool input validation

## Project layout

```
research-assistant/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Streaming chat endpoint
│   │   └── ingest/route.ts    # Multipart upload → /documents/
│   ├── globals.css            # Tailwind v4 entry
│   ├── layout.tsx
│   └── page.tsx               # Main UI: upload zone + chat
├── components/
│   ├── chat.tsx               # Message list + auto-scroll + streaming dots
│   ├── file-upload.tsx        # Drag-and-drop upload zone
│   └── message.tsx            # Per-message rendering + collapsible tool calls
├── .env.example
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## Notes

- This example uses Tailwind CSS **v4**. Styles are imported via `@import "tailwindcss"` in `app/globals.css`, not the legacy `@tailwind base/components/utilities` directives.
- Files are stored in a per-`containerTag` sandbox. If you want clean isolation per session/user, change `CONTAINER_TAG` in `app/page.tsx` (and pass a matching tag to `/api/ingest`).
- Only `.txt` and `.md` files are accepted by the upload zone; you can extend `ACCEPTED_EXTENSIONS` in `components/file-upload.tsx`.
