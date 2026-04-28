import asyncio
import os
import shlex

from dotenv import load_dotenv

from supermemory_bash import create_bash


CUSTOMERS = {
    "acme_corp": {
        "/notes/account.md": """# Acme Corp — Account Notes

- Plan: Enterprise (50 seats)
- Primary contact: Jane Doe (jane@acme.example)
- Account manager: Priya
- Renewal: 2025-02-01
- Notes: Large legal team, sensitive to billing surprises. Prefers
  email over phone. Has SSO enabled (Okta).
""",
        "/tickets/2024-01-billing.md": """# Ticket — 2024-01-12 — Billing dispute

Reporter: Jane Doe
Status: Resolved

Jane flagged that the December invoice was $1,200 higher than
expected. Investigation showed seat count had been miscounted
during a mid-month upgrade. Issued a $1,200 credit to the next
invoice and confirmed the seat reconciliation logic was fixed
on our side. Jane was satisfied with the resolution.
""",
        "/tickets/2024-03-feature-request.md": """# Ticket — 2024-03-04 — Feature request: bulk export

Reporter: Jane Doe
Status: Logged to roadmap

Acme's compliance team needs to export all audit logs for a
given quarter as a single CSV. Current UI only supports per-day
export. Logged as FR-482 and shared with product. ETA Q3.
Jane acknowledged and will check back in June.
""",
        "/tickets/2024-06-billing.md": """# Ticket — 2024-06-18 — Pro-rata charge question

Reporter: Jane Doe
Status: Resolved

Jane asked why the June invoice included a $340 pro-rata line
item. Explained: 4 seats were added on June 6, billed for the
remaining 24 days of the cycle. Walked through the calculation
and pointed Jane to the seat-changes audit page. No credit
needed — charge was correct. Jane confirmed understanding.
""",
    },
    "startup_xyz": {
        "/notes/account.md": """# Startup XYZ — Account Notes

- Plan: Startup (5 seats)
- Primary contact: Alex Kim (alex@startupxyz.example)
- Signed up: 2024-02-01
- Notes: Two-person eng team, very hands-on. Building on our API.
  Slack-connected (#startup-xyz-support).
""",
        "/tickets/2024-02-onboarding.md": """# Ticket — 2024-02-03 — Initial setup help

Reporter: Alex Kim
Status: Resolved

Walked Alex through workspace creation, inviting their cofounder,
and generating their first API key. Shared the quickstart doc
and the rate-limit reference. Alex was up and running in ~30
minutes. Suggested they enable webhooks once they're ready.
""",
        "/tickets/2024-04-api-integration.md": """# Ticket — 2024-04-22 — Webhook configuration issues

Reporter: Alex Kim
Status: Resolved

Alex's webhook endpoint was returning 401s for our delivery
attempts. Root cause: their middleware was rejecting requests
without a custom auth header. Pointed Alex at our signing-secret
verification doc instead, and they switched to HMAC verification.
Webhooks delivering reliably since. Suggested enabling delivery
retries in their dashboard.
""",
    },
}


async def seed_customer(customer_id: str, files: dict[str, str]) -> None:
    container_tag = f"support_{customer_id}"
    print(f"\nSeeding container: {container_tag}")

    result = await create_bash(
        api_key=os.environ["SUPERMEMORY_API_KEY"],
        container_tag=container_tag,
    )
    bash = result.bash

    for path, content in files.items():
        parent = path.rsplit("/", 1)[0] or "/"
        await bash.exec(f"mkdir -p {shlex.quote(parent)}")
        cmd = f"cat > {shlex.quote(path)} <<'__SM_EOF__'\n{content}\n__SM_EOF__"
        r = await bash.exec(cmd)
        if r.exit_code != 0:
            print(f"  FAILED {path}: {r.stderr}")
            continue
        print(f"  wrote {path} ({len(content)} bytes)")

    listing = await bash.exec("ls -R /tickets /notes")
    print(listing.stdout)


async def main() -> None:
    load_dotenv()
    for customer_id, files in CUSTOMERS.items():
        await seed_customer(customer_id, files)


if __name__ == "__main__":
    asyncio.run(main())
