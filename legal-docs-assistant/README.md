# Legal Docs Assistant

A CLI agent that ingests legal documents into a Supermemory container and
answers natural-language questions about them using semantic search.

## What it does

`ingest.py` uploads the contracts in `docs/` into a `legal_docs` Supermemory
container. `agent.py` runs a Claude agent loop with `supermemory-bash` as a
tool — the model uses `sgrep` to semantically search across the ingested
contracts and `cat` to read the relevant documents in full before answering.

## Prerequisites

- Python 3.10+
- A Supermemory API key (`sm-...`)
- An Anthropic API key (`sk-ant-...`)

## Setup

```bash
cd legal-docs-assistant
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and fill in SUPERMEMORY_API_KEY and ANTHROPIC_API_KEY
```

## Usage

Ingest the sample contracts (one-time, or whenever `docs/` changes):

```bash
python ingest.py
```

Ask a question:

```bash
python agent.py "What are the termination clauses?"
```

You can also drop the question and be prompted:

```bash
python agent.py
Question: What is the liability cap in the service agreement?
```

## Example output

```
$ python agent.py "What are the termination clauses?"

Question: What are the termination clauses?

  > sgrep "termination clause" /contracts
  > cat /contracts/service-agreement.txt
  > cat /contracts/employment-contract.txt
  > cat /contracts/nda-template.txt

Answer:
Across the three contracts in /contracts, termination is handled as follows:

1. SaaS Service Agreement (service-agreement.txt, Section 5 "Term and
   Termination") — 12-month initial term with auto-renewal; either party
   may opt out with 30 days' written notice. Either party may terminate
   for material breach uncured after 30 days. Provider may suspend
   immediately for payment >15 days past due.

2. Employment Agreement (employment-contract.txt, Section 6 "Termination")
   — at-will; either party may terminate any time. Termination without
   cause entitles employee to 3 months' severance subject to a release
   of claims.

3. Mutual NDA (nda-template.txt, Section 4 "Term") — 2-year term, with
   confidentiality obligations surviving 5 years post-disclosure
   (indefinite for trade secrets).
```

## Files

- `ingest.py` — uploads `docs/*.txt` into the `legal_docs` container at `/contracts/<filename>`
- `agent.py` — Anthropic agent loop using `supermemory-bash` as a tool
- `docs/` — sample contract templates (NDA, SaaS service agreement, employment agreement)

The sample contracts in `docs/` are illustrative templates only and are not
legal advice.
