# Personal Knowledge Base

A minimal note-taking web app with an AI chat that can search across your
notes. Notes live in a [Supermemory bash](https://supermemory.ai) sandbox
under `/notes/`, so the same `sgrep` / `cat` / `ls` tooling powering the
agent's search is what stores your data — no separate database, no
embeddings setup.

## Features

- 📝 Add, browse, view, and delete markdown notes from the sidebar.
- 💬 Chat with Claude, which has a `bash` tool wired to your notes
  directory and can semantically search them with `sgrep`.
- 📡 Streaming responses over Server-Sent Events with live tool-call
  blocks so you can see what the assistant is doing.
- 🪶 Pure HTML / CSS / vanilla JS frontend — no build step.

## Prerequisites

- Python 3.10+
- A [Supermemory](https://supermemory.ai) API key
- An [Anthropic](https://console.anthropic.com) API key

## Setup

```bash
cd examples/knowledge-base

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# then edit .env and fill in your two API keys
```

## Usage

```bash
python server.py
```

Then open <http://localhost:8000> in your browser.

1. Click **+ Add Note** in the sidebar to create a few notes (markdown
   is fine — the title becomes `/notes/<title>.md`).
2. Type a question in the chat. The assistant will call the `bash`
   tool, run `sgrep` / `cat` against `/notes/`, and stream back an
   answer that cites the source note(s).

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  Browser (vanilla JS)   │ <──SSE─ │  FastAPI server         │
│  - notes sidebar        │ ──HTTP─►│  - /api/notes CRUD      │
│  - chat + tool blocks   │         │  - /api/chat (stream)   │
└─────────────────────────┘         └────────────┬────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────┐
                                  │ supermemory_bash sandbox │
                                  │  /notes/*.md             │
                                  │  + sgrep / cat / ls      │
                                  └──────────────────────────┘
                                                 ▲
                                                 │ tool_use
                                  ┌──────────────┴───────────┐
                                  │ Anthropic Claude         │
                                  │ (agent loop, ≤10 steps)  │
                                  └──────────────────────────┘
```

- `server.py` exposes the REST + SSE API and serves `static/`.
- Each request creates a fresh bash instance scoped to the
  `knowledge_base` container tag, so all notes live in a single
  persistent sandbox keyed by that tag.
- The chat endpoint streams Claude's text and tool-use events as SSE
  so the UI can render them progressively.

## Tech stack

- [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/)
- [supermemory-bash](https://pypi.org/project/supermemory-bash/)
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python)
  (Claude Sonnet 4)
- Vanilla HTML / CSS / JavaScript (no build step)

## Notes

- Slashes in note titles are replaced with `_` so the path stays a
  single file under `/notes/`.
- The agent loop is capped at 10 iterations per chat turn.
- Conversation history is kept client-side and sent with every
  request; refreshing the page starts a new conversation but your
  notes persist in the sandbox.
