# Receipt extraction → verified spending → points

This release implements earning claims. Reward redemption and automated refund reversals remain separate work.

## Customer and Manager workflow

1. Customer opens **Points claims**, chooses a verified vehicle and opens an upload record, or uploads a receipt/invoice under an existing service request.
2. After upload, the app automatically invokes `extract-receipt`. Supporting documents are not sent to OCR.
3. Live OCR proposes merchant, invoice number, date and total, and keeps field confidence, currency, tax text and line-item suggestions for inspection. Missing or ambiguous values remain missing; payment and eligible spending are never inferred.
4. Customer checks the original, corrects fields, explicitly confirms MYR and submits.
5. Manager reviews the original, matches the customer/invoice to dealer payment records, enters the eligible paid amount and unique payment reference, and records a verification note. Alternatively, reject with a reason.
6. Approval atomically snapshots the configured points-per-RM rate, calculates `floor(eligible_sen × rate / 100)`, inserts one immutable points ledger entry and sends an in-app notification. No points are earned before approval.

Retrying approval does not credit twice. Credited invoice numbers and payment references are unique within the dealer branch; punctuation/case are normalized. Managers must use the actual dealer references, not new identifiers invented for each claim. A Manager cannot approve a claim attached to their own customer identity. Source uploads and OCR suggestions remain available for review.

Administrators can inspect claims and configure the existing earning rate through Rules & configuration. Managers select eligible spending according to the dealer's written exclusions; line-item eligibility is not automatically decided. Rate changes apply to subsequent approvals; the credited claim retains its rate snapshot.

## Demo versus live

Demo mode does **not** run OCR. It copies the declared upload amount and lets the customer enter sample invoice details. It exercises confirmation, review, rejection, duplicate checks, balance updates and history locally. Its label explicitly says no OCR was performed. Demo data is not shared between devices.

Live mode uses Azure Document Intelligence's `prebuilt-invoice` model through a Supabase Edge Function. Receipts without an identifiable invoice number need customer correction. OCR failures have a manual-entry fallback; they never auto-approve claims. A completed extraction cannot overwrite customer-confirmed details. Resumable jobs prevent normal retries from submitting another paid extraction request; interrupted submissions with no saved job URL fall back to manual entry rather than blindly re-submit.

The app polls a saved job for up to approximately 14 seconds after submission; use **Check extraction progress** if still processing. No external OCR calls have been made during this coding task. Provider accuracy and hosted authentication/storage need testing with the dealer's representative documents before launch.

## Deploy in your existing architecture

1. Extract the ZIP and copy its **autocare folder contents** into the repository checkout, preserving subfolders. Commit source, migrations, functions and dotfiles. Do not upload ZIPs, `dist`, `node_modules` or secret `.env` files.
2. Apply existing migrations in order if not already applied. For an existing installation through service documents, apply only `supabase/migrations/202609110002_loyalty_claims.sql`.
3. Create an Azure Document Intelligence resource. Choose its region and commercial/privacy arrangements appropriate to your dealer's documents. Obtain its endpoint and key.
4. Set `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` and `AZURE_DOCUMENT_INTELLIGENCE_KEY` as **Supabase Edge Function secrets**, never `VITE_` variables or GitHub source. Standard Supabase function environment provides SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
5. Deploy the function from this project with `supabase functions deploy extract-receipt`. The included config disables gateway JWT checking because the handler explicitly calls `auth.getUser()` and verifies active customer membership and document ownership on every request. It does not allow anonymous access.
6. In Vercel, configure the existing Supabase frontend URL/anonymous key/tenant/branch values and `VITE_DATA_MODE=supabase`. Keep framework Vite, build `pnpm build`, output `dist`, and use the folder containing `package.json` as Root Directory.
7. Test one real sample invoice end to end in development with separate Customer and Manager accounts. Confirm the database ledger contains one entry after repeat approval. Test unreadable receipts, missing invoice numbers, foreign currency, duplicate invoice uploads and rejected claims before production.

Private files are sent by the function to the configured OCR provider. The upload UI discloses this. Confirm the dealer's privacy notice covers this processing. Original files remain in the private Supabase bucket; signed viewing links last 60 seconds. No OCR keys or service-role keys are sent to the browser.

## Files

- `src/features/LoyaltyClaims.tsx`: customer confirmation and Manager approval screens.
- `src/features/ServiceDocuments.tsx`: automatic extraction trigger after uploads.
- `src/data/demo.ts`: local demo commands.
- `src/data/supabase.ts`: RPC/function adapter and bounded polling.
- `supabase/functions/extract-receipt/index.ts`: authenticated provider adapter and resumable OCR jobs.
- `supabase/functions/_shared/receipt.ts`: deterministic mapping of OCR fields.
- `supabase/migrations/202609110002_loyalty_claims.sql`: protected claims, server-only jobs, duplicate indexes and atomic points approval.

## Verification and boundaries

26 unit/domain tests and 77 PostgreSQL checks cover field mapping, missing/ambiguous extraction, customer confirmation, Manager authorization, spending limits, duplicate invoice rejection and idempotent crediting. TypeScript and production build pass. PostgreSQL tests stub Supabase Auth/Storage metadata. Hosted Edge Function execution and the real Azure API are not tested without credentials; phone camera behavior also requires device testing.

This release has no automatic bank reconciliation, POS integration, refund reversal or redemption checkout. A receipt is not payment proof by itself. Manager approval is an explicit manual reconciliation step. Existing adjustment controls remain available for authorized corrections, with their existing approvals and audit requirements.
