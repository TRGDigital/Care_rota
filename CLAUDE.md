# CareRota — Repo Guide for Claude Code

This file is loaded automatically on every Claude Code session. Keep responses grounded in the conventions and references below.

## What we're building

CareRota is a **dynamic rota, time-and-attendance and payroll platform** for UK care homes. It is the third product in a suite alongside CareStream (care planning) and CareAssura (compliance).

**CareRota is a standalone repo and deployment.** It does not share a codebase or database with CareStream. Integration points:
- **Identity:** Shared identity provider via JWT. CareRota uses Supabase Auth; users who are also CareStream users authenticate with the same upstream identity provider (TBD — Auth0 or Clerk, pending confirmation of what CareStream uses). Supabase Auth handles it as a third-party provider.
- **Billing:** `organisations.stripe_customer_id` matches the same Stripe customer record as CareStream. No shared billing code.
- **Data:** CareStream integration (occupancy totals, dependency assessments) is via internal HTTPS API calls with service-to-service JWT auth. Not shared module imports.

The product solves three problems that cost UK care homes 3–8% of payroll every month:

1. **Static rotas don't react to occupancy.** When beds empty, hours don't.
2. **Time-and-attendance lives in a separate system.** Payroll is run off the rota, not off what actually happened.
3. **Compliance is reactive.** Training expiry, visa hours, and Working Time Regulations are caught at inspection, not at rota publication.

CareRota closes all three loops in one product.

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 15 (App Router), React 19, TypeScript, Tailwind, shadcn/ui |
| Mobile staff app | React Native + Expo |
| Kiosk (iPad) | Safari PWA, locked into Guided Access |
| API | Next.js Route Handlers + Supabase Edge Functions for background workers |
| Database | Supabase (PostgreSQL 17) with row-level security; pgvector for embeddings |
| Cache + queues | Redis 7 (cache + BullMQ) |
| Object store | Supabase Storage (S3-compatible) |
| Realtime | Supabase Realtime (WebSocket) |
| LLM | Anthropic Claude API (Sonnet for chat, Haiku for routing) |
| Auth | Supabase Auth with custom JWT claims; CareStream SSO via third-party provider (Auth0 or Clerk — TBD) |
| Hosting | Supabase Cloud (eu-west region) — UK data residency |

## Authoritative spec

The full technical specification lives at:

**`docs/CareRota_Technical_Specification_v1_1.docx`**

This document is authoritative. If anything in this `CLAUDE.md`, in a sprint brief, or in a user prompt contradicts the spec, **flag the conflict and ask before proceeding** rather than silently deviating.

Per-sprint briefs live in `docs/sprints/` — see the index at `docs/sprints/README.md`. Each sprint brief is a focused subset of the full spec; read the brief first, then refer to the full spec for anything ambiguous.

## Directory layout

