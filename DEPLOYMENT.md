# Deployment and Supabase setup

## 1. Source repository

Use this directory as your GitHub repository root. `.gitignore` excludes credentials and generated dependencies. Commit `pnpm-lock.yaml` and `pnpm-workspace.yaml`. The workspace file permits the esbuild build step. Node 22 and pnpm 11.19.0 match CI.

## 2. Supabase development project

Create a development project before production. Use Supabase CLI migrations or the SQL editor to apply `supabase/migrations/202609090001_phase1.sql`. Review the SQL first; it expects a new schema and is not a migration of an existing dealer database.

Using the trusted SQL editor, create a tenant, branch and settings row. Keep `open_registration=false` until policy text and verification practices are approved.

```sql
-- Replace names and retain returned IDs for the next statements.
insert into public.tenants(name) values ('Your dealer group') returning id;
insert into public.branches(tenant_id,name)
values ('TENANT_UUID','Your branch') returning id;
insert into public.settings(tenant_id,branch_id,dealer_name)
values ('TENANT_UUID','BRANCH_UUID','Your dealer group');
```

Invite the initial Administrator using Supabase Auth's Users dashboard. Then assign their Auth user UUID with trusted SQL:

```sql
insert into public.memberships(tenant_id,branch_id,user_id,name,role)
values ('TENANT_UUID','BRANCH_UUID','AUTH_USER_UUID','Administrator name','administrator');
```

Repeat for a Manager with role `manager`. Never make this provisioning SQL available as a public API. The in-app Administrator can manage existing memberships; new staff invitations are a trusted dashboard operation in this release.

To enable customer onboarding after review:

```sql
update public.tenants set open_registration=true where id='TENANT_UUID';
```

Enable email confirmation and configure SMTP delivery in Supabase Auth. Add the exact development and production Site/Redirect URLs, including the `/#reset-password` route. Customer sign-up sends a verification email; verified sign-in calls `enrol_customer` to create a customer-only profile and membership. Role metadata submitted by a user is never trusted.

## 3. Environment values

In `.env` locally and Vercel environment settings:

```text
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
VITE_TENANT_ID=TENANT_UUID
VITE_BRANCH_ID=BRANCH_UUID
```

All `VITE_` values are public in the browser. Never include a service-role key, secret key, database password or provider credential. Missing live configuration gives an error and never falls back to demo data. Rebuild after changing variables.

Use `VITE_DATA_MODE=demo` for design reviews. Never enter customer personal data in demo mode.

## 4. Vercel

Connect the GitHub repository. Set framework Vite, install `pnpm install --frozen-lockfile`, build `pnpm build`, output `dist`. Use Node 22. The included rewrite serves the app shell; routing uses hash routes.

Configure Preview and Production variables separately. A preview deployment must not write to the production Supabase database. Apply reviewed migrations to the appropriate database before switching the frontend to it.

## 5. Pilot checks

Run the included domain tests, build and SQL access tests. Verify with separate real Auth test users that customer A cannot read customer B, branch A cannot read branch B, and suspended members cannot write. Test email verification, recovery links and database provisioning against the actual project; the local PostgreSQL test runtime does not simulate Auth email delivery.

No GitHub repository, Vercel project or Supabase project was created or changed by this deliverable.
