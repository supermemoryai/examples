# Docs Answering Agent

A CLI tool that ingests a folder of markdown docs into a Supermemory container and answers questions about them using semantic search. Built with [`@supermemory/bash`](https://www.npmjs.com/package/@supermemory/bash) and the [Vercel AI SDK](https://sdk.vercel.ai/).

## Prerequisites

- Node.js 18+
- A [Supermemory](https://supermemory.ai/) API key
- An [Anthropic](https://console.anthropic.com/) API key

## Setup

```bash
npm install
cp .env.example .env
# edit .env and fill in SUPERMEMORY_API_KEY and ANTHROPIC_API_KEY
```

## Usage

First, ingest the bundled sample docs into your Supermemory container:

```bash
npx tsx ingest.ts
```

Then ask questions about them:

```bash
npx tsx agent.ts "How do I authenticate?"
```

Add or replace files in `docs/` with your own markdown to query a different docset. Re-run `ingest.ts` after any changes.

## Example output

```
$ npx tsx agent.ts "How do I authenticate?"

Acme API uses bearer token authentication. Every request must include an
Authorization header with your API key:

    Authorization: Bearer ack_live_xxxxxxxxxxxxxxxx

You can create and rotate keys in the dashboard under Settings → API Keys.
There are two key types: `ack_test_*` (sandboxed, free) and `ack_live_*`
(production). Never commit live keys to source control — the SDK reads
ACME_API_KEY from the environment by default.

Source: getting-started.md, "Authentication" section.
```

## How it works

- `ingest.ts` reads each `*.md` file in `docs/` and writes it to `/docs/<filename>` inside a Supermemory container tagged `docs_agent`.
- `agent.ts` hands a single `bash` tool to Claude. The model uses `sgrep` (semantic search) to find relevant pages and `cat` to read them in full, then composes an answer with citations.

The whole filesystem lives in your Supermemory container — no local disk, no vector DB to manage.
