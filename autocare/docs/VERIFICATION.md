# Verification — September 9, 2026

## Completed

- TypeScript compilation passed.
- Production Vite build passed, including the restored responsive stylesheet and supplied vehicle asset.
- **18 domain tests passed**: customer/tenant/branch scope, active membership, held Advisor actions, permission denials, status transitions, capacity and closures, verified-vehicle requirements, rescheduling, feedback linkage and duplicate prevention, case closure, independent adjustment approval, duplicate posting, nonnegative balances, marketing consent, new-customer segmentation, configuration bounds, budget validation and CSV formula escaping.
- **32 PostgreSQL checks passed** using PGlite: migration execution, actual RLS under the authenticated role, direct-write denial, cross-scope commands, customer-only enrolment despite privileged user metadata, capacity, allowed time slots, feedback duplication, recovery closure, audit deletion denial, independent approval and posting, suspended membership, and held Advisor access.
- Browser walkthrough: sign-up rendered; Customer booking persisted and appeared in appointments; Manager overview loaded; Administrator posting was rejected before approval; Manager approval enabled Administrator posting; the request then displayed Posted without a repeat-post button.
- Customer mobile and Manager desktop layouts visually reviewed. Only Customer, Manager and Administrator are offered in the demo workspace selector.

## Run again

```sh
pnpm test
pnpm test:db
pnpm build
```

`tests/database.mjs` creates an isolated in-memory PostgreSQL instance. It stubs the Supabase Auth schema only to exercise database authority. It does not contact or modify a Supabase project.

## Not verified externally

No live Supabase project, email verification/recovery delivery, DMS, messaging provider, Vercel deployment or GitHub remote was connected. Actual project bootstrap, SMTP/redirect settings and end-to-end Auth must be tested in the team's development environment. Browser tests are a recorded manual walkthrough; they are not an automated browser-test suite.
