# Getting Started with Acme API

Acme API is a JSON-over-HTTPS service for managing widgets in your account. This guide walks you through installing the SDK, authenticating, and making your first request.

## Installation

The official Node.js client is published on npm:

```bash
npm install @acme/sdk
```

Python users can install with pip:

```bash
pip install acme-sdk
```

You can also call the API directly with `curl` or any HTTP client. The base URL for all requests is:

```
https://api.acme.dev/v1
```

## Authentication

Acme API uses bearer token authentication. Every request must include an `Authorization` header with your API key:

```
Authorization: Bearer ack_live_xxxxxxxxxxxxxxxx
```

You can create and rotate API keys in the dashboard under **Settings → API Keys**. Keys come in two flavors:

- `ack_test_*` — sandboxed, no real side effects, free of charge.
- `ack_live_*` — production, billed against your account.

Never commit live keys to source control. The SDK reads `ACME_API_KEY` from the environment by default.

## Your First Request

Once you have a key exported, list your widgets:

```bash
curl https://api.acme.dev/v1/widgets \
  -H "Authorization: Bearer $ACME_API_KEY"
```

A successful response returns HTTP 200 with a JSON body of the form `{ "data": [...], "next_cursor": null }`. If you see a `401 Unauthorized`, double-check the header format — the word `Bearer` is required.

Next, head over to the API reference to see the full set of endpoints.
