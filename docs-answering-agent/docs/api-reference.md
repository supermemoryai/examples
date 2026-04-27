# Acme API Reference

All endpoints are rooted at `https://api.acme.dev/v1` and require a bearer token. Request and response bodies are JSON.

## Create a widget

`POST /widgets`

Creates a new widget in your account.

**Body parameters**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Display name, 1–80 characters. |
| `color` | string | no | One of `red`, `green`, `blue`. Defaults to `blue`. |
| `metadata` | object | no | Arbitrary string-to-string map, up to 16 keys. |

**Response** — `201 Created` with the new widget object: `{ "id": "wgt_...", "name": "...", "color": "...", "created_at": "..." }`.

## List widgets

`GET /widgets`

Returns a paginated list of widgets, newest first.

**Query parameters**

- `limit` (integer, 1–100, default 25)
- `cursor` (string, opaque pagination token)
- `color` (string, filter by color)

**Response** — `200 OK` with `{ "data": [Widget], "next_cursor": string | null }`.

## Get a widget

`GET /widgets/{id}`

Fetches a single widget by ID.

**Response** — `200 OK` with the widget object, or `404 Not Found` if the ID does not exist or belongs to a different account.

## Delete a widget

`DELETE /widgets/{id}`

Permanently deletes a widget. Returns `204 No Content` on success. Deletion is irreversible — there is no soft-delete or trash.

## Errors

Errors are returned as `{ "error": { "code": "...", "message": "..." } }`. Common codes include `invalid_request`, `unauthorized`, `not_found`, and `rate_limited`.
