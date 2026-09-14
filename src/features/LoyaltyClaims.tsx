import { Badge, Button, Card, Field, Heading, Empty } from "../components/ui";
import { useWorkspace } from "../lib/context";
import { money } from "../lib/rules";
import { mode, supabase } from "../lib/supabase";
import { Documents } from "./ServiceDocuments";
import type { LoyaltyClaim } from "../lib/types";
function ClaimCard({ claim }: { claim: LoyaltyClaim }) {
  const { actor, data, run, busy, notify } = useWorkspace();
  const doc = data.service_documents.find((d) => d.id === claim.document_id);
  async function view() {
    try {
      if (!doc) return;
      let url = "";
      if (mode === "demo") {
        const bytes = Uint8Array.from(atob(doc.demo_url!.split(",")[1]), (c) =>
          c.charCodeAt(0),
        );
        url = URL.createObjectURL(new Blob([bytes], { type: doc.mime_type }));
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const result = await supabase!.storage
          .from("service-evidence")
          .createSignedUrl(doc.storage_path, 60);
        if (result.error) throw result.error;
        url = result.data.signedUrl;
      }
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <Card>
      <div className="row">
        <h2>{claim.invoice_number || doc?.filename || "Receipt claim"}</h2>
        <Badge
          tone={
            claim.status === "Credited"
              ? "green"
              : claim.status === "Rejected"
                ? "red"
                : "amber"
          }
        >
          {claim.status}
        </Badge>
      </div>
      <p>
        {claim.merchant} · {claim.invoice_date} · {money(claim.total_sen)}
      </p>
      <Button variant="secondary" onClick={view}>
        View original document
      </Button>
      <p className="small muted">
        Extraction currency:{" "}
        {String(
          claim.extracted.currency || "Not identified — check the original",
        )}
      </p>
      <details>
        <summary>Extraction results and confidence</summary>
        <p className="small muted">
          Machine-read suggestions can be wrong. Check the original document.
        </p>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {JSON.stringify(claim.extracted, null, 2)}
        </pre>
      </details>
      {claim.review_note && (
        <p className="inline-note">Review: {claim.review_note}</p>
      )}
      {claim.status === "Credited" && (
        <p className="points">
          +{claim.points.toLocaleString()} pts{" "}
          <small>
            · {money(claim.eligible_sen)} eligible × {claim.rate} points/RM
          </small>
        </p>
      )}
      {actor.role === "customer" && claim.status === "Extracting" && (
        <Button
          disabled={busy}
          onClick={() =>
            run({ type: "loyalty.extract", id: doc?.id, payload: {} })
          }
        >
          Check extraction progress
        </Button>
      )}
      {actor.role === "customer" &&
        ["Review details", "Extraction failed"].includes(claim.status) && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await run({
                type: "loyalty.confirm",
                id: claim.id,
                payload: {
                  ...Object.fromEntries(f),
                  total_sen: Math.round(Number(f.get("total")) * 100),
                  currency_confirmed: f.get("currency_confirmed") === "on",
                },
              });
            }}
          >
            <h3>Check your receipt details</h3>
            <Field label="Merchant / dealer">
              <input
                name="merchant"
                required
                defaultValue={claim.merchant}
                maxLength={150}
              />
            </Field>
            <div className="form-grid">
              <Field label="Invoice / receipt number">
                <input
                  name="invoice_number"
                  required
                  defaultValue={claim.invoice_number}
                  maxLength={100}
                />
              </Field>
              <Field label="Transaction date">
                <input
                  name="invoice_date"
                  type="date"
                  required
                  defaultValue={claim.invoice_date}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </Field>
            </div>
            <Field label="Total shown (RM)">
              <input
                name="total"
                type="number"
                step="0.01"
                min="0.01"
                max="1000000"
                required
                defaultValue={claim.total_sen / 100 || ""}
              />
            </Field>
            <label className="checkbox">
              <input type="checkbox" name="currency_confirmed" required />I
              checked the document, these details are correct, and the amount is
              in Malaysian ringgit (MYR).
            </label>
            <Button disabled={busy}>Confirm details & submit</Button>
          </form>
        )}
      {actor.role === "manager" && claim.status === "Pending verification" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await run({
              type:
                f.get("decision") === "Approve"
                  ? "loyalty.approve"
                  : "loyalty.reject",
              id: claim.id,
              payload: {
                eligible_sen: Math.round(Number(f.get("eligible")) * 100),
                paid_reference: f.get("paid_reference"),
                review_note: f.get("review_note"),
                paid_confirmed: f.get("paid_confirmed") === "on",
              },
            });
          }}
        >
          <p>
            Customer:{" "}
            {data.customers.find((c) => c.id === claim.customer_id)?.name}
          </p>
          <Field label="Decision">
            <select name="decision">
              <option>Approve</option>
              <option>Reject</option>
            </select>
          </Field>
          <Field label="Eligible paid spending (RM)">
            <input
              name="eligible"
              type="number"
              min="0.01"
              max={claim.total_sen / 100}
              step="0.01"
            />
          </Field>
          <p className="small muted">
            Exclude spending outside the dealer programme, tax or discounts
            where applicable. Current rate: {data.settings[0].points_per_rm}{" "}
            points per RM; round down once per invoice.
          </p>
          <Field label="Unique dealer payment / transaction reference">
            <input name="paid_reference" maxLength={100} />
          </Field>
          <Field label="Verification note / rejection reason">
            <textarea name="review_note" required maxLength={2000} />
          </Field>
          <label className="checkbox">
            <input name="paid_confirmed" type="checkbox" />I matched the
            original invoice and customer to a paid dealer transaction, checked
            the currency and eligibility, and confirmed the invoice number
            against dealer records.
          </label>
          <Button disabled={busy}>Save decision</Button>
        </form>
      )}
    </Card>
  );
}
export function LoyaltyClaims() {
  const { actor, data, run, busy } = useWorkspace();
  const customer = data.customers.find((c) => c.user_id === actor.user_id);
  return (
    <>
      <Heading
        eyebrow="LOYALTY / VERIFIED SPENDING"
        title={
          actor.role === "customer"
            ? "Turn verified spending into points"
            : "Loyalty claim review"
        }
        description="Upload → extract → check details → verify payment → credit points"
      />
      {mode === "demo" && (
        <p className="inline-note">
          Demo mode does not perform OCR. It copies the declared amount and lets
          you enter sample details to test the approval workflow. Live automatic
          extraction requires the server setup.
        </p>
      )}
      {actor.role === "customer" && (
        <Card>
          <h2>Upload a receipt for points</h2>
          <p>
            Choose a vehicle to open an upload record, or use an existing
            service record below.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await run({
                type: "phase2.request.create",
                payload: {
                  customer_id: customer?.id,
                  vehicle_id: f.get("vehicle_id"),
                  category: "Maintenance",
                  details: "Loyalty receipt submission",
                },
              });
            }}
          >
            <Field label="Vehicle for this receipt">
              <select name="vehicle_id" required>
                <option value="">Choose vehicle</option>
                {data.vehicles
                  .filter((v) => v.verified)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration} · {v.model}
                    </option>
                  ))}
              </select>
            </Field>
            <Button disabled={busy}>Open upload record</Button>
          </form>
          {data.service_requests
            .filter((r) => r.details === "Loyalty receipt submission")
            .map((r) => (
              <Documents key={r.id} request={r} />
            ))}
        </Card>
      )}
      <div className="stack">
        {actor.role === "customer" &&
          data.service_documents
            .filter(
              (d) =>
                d.kind !== "Supporting document" &&
                !data.loyalty_claims.some((c) => c.document_id === d.id),
            )
            .map((d) => (
              <Card key={d.id}>
                <h3>{d.filename}</h3>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run({ type: "loyalty.extract", id: d.id, payload: {} })
                  }
                >
                  Extract receipt details
                </Button>
              </Card>
            ))}
        {!data.loyalty_claims.length && (
          <Empty
            title="No points claims yet"
            description="Uploaded receipts and invoices can be submitted for points."
          />
        )}
        {data.loyalty_claims.map((c) => (
          <ClaimCard key={c.id + ":" + c.status} claim={c} />
        ))}
      </div>
    </>
  );
}
