# Sprint 1 — Foundations

**Duration:** Weeks 1–2
**Spec sections:** 1 (executive summary), 4 (manager overrides), 5 (architecture), 6.1 (organisation/tenancy), 6.7 (override audit), 15 (security)
**Depends on:** Sprint 0 (schema and types)

## Goal

Get the basic skeleton running end-to-end. By the end of this sprint, a user can sign in via the existing CareStream identity provider, land in an empty admin portal scoped to their home, and the override audit infrastructure exists ready for every subsequent sprint to plug into.

## What we're building

### 1. Monorepo wiring

CareRota lives in the **same monorepo** as CareStream. Set up:

- `apps/web/` — the admin portal (Next.js 15)
- `apps/api/` — the API service (Fastify)
- `packages/auth/` — auth middleware shared with CareStream
- `packages/domain/` — pure business logic (will fill across sprints)

Share `node_modules` via pnpm workspaces or whatever the existing CareStream repo uses. Reuse the existing CI pipeline; add a CareRota-specific test job.

### 2. Identity integration

Single sign-on with CareStream. A user authenticated for CareStream should be able to switch to CareRota without re-authenticating, if their org has a CareRota subscription.

Implement:

- Tenant context resolution — on every API request, resolve `(organisationId, homeId, userId, roles)` from the auth token plus the URL/header (e.g. `/api/homes/:homeId/...`)
- Role check middleware — `requireRole('registered_manager')` etc.
- Postgres connection helper — sets `app.current_tenant_id` on every connection acquired for a request, so RLS fires correctly

### 3. Admin portal shell

The web app should boot, show login, show a home picker if the user has access to more than one, then show an empty dashboard with the navigation sidebar from Section 13.2 of the spec:

- Rota board (empty placeholder)
- Today view (empty)
- Staff directory (empty)
- Leave inbox (empty)
- Holiday calendar (empty)
- Pay runs (empty)
- Compliance (empty)
- Dashboards (empty)
- Settings (basic — home name, time zone, holiday allocation unit setting)
- Chat (panel placeholder)

The navigation is in place; the screens are empty for now. This unblocks every subsequent sprint to fill in its screens without rewiring the navigation.

### 4. Override audit infrastructure — **critical for every later sprint**

This is the foundation that every "hard rule" will use. Implement:

#### `rule_overrides` write path

A single domain service `RuleOverrideService` exposes:

```ts
async function recordOverride(params: {
  homeId: string;
  ruleCode: string;            // e.g. "wtr_11hr_rest", "training_expired_safeguarding"
  entityType: string;          // e.g. "shift", "pay_run"
  entityId: string;
  blockedAction: string;       // e.g. "publish_shift", "approve_pay_run"
  reasonCategory: string;      // from the per-rule enum
  justification: string;       // min 20 chars, enforced
  overriddenByUserId: string;
  mfaMethod: string;           // "password_reentry" | "totp" | "webauthn"
  beforeState: unknown;
  afterState: unknown;
}): Promise<RuleOverride>;
```

The service:

- Validates the justification meets minimum length
- Checks the user has the role authorised for this `ruleCode` (lookup in a config map)
- Re-verifies MFA (the API receives a fresh MFA proof from the client, not just a session)
- Inserts into `rule_overrides` (which has no UPDATE or DELETE grants)
- Returns the inserted row

#### Per-rule authorisation config

In `packages/domain/src/overrides/authorisation.ts`:

```ts
export const OVERRIDE_AUTHORISATION: Record<RuleCode, OverrideAuthorisation> = {
  wtr_11hr_rest: { rolesPermitted: ['registered_manager', 'deputy_manager'], coSignRequired: false },
  wtr_48hr_weekly: { rolesPermitted: ['registered_manager'], coSignRequired: false, ownerDigest: true },
  training_expired_safeguarding: { rolesPermitted: ['registered_manager'], coSignRequired: false, sevenDayRetrainPrompt: true },
  // ... (full map from Section 4.2 of the spec)
};
```

Subsequent sprints add rules to this map. The infrastructure to enforce them is ready from day one.

#### Override UI modal

A reusable React component in `packages/ui/`:

```tsx
<OverrideModal
  rule="wtr_11hr_rest"
  context={{ shiftId, staffName, ... }}
  onConfirmed={(override) => ...}
/>
```

Renders the rule that fired, the data that triggered it, a reason-category dropdown, a free-text justification (with 20-char counter), and an MFA re-confirm step. On submission, calls the API which calls `RuleOverrideService.recordOverride`.

### 5. Override Log screen (basic version)

A new section under Compliance: "Override Log". Lists every override with filters (rule type, manager, staff member, date range). Per Section 4.4 of the spec. Empty for now; subsequent sprints will populate it.

### 6. Audit events

Generic `audit_events` write helper used by every state-changing operation across the codebase. Same pattern as `RuleOverrideService` but for ordinary state changes (not override-protected ones).

```ts
async function recordAudit(params: {
  homeId: string;
  actorUserId: string;
  actionCode: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
}): Promise<void>;
```

## Settings: holiday allocation unit

In Settings → General, expose a one-time setting: **Holiday allocation unit** (`days` | `hours`). Stored in `homes.holiday_allocation_unit`. Per Section 3.4 of the spec. Cannot be changed once any `leave_requests` row exists for the home.

UI shows an inline explanation: "Some homes allocate annual leave in days, others in hours. Pick one — you can't change this later without admin support. Most care homes with variable-length shifts choose hours."

## Acceptance tests

1. A user authenticated for CareStream can navigate to CareRota and lands on the home picker without re-authenticating.
2. A user with access to two homes can switch between them; the URL reflects the current home.
3. A user without a CareRota subscription on their organisation sees a friendly "not subscribed" page rather than a 403.
4. Submitting an override without MFA fails.
5. Submitting an override with MFA writes a `rule_overrides` row with all required fields populated.
6. An UPDATE attempt against `rule_overrides` fails with a permission error.
7. The Override Log screen displays the recorded override.
8. A `super_admin` user can view the Override Log across all homes; a `registered_manager` only sees their home.

## Out of scope

- Any rota, shift, payroll, leave, or T&A functionality (handled in later sprints)
- Staff CRUD (Sprint 2)
- The `audit_events` and `rule_overrides` tables themselves (created in Sprint 0)
- Email/notification dispatch (handled per sprint as needed)

## Definition of done

- Login → home picker → empty admin portal works end-to-end
- Override audit infrastructure is in place and tested
- Override Log screen displays test data correctly
- All 8 acceptance tests pass
- Sprint demo: a fake "test rule" is fired, override modal is invoked, MFA confirmed, the override appears in the Override Log within 2 seconds
