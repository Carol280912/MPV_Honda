# Architecture and team ownership

## Request path

```text
Customer / Manager / Administrator UI (React + TypeScript)
  → typed command { type, id, payload }
  → Repository interface
      → demo: scoped local data + validated commands
      → live: Supabase client with signed-in user's JWT
          → RLS-protected reads
          → phase1_action RPC for transactional writes
              → branch configuration lock
              → role, ownership, scope and business-rule validation
              → domain tables + audit entry in the same transaction
```

Vercel serves the built frontend. Supabase Auth owns credentials and sessions; PostgreSQL owns authoritative business data and permissions. GitHub owns source, migrations, reviews and CI. No Supabase service-role/secret key belongs in browser code or Vercel `VITE_` variables.

## Data ownership

- `tenants` and `branches` define the organisation.
- `memberships` grants a user a role in an explicit tenant/branch. It is not editable directly from the browser.
- `customers` links an authenticated user to a business profile; phone/email are attributes, not primary keys.
- `vehicles` belongs to a customer profile. New requests are unverified; verification requires a trusted evidence reference. Existing ownership must be reviewed before linking a duplicate registration. Full ownership-transfer history is future work.
- `appointments` links customer, vehicle, assignment, visit and time; `feedback` links to a completed appointment.
- `recovery_cases` stores response deadline, contact history and resolution; low ratings create a case transactionally.
- `campaigns` stores a draft/approval and budget; audience calculation respects marketing consent. There is no outbound delivery queue yet.
- `adjustments` separates request, independent approval and posting. `loyalty_entries` is an append-only signed-points ledger with unique posting references.
- `settings` holds non-secret dealer rules. `audit_events` records actor, action, reason and database before/after snapshots.
- `inspections` is a read model for trusted imported inspection results. No Service Advisor inspection interface is enabled.

## Authority

| Role            | Read                                                                                                                           | Write                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Customer        | Own customer, vehicles, appointments, ledger, feedback, inspection reports, notifications; approved campaigns and branch rules | Own vehicle request, eligible booking/cancellation, completed-visit feedback, contact/preferences           |
| Manager         | Assigned branch customer/operations data, team references and business audit                                                   | Capacity/closures, appointment lifecycle, recovery, campaigns, adjustment requests/independent approval     |
| Administrator   | Assigned branch governance and data                                                                                            | Rules, other memberships, manual verification, authorised adjustment posting, own/admin contact corrections |
| Service Advisor | Reserved for future release                                                                                                    | Denied by live command boundary; no workspace                                                               |

Data writes never trust a client-supplied role, tenant filtering alone, or editable Auth user metadata. The database looks up the active membership using `auth.uid()`. Direct table writes are revoked from browser roles. Privileged provisioning must be performed through trusted Supabase administration, with no keys committed to GitHub.

The current UI opens the first active membership. Cross-branch selection is not implemented. Separate memberships provide data isolation for a later selector. A platform-wide super-admin role is not included.

## Concurrency and audit

`phase1_action` locks the branch's settings row before mutations. This deliberately simple Phase 1 strategy serialises capacity and ledger decisions within a branch. Replace with narrower per-slot/per-account locks if volume requires it; retain transactionality and idempotency constraints.

The browser adapter is for demo interactions only. Its local state can be edited by the user; it is not a security boundary. PostgreSQL is the live authority. Neither application role can update/delete audit or ledger rows directly. Trusted database operators retain the usual database-owner powers.

## Team collaboration

- UI changes: `src/features`, `src/components`, `src/styles.css`.
- Business-rule changes: update tests, `src/lib/rules.ts`, demo validation and matching SQL command validation together.
- Database changes: add a new timestamped migration; never rewrite a migration already applied to a shared environment.
- Integration changes: extend the repository/provider boundary rather than calling providers from a screen.
- Keep commits focused and review the PR preview plus tests before merging.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth user management](https://supabase.com/docs/guides/auth/managing-user-data), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