```
/
├── CLAUDE.md                           ← this file
├── docs/
│   ├── CareRota_Technical_Specification_v1_1.docx
│   └── sprints/
│       ├── README.md                   ← sprint index
│       ├── sprint-0-preflight.md
│       ├── sprint-1-foundations.md
│       ├── sprint-2-staff-contracts.md
│       ├── sprint-3-rota-engine-v1.md
│       ├── sprint-4-rota-leave.md
│       ├── sprint-5-time-attendance.md
│       ├── sprint-6-payroll-core.md
│       ├── sprint-7-payroll-exports-accountant.md
│       ├── sprint-8-occupancy-compliance-v2.md  ← replaces sprint-8-occupancy-compliance.md
│       └── sprint-9-chat.md
├── supabase/
│   ├── config.toml
│   └── migrations/                     ← All DB migrations live here (not packages/db)
├── apps/
│   ├── web/                            ← Next.js 15 admin portal
│   ├── mobile/                         ← React Native + Expo staff app
│   └── kiosk/                          ← Safari PWA for iPad
├── packages/
│   ├── domain/                         ← Pure business logic (rota engine, payroll engine, reconciliation)
│   ├── ui/                             ← Shared shadcn/ui components
│   └── types/                          ← Generated TypeScript types from DB schema
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Coding conventions

### TypeScript

- Strict mode on. No `any` — use `unknown` and narrow.
- Prefer `type` over `interface` unless extending.
- Discriminated unions for state machines (rota period state, pay run state, reconciliation state).
- Zod schemas for every external boundary (API input, kiosk payload, CSV row).

### File naming

- `kebab-case` for files and folders.
- `PascalCase` for React components and class names.
- `camelCase` for functions and variables.
- One exported entity per file where reasonable; co-locate types with the entity.

### Database

- Migrations in `supabase/migrations/`, named with a sortable timestamp prefix (e.g. `20240101000000_extensions.sql`). Run via `supabase db push` locally and in CI.
- Every table has `id` (UUID v7), `tenant_id`, `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`. Don't repeat these in sprint briefs — they are universal.
- All money in **pence as integers**. Never floats. Use `bigint` in TypeScript.
- All dates **UTC** in the database; display time zones are per-home.
- Row-level security on every tenant-scoped table. **RLS uses Supabase JWT claims, not `SET LOCAL app.current_tenant_id`.** See the JWT pattern below.

### Row-level security (RLS) pattern

Every authenticated user's JWT carries custom claims set at login time:

```json
{
  "user_id": "...",
  "organisation_id": "...",
  "home_ids": ["...", "..."],
  "active_home_id": "...",
  "roles": { "home-uuid": ["registered_manager"], ... }
}
```

RLS policies read these via `auth.jwt()`:

```sql
CREATE POLICY tenant_isolation ON shifts
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);
```

**Home switching:** When a user changes `active_home_id` in the home picker, the JWT must be refreshed via `supabase.auth.refreshSession()` backed by a Supabase Auth Hook that rewrites the custom claims from the database. Do not rely on client-side state — RLS reads the JWT, so a stale JWT means the wrong home.

**Audit and override tables** (`audit_events`, `rule_overrides`, `rule_override_reviews`) are INSERT-only for the application role. Enforce via Postgres grants, not RLS. No UPDATE or DELETE grants to the application user on these tables.

**Super-admin bypass:** A separate Postgres role with explicit grant, set only in support workflows via a dedicated service function. Never default.

### Testing

- Vitest for unit tests, Playwright for E2E.
- Pure domain logic (rota engine, payroll engine) must have **table-driven unit tests** covering edge cases — Christmas Day shifts, training-overlap edge cases, no-show reconciliation, NMW floor breach.
- Integration tests run against a Postgres test container with RLS enabled.
- Every override path needs an explicit test that confirms the audit row is written.

### Errors and observability

- Domain errors are typed (`PayrollError`, `RotaError`, `OverrideError`); never throw plain `Error`.
- Every state change writes an `audit_events` row. No exceptions.
- Every manager override writes a `rule_overrides` row. No exceptions.
- Use structured logging (pino). Include `tenant_id`, `home_id`, `user_id`, and `request_id` on every log line.

## Design system — applies to every page, no exceptions

CareRota has a complete design system documented at **`docs/design-system.md`**. It is authoritative for how the entire internal admin UI looks and behaves.

**The design system applies to EVERY page of the admin UI without exception** — every screen, panel, modal, empty state, loading state, error state, form, and table, across all sprints. There are no pages exempt. As new pages are built, they are automatically in scope.

### The non-negotiables

- **All visual values come from tokens.** Colours, spacing, radii, font sizes, shadows, motion — every one comes from a token defined in `apps/web/src/app/globals.css`. No arbitrary hex values, no arbitrary pixel values, anywhere.
- **All components come from `packages/ui`.** Buttons, forms, badges, cards, modals, empty states, loading states — use the shared component, never re-implement one per page.
- **Every page uses the application shell.** Sidebar (`NavSidebar`), top bar (`TopBar`), content area. No bespoke page layouts.
- **One primary action per screen or dialog**, using the accent coral (`bg-accent` / `btn-primary`).
- **Semantic colour conveys meaning only** — never decoration. Use `Badge` variants, not custom colour classes.
- **Every list has a designed empty state** (`EmptyState` component) and a distinct no-results state.
- **Every data area has a skeleton loading state** (`SkeletonTable`, `SkeletonCard`) — never a blank page.
- **Every destructive action has a confirmation dialog** (`ConfirmDialog` component).
- **WCAG 2.2 AA is a release gate** — axe-core runs in CI.
- **Tablet layouts are a primary use case** — verified at desktop, tablet-landscape, and tablet-portrait.

### Token quick reference

| Need | Class |
|---|---|
| Primary action (coral) | `bg-accent` / `text-accent` / `btn-primary` |
| Brand navy (headings, active nav) | `bg-brand-primary` / `text-brand-primary` |
| Page background | `bg-canvas` |
| Card / surface | `bg-surface` |
| Body text | `text-ink` |
| Helper / secondary text | `text-ink-muted` |
| Card radius | `rounded-xl` (16px) |
| Button / input radius | `rounded-md` (10px) / `rounded-sm` (6px) |
| Card resting shadow | `shadow-sm` |
| Modal shadow | `shadow-lg` |

### Already-built pages are not exempt

Pages built before the design system was adopted must be retrofitted to full conformance. Retrofit is a defined ongoing task — not optional polish.

## Critical product principles

These shape every implementation decision. Do not deviate without raising it first.

### 0. Standalone first, integrated second

CareRota is an independently saleable product. It functions completely on its own, without CareStream or CareAssura installed.

When CareStream is also present in the same organisation, CareRota's experience gets *better* — admissions and discharges flow in automatically, dependency assessments stay in sync, occupancy updates are real-time. But CareRota never *requires* CareStream. Every feature has a standalone path before any integration path is considered.

This is not a stylistic preference. It is a commercial requirement:

- A care home using a competing care planning system must still be able to buy and use CareRota
- If CareStream has an outage, CareRota must keep running — payroll calculates, rotas publish, staff clock in
- CareRota's data protection story is cleaner when it does not depend on receiving resident PII from elsewhere

**Data CareRota needs and where it comes from:**

| Data CareRota needs | Standalone source (always available) | Integration source (when CareStream is present) |
|---|---|---|
| Bed occupancy | Manager enters or confirms occupancy in CareRota | Auto-updated from CareStream admission/discharge events |
| Dependency totals (low/medium/high/one-to-one counts) | Manager records dependency band per resident in CareRota | Pulled from CareStream's dependency assessments |
| Bed definitions | Configured in CareRota Settings → Beds | Same — beds are CareRota's data either way |

**CareRota does not store resident PII.** It holds aggregate dependency counts and bed occupancy numbers, not individual residents. A `dependency_assessments` row carries a resident reference, dependency band, assessment date, and `source` (`carerota_native` / `imported_from_carestream` / `manual_csv`). For standalone customers, residents are stored with first name and room number only — enough for the assessment, not enough to constitute clinical data.

**Three integration patterns, in order of preference:**

1. **Manual CSV import (always available, no setup)** — Manager exports a weekly CSV from CareStream and uploads to CareRota.
2. **API sync (premium add-on)** — "Connect CareStream" button in Settings. Service-to-service token. Background job pulls every 15 minutes.
3. **Event-driven (real-time, large groups only)** — Shared event bus. Built only on demand.

Build pattern 1 in v1. Build pattern 2 in v1 if there's time, otherwise v2. Build pattern 3 only on demand.

**How to apply this to a sprint:** Before writing code for any feature described as "reads from CareStream": (1) build the standalone version first, (2) add the CareStream integration as a second optional source feeding the same data model, (3) tests pass with no CareStream connection assumed.

**What is NOT changing:** Shared identity (JWT), shared billing (`stripe_customer_id`), shared UI conventions. The boundary is: identity and billing are shared by design; data is not shared except via explicit, optional integration.

1. **Pay actual, not planned.** The reconciliation worker is the source of truth for hours worked. The rota is a plan; the clock-in is the truth.

2. **Every hard rule has a manager override path.** Never build a brick wall. Build a documented door — with MFA, mandatory justification, and an audit row that cannot be deleted. See Section 4 of the spec.

3. **Display time, calculate hours.** The rota shows "07:00–19:00". Payroll sees 11.0 hours (after break). The bridge is the `shift_pattern_templates` library, set up by the admin once. See Section 7 of the spec.

4. **Holidays can be hours or days.** The home picks at setup. Both unit conventions are first-class. See Section 3.4.

5. **Bank holiday and Christmas premium pay.** Multipliers stored on the shift at publish time, applied by the payroll engine. Defaults 1.5× and 2.0×, configurable per home. See Sections 3.5 and 8.3.

6. **Row-level citations on every chat answer.** No vibes. Every number the chat returns must link back to the rows it came from. See Section 12.4.

7. **Tenant isolation is at the database, not the application.** RLS first; application checks are belt-and-braces.

## CareStream integration

CareRota is standalone-first (see Principle 0). CareStream integration is an optional enrichment layer, never a requirement.

When a sprint brief says "reads from CareStream", implement the standalone path first (manual entry / CSV import), then add CareStream as a second source feeding the same data model. There are no shared packages, shared database tables, or shared module imports between CareRota and CareStream. An authenticated HTTP call to CareStream's API is the only permitted integration mechanism for data.

Shared across the suite: identity (JWT / Supabase Auth), billing (`organisations.stripe_customer_id`), UI conventions and design tokens.

## What NOT to do

- Don't use ORMs that hide RLS behaviour. Use the Supabase JS client (which goes through PostgREST and respects RLS automatically) or Kysely for complex queries. Raw SQL goes in Edge Functions or RPC functions — never inline in application code.
- Don't bypass RLS by using the Supabase service-role key in user-facing API routes. Service-role key is only for background workers and admin functions that need super-admin access.
- Don't switch `active_home_id` client-side only. Always refresh the JWT via the Auth Hook so RLS sees the change.
- Don't put business logic in React components. Domain logic lives in `packages/domain/`.
- Don't compute money in TypeScript using `Number`. Use `bigint` for pence.
- Don't write SQL inside route handlers. Wrap queries in repositories or RPC functions.
- Don't ship code that talks to the Anthropic API without a budget guard. Every LLM call must check a per-tenant rate limit.
- Don't allow free-form SQL from the LLM. The chat layer uses typed tools only — see Section 12.
- Don't import from CareStream packages. Integration is HTTP only.
- Don't build a CareStream integration path before the standalone path exists and is tested.

## How to work with me on this codebase

When starting a sprint:

1. Read the sprint brief at `docs/sprints/sprint-N-<name>.md`.
2. Check the spec for any sections referenced in the brief.
3. Propose the migration set and TypeScript types **before** writing application code.
4. Write tests alongside the code, not after.
5. If anything in the brief is ambiguous or you find a contradiction with the spec, ask before assuming.

When asked to implement a feature:

- State what you're going to do, the files you'll touch, and any new dependencies — before writing code.
- If the feature touches a hard rule (training expiry, WTR, RTW, sponsorship, NMW), confirm the override path is implemented and tested.
- Run validations and tests before reporting back.

## Pre-flight before sprint 1

Two things to deliver **before** any sprint kicks off (see `docs/sprints/sprint-0-preflight.md`):

1. **Complete DB migration set** for the entire schema (all tables across all 9 sprints). Files go in `supabase/migrations/` with sortable timestamp prefixes. One migration file per logical group.
2. **Generated TypeScript types file** in `packages/types/` exposing types for every table (use `supabase gen types typescript`).

Both exist before sprint 1 starts so all subsequent sprints slot cleanly in.

## Open questions to flag if they come up

These need product answers before the relevant sprint:

- **CareStream auth provider** — Auth0 or Clerk? Needed for Sprint 1 to configure Supabase's third-party SSO provider. **Block Sprint 1 until confirmed.**
- Pension provider for CSV alignment (NEST default?)
- Bank holiday multiplier — 1.5× confirmed? Some homes use 1.25×.
- Christmas multiplier scope — which dates? Christmas Day, Boxing Day, NYD, also 24th/31st evenings?
- Default training rate — same as weekday, or separate?
- NFC reader hardware model
- iPad procurement responsibility
- Pilot home details

If any of these block progress on a sprint, raise it and pause.
