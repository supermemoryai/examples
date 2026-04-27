# Customer Support Agent

A CLI support agent that gives each customer their own memory. It reads the customer's history (past tickets, account notes) from a per-customer Supermemory container and drafts a response that references prior interactions.

## Key concept: per-customer containers

Each customer gets their own container tag: `support_<customer_id>`. When the agent runs for `acme_corp`, it only sees `acme_corp`'s tickets and notes — never another customer's. This is how you scope memory per user/tenant with Supermemory.

## Prerequisites

- Python 3.10+
- A [Supermemory](https://supermemory.ai) API key
- An [Anthropic](https://console.anthropic.com) API key

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# edit .env and fill in your API keys
```

## Usage

Seed two sample customer containers:

```bash
python seed.py
```

Run the agent for a specific customer with a new ticket:

```bash
python agent.py acme_corp "I'm having billing issues again"
python agent.py startup_xyz "Webhooks stopped firing this morning"
```

## Example output

```
$ python agent.py acme_corp "I'm having billing issues again"

Customer: acme_corp
Ticket: I'm having billing issues again

  > cat /profile.md
  > sgrep "billing" /tickets
  > cat /tickets/2024-01-billing.md
  > cat /tickets/2024-06-billing.md
  > cat > /tickets/2024-XX-billing.md <<'EOF' ...

Response:
Hi Jane,

Thanks for reaching out again. I see we've worked through billing
questions with Acme twice before — the January dispute (resolved
with a $1,200 credit) and the June pro-rata charge question. To
help quickly this time, could you share the invoice number or the
charge you're seeing? Given your Enterprise plan with 50 seats,
I'll loop in your account manager if it looks like another
proration issue...
```

The agent uses `sgrep` for semantic search across the customer's container, `cat` to read individual ticket files, and writes the new ticket back to `/tickets/` so future interactions have it as context.
