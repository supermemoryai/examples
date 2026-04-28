# Supermemory Examples

Example apps built with [Supermemory](https://supermemory.ai) and [SMFS](https://docs.supermemory.ai/smfs/overview). Each example is a standalone, runnable project you can clone and try.

| Example | Description | Stack |
|---------|-------------|-------|
| [Legal Docs Assistant](./legal-docs-assistant) | Ingest contracts, query them with semantic search | Python, `supermemory-bash`, Anthropic SDK |
| [Docs Answering Agent](./docs-answering-agent) | Ingest documentation, answer questions about it | TypeScript, `@supermemory/bash`, Vercel AI SDK |
| [Customer Support Agent](./customer-support-agent) | Per-customer memory for support ticket drafting | Python, `supermemory-bash`, Anthropic SDK |

## Getting started

1. Get a [Supermemory API key](https://supermemory.ai)
2. Get an [Anthropic API key](https://console.anthropic.com)
3. Pick an example, follow its README

## How SMFS works

SMFS gives your agent a filesystem backed by Supermemory. The agent uses standard bash commands (`ls`, `cat`, `echo`, `grep`) to read and write files. Writes sync to Supermemory automatically. `sgrep` does semantic search across all files.

Two flavors:

- **Mount** (`smfs` binary) — real FUSE/NFS mount for agents with filesystem access
- **Bash Tool** (`@supermemory/bash` / `supermemory-bash`) — virtual bash for serverless and edge runtimes

These examples use the Bash Tool. See the [SMFS docs](https://docs.supermemory.ai/smfs/overview) for the full picture.
