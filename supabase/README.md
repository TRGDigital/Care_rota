# Database — migrations and types

## Running migrations locally

```bash
# Start local Supabase stack
supabase start

# Apply all migrations to the local DB
supabase db push

# Reset local DB and re-apply from scratch
supabase db reset
```

## Generating TypeScript types

After any migration change, regenerate types:

```bash
pnpm --filter @carerota/types gen
# or directly:
supabase gen types typescript --local > packages/types/src/database.types.ts
```

The generated file (`database.types.ts`) is gitignored — always regenerate after pulling new migrations.

## Migration naming convention

```
YYYYMMDDHHmmss_description.sql
```

One file per logical group. Don't split a single transaction across files.

## CI

The CI pipeline runs `supabase db push --dry-run` on every PR to verify migrations apply cleanly. Full migration acceptance tests run in the integration test job.
