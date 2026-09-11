# Service journeys and evidence — September 11

## What changed

Customer Maintenance, Repairs, Parts, Insurance and Towing now have separate forms, instructions, next steps and category-specific request histories. Vehicle selection is required. Maintenance links to the existing appointment flow; insurance captures insurer, expiry and cover enquiry; towing distinguishes breakdown, accident and already-towed evidence submissions. No emergency dispatch, insurer purchase, stock reservation or payment confirmation is simulated.

Each request supports JPEG/PNG photos and PDF documents. A second file picker requests the rear camera on supported phones. Desktop browsers can offer a normal picker instead. HEIC is not supported; convert to JPEG. Files are attached after the request is saved and are visible to the owner and authorized branch staff. Managers can filter requests by service.

Customers provide a document type, optional amount and transaction reference. Managers review evidence and mark it Verified or Rejected with a required note/reconciliation reference. Administrators have read access for governance. Reviews are immutable through the app and audited. A rejected document can be resubmitted as a new upload, preserving the original.

**Verified means a Manager reviewed the evidence. It does not prove bank settlement, post a payment, issue a refund or award loyalty points.** Reviewers must compare receipts with dealer/provider records. OCR, malware scanning, automatic payment reconciliation and gateway webhooks are not included.

## Data and architecture

- `src/features/ServiceJourney.tsx`: customer category forms and next steps.
- `src/features/ServiceDocuments.tsx`: upload validation, camera/file inputs, private viewing and review UI.
- `src/features/PhaseTwo.tsx`: Manager/Admin workspaces and request filters.
- Existing repository command boundary is retained. New `document.register` and `document.review` commands use the `document_action` RPC.
- Existing request `details` stores labelled answers; this increment does not introduce a new typed lifecycle for quotations or insurer dispatch.
- `service_documents` stores metadata and review state. Supabase mode stores binaries in the private `service-evidence` bucket, never GitHub or public assets.
- Signed document links expire after 60 seconds. Downloaded copies cannot be revoked by the app.
- Old Phase 1/2 demo data is preserved. Demo documents use local browser storage (1 MB/file and browser storage quota); use sample documents only. Supabase supports 5 MB/file. Quota failures do not claim success.

## GitHub → Vercel setup

1. Extract `autocare-service-journeys-source.zip`.
2. Copy the **contents inside its autocare folder** into the existing repository checkout, preserving `src/features`, `src/data`, `src/lib`, `supabase/migrations`, `public`, `tests`, `docs` and dotfiles. Do not flatten files into the repository root.
3. Review and commit the changes. Do not upload the ZIP, `node_modules`, `dist`, `.env` or generated build files. Do not delete teammates' unrelated work.
4. Vercel Root Directory should be the directory containing `package.json`. Use Vite, `pnpm build`, output `dist` and `pnpm install --frozen-lockfile`.
5. Demo mode: `VITE_DATA_MODE=demo`. Uploads stay in that browser and do not reach staff on other devices.
6. Live mode: apply the existing Phase 1 and Phase 2 migrations if not already applied, then apply **202609110001_service_documents.sql** in your development Supabase project. It creates the private bucket, metadata table, RLS policies and RPC. Do not make the bucket public. Existing deployed databases should receive only the new migration.
7. Configure existing Supabase environment variables and use authenticated customer/manager accounts to test upload, viewing and review across devices before production. Only after that deploy with `VITE_DATA_MODE=supabase`.

The source ZIP contains code and SQL only. This task does not push to GitHub, deploy Vercel or modify a live Supabase project.

## Verification

22 domain tests and 63 PostgreSQL checks cover original functionality, evidence ownership, role restrictions, immutable review, storage path access and unchanged loyalty balances. The PostgreSQL tests stub Supabase Storage metadata; real hosted storage HTTP uploads and phone camera behavior require device/integration testing. Local browser QA submitted an insurance renewal request and uploaded a sample PDF receipt, confirming Awaiting verification and amount/reference persistence. TypeScript and Vite production builds pass.
