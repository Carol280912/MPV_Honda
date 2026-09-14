import { useState } from "react";
import {
  CalendarDays,
  MessageSquareText,
  ArrowRight,
  Battery,
  ShieldCheck,
  CarFront,
  Gift,
  Clock3,
  ChevronRight,
  TriangleAlert,
  Tag,
  Disc3,
  Droplets,
  Plus,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  SectionTitle,
} from "../components/ui";
import { useWorkspace } from "../lib/context";
import { balance, localDate, money } from "../lib/rules";
export function CustomerHome() {
  const { data, actor, navigate } = useWorkspace();
  const customer = data.customers.find((c) => c.user_id === actor.user_id);
  const [selected, setSelected] = useState("");
  const owned = data.vehicles.filter((v) => v.customer_id === customer?.id);
  const v = owned.find((v) => v.id === selected) || owned[0];
  const s = data.settings[0];
  const points = customer ? balance(data, customer.id) : 0;
  const ap = data.appointments
    .filter((a) => !["Completed", "Cancelled", "No-show"].includes(a.status))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const inspection = data.inspections
    .filter((i) => i.vehicle_id === v?.id)
    .at(-1);
  return (
    <>
      <Heading
        eyebrow="YOUR PERSONAL OWNERSHIP DASHBOARD"
        title={`Good to see you, ${customer?.name.split(" ")[0] || actor.name.split(" ")[0]}.`}
        description="A little care today. More confidence tomorrow."
        action={
          <button
            className="subtle-button"
            onClick={() => navigate("vehicles")}
          >
            <Plus size={16} />
            Manage vehicles
          </button>
        }
      />
      <div className="customer-grid">
        <div className="customer-primary">
          <Card className="vehicle-card">
            <div className="vehicle-heading">
              <div>
                <div className="eyebrow">MY VEHICLE</div>
                <h2>{v?.model || "Your journey starts here"}</h2>
                <p>
                  {v
                    ? `${v.registration} · ${v.mileage.toLocaleString()} km`
                    : "Add a vehicle to start planning your next visit."}
                </p>
              </div>
              <Badge tone={v?.verified ? "green" : "amber"}>
                {v?.verified ? "● Good standing" : "Verification pending"}
              </Badge>
            </div>
            {owned.length > 1 && (
              <select
                className="vehicle-selector"
                aria-label="Select vehicle"
                value={v?.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {owned.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.registration} · {v.model}
                  </option>
                ))}
              </select>
            )}
            <Card className="health-card">
              <SectionTitle
                title="Vehicle health overview"
                action="View report"
                onClick={() => navigate("health")}
              />
              <div className="row">
                <p className="muted small">
                  {inspection
                    ? "Latest dealer inspection · Checklist v" +
                      inspection.version
                    : "An inspection report will appear after your visit."}
                </p>
                <Badge tone="green">
                  {inspection?.score || v?.health || "—"}/100
                </Badge>
              </div>
              <div className="health-grid">
                {[
                  [Droplets, "Engine oil", inspection?.oil],
                  [Battery, "Battery", inspection?.battery],
                  [Disc3, "Tyres", inspection?.tyres],
                  [Disc3, "Brakes", inspection?.brakes],
                ].map(([Icon, n, value]) => {
                  const I = Icon as typeof Battery;
                  return (
                    <div
                      className={value === "Check" ? "needs-attention" : ""}
                      key={String(n)}
                    >
                      <I size={17} />
                      <span>{String(n)}</span>
                      <strong>{value ? String(value) : "—"}</strong>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Card>
          <section className="promotion">
            <div className="promotion-visual">
              <img
                src="https://lh3.googleusercontent.com/aida/AEtjO1UEnLZz_YmzOTfTQI9Nk7j0m26CCaFRP2AFcCPMBU1pjVdbAhWaqYnlVODetFXIyXvvRNEbwajJjMDZWIabHhnlpivZJUESwLIa5a-d1ix315iav69mXjeMV0qqvRgvHaY0z8AX6RsPZvkZJMo7wJvQKbTDwYFlq2uaXBUfgxs0Bgv_EwulnZ0hS-ZQ72NGAVKarKQkgSWvsX15rOO994sbYh21_G5ij_z3tV2R7PmJGc1K3SmcpmzEjKY"
                alt="Automotive workshop service team"
                referrerPolicy="no-referrer"
              />
            </div>
            <Badge tone="red">DEALERSHIP OFFERS</Badge>
            <h2>Special promotions</h2>
            <p>Your next chapter deserves the same expert care.</p>
            <p className="small">
              Discover eligible offers from your dealership.
            </p>
            <Button onClick={() => navigate("offers")}>
              Explore offers
              <ArrowRight size={16} />
            </Button>
          </section>
          <h2>Service pillars</h2>
          <div className="quick-actions">
            {[
              [CarFront, "Maintenance", "maintenance"],
              [ShieldCheck, "Repairs", "repairs"],
              [Tag, "Parts", "parts"],
              [ShieldCheck, "Insurance", "insurance"],
              [CarFront, "Towing", "towing"],
              [CalendarDays, "Appointments", "appointments"],
              [MessageSquareText, "Feedback", "feedback"],
            ].map(([Icon, label, path]) => {
              const I = Icon as typeof CarFront;
              return (
                <button
                  key={String(label)}
                  onClick={() => navigate(String(path))}
                >
                  <span>
                    <I size={21} />
                  </span>
                  {String(label)}
                  <ChevronRight size={15} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="customer-secondary">
          <Card className="loyalty-card">
            <div className="row">
              <div className="loyalty-icon">
                <Gift size={21} />
              </div>
              <div className="grow">
                <div className="eyebrow">LOYALTY MEMBERSHIP</div>
                <strong className="points">
                  {points.toLocaleString()} <span>pts</span>
                </strong>
              </div>
              <Badge tone="green">
                {points >= s.reward_points
                  ? "Reward available"
                  : "Keep earning"}
              </Badge>
            </div>
            <div className="progress-caption">
              <span>Tier progress</span>
              <span>
                {Math.max(0, s.tier_points - points).toLocaleString()} pts to
                next tier
              </span>
            </div>
            <div className="progress">
              <i
                style={{
                  width: Math.min(100, (points / s.tier_points) * 100) + "%",
                }}
              />
            </div>
            <button className="text-link" onClick={() => navigate("wallet")}>
              View rewards <ArrowRight size={15} />
            </button>
          </Card>

          <Card>
            <SectionTitle title="Your next appointment" />
            {ap ? (
              <>
                <Badge tone="green">● {ap.status}</Badge>
                <div className="appointment-preview">
                  <div className="date-tile">
                    <small>
                      {new Date(ap.date + "T12:00").toLocaleDateString("en", {
                        month: "short",
                      })}
                    </small>
                    <strong>{new Date(ap.date + "T12:00").getDate()}</strong>
                  </div>
                  <div>
                    <h3>{ap.service}</h3>
                    <p>
                      <Clock3 size={13} />
                      {ap.time} ·{" "}
                      {new Date(ap.date + "T12:00").toLocaleDateString("en", {
                        weekday: "long",
                      })}
                    </p>
                    <p>Glenmarie branch · Shah Alam</p>
                  </div>
                </div>
                <div className="two-buttons">
                  <Button
                    variant="secondary"
                    onClick={() => navigate("appointments")}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="dark"
                    onClick={() => navigate("appointments")}
                  >
                    Details <ChevronRight size={16} />
                  </Button>
                </div>
              </>
            ) : (
              <Empty
                title="No upcoming visits"
                description="Book when you’re ready. We’ll be here."
              />
            )}
          </Card>
          <Card className="priority-card">
            <Badge tone="red">
              <TriangleAlert size={13} />
              ACTION RECOMMENDED
            </Badge>
            <h2>
              {v?.verified
                ? v.next_service > 0
                  ? `Next service due: ${v.next_service.toLocaleString()} km`
                  : "Plan your next service"
                : "Verify your vehicle ownership"}
            </h2>
            <p>
              {v?.verified
                ? `Approximately ${Math.max(0, v.next_service - v.mileage).toLocaleString()} km to your next recommended visit.`
                : "Your dealer will verify the vehicle before bookings are enabled."}
            </p>
            <div className="battery-note">
              <Battery size={18} />
              <span>Battery health</span>
              <strong>{inspection?.battery || "No report yet"}</strong>
              <span className="muted">
                {inspection?.battery === "Check" ? "Check advised" : ""}
              </span>
            </div>
            <Button
              className="button primary full"
              onClick={() => navigate(v?.verified ? "booking" : "vehicles")}
            >
              <CalendarDays size={18} />
              {v?.verified ? "Book service" : "My vehicles"}
            </Button>
          </Card>
          <div className="care-note">
            <ShieldCheck size={27} />
            <div>
              <strong>Care that stays with you.</strong>
              <p>Your vehicle. Your trusted dealership.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export function CustomerVehicles() {
  const { data, actor, run, busy } = useWorkspace();
  const c = data.customers.find((x) => x.user_id === actor.user_id);
  return (
    <>
      <Heading
        title="My garage"
        description="Your vehicles and ownership verification."
      />
      <div className="split-layout">
        <div className="stack">
          {data.vehicles.map((v) => (
            <Card key={v.id}>
              <div className="row">
                <CarFront />
                <h2>{v.model}</h2>
                <Badge tone={v.verified ? "green" : "amber"}>
                  {v.verified ? "Verified" : "Pending verification"}
                </Badge>
              </div>
              <p>
                {v.registration} · {v.mileage.toLocaleString()} km
              </p>
            </Card>
          ))}
        </div>
        <Card>
          <h2>Add a vehicle</h2>
          <p className="muted">
            Registration alone does not grant access to past vehicle records.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              if (
                await run({
                  type: "vehicle.create",
                  payload: { ...Object.fromEntries(f), customer_id: c?.id },
                })
              )
                form.reset();
            }}
          >
            <Field label="Registration">
              <input required name="registration" maxLength={20} />
            </Field>
            <Field label="Model">
              <input required name="model" maxLength={80} />
            </Field>
            <div className="form-grid">
              <Field label="Year">
                <input
                  required
                  name="year"
                  type="number"
                  min={1980}
                  max={2100}
                />
              </Field>
              <Field label="Mileage (km)">
                <input
                  required
                  name="mileage"
                  type="number"
                  min={0}
                  max={2000000}
                />
              </Field>
            </div>
            <Button disabled={busy}>Request verification</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
export function CustomerWallet() {
  const { data, actor } = useWorkspace();
  const c = data.customers.find((x) => x.user_id === actor.user_id),
    s = data.settings[0];
  return (
    <>
      <Heading
        action={
          <Button onClick={() => (window.location.hash = "claims")}>
            Submit receipt / points claims
          </Button>
        }
        title="My rewards"
        description="Your loyalty, recognised. Every entry has a story."
      />
      <div className="metrics">
        <Card>
          <div className="eyebrow">AVAILABLE POINTS</div>
          <strong className="big-number">
            {balance(data, c?.id || "").toLocaleString()}
          </strong>
          <p>Points follow the dealer’s configured earning rules.</p>
        </Card>
        <Card>
          <Badge tone="red">PROGRAMME BENEFIT</Badge>
          <h2>{money(s.reward_value_sen)} service reward</h2>
          <p>{s.reward_points.toLocaleString()} points required</p>
          <div className="inline-note">
            Transaction redemption connects to the Phase 2 quotation/payment
            workflow.
          </div>
        </Card>
      </div>
      <Card>
        <SectionTitle title="Points history" />
        {data.loyalty_entries.map((l) => (
          <div className="list-row" key={l.id}>
            <div>
              <h3>{l.reason}</h3>
              <p>
                {new Date(l.created_at).toLocaleDateString()} · Ref:{" "}
                {l.reference}
              </p>
            </div>
            <strong className={l.points > 0 ? "green-text" : ""}>
              {l.points > 0 ? "+" : ""}
              {l.points.toLocaleString()}
            </strong>
          </div>
        ))}
      </Card>
    </>
  );
}
export function CustomerFeedback() {
  const { data, actor, run, busy } = useWorkspace();
  const c = data.customers.find((x) => x.user_id === actor.user_id);
  const [rating, setRating] = useState(0);
  const choices = data.appointments.filter(
    (a) =>
      a.status === "Completed" &&
      !data.feedback.some((f) => f.appointment_id === a.id),
  );
  return (
    <>
      <Heading
        title="Your experience matters."
        description="Tell us how your visit went. We’re listening."
      />
      <div className="split-layout">
        <Card>
          {choices.length ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await run({
                    type: "feedback.create",
                    payload: {
                      ...Object.fromEntries(f),
                      customer_id: c?.id,
                      rating,
                      contact_requested: f.get("contact_requested") === "on",
                    },
                  })
                )
                  setRating(0);
              }}
            >
              <Field label="Completed visit">
                <select required name="appointment_id">
                  {choices.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.date} · {a.service}
                    </option>
                  ))}
                </select>
              </Field>
              <p>How would you rate your visit?</p>
              <div className="rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    aria-pressed={rating === n}
                    type="button"
                    key={n}
                    onClick={() => setRating(n)}
                    className={rating === n ? "selected" : ""}
                  >
                    {n}
                    <span>★</span>
                  </button>
                ))}
              </div>
              <Field label="Your comments">
                <textarea name="comments" maxLength={2000} />
              </Field>
              <label className="checkbox">
                <input name="contact_requested" type="checkbox" />I would like
                my service advisor to contact me.
              </label>
              <Button disabled={busy || !rating}>Submit feedback</Button>
            </form>
          ) : (
            <Empty
              title="You’re all caught up"
              description="Feedback opens after a completed visit."
            />
          )}
        </Card>
        <Card>
          <h2>Previous feedback</h2>
          {data.feedback.map((f) => (
            <div className="list-row" key={f.id}>
              <div>
                <Badge tone="amber">{f.rating} / 5</Badge>
                <p>{f.comments}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
export function CustomerMore() {
  const { navigate, data, actor, run } = useWorkspace();
  const c = data.customers.find((x) => x.user_id === actor.user_id);
  return (
    <>
      <Heading title="Your ownership essentials" />
      <div className="split-layout">
        <Card>
          {[
            ["My vehicles", "vehicles"],
            ["Service history", "history"],
            ["My notifications", "notifications"],
            ["Vehicle health", "health"],
            ["My feedback", "feedback"],
          ].map(([n, r]) => (
            <button className="menu-row" key={r} onClick={() => navigate(r)}>
              {n}
              <ChevronRight size={17} />
            </button>
          ))}
        </Card>
        <Card>
          <h2>Profile & preferences</h2>
          <p>
            {c?.name} · {c?.email}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await run({
                type: "customer.update",
                payload: {
                  customer_id: c?.id,
                  phone: f.get("phone"),
                  marketing_consent: f.get("marketing") === "on",
                },
              });
            }}
          >
            <Field label="Mobile number">
              <input name="phone" defaultValue={c?.phone} type="tel" required />
            </Field>
            <label className="checkbox">
              <input
                name="marketing"
                type="checkbox"
                defaultChecked={c?.marketing_consent}
              />
              Send me promotional offers
            </label>
            <p className="small muted">
              Appointment updates are separate from optional marketing.
            </p>
            <Button>Save preferences</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
export function CustomerRecords({ kind }: { kind: string }) {
  const { data } = useWorkspace();
  return (
    <>
      <Heading
        title={
          kind === "health"
            ? "Vehicle health reports"
            : kind === "offers"
              ? "Offers for your next journey"
              : kind === "notifications"
                ? "Your updates"
                : "Service history"
        }
      />
      <div className="stack">
        {kind === "health"
          ? data.inspections.map((i) => (
              <Card key={i.id}>
                <Badge tone="green">{i.score}/100</Badge>
                <h2>Vehicle inspection</h2>
                <p>
                  Checklist v{i.version} ·{" "}
                  {new Date(i.created_at).toLocaleDateString()}
                </p>
                <div className="health-grid">
                  {["oil", "battery", "tyres", "brakes"].map((k) => (
                    <div key={k}>
                      <span>{k}</span>
                      <strong>{String(i[k as keyof typeof i])}</strong>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          : kind === "offers"
            ? data.campaigns
                .filter(
                  (c) =>
                    c.status === "Approved" &&
                    c.starts_on <= localDate() &&
                    c.ends_on >= localDate(),
                )
                .map((c) => (
                  <Card key={c.id}>
                    <Badge tone="red">{c.segment}</Badge>
                    <h2>{c.title}</h2>
                    <p>{c.description}</p>
                    <small>
                      Valid through {c.ends_on}. Eligibility is checked before
                      redemption.
                    </small>
                  </Card>
                ))
            : kind === "notifications"
              ? data.notifications.map((n) => (
                  <Card key={n.id}>
                    <Badge>{n.category}</Badge>
                    <h2>{n.title}</h2>
                    <p>{n.body}</p>
                  </Card>
                ))
              : data.appointments
                  .filter((a) => a.status === "Completed")
                  .map((a) => (
                    <Card key={a.id}>
                      <Badge tone="green">Completed</Badge>
                      <h2>{a.service}</h2>
                      <p>
                        {a.date} · {a.notes}
                      </p>
                    </Card>
                  ))}
        {((kind === "offers" &&
          !data.campaigns.some((c) => c.status === "Approved")) ||
          (kind === "health" && !data.inspections.length)) && (
          <Card>
            <Empty
              title="Nothing here yet"
              description="New information from your dealer will appear here."
            />
          </Card>
        )}
      </div>
    </>
  );
}
