# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Send Inteligentte** is a multi-tenant WhatsApp Business SaaS for bulk/automated message dispatching via the Meta WhatsApp Business Cloud API v19. It is a TypeScript monorepo with a `backend/` (Express + Prisma) and `frontend/` (React 19 + Vite).

Deployed on **Render** (backend) and **Vercel** (frontend). Database is **Neon** (serverless PostgreSQL).

---

## Commands

### Backend (`cd backend/`)
```bash
npm run dev          # ts-node-dev hot-reload on :3001
npm run build        # prisma generate + db push + tsc
npm run test         # vitest run (unit tests only)
npm run test:watch   # vitest watch mode
npx ts-node --project tsconfig.json src/<file>.ts  # run a one-off script
```

**Schema changes:** always use `npx prisma db push` (never `prisma migrate dev` — non-interactive env fails). This also regenerates the Prisma Client.

### Frontend (`cd frontend/`)
```bash
npm run dev    # Vite dev server on :5173
npm run build  # tsc -b && vite build
npm run lint   # eslint
```

### Type checking (no build)
```bash
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

---

## Required Environment Variables (`backend/.env`)

```
DATABASE_URL=          # Neon PostgreSQL connection string
JWT_SECRET=            # Used for all JWT signing (30-day user tokens, 1-day support tokens)
ENCRYPTION_KEY=        # AES-256-CBC key for Meta access tokens stored in DB
FACEBOOK_APP_ID=       # Meta app (for OAuth)
FACEBOOK_APP_SECRET=   # Meta app secret (HMAC webhook validation)
PORT=3001
FRONTEND_URL=http://localhost:5173   # comma-separated for multi-origin CORS
```

Frontend: set `VITE_API_BASE_URL=https://<backend>.onrender.com/api` in `frontend/.env`.

---

## Architecture

### Request Flow

```
Browser → Vercel (frontend SPA)
              ↓
          AuthContext (JWT in localStorage)
              ↓ Authorization: Bearer <jwt>
Render → Express backend (:3001)
              ↓
         /api/auth      → auth.ts
         /api/admin     → admin.ts  (SUPERUSER only)
         /api/v1        → publicApiRoutes.ts (API key auth, no JWT)
         /api           → whatsapp.ts (aggregator → 14 sub-routers)
         /t/:shortCode  → trackingRoutes.ts (public redirect)
```

All authenticated routes under `/api` go through `middlewares/auth.ts` (JWT). The public API at `/api/v1` uses `middlewares/apiKeyAuth.ts` (Bearer `sk_...` key, SHA-256 hash lookup).

### Multi-tenancy Model

`User` → many `Account`s (each Account = one WhatsApp Business number). All data models (Template, Message, ContactList, Campaign, ApiKey, etc.) are scoped by `accountId`. Every route validates ownership: it fetches the resource by `{ id, accountId }` and returns 404 if the account doesn't belong to the requesting user.

### Message Dispatch — Transactional Outbox Pattern

Messages are **never sent inline**. The API creates a `Message` record with `status: PENDING`. A background worker (`workers/dispatcher.ts`) polls every 5 seconds:

1. Fetches up to 50 PENDING messages (respecting `scheduledAt` and `nextRetryAt`)
2. Checks opt-out list in batch
3. Decrypts the account's `accessToken` (AES-256-CBC via `utils/crypto.ts`)
4. Calls `graph.facebook.com/v19.0/{phoneNumberId}/messages`
5. Updates status to SENT / FAILED; emits SSE event via `utils/emitter.ts`
6. On failure: exponential backoff retries (1min → 5min → 15min), then FAILED permanently

On server startup, any messages stuck in `PROCESSING` are reset to `PENDING` (handles crash recovery).

### Campaign Worker

`workers/campaignWorker.ts` polls every 60 seconds for ACTIVE campaigns with `nextRunAt ≤ now`. Variable mappings support: `CONTACT_NAME`, `CONTACT_PHONE`, `CONTACT_VAR_1/2/3`, `STATIC:<value>`. After execution: ONCE campaigns → COMPLETED; recurring → `calculateNextRun()` sets next `nextRunAt`.

### Real-time Updates (SSE)

