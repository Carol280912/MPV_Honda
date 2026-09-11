import { useState } from "react";
import { Badge, Button, Card, Empty, Field, Heading } from "../components/ui";
import { useWorkspace } from "../lib/context";
import { localDate, money } from "../lib/rules";
const categories = [
  "Maintenance",
  "Repairs",
  "Parts",
  "Insurance",
  "Towing",
  "Referral",
  "Trade-in",
];
export function PhaseTwo({
  initialCategory = "Maintenance",
}: {
  initialCategory?: string;
}) {
  const { actor, data, run, busy, navigate } = useWorkspace();
  const [category, setCategory] = useState(initialCategory);
  const customer = data.customers.find((c) => c.user_id === actor.user_id);
  const admin = actor.role === "administrator",
    manager = actor.role === "manager";
  return (
    <>
      <Heading
        eyebrow="OWNERSHIP / PHASE 02"
        title={
          admin
            ? "Service catalogue"
            : manager
              ? "Service requests"
              : "Care for every journey"
        }
        description={
          admin
            ? "Publish dated catalogue entries. Archive previous versions to preserve their history."
            : manager
              ? "Track customer requests and record clear next steps."
              : "Explore dealership services and follow your requests in one place."
        }
      />
      <div className="split-layout">
        <div className="stack">
          {!manager &&
            data.service_catalogue
              .filter(
                (x) => admin || (x.active && x.effective_on <= localDate()),
              )
              .map((item) => (
                <Card key={item.id}>
                  <Badge>{item.category}</Badge>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  <h3>
                    {money(item.price_sen)}{" "}
                    <small>indicative catalogue price</small>
                  </h3>
                  <p className="small muted">
                    Effective {item.effective_on} ·{" "}
                    {item.active ? "Active" : "Archived"}
                  </p>
                  {admin ? (
                    item.active && (
                      <Button
                        disabled={busy}
                        variant="secondary"
                        onClick={() =>
                          run({
                            type: "phase2.catalogue.archive",
                            id: item.id,
                            payload: {},
                          })
                        }
                      >
                        Archive version
                      </Button>
                    )
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setCategory(item.category)}
                    >
                      Request this service
                    </Button>
                  )}
                </Card>
              ))}
          <Card>
            <h2>{manager ? "Branch request queue" : "Request history"}</h2>
            {!data.service_requests.length && (
              <Empty
                title="No requests yet"
                description="Submitted requests and their progress will appear here."
              />
            )}
            {data.service_requests.map((r) => (
              <div className="request-row" key={r.id}>
                <div className="row">
                  <h3>{r.category}</h3>
                  <Badge tone={r.status === "Closed" ? "green" : "amber"}>
                    {r.status}
                  </Badge>
                </div>
                <p>{r.details}</p>
                <p className="small muted">
                  {
                    data.vehicles.find((v) => v.id === r.vehicle_id)
                      ?.registration
                  }{" "}
                  · {new Date(r.created_at).toLocaleDateString()}
                  {manager
                    ? " · " +
                      data.customers.find((c) => c.id === r.customer_id)?.name
                    : ""}
                </p>
                {r.outcome && <p className="inline-note">{r.outcome}</p>}
                {manager && r.status !== "Closed" && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = e.currentTarget;
                      if (
                        await run({
                          type: "phase2.request.update",
                          id: r.id,
                          payload: Object.fromEntries(new FormData(f)),
                        })
                      )
                        f.reset();
                    }}
                  >
                    <Field label="Next status">
                      <select name="status">
                        {(r.status === "Requested"
                          ? ["In progress", "Closed"]
                          : r.status === "In progress"
                            ? ["Waiting for customer", "Closed"]
                            : ["In progress", "Closed"]
                        ).map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Customer-visible update / closure reason">
                      <textarea name="outcome" required maxLength={2000} />
                    </Field>
                    <Button disabled={busy}>Update request</Button>
                  </form>
                )}
              </div>
            ))}
          </Card>
        </div>
        <div className="stack">
          {admin ? (
            <Card>
              <h2>Add catalogue version</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  if (
                    await run({
                      type: "phase2.catalogue.create",
                      payload: Object.fromEntries(new FormData(f)),
                    })
                  )
                    f.reset();
                }}
              >
                <Field label="Title">
                  <input name="title" required maxLength={100} />
                </Field>
                <Field label="Category">
                  <select name="category">
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Scope and pricing source">
                  <textarea name="description" required maxLength={2000} />
                </Field>
                <Field label="Indicative price (sen; RM1 = 100 sen)">
                  <input
                    name="price_sen"
                    type="number"
                    min={0}
                    max={10000000}
                    required
                    step={1}
                  />
                </Field>
                <Field label="Effective date">
                  <input name="effective_on" type="date" required />
                </Field>
                <Button disabled={busy}>Publish catalogue version</Button>
              </form>
            </Card>
          ) : !manager ? (
            <Card>
              <h2>Request assistance</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  if (
                    await run({
                      type: "phase2.request.create",
                      payload: {
                        ...Object.fromEntries(new FormData(f)),
                        customer_id: customer?.id,
                      },
                    })
                  )
                    f.reset();
                }}
              >
                <Field label="Service">
                  <select
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                {category === "Towing" && (
                  <p className="inline-note">
                    This request is not monitored as an emergency dispatch
                    service. For urgent help, contact your verified roadside
                    assistance provider directly.
                  </p>
                )}
                {category === "Insurance" && (
                  <p className="inline-note">
                    Request a dealer follow-up. Coverage and pricing require
                    confirmation from the insurance provider.
                  </p>
                )}
                <Field label="Vehicle">
                  <select required name="vehicle_id">
                    <option value="">Choose verified vehicle</option>
                    {data.vehicles
                      .filter((v) => v.verified)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registration} · {v.model}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="What do you need?">
                  <textarea required name="details" maxLength={2000} />
                </Field>
                <Button disabled={busy}>Submit request</Button>
              </form>
              <hr />
              <Button variant="secondary" onClick={() => navigate("booking")}>
                Book a service appointment
              </Button>
            </Card>
          ) : (
            <Card>
              <h2>Queue overview</h2>
              <strong className="big-number">
                {
                  data.service_requests.filter((r) => r.status !== "Closed")
                    .length
                }
              </strong>
              <p>Open customer requests</p>
              <p>
                Updates are shared with the customer and recorded in the
                business audit.
              </p>
            </Card>
          )}
          <Card>
            <Badge>INTEGRATION STATUS</Badge>
            <h2>Dealer follow-up</h2>
            <p>
              Requests are recorded in this workspace. Payment processing,
              insurer quotations, inventory availability and roadside dispatch
              are not connected.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
