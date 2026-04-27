# Frequently Asked Questions

## How do I get an API key?

Sign in to the Acme dashboard and open **Settings → API Keys**. Click **Create key**, give it a name, and choose between a test key (`ack_test_*`) and a live key (`ack_live_*`). Test keys are free and never bill your account.

## What are the rate limits?

Test keys are limited to 60 requests per minute. Live keys default to 600 requests per minute, with burst capacity up to 1,000. If you exceed your limit you'll receive a `429 Too Many Requests` response with a `Retry-After` header indicating how many seconds to wait. Contact support to request a higher limit.

## Can I use the API from the browser?

We don't recommend it. API keys grant full access to your account and should never ship to end-user devices. Instead, proxy requests through your backend or issue short-lived scoped tokens via the `/auth/tokens` endpoint.

## Is there a webhooks system?

Yes. Configure webhook URLs under **Settings → Webhooks**. Acme will POST a signed JSON payload whenever a widget is created, updated, or deleted. Verify the `Acme-Signature` header using your webhook secret before trusting the body.

## What's the SLA?

Live API traffic is covered by a 99.9% monthly uptime SLA on Pro and Enterprise plans. The free tier has no SLA but typically tracks the same availability. Status and incident history live at `https://status.acme.dev`.

## How do I delete my account?

Email `support@acme.dev` from the address on file. Account deletion permanently removes all widgets, API keys, and webhook configurations after a 7-day grace period. You can cancel the deletion any time during the grace period by signing back in.