`messageEventEmitter` (Node EventEmitter) is the in-process pub/sub. `chatRoutes.ts` exposes `GET /accounts/:id/messages/events?token=<jwt>` as a persistent SSE stream. Frontend `Layout.tsx` connects on mount and dispatches a `CustomEvent("messageUpdated")` that any page can listen to.

### Media Storage

Uploaded files are stored both on disk (`/uploads/`) and as Base64 in `MediaAsset.fileData` in Postgres. A custom Express middleware auto-restores files from DB on each request if the file is missing on disk (handles Render's ephemeral filesystem after restarts).

### Meta Access Token Security

Access tokens are AES-256-CBC encrypted before storage in `Account.accessToken`. The raw key never appears in the DB. `encryptToken` / `decryptToken` in `utils/crypto.ts`.

---

## Authentication & Authorization

| Flow | Mechanism |
|---|---|
| Regular login | `POST /api/auth/login` → 30-day JWT (`{ userId }`) |
| Super admin login | Same login endpoint; user has `role: "SUPERUSER"` in DB |
| Support session (impersonation) | `POST /api/admin/impersonate` → 1-day JWT with `{ userId, impersonatorId, impersonatorName }` |
| Stop impersonation | Frontend restores `admin_token` from localStorage |
| Public API | `Authorization: Bearer sk_<base64url>` — hash compared against `ApiKey.keyHash` |

The frontend detects impersonation by JWT-decoding the token and checking `impersonatorId`. A banner and "Voltar para Administrador" button are shown via `Layout.tsx`.

**Super admin account:** `equipeinteligentte@send.com` / `eu1507` — user with `role: "SUPERUSER"` in the database. Access the admin panel at `/admin`.

**API keys** use SHA-256 (not bcrypt) for fast lookup — keys are long random strings (`sk_<32 random bytes as base64url>`), not user passwords. The plain key is returned once on creation and never stored.

---

## Frontend Architecture

`App.tsx` wraps everything in `AuthProvider → AccountProvider → AlertProvider → BrowserRouter`. If no JWT token is in localStorage, `Layout.tsx` renders `AuthPages` instead of the outlet.

**Key contexts:**
- `AuthContext` — token, user, impersonation state, `axios.defaults.headers` management
- `AccountContext` — list of accounts, selected account (persisted in memory, first account selected by default)
- `AlertContext` — toast notifications via `useAlert()` hook

**CSS design system** (`src/index.css`):
- Glassmorphism: `.glass`, `.glass-interactive`
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`
- Modals: `.modal-overlay`, `.modal-card`, `.modal-header`, `.modal-body`, `.modal-footer`
- Forms: `.field`, `.field-label`, `.field-input`
- Tags: `.tag-chip`, `.tag-chip--interactive`
- Code display: `.code-block` with `.c-method`, `.c-key`, `.c-val`, etc.
- Info panels: `.info-panel--warning/success/info/error`
- Tables: `.data-table`, `.table-container`
- Brand color: `--primary: #00c26b` (dark) / `#009652` (light)
- Modals should use `createPortal(children, document.body)` with `ModalPortal` wrapper

All pages follow the same structure: `fade-in` wrapper div → page header with `.page-heading` + action buttons → content. Pages use `selectedAccount` from `useAccount()` and show empty-state with `.empty-state__icon/title/desc` when no account is selected.

---

## Key Gotchas

- **Never use `prisma migrate dev`** — use `npx prisma db push` (the environment is non-interactive).
- **Access tokens in DB are AES-encrypted.** When debugging a "token invalid" error, check that `ENCRYPTION_KEY` is consistent between environments.
- **CORS** is configured to allow `*.vercel.app` subdomains dynamically — no need to add every preview URL manually.
- **The dispatcher is a single process** — it uses an `isProcessing` flag (not a DB lock) which is fine for the single-instance Render deployment. Do not run multiple backend instances without replacing this with a DB-based advisory lock.
- **Render free tier resets the filesystem** on each wake — the media restore middleware handles this automatically.
- **All new route files** must be registered in both `src/routes/whatsapp.ts` (aggregator) and imported in `server.ts` if they need to be outside JWT auth.
