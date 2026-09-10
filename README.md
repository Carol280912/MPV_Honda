# AutoCare — Phase 1

Customer ownership, dealership retention and platform governance. Updated from the September 9 design and the Phase 1 section of `Dealer_App_Role_Settings_Dashboard_Matrix.xlsx`.

**Enabled workspaces:** Customer, Manager, Administrator. **Service Advisor is on hold.** Its role identifier and existing assignment references remain in the data model for future work, but it cannot enter a workspace or execute Phase 1 commands.

## Start locally

Use Node.js 22 and pnpm 11.19.0.

```sh
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Open **http://127.0.0.1:4174**. The first screen is sign-up. In demo mode, choose Customer, Manager or Administrator below the form. No demo password is stored. Demo changes persist in this browser under `autocare-phase1-v2`; this is not secure account storage.

```sh
pnpm test
pnpm build
pnpm preview
```

## Where the team works

| Folder                 | Responsibility                                                            |
| ---------------------- | ------------------------------------------------------------------------- |
| `src/features/`        | Customer, authentication, appointments, Manager and Administrator screens |
| `src/components/`      | Shared buttons, cards, fields, tables and page headings                   |
| `src/lib/types.ts`     | Shared data contracts                                                     |
| `src/lib/rules.ts`     | Pure business calculations and workflow rules                             |
| `src/data/demo.ts`     | Fictional local data adapter and validated demo commands                  |
| `src/data/supabase.ts` | Supabase read adapter and RPC command boundary                            |
| `src/styles.css`       | Responsive design system based on the supplied reference                  |
| `supabase/migrations/` | Versioned tables, RLS and server-side business commands                   |
| `tests/`               | Business-rule tests                                                       |
| `.github/workflows/`   | Pull-request checks                                                       |
| `docs/`                | Architecture, deployment and Phase 1 scope                                |

## GitHub → Vercel → Supabase

1. Upload **the contents of this folder** as the repository root, including dotfiles, `pnpm-lock.yaml`, `src`, `public`, `supabase`, `tests`, and `docs`. Do not upload `node_modules`, `.env`, or `dist`.
2. Connect the GitHub repository to Vercel. Use framework **Vite**, install command `pnpm install --frozen-lockfile`, build command `pnpm build`, and output directory `dist`.
3. Start previews with `VITE_DATA_MODE=demo`. This uses fictional browser data and does not need Supabase.
4. Follow [deployment setup](docs/DEPLOYMENT.md) to configure a separate development Supabase project, apply the migration, provision memberships, and enable `VITE_DATA_MODE=supabase`.
5. Open a `codex/feature-name` branch for changes. A pull request runs tests and build checks; Vercel creates a preview. Review code and migrations before merging to `main`.

A Vercel preview is not a Supabase database branch. Configure development/preview and production database environments explicitly.

## What is functional

- Responsive sign-up/sign-in/recovery UI; Supabase Auth wiring when configured.
- Customer Home, vehicle registration requests, verified-vehicle booking, rescheduling/cancellation, history, feedback and preferences.
- Manager appointments, capacity/closures, customer segments and CSV export, recovery case updates, campaign drafts/approval, points adjustment approval and business audit.
- Administrator rules, membership role/suspension updates, points posting, manual ownership verification, quality counts and audit history.
- Supabase RLS scopes records by tenant, branch and customer. RPC commands validate authority and sensitive transitions. Public registration creates customers only.

## Release boundaries

This is a working Phase 1 implementation and integration foundation, not a live dealership launch. No external project was connected or deployed. See [scope and remaining work](docs/PHASE1.md).

Campaigns are saved and approved but not sent. No DMS, SMS, towing, payment, or insurance provider is connected. Staff invitations and initial tenant provisioning use the Supabase dashboard/trusted administration workflow. Reports do not invent revenue, retention percentages or campaign ROI. Uploaded ownership evidence storage, duplicate merging, scheduled points expiry/tier calculations, advanced segmentation and multi-branch selection are not implemented.

The sign-up privacy copy is a preview placeholder; the pilot dealer must supply approved terms and policy text before public registration is enabled. The vehicle artwork is from the supplied Stitch HTML; confirm reuse rights before public publication.

See [architecture](docs/ARCHITECTURE.md), [deployment](docs/DEPLOYMENT.md), and [verification](docs/VERIFICATION.md).
