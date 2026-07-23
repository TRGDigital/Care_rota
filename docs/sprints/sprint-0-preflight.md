# Sprint 0 — Pre-flight: Schema and Types

**Duration:** Whatever it takes before sprint 1 (typically 2–3 days)
**Spec sections:** 6 (all subsections), 5.2 (multi-tenancy)

## Goal

Lay down the **complete database schema** and the **shared TypeScript types** for every table across all 9 sprints, before any sprint feature code is written. Doing this once upfront prevents schema drift, prevents back-and-forth refactors across sprints, and gives every subsequent sprint a stable foundation to slot into.

## Deliverables

### 1. Complete migration set

One migration file per logical group, in `packages/db/migrations/`, named with a sortable timestamp prefix:

| Migration | Tables |
|---|---|
| `000_extensions` | Postgres extensions: `uuid-ossp` (for UUID v7 via helper), `pgvector`, `pgcrypto` |
| `001_organisations_tenancy` | `organisations`, `homes`, `users`, `user_home_roles` |
| `002_staff_core` | `staff`, `staff_roles`, `staff_contracts`, `staff_fixed_shifts`, `staff_pay_rates` |
| `003_staff_compliance` | `staff_documents`, `staff_sponsorship`, `staff_training_certs`, `staff_training_attendances`, `training_topics` |
| `004_rota` | `rota_periods`, `shift_pattern_templates`, `shift_slots`, `shifts`, `shift_clockings`, `shifts_actual`, `shift_swaps`, `shifts_payable`, `premium_pay_calendar` |
| `005_ta_hardware` | `kiosks`, `nfc_badges`, `staff_kiosk_pins`, `geofences` |
| `006_leave_sickness` | `leave_requests`, `leave_balances`, `leave_year_month_summary`, `sickness_episodes`, `statutory_payment_records` |
| `007_payroll` | `pay_cycles`, `pay_periods`, `pay_runs`, `payslips`, `payslip_lines`, `payroll_exports`, `accountant_invitations` |
| `008_overrides_audit` | `audit_events`, `rule_overrides`, `rule_override_reviews` |
| `009_dependency_occupancy` | `beds`, `bed_occupancy_snapshots`, `dependency_assessments`, `staffing_matrices` |
| `010_ai` | `chat_sessions`, `chat_messages`, `rag_chunks` |
| `011_rls_policies` | Row-level security policies on every tenant-scoped table |

### 2. Shared TypeScript types

In `packages/types/src/`:

- Auto-generated types from the Postgres schema (use `kysely-codegen` or `pg-to-ts`)
- Hand-written domain types layered on top in `packages/domain/src/types/`:
  - State machine unions: `RotaPeriodState`, `PayRunState`, `ReconciliationState`, `ShiftState`, `LeaveRequestState`
  - Money type: `type Pence = bigint`
  - Helper types: `TenantContext`, `HomeContext`, `UserContext`

### 3. Tenant context helper

A small utility used by every API route and worker:

```ts
type TenantContext = {
  organisationId: string;
  homeId: string | null;  // null = org-wide query
  userId: string;
  roles: RoleCode[];
};
```

Every Postgres connection acquired for a request must `SET LOCAL app.current_tenant_id` so the RLS policies fire correctly.

## Schema requirements — universal columns

Every table has:

```sql
id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
tenant_id uuid NOT NULL,         -- usually = home_id, except for org-level tables
created_at timestamptz NOT NULL DEFAULT now(),
updated_at timestamptz NOT NULL DEFAULT now(),
created_by_user_id uuid REFERENCES users(id),
updated_by_user_id uuid REFERENCES users(id)
```

Do not repeat these in the per-table specs in the brief. They are universal.

## Schema requirements — type rules

- **Money:** `bigint` columns named `_pence`. Never `numeric` or `money`.
- **Dates:** `timestamptz` for points in time; `date` for calendar dates; `time` for time-of-day only.
- **Enums:** Use Postgres `enum` types for state machines (`rota_period_state`, `pay_run_state`, etc.). Do not use plain text columns with CHECK constraints.
- **JSON:** `jsonb` for `before_state_json` / `after_state_json` on audit tables. Never `json`.
- **References:** All foreign keys named `<entity>_id` with explicit `REFERENCES <table>(id) ON DELETE <action>`. Default action is `RESTRICT` unless the spec specifies otherwise.

## RLS — what the policies must enforce

For every table with `tenant_id`:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY <table>_tenant_isolation ON <table>
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
```

Plus a separate policy for super-admin bypass that requires an explicit setting (`app.super_admin_bypass = 'true'`) — set only in support workflows, never by default.

The `audit_events` and `rule_overrides` tables additionally have NO UPDATE and NO DELETE grants for any application role. The only ways to mutate them are INSERT-only by the application user, and full superuser access used only for retention pruning by a scheduled job.

## Acceptance tests

A test container starts a Postgres instance, runs all migrations, and verifies:

1. Every table has the universal columns
2. RLS is enabled on every tenant-scoped table
3. A query without `app.current_tenant_id` set returns zero rows from any tenant table
4. A query with home A's tenant ID set cannot see home B's rows
5. UPDATE on `audit_events` fails with a permission error
6. DELETE on `rule_overrides` fails with a permission error
7. All foreign keys resolve cleanly
8. All enum types have the expected values from the spec

## Out of scope for this sprint

- Any application code beyond migrations and types
- Seed data (handled per sprint)
- API routes
- Tests beyond the schema-level acceptance tests above

## Definition of done

- All migrations apply cleanly on a fresh Postgres 17 instance
- All migrations apply cleanly on top of each other in sequence
- All 8 acceptance tests pass
- TypeScript types are generated and importable from `@carerota/types`
- A short README in `packages/db/` documents how to run migrations locally and in CI
