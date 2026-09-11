import { localDate, money } from "../lib/rules";
import { useState } from "react";
import { Button, Card, Field, Heading, Badge, Empty } from "../components/ui";
import { useWorkspace } from "../lib/context";
import { Documents } from "./ServiceDocuments";
const journeys: Record<
  string,
  {
    title: string;
    steps: string[];
    fields: [string, string, string][];
    submit: string;
  }
> = {
  Maintenance: {
    title: "Plan your maintenance",
    steps: [
      "Choose your vehicle and service",
      "Request dealer confirmation or book a slot",
      "Keep your service records and receipts",
    ],
    fields: [
      ["service", "Service required", "text"],
      ["mileage", "Current mileage (km)", "number"],
      ["preferred_date", "Preferred service date", "date"],
    ],
    submit: "Request maintenance follow-up",
  },
  Repairs: {
    title: "Arrange a repair",
    steps: [
      "Describe the problem",
      "Dealer arranges inspection and quotation",
      "Review the quote with your dealer before work begins",
    ],
    fields: [
      ["symptoms", "Symptoms or damage", "text"],
      ["driveable", "Is the vehicle driveable?", "driveable"],
    ],
    submit: "Request repair assessment",
  },
  Parts: {
    title: "Find the right part",
    steps: [
      "Identify the vehicle and part",
      "Dealer checks fitment, stock and price",
      "Arrange collection or installation after confirmation",
    ],
    fields: [
      ["part", "Part name or number", "text"],
      ["quantity", "Quantity", "number"],
      ["fulfilment", "Collection or installation", "fulfilment"],
    ],
    submit: "Request part availability",
  },
  Insurance: {
    title: "Renew your vehicle insurance",
    steps: [
      "Choose the vehicle and enter renewal details",
      "Request options from the dealer / insurance partner",
      "Review the provider quote and arrange renewal directly",
    ],
    fields: [
      ["insurer", "Current insurer", "text"],
      ["expiry", "Policy expiry date", "date"],
      ["cover", "Requested cover", "cover"],
    ],
    submit: "Request renewal options",
  },
  Towing: {
    title: "Breakdown & accident assistance",
    steps: [
      "Contact your verified assistance provider for urgent help",
      "Record the vehicle, location and incident",
      "Upload towing invoices, receipts or supporting documents",
    ],
    fields: [
      ["incident", "Type of incident", "incident"],
      ["location", "Vehicle location / landmark", "text"],
      ["contact", "Callback number", "tel"],
      ["destination", "Requested towing destination", "text"],
    ],
    submit: "Record assistance case",
  },
};
export function ServiceJourney({ category }: { category: string }) {
  const { actor, data, run, busy, navigate } = useWorkspace();
  const c = data.customers.find((x) => x.user_id === actor.user_id);
  const [saved, setSaved] = useState(false);
  const config = journeys[category] || journeys.Maintenance;
  const rows = data.service_requests.filter((r) => r.category === category);
  const options: Record<string, string[]> = {
    driveable: ["Yes", "No", "Unsure"],
    fulfilment: ["Collection", "Installation"],
    cover: ["Discuss available cover", "Comprehensive", "Third party"],
    incident: ["Breakdown", "Accident", "Already towed — submit documents"],
  };
  return (
    <>
      <Heading
        eyebrow={"OWNERSHIP / " + category.toUpperCase()}
        title={config.title}
        description="Your vehicle, the right next step, and supporting documents in one place."
      />
      <div className="service-tabs">
        {Object.keys(journeys).map((k) => (
          <Button
            key={k}
            variant={k === category ? "primary" : "secondary"}
            onClick={() => navigate(k.toLowerCase())}
          >
            {k}
          </Button>
        ))}
      </div>
      {category === "Towing" && (
        <Card className="assistance-note">
          <h2>Need urgent assistance?</h2>
          <p>
            This app does not dispatch a tow truck or monitor emergencies.
            Contact your insurer’s verified roadside assistance provider
            directly. You can record an accident or breakdown below and attach
            documents afterwards.
          </p>
        </Card>
      )}
      <div className="split-layout">
        <div className="stack">
          <Card>
            <h2>What happens next</h2>
            <ol className="journey-steps">
              {config.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {category === "Maintenance" && (
              <Button onClick={() => navigate("booking")}>
                Choose an appointment slot
              </Button>
            )}
          </Card>
          {["Maintenance", "Repairs", "Parts"].includes(category) &&
            data.service_catalogue
              .filter(
                (i) =>
                  i.category === category &&
                  i.active &&
                  i.effective_on <= localDate(),
              )
              .map((i) => (
                <Card key={i.id}>
                  <Badge>{category}</Badge>
                  <h2>{i.title}</h2>
                  <p>{i.description}</p>
                  <p>
                    {money(i.price_sen)} · Indicative price, subject to dealer
                    confirmation
                  </p>
                </Card>
              ))}
          <Card>
            <h2>{category} records & documents</h2>
            <p>
              Open a request first, then take a photo or upload its receipts and
              supporting documents below.
            </p>
            {!rows.length && <Empty title="No records yet" />}
            {rows.map((r) => (
              <section className="request-row" key={r.id}>
                <Badge>{r.status}</Badge>
                <p className="small muted">
                  {
                    data.vehicles.find((v) => v.id === r.vehicle_id)
                      ?.registration
                  }{" "}
                  · {new Date(r.created_at).toLocaleDateString()}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>{r.details}</p>
                {r.outcome && (
                  <p className="inline-note">Dealer update: {r.outcome}</p>
                )}
                <Documents request={r} />
              </section>
            ))}
          </Card>
        </div>
        <Card>
          <h2>
            {category === "Insurance"
              ? "Renewal details"
              : category === "Towing"
                ? "Incident details"
                : "Tell us what you need"}
          </h2>
          {saved && (
            <p role="status" className="inline-note">
              Request recorded. Add your receipts or documents under this
              service’s records.
            </p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const values = new FormData(f);
              const details = config.fields
                .map(([key, label]) => `${label}: ${values.get(key)}`)
                .concat(String(values.get("notes") || ""))
                .join("\n");
              if (
                await run({
                  type: "phase2.request.create",
                  payload: {
                    customer_id: c?.id,
                    vehicle_id: values.get("vehicle_id"),
                    category,
                    details,
                  },
                })
              ) {
                f.reset();
                setSaved(true);
              }
            }}
          >
            <Field label="Vehicle">
              <select name="vehicle_id" required>
                <option value="">Choose your vehicle</option>
                {data.vehicles
                  .filter((v) => v.verified)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration} · {v.model}
                    </option>
                  ))}
              </select>
            </Field>
            {config.fields.map(([key, label, type]) => (
              <Field key={key} label={label}>
                {options[type] ? (
                  <select name={key} required>
                    {options[type].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={key}
                    type={type}
                    required
                    maxLength={300}
                    min={key === "quantity" ? 1 : 0}
                    max={key === "quantity" ? 1000 : 2000000}
                  />
                )}
              </Field>
            ))}
            <Field label="Additional notes (optional)">
              <textarea name="notes" maxLength={1200} />
            </Field>
            <Button disabled={busy}>{config.submit}</Button>
          </form>
          {category === "Insurance" && (
            <p className="small muted">
              This requests a follow-up, not an insurance purchase. Premiums,
              cover and payment are confirmed by the provider.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
