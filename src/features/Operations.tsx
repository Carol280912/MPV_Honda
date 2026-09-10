import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Users,
  TriangleAlert,
  HeartHandshake,
  Download,
  Plus,
  CheckCircle2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Metric,
  SearchBox,
  SectionTitle,
  Table,
} from "../components/ui";
import { useWorkspace } from "../lib/context";
import {
  csvCell,
  eligibleAudience,
  localDate,
  money,
  segment,
} from "../lib/rules";
import type { Recovery } from "../lib/types";
export function OperationsHome() {
  const { data, actor, navigate } = useWorkspace(),
    s = data.settings[0];
  const open = data.recovery_cases.filter((r) => r.status !== "Resolved"),
    overdue = open.filter(
      (r) => !r.contact_log.trim() && new Date(r.due_at) < new Date(),
    ),
    today = data.appointments.filter((a) => a.date === localDate()),
    lapsed = data.customers.filter((c) => segment(c, s) === "Lapsed");
  const isAdvisor = actor.role === "advisor";
  return (
    <>
      <Heading
        eyebrow={
          isAdvisor
            ? "YOUR DAY, AT A GLANCE"
            : "DEALERSHIP OPERATIONS / GLENMARIE"
        }
        title={
          isAdvisor
            ? `Ready for the day, ${actor.name.split(" ")[0]}?`
            : "Every visit is a chance to retain."
        }
        description={
          isAdvisor
            ? "Your assigned customers, appointments and follow-ups."
            : "A clear view of your team, your customers and what needs attention."
        }
        action={<Badge tone="green">● Phase 1 workspace</Badge>}
      />
      <div className="metrics">
        <Metric
          label="Appointments today"
          value={today.length}
          detail="Scheduled for your branch scope"
          icon={<CalendarDays size={19} />}
        />
        <Metric
          label="Customers to win back"
          value={lapsed.length}
          detail={`No visit in ${s.lapse_days}+ days`}
          icon={<Users size={19} />}
        />
        <Metric
          label="Open recovery cases"
          value={open.length}
          detail={`${overdue.length} past response deadline`}
          icon={<HeartHandshake size={19} />}
        />
        <Metric
          label="Average feedback"
          value={
            data.feedback.length
              ? (
                  data.feedback.reduce((n, f) => n + f.rating, 0) /
                  data.feedback.length
                ).toFixed(1) + "/5"
              : "—"
          }
          detail={`${data.feedback.length} recorded responses`}
          icon={<CheckCircle2 size={19} />}
        />
      </div>
      <div className="operations-grid">
        <Card>
          <SectionTitle
            title="Attention required"
            action="Open recovery queue"
            onClick={() => navigate("recovery")}
          />
          {open.map((r) => (
            <button
              className="alert-row"
              key={r.id}
              onClick={() => navigate("recovery")}
            >
              <span className="alert-icon">
                <TriangleAlert size={19} />
              </span>
              <div className="grow">
                <h3>
                  {data.customers.find((c) => c.id === r.customer_id)?.name}{" "}
                  needs a follow-up
                </h3>
                <p>{r.comments}</p>
                <small>
                  Owner:{" "}
                  {data.memberships.find((m) => m.user_id === r.advisor_id)
                    ?.name || "Assigned advisor"}{" "}
                  · Due {new Date(r.due_at).toLocaleString()}
                </small>
              </div>
              <Badge
                tone={
                  !r.contact_log.trim() && new Date(r.due_at) < new Date()
                    ? "red"
                    : "amber"
                }
              >
                {r.contact_log.trim()
                  ? "Contacted"
                  : new Date(r.due_at) < new Date()
                    ? "Overdue"
                    : "Due soon"}
              </Badge>
            </button>
          ))}
          {!open.length && <Empty title="No open recovery alerts" />}
          <div className="section-divider" />
          <SectionTitle
            title="Today’s appointments"
            action="Manage appointments"
            onClick={() => navigate("appointments")}
          />
          {today.map((a) => (
            <div className="list-row" key={a.id}>
              <span className="time-pill">{a.time}</span>
              <div className="grow">
                <h3>
                  {data.customers.find((c) => c.id === a.customer_id)?.name}
                </h3>
                <p>{a.service}</p>
              </div>
              <Badge tone="blue">{a.status}</Badge>
            </div>
          ))}
          {!today.length && <Empty title="No appointments today" />}
        </Card>
        <div className="stack">
          <Card>
            <SectionTitle
              title="Customer retention"
              action="View worklist"
              onClick={() => navigate("customers")}
            />
            <p className="muted small">
              Current segments, calculated from the last recorded visit.
            </p>
            <div className="segment-chart">
              {["Active", "Due", "At risk", "Lapsed"].map((name, i) => {
                const n = data.customers.filter(
                  (c) => segment(c, s) === name,
                ).length;
                return (
                  <div key={name}>
                    <div className="row">
                      <span>
                        <i className={"legend-dot color-" + i} />
                        {name}
                      </span>
                      <strong>{n}</strong>
                    </div>
                    <div className="bar-track">
                      <i
                        className={"color-" + i}
                        style={{
                          width:
                            (data.customers.length
                              ? (n / data.customers.length) * 100
                              : 0) + "%",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="inline-note">
              Retention rate requires an eligible cohort and observation window.
              No rate is inferred from this snapshot.
            </div>
          </Card>
          <section className="dark-panel">
            <Badge tone="light">THE NEXT BEST ACTION</Badge>
            <h2>
              Bring customers
              <br />
              back into the habit.
            </h2>
            <p>
              {lapsed.filter((c) => c.marketing_consent).length} lapsed
              customers in your scope have marketing consent.
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate(isAdvisor ? "customers" : "campaigns")}
            >
              {isAdvisor ? "Open my worklist" : "Plan a win-back campaign"}
              <ArrowRight size={16} />
            </Button>
          </section>
        </div>
      </div>
    </>
  );
}
export function Customers() {
  const { data, actor, run } = useWorkspace();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [selected, setSelected] = useState("");
  const s = data.settings[0];
  const rows = data.customers.filter(
    (c) =>
      (filter === "All" || segment(c, s) === filter) &&
      `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  const c = data.customers.find((c) => c.id === selected);
  function exportCsv() {
    const text = [
      ["Customer", "Segment", "Last visit", "Marketing consent"],
      ...rows.map((c) => [
        c.name,
        segment(c, s),
        c.last_visit,
        c.marketing_consent ? "Yes" : "No",
      ]),
    ]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n");
    const u = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = "customer-worklist.csv";
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <>
      <Heading
        title={
          actor.role === "advisor"
            ? "My customer worklist"
            : "Customers & retention"
        }
        description="Know who needs attention and make the next action clear."
        action={
          actor.role === "manager" ? (
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={16} />
              Export filtered CSV
            </Button>
          ) : undefined
        }
      />
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} />
        <select
          aria-label="Customer segment"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All", "Active", "Due", "At risk", "Lapsed"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <Card className="table-card">
        <Table
          headers={[
            "Customer",
            "Vehicle",
            "Segment",
            "Last visit",
            "Marketing",
            "",
          ]}
        >
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.name}</strong>
                <small>{c.email}</small>
              </td>
              <td>
                {data.vehicles.find((v) => v.customer_id === c.id)
                  ?.registration || "Not linked"}
              </td>
              <td>
                <Badge
                  tone={
                    segment(c, s) === "Lapsed"
                      ? "red"
                      : segment(c, s) === "Active"
                        ? "green"
                        : "amber"
                  }
                >
                  {segment(c, s)}
                </Badge>
              </td>
              <td>{c.last_visit}</td>
              <td>
                <Badge tone={c.marketing_consent ? "green" : "neutral"}>
                  {c.marketing_consent ? "Consented" : "Suppressed"}
                </Badge>
              </td>
              <td>
                <button className="text-link" onClick={() => setSelected(c.id)}>
                  View customer
                  <ArrowRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
        {!rows.length && <Empty title="No matching customers" />}
      </Card>
      {c && (
        <Card className="detail-card">
          <SectionTitle title={c.name} />
          <p>
            {c.phone} · {c.email}
          </p>
          <p>
            Next action:{" "}
            {segment(c, s) === "Active"
              ? "Prepare for the next scheduled visit"
              : "Review service needs and contact using permitted channels"}
            .
          </p>
          {actor.role === "advisor" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run({
                  type: "customer.update",
                  payload: {
                    customer_id: c.id,
                    phone: new FormData(e.currentTarget).get("phone"),
                  },
                });
              }}
            >
              <Field label="Customer-requested phone correction">
                <input required name="phone" defaultValue={c.phone} />
              </Field>
              <Button>Save correction</Button>
            </form>
          )}
          <p className="small muted">
            Ownership history, service records and actions stay linked to a
            unique customer ID.
          </p>
        </Card>
      )}
    </>
  );
}
export function RecoveryCases() {
  const { data, actor, run, busy } = useWorkspace();
  const [selected, setSelected] = useState<Recovery | null>(null);
  const r = data.recovery_cases.find((x) => x.id === selected?.id);
  return (
    <>
      <Heading
        title="Service recovery"
        description="Respond with care. Record the outcome. Earn the next visit."
      />
      <Card className="table-card">
        <Table
          headers={[
            "Customer / concern",
            "Rating",
            "Owner",
            "Response deadline",
            "Status",
            "",
          ]}
        >
          {data.recovery_cases.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>
                  {data.customers.find((c) => c.id === r.customer_id)?.name}
                </strong>
                <small>{r.comments}</small>
              </td>
              <td>{r.rating}/5</td>
              <td>
                {data.memberships.find((m) => m.user_id === r.advisor_id)
                  ?.name || "Assigned advisor"}
              </td>
              <td>
                <Badge
                  tone={
                    new Date(r.due_at) < new Date() && r.status !== "Resolved"
                      ? "red"
                      : "neutral"
                  }
                >
                  {new Date(r.due_at).toLocaleString()}
                </Badge>
              </td>
              <td>{r.status}</td>
              <td>
                <button className="text-link" onClick={() => setSelected(r)}>
                  Open case →
                </button>
              </td>
            </tr>
          ))}
        </Table>
        {!data.recovery_cases.length && <Empty title="No recovery cases" />}
      </Card>
      {r && (
        <Card className="form-card" key={r.id}>
          <div className="row">
            <h2>Resolve with confidence</h2>
            <Badge>{r.status}</Badge>
          </div>
          <p>{r.comments}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run({
                  type: "recovery.update",
                  id: r.id,
                  payload: Object.fromEntries(new FormData(e.currentTarget)),
                })
              )
                setSelected(null);
            }}
          >
            {actor.role === "manager" && (
              <Field label="Assigned advisor">
                <select name="advisor_id" defaultValue={r.advisor_id || ""}>
                  <option value="">Keep current owner</option>
                  {data.memberships
                    .filter((m) => m.role === "advisor" && m.active)
                    .map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Contact action / progress note">
              <textarea
                name="contact_log"
                placeholder="What happened, and what will happen next?"
                maxLength={2000}
              />
            </Field>
            <Field label="Case status">
              <select name="status" defaultValue={r.status}>
                <option>Open</option>
                <option>In progress</option>
                <option>Resolved</option>
              </select>
            </Field>
            <Field label="Resolution outcome (required to resolve)">
              <textarea
                name="outcome"
                defaultValue={r.outcome}
                maxLength={2000}
              />
            </Field>
            <p className="small muted">
              A resolved case requires a contact action and an outcome. Reopen
              when follow-up is still needed.
            </p>
            <Button disabled={busy}>Save case update</Button>
          </form>
          <pre className="contact-log">
            {r.contact_log || "No contact actions recorded yet."}
          </pre>
        </Card>
      )}
    </>
  );
}
export function Campaigns() {
  const { data, run, busy } = useWorkspace();
  const [create, setCreate] = useState(false);
  const s = data.settings[0];
  return (
    <>
      <Heading
        title="Bring them back."
        description="Consent-aware campaigns, with clear budgets and ownership."
        action={
          <Button onClick={() => setCreate(!create)}>
            <Plus size={17} />
            New campaign
          </Button>
        }
      />
      {create && (
        <Card className="form-card">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run({
                  type: "campaign.create",
                  payload: {
                    ...Object.fromEntries(f),
                    budget_sen: Math.round(Number(f.get("budget")) * 100),
                  },
                })
              )
                setCreate(false);
            }}
          >
            <Field label="Campaign title">
              <input required name="title" maxLength={120} />
            </Field>
            <div className="form-grid">
              <Field label="Customer segment">
                <select name="segment">
                  {["Lapsed", "At risk", "Due", "All eligible"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Budget (RM)">
                <input
                  required
                  name="budget"
                  type="number"
                  min={0}
                  max={s.promotion_limit_sen / 100}
                  step="0.01"
                />
              </Field>
              <Field label="Start date">
                <input
                  required
                  name="starts_on"
                  type="date"
                  defaultValue={localDate()}
                />
              </Field>
              <Field label="End date">
                <input
                  required
                  name="ends_on"
                  type="date"
                  defaultValue={localDate(30)}
                />
              </Field>
            </div>
            <Field label="Offer description">
              <textarea required name="description" maxLength={2000} />
            </Field>
            <Button disabled={busy}>Save draft</Button>
          </form>
        </Card>
      )}
      <div className="campaign-grid">
        {data.campaigns.map((c) => (
          <Card key={c.id}>
            <div className="row">
              <Badge tone={c.status === "Approved" ? "green" : "amber"}>
                {c.status}
              </Badge>
              <Badge>{c.segment}</Badge>
            </div>
            <h2>{c.title}</h2>
            <p>{c.description}</p>
            <div className="campaign-stats">
              <div>
                <strong>{eligibleAudience(data, s, c.segment).length}</strong>
                <small>Consented audience</small>
              </div>
              <div>
                <strong>{money(c.budget_sen)}</strong>
                <small>Campaign budget</small>
              </div>
            </div>
            <p className="small muted">
              {c.starts_on} → {c.ends_on}
            </p>
            <div className="inline-note">
              Approval saves the campaign. External delivery is not connected;
              no messages are sent.
            </div>
            {c.status === "Draft" && (
              <Button
                disabled={busy}
                onClick={() =>
                  run({ type: "campaign.approve", id: c.id, payload: {} })
                }
              >
                Approve campaign
              </Button>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
