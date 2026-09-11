import { useEffect, useState } from "react";
import { Badge, Button, Field } from "../components/ui";
import { useWorkspace } from "../lib/context";
import { mode, supabase } from "../lib/supabase";
import type { ServiceRequest, ServiceDocument } from "../lib/types";
import { money } from "../lib/rules";
export async function validateDocument(file: File) {
  const limit = mode === "demo" ? 1024 * 1024 : 5 * 1024 * 1024;
  if (!file.size || file.size > limit)
    throw Error(`Choose a file up to ${mode === "demo" ? "1" : "5"} MB.`);
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid =
    (file.type === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (file.type === "image/png" &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) ||
    (file.type === "application/pdf" &&
      String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-");
  if (!valid)
    throw Error(
      "Choose a JPEG, PNG or PDF file. Convert HEIC photos to JPEG first.",
    );
}
export function Documents({ request }: { request: ServiceRequest }) {
  const { actor, data, run, busy, notify } = useWorkspace();
  const [file, setFile] = useState<File | null>(null),
    [uploading, setUploading] = useState(false),
    [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const docs = data.service_documents.filter(
    (d) => d.request_id === request.id,
  );
  async function view(d: ServiceDocument) {
    try {
      if (mode === "demo") {
        const encoded = d.demo_url!.split(",")[1];
        const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        setPreview(
          URL.createObjectURL(new Blob([bytes], { type: d.mime_type })),
        );
      } else {
        const { data, error } = await supabase!.storage
          .from("service-evidence")
          .createSignedUrl(d.storage_path, 60);
        if (error) throw error;
        setPreview(data.signedUrl);
      }
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <div className="documents-panel">
      <h3>Receipts & supporting documents</h3>
      <p className="small muted">
        Verification records a manual review of evidence. It does not create a
        payment, refund or loyalty credit.
      </p>
      {docs.map((d) => (
        <div className="document-row" key={d.id}>
          <strong>{d.filename}</strong>
          <Badge
            tone={
              d.status === "Verified"
                ? "green"
                : d.status === "Rejected"
                  ? "red"
                  : "amber"
            }
          >
            {d.status}
          </Badge>
          <p>
            {d.kind} · Declared amount: {money(d.amount_sen)}
            {d.payment_reference ? " · Ref: " + d.payment_reference : ""}
          </p>
          <Button type="button" variant="secondary" onClick={() => view(d)}>
            View document
          </Button>
          {d.review_note && <p>Review: {d.review_note}</p>}
          {actor.role === "manager" && d.status === "Awaiting verification" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await run({
                  type: "document.review",
                  id: d.id,
                  payload: Object.fromEntries(new FormData(e.currentTarget)),
                });
              }}
            >
              <Field label="Review decision">
                <select name="status">
                  <option>Verified</option>
                  <option>Rejected</option>
                </select>
              </Field>
              <Field label="Review note / payment reconciliation reference">
                <textarea name="review_note" required maxLength={2000} />
              </Field>
              <Button disabled={busy}>Save verification</Button>
            </form>
          )}
        </div>
      ))}
      {preview && (
        <div className="document-preview">
          <a href={preview} target="_blank" rel="noreferrer">
            Open document in a new tab
          </a>
          <Button variant="text" onClick={() => setPreview("")}>
            Close preview
          </Button>
        </div>
      )}
      {actor.role === "customer" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            const form = e.currentTarget;
            setUploading(true);
            let path = "";
            try {
              await validateDocument(file);
              const f = new FormData(form);
              const amount = Number(f.get("amount") || 0);
              const amountSen = Math.round(amount * 100);
              if (
                !Number.isFinite(amount) ||
                amount < 0 ||
                amountSen > 100000000
              )
                throw Error("Invalid amount.");
              let demo_url = "";
              if (mode === "demo") {
                demo_url = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = () =>
                    reject(Error("File could not be read."));
                  reader.readAsDataURL(file);
                });
              } else {
                path = `${actor.tenant_id}/${actor.branch_id}/${request.customer_id}/${request.id}/${crypto.randomUUID()}`;
                const { error } = await supabase!.storage
                  .from("service-evidence")
                  .upload(path, file, {
                    contentType: file.type,
                    upsert: false,
                  });
                if (error) throw error;
              }
              const success = await run({
                type: "document.register",
                payload: {
                  request_id: request.id,
                  filename: file.name,
                  mime_type: file.type,
                  storage_path: path,
                  demo_url,
                  kind: f.get("kind"),
                  amount_sen: amountSen,
                  payment_reference: f.get("payment_reference"),
                },
              });
              if (success) {
                setFile(null);
                form.reset();
              } else if (path) {
                await supabase!.storage.from("service-evidence").remove([path]);
              }
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setUploading(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label="Upload file">
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                disabled={uploading}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
            <Field label="Take a photo (supported phones)">
              <input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                disabled={uploading}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
          </div>
          <p className="small muted">
            {file
              ? `Selected: ${file.name}`
              : `JPEG, PNG or PDF · ${mode === "demo" ? "1 MB maximum. Demo files stay in this browser; use sample documents." : "5 MB maximum. Stored privately in your dealer workspace."}`}
          </p>
          <Field label="Document type">
            <select name="kind">
              <option>Receipt</option>
              <option>Invoice</option>
              <option>Supporting document</option>
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Amount shown (RM; optional)">
              <input
                name="amount"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
              />
            </Field>
            <Field label="Receipt / transaction reference">
              <input name="payment_reference" maxLength={150} />
            </Field>
          </div>
          <Button disabled={busy || uploading || !file}>
            {uploading ? "Uploading…" : "Upload for verification"}
          </Button>
        </form>
      )}
    </div>
  );
}
