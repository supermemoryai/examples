# Code Sandbox with Memory

An interactive, browser-based code execution environment. Users write Python or
JavaScript in a VS Code–style editor and run it inside a fresh
[Daytona](https://www.daytona.io/) sandbox that has
[SMFS](https://github.com/supermemoryai/smfs) (the Supermemory Filesystem)
mounted at `/home/daytona/memory/`. An AI assistant in the sidebar can run
shell commands in the sandbox, read from persistent memory, and help debug or
explain code.

## Features

- 📝 VS Code–style editor with line numbers, tab indentation, and a language
  picker (Python / JavaScript).
- ▶️ One-click execution in an isolated Daytona container.
- 🧠 Persistent memory mounted at `/home/daytona/memory/` via SMFS — files
  written there can be inspected from the file browser.
- 🤖 AI assistant (Anthropic Claude) with two tools:
  - `execute_in_sandbox` — runs an arbitrary shell command in your sandbox.
  - `read_memory` — reads any file from `/home/daytona/memory/`.
- 🗂️ Memory file browser with a click-to-view modal.

## Prerequisites

- **Node.js 18+** (Node 20+ recommended)
- A **Daytona** account and API key — <https://app.daytona.io>
- A **Supermemory** API key — <https://supermemory.ai>
- An **Anthropic** API key — <https://console.anthropic.com>

## Setup

```bash
cd code-sandbox
npm install
cp .env.example .env.local
```

Then edit `.env.local` and fill in the three API keys:

```env
SUPERMEMORY_API_KEY=sk_...
ANTHROPIC_API_KEY=sk-ant-...
DAYTONA_API_KEY=dtn_...
```

## Usage

```bash
npm run dev
```

Open <http://localhost:3000>. The page will:

1. Provision a fresh Daytona sandbox (this takes ~10–30s on first boot).
2. Install the SMFS binary in the sandbox.
3. Log in to Supermemory and mount `/home/daytona/memory/`.
4. Show the editor / output / chat layout.

Click **Run** to execute the code in the sandbox. The output panel shows
`stdout` (white) and `stderr` (red) and reports a non-zero exit code at the
bottom. Use the chat sidebar to ask the assistant to inspect files, run shell
commands, or save snippets to memory.

When you close the tab, a `DELETE /api/sandbox?sandboxId=...` request is
fired to clean up the sandbox.

## Architecture

```
┌────────────────┐   POST /api/sandbox    ┌────────────────────────┐
│   Browser UI   │  ────────────────────▶ │   Next.js API routes   │
│                │  POST /api/execute     │                        │
│ - editor       │  POST /api/chat        │  @daytonaio/sdk        │
│ - output       │  GET  /api/files       │  @ai-sdk/anthropic     │
│ - chat         │  ◀──────────────────── │                        │
│ - file browser │                        └──────────┬─────────────┘
└────────────────┘                                   │
                                                     │  REST
                                                     ▼
                                          ┌──────────────────────┐
                                          │   Daytona sandbox    │
                                          │                      │
                                          │  python3 / node      │
                                          │  /home/daytona/      │
                                          │     memory  ◀── SMFS │
                                          │            │  mount  │
                                          └────────────┼─────────┘
                                                       │ HTTPS
                                                       ▼
                                              Supermemory cloud
                                              (containerTag:
                                                 code_sandbox)
```

### Sandbox lifecycle

`app/api/sandbox/route.ts` (POST) does the following:

1. Creates a Daytona sandbox with `SUPERMEMORY_API_KEY` injected.
2. Downloads the SMFS binary:

   ```bash
   curl -sL https://github.com/supermemoryai/smfs/releases/download/v0.0.1-rc2/smfs-linux-x64 \
     -o $HOME/.local/bin/smfs && chmod +x $HOME/.local/bin/smfs
   ```

3. Logs in: `smfs login --key $SUPERMEMORY_API_KEY`.
4. Mounts the FS in the background:

   ```bash
   smfs mount code_sandbox --ephemeral --path /home/daytona/memory --foreground &
   ```

5. Returns the sandbox ID so the frontend can keep talking to the same
   container for execution and chat.

### Code execution

`app/api/execute/route.ts` writes the editor contents to `/tmp/run_*.{py,js}`
inside the sandbox via a single-quoted heredoc, then runs `python3` or `node`.
Stdout, stderr, and exit code are returned to the client.

### AI chat

`app/api/chat/route.ts` uses the Vercel AI SDK's `streamText` with two tools.
Both tools shell out to the same Daytona sandbox the user is editing in, so
the assistant can `ls`, `cat`, `pip install`, or write files into memory in
real time.

## Known limitations

> **SMFS sync from Daytona datacenter IPs is currently limited.** The mount
> works locally inside the sandbox — you can `cat`, `ls`, and write files
> against `/home/daytona/memory/` — but those operations may not propagate
> to the Supermemory cloud from Daytona's egress IPs.
>
> If you need full bidirectional sync (e.g. memories written here showing up
> in your Supermemory dashboard or in another app), prefer the
> **Research Assistant** example, which uses `@supermemory/bash` and runs the
> SMFS process locally.

Other limitations:

- Each browser session creates its own sandbox; nothing is shared between
  users by default.
- Sandbox cleanup uses `beforeunload` + `fetch(..., { keepalive: true })`,
  which is best-effort. Long-lived sandboxes may need to be cleaned up
  manually from the Daytona dashboard.
- Code execution has no timeout enforcement at the Next.js layer beyond
  `maxDuration = 60`. Long-running scripts will be killed by the route
  handler timeout.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router, React 19)
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/postcss`)
- [`@daytonaio/sdk`](https://www.npmjs.com/package/@daytonaio/sdk) — sandbox
  management
- [SMFS](https://github.com/supermemoryai/smfs) — Supermemory Filesystem,
  installed inside the sandbox
- [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`, `@ai-sdk/anthropic`,
  `@ai-sdk/react`)
- [Anthropic Claude](https://www.anthropic.com/) (`claude-sonnet-4-20250514`)
- [Zod](https://zod.dev/) for tool input validation

## Project layout

```
code-sandbox/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # streaming AI chat with sandbox tools
│   │   ├── execute/route.ts    # run code in the Daytona sandbox
│   │   ├── files/route.ts      # list / read /home/daytona/memory/
│   │   └── sandbox/route.ts    # create / delete sandbox
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # 3-panel UI: editor, output+files, chat
└── components/
    ├── chat-panel.tsx
    ├── code-editor.tsx
    ├── file-browser.tsx
    └── output-panel.tsx
```
