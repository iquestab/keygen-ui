# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Keygen-UI is a Next.js dashboard for administering a [Keygen](https://keygen.sh) licensing server — licenses, machines, products, policies, packages, releases, artifacts, channels, groups, entitlements, webhooks, and users.

See also `AGENTS.md` (agent index) and `docs/` (`project-documentation.md`, `implementation-plan.md`, `keygen-api-configuration.md`). Note that parts of `docs/` and `README.md` have drifted from the code — prefer the source when they disagree.

## Commands

**PNPM only — never npm or yarn.**

```bash
pnpm dev            # Dev server (Turbopack) on :3000
pnpm build          # Production build (Turbopack, standalone output)
pnpm start          # Serve the production build
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit

npx shadcn@latest add <component>   # Install UI components (New York style, → src/components/ui/)
```

There is no test framework. `scripts/` holds ad-hoc integration probes run against a live Keygen instance; they are excluded from both `tsconfig.json` and ESLint:

```bash
pnpm tsx scripts/test-keygen-auth.ts   # Verify credentials/account against the API
pnpm tsx scripts/test-api-client.ts    # Exercise the KeygenClient end to end
```

Both read `.env.local` and additionally need `KEYGEN_ADMIN_EMAIL` / `KEYGEN_ADMIN_PASSWORD`.

## Environment

```env
NEXT_PUBLIC_KEYGEN_API_URL=https://your-keygen-host.com/v1   # required, must include /v1
NEXT_PUBLIC_KEYGEN_ACCOUNT_ID=                               # required unless singleplayer
NEXT_PUBLIC_KEYGEN_SINGLEPLAYER=true                         # Keygen CE: drops /accounts/{id} from paths
```

These are `NEXT_PUBLIC_*` and read at module scope, so Docker builds must pass them as `--build-arg` (see `Dockerfile`) — they are baked in at build time, not read at container start.

## Architecture

### The request path is the thing to understand first

A browser API call never talks to Keygen directly. It goes:

```
Component → getKeygenApi() → KeygenClient.request()
    → /api/keygen/<path>            (src/app/api/keygen/[...path]/route.ts)
        → fetchKeygen()             (src/lib/server/keygen-fetch.ts)
            → https://keygen-host/v1/<path>
```

Three pieces make this work, and changes usually need to touch more than one:

1. **`KeygenClient.buildUrl()`** (`src/lib/api/client.ts`) is dual-mode. In the browser it rewrites every endpoint onto the `/api/keygen` proxy; on the server it hits `apiUrl` directly. It also injects the `/accounts/{accountId}` prefix unless `singleplayer` is set. Endpoints therefore come in three shapes — relative (`'licenses'`), account-scoped absolute (`'/tokens'`), and fully absolute (`'/v1/...'`) — each handled differently. Resource classes are inconsistent about which they use; both `'licenses'` and `'/artifacts'` appear and both work.

2. **The proxy route** validates against `ALLOWED_PATH_SEGMENTS` — a hardcoded allowlist of first path segments. **Adding a new Keygen resource requires adding its segment here**, or every request 400s with "Invalid API path". This has bitten the repo before (see the `search` segment fix in git history). The proxy forwards an incoming `Authorization` header when present (login sends Basic auth), otherwise falls back to the `keygen_session` httpOnly cookie.

3. **`fetchKeygen()`** wraps `node-fetch` with a pinned `https.Agent` because Node's global `fetch` hits TLS errors against some Keygen hosts. Server-side Keygen calls should go through it rather than bare `fetch`.

### Authentication

Token lives in an **httpOnly cookie** (`keygen_session`), not localStorage:

- `AuthProvider` (`src/lib/auth/context.tsx`) calls `api.authenticate(email, password)`, which POSTs Basic-auth credentials to `/tokens` through the proxy.
- The returned token is POSTed to `/api/auth/token`, which stores it httpOnly (7 days). It is also set on the in-memory client for the current tab's calls.
- On mount, `checkAuth()` asks `/api/auth/token` whether a cookie exists (never receiving the value), then validates via `/api/auth/me` — a server route that reads the cookie and proxies `/me` so the token never reaches JS.
- `<ProtectedRoute>` (optionally `requireAdmin`) wraps every dashboard page's content; pages themselves are thin server components.
- After a full page reload the httpOnly cookie authenticates proxied requests, but the in-memory `KeygenClient` has no token — the proxy's cookie fallback is what keeps things working.

