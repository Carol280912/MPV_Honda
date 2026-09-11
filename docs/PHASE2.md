# Phase 2 — increment 1

This release starts Phase 2. It does not implement every Phase 2 matrix row.
Customer, Manager and Administrator only; Service Advisor remains blocked.

## Implemented

- Customer home follows the September Stitch arrangement: embedded vehicle health, workshop promotion image, service pillars, loyalty, next appointment and service recommendation cards.
- Customer service catalogue with indicative prices and effective dates.
- Verified vehicle requests for maintenance, repairs, parts, insurance, towing, referral and trade-in. These are dealer follow-up requests, not provider orders or financial commitments.
- Manager branch queue: requested → in progress → waiting for customer → closed, with required customer-visible update and audit records. Closed requests cannot be silently reopened.
- Administrator dated catalogue versions and archival. Prior entries are retained.
- Additive Supabase schema, RLS, command RPC, ownership validation and write denial for unauthorized roles.
- Old Phase 1 demo data is retained; missing Phase 2 arrays are added when loading.

## Still required for the full Phase 2 matrix

- Versioned repair quotations, customer accept/decline, discount authority and retention offer ceilings.
- Package approval and conversion reporting, detailed WIP milestones and DMS synchronization.
- Part fitment, stock/reservation integration and install workflow.
- Insurance partner quotations and renewals; verified towing/claim routing and SLA management.
- Provider-confirmed payments, reward redemption/earning, idempotent webhooks, refund approvals and proportional loyalty reversals.
- Referral attribution and qualifying rewards; trade-in/test-drive routing beyond request capture.
- Source-backed revenue and lost-opportunity dashboards; integration health monitoring.

No fabricated revenue, successful payments, insurance quotes, stock availability or emergency dispatch is displayed. Catalogue prices are indicative. Source illustrations and demo fixtures are not commercial offers.

## Architecture and deployment

The existing React + TypeScript + Vite structure, GitHub CI and Vercel configuration are retained.

`features/PhaseTwo.tsx` renders role-specific screens → `WorkspaceContext.run` → repository → `phase2_action`.
`data/demo.ts` applies the same command restrictions locally. `data/supabase.ts` routes only Phase 2 commands to the new RPC; Phase 1 retains its existing RPC.

Apply `202609090001_phase1.sql` followed by `202609100001_phase2.sql` to a test Supabase project before connecting this build. Do not reapply Phase 1 on an existing database. No database migration or deployment has been applied remotely by this task.

The workshop image uses the exact image URL in the supplied Stitch HTML. It remains an external asset dependency; replace with a dealer-owned stable asset before launch.

## Validation

21 domain tests and 48 PostgreSQL checks pass across Phase 1 and the new workflow. Production build and TypeScript checks pass. Browser QA covered customer submission and Manager closure; the QA request is clearly marked in the local demo. Live Supabase Auth and external providers have not been exercised.
