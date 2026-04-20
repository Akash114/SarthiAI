# Public API contracts

| Artifact | Description |
| --- | --- |
| [openapi.yaml](openapi.yaml) | OpenAPI **3.1** description of all public `/v1` HTTP endpoints and schemas |

## Conventions

- **Servers:** The spec uses templated `servers[0].url` variables (`scheme`, `host`) so environments do not embed forbidden placeholder hosts in lint tooling. Set `host` to your real API hostname in clients and docs.
- **Versioning:** All paths in this file are prefixed `/v1`. Breaking changes require a new major API version (e.g. `/v2`) or additive-only evolution policy documented in the OpenAPI `info.description` changelog section.
- **Auth:** HTTP bearer JWT (`Authorization: Bearer …`) unless explicitly marked `security: []` on an operation.
- **Idempotency:** Mutations that enqueue or finalize side effects accept optional `Idempotency-Key` header; see individual operations.
- **Pagination:** Cursor-based list endpoints use `cursor` + `limit` query parameters and return `next_cursor` in the payload where applicable.

### Validate the spec (recommended)

Avoid bare `npx @redocly/cli …` on every run: it **re-downloads** the CLI and often looks slow or “stuck” behind network or sandbox limits. Use the pinned workspace instead:

```bash
cd tooling/openapi && npm ci && npm run lint
```

From the repo root after a one-time `npm ci` in `tooling/openapi/`, you can also run:

```bash
./tooling/openapi/node_modules/.bin/redocly lint docs/contracts/openapi.yaml
```

Configuration lives in [redocly.yaml](../../redocly.yaml) at the repository root (extends `recommended`).