`src/proxy.ts` is the Next.js 16 proxy (formerly middleware) and only sets security headers (CSP, HSTS, frame options). It does no auth.

### Error handling — errors are plain objects, not `Error` instances

`KeygenClient.request()` throws structured **object literals** typed as `KeygenApiError` / `NetworkError` / `AuthError` / `ParseError` (`src/lib/types/errors.ts`). `err instanceof Error` is false for all of them and `console.error` serializes them poorly. Never inspect these by hand:

```typescript
import { handleLoadError, handleCrudError, handleFormError } from '@/lib/utils/error-handling'

try {
  const response = await api.licenses.list({ page: { size: 25, number: 1 } })
  setLicenses(response.data || [])
} catch (error: unknown) {
  handleLoadError(error, 'licenses')
}
```

`error-handling.ts` maps status codes to toasts and accepts `onNotFound` / `onValidation` / `onForbidden` callbacks; `error-guards.ts` holds the type guards and message extraction (including flattening JSON:API `source.pointer` into "Duration: must be…"). Note `shouldShowToast()` suppresses toasts for 401 and validation errors on purpose — form code is expected to surface those inline.

### API layer

`src/lib/api/index.ts` composes one resource class per Keygen entity onto a singleton `KeygenApi`. Adding a resource means: a class in `src/lib/api/resources/`, a field + constructor line + re-export in `index.ts`, and the allowlist entry in the proxy route.

Query-param serialization in `request()` follows Rails conventions and is load-bearing: nested objects become `page[size]=25`, and arrays become repeated `roles[]=admin` — a bare repeated key gets collapsed to its last value by this API.

Pagination is `{ page: { size, number } }` (`PaginationOptions`); `limit` is also accepted for simple lists. `KeygenListResponse.meta` carries the total count that `<PaginationControls>` needs.

### Artifact upload (three-legged, deliberately unusual)

`POST /artifacts` makes Keygen answer with a **307 to a pre-signed S3 URL** instead of a JSON body. Browsers can't read `Location` off a cross-origin redirect, so the proxy special-cases this path with `redirect: 'manual'` and converts it into a normal `200 { meta: { uploadUrl } }`. `ArtifactResource.create()` returns that URL, and `uploadArtifactFile()` (`src/lib/api/upload.ts`) PUTs the bytes **directly to S3, bypassing the proxy** — replaying our `Authorization` header there makes S3 reject the request. It uses `XMLHttpRequest` because only XHR exposes upload progress.

### Search

Free-text search is `POST /search` (`SearchResource`) with `meta.type` / `meta.query` / `meta.op`, not a list filter. Management components toggle between list mode and search mode (`isSearchMode`) depending on the debounced input; searchable fields differ per resource type.

### UI conventions

Routes live under the `(dashboard)` route group, so paths are top-level: `/licenses`, `/machines`, `/releases/[id]` — **not** `/dashboard/licenses`. Only the overview page is at `/dashboard`. Nav entries live in `src/components/app-sidebar.tsx`.

Each feature folder under `src/components/<feature>/` follows the same shape: a `<feature>-management.tsx` container (data fetching, table, filters, pagination, dialog state) plus sibling `create-`/`edit-`/`delete-`/`-details` dialogs. Copy the nearest existing feature rather than inventing a new layout.

Data fetching is plain `useState` + `useEffect` + `useCallback`. There is **no SWR, React Query, or global store**, despite what `docs/` claims — a mutation refreshes by re-invoking the loader passed down as `onXChanged`.

Shared building blocks worth reusing: `shared/pagination-controls.tsx`, `shared/confirm-dialog.tsx`, `shared/entitlement-manager.tsx` (attaches entitlements to a policy or license).

## Working notes

- Keygen rejects unknown attributes with 422 "unpermitted parameter". Build creation payloads minimally — send `name` plus required relationships, and spread optional attributes in conditionally (`...(x ? { x } : {})`), as the resource classes already do.
- `strict` TypeScript with `@typescript-eslint/no-explicit-any` as a warning; new code uses `unknown` in catch blocks and the error guards.
- File naming is kebab-case; components are PascalCase; `'use client'` on anything with hooks.
- DELETE responses are often empty — the client tolerates unparseable JSON on `ok` DELETEs and returns `null`.
