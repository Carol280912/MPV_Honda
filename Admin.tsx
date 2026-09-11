import { useState } from "react";
import {
  Settings2,
  ShieldCheck,
  Users,
  Activity,
  Check,
  ArrowRight,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Metric,
  SectionTitle,
  Table,
} from "../components/ui";
import { useWorkspace } from "../lib/context";
import { balance, roles } from "../lib/rules";
import type { Role } from "../lib/types";
export function AdminHome() {
  const { data, navigate } = useWorkspace();
  const pending = data.vehicles.filter((v) => !v.verified);
  return (
    <>
      <Heading
        eyebrow="PLATFORM GOVERNANCE / PREMIER AUTO GROUP"
        title="A well-run platform starts here."
        description="Keep access clear, rules consistent, and data trustworthy."
      />
      <div className="metrics">
        <Metric
          label="Active memberships"
          value={data.memberships.filter((m) => m.active).length}
          detail="Within this tenant and branch"
          icon={<Users size={19} />}
        />
        <Metric
          label="Access roles"
          value="3"
          detail="Customer · Manager · Administrator"
          icon={<ShieldCheck size={19} />}
        />
        <Metric
          label="Verification queue"
          value={pending.length}
          detail="Vehicles awaiting ownership checks"
          icon={<Check size={19} />}
        />
        <Metric
          label="Pending adjustments"
          value={data.adjustments.filter((a) => a.status !== "Posted").length}
          detail="Review approval before posting"
          icon={<Activity size={19} />}
        />
      </div>
      <div className="operations-grid">
        <Card>
          <SectionTitle title="Configuration centre" />
          {[
            [
              "Booking guardrails",
              "Slot duration, lead time and cancellation windows",
              "settings",
            ],
            [
              "Loyalty programme",
              "Earning rules, rewards and adjustment thresholds",
              "loyalty",
            ],
            [
              "Team & access",
              "Membership, permissions and branch scope",
              "access",
            ],
            [
              "Data quality",
              "Missing fields and vehicle verification",
              "quality",
            ],
            ["Audit trail", "Who changed what, when and why", "audit"],
          ].map(([n, d, r]) => (
            <button className="menu-row" onClick={() => navigate(r)} key={r}>
              <span>
                <h3>{n}</h3>
                <p>{d}</p>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </Card>
        <div className="stack">
          <Card>
            <SectionTitle title="Integration readiness" />
            {[
              "DMS / customer sync",
              "Email & SMS delivery",
              "Payment provider — Phase 2",
            ].map((n) => (
              <div className="list-row" key={n}>
                <span>{n}</span>
                <Badge>Not connected</Badge>
              </div>
            ))}
            <div className="inline-note">
              No provider activity is simulated as live. Configure and validate
              each integration before the pilot.
            </div>
          </Card>
          <section className="dark-panel">
            <ShieldCheck size={26} />
            <h2>Access follows responsibility.</h2>
            <p>
              Customers own their information. Manager operations are enabled.
              Service Advisor workspace is on hold. Managers decide.
              Administrators govern.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
const groups = [
  {
    name: "Booking guardrails",
    fields: [
      ["slot_minutes", "Slot duration (minutes)"],
      ["lead_hours", "Minimum lead time (hours)"],
      ["cancel_hours", "Cancellation window (hours)"],
    ],
  },
  {
    name: "Retention definitions",
    fields: [
      ["at_risk_days", "At-risk after (days)"],
      ["lapse_days", "Lapsed after (days)"],
    ],
  },
  {
    name: "Feedback & recovery",
    fields: [
      ["low_rating", "Create a case at or below rating"],
      ["recovery_hours", "First response SLA (hours)"],
    ],
  },
  {
    name: "Loyalty controls",
    fields: [
      ["points_per_rm", "Points per qualifying RM"],
      ["reward_points", "Points required per reward"],
      ["reward_value_sen", "Reward value (sen)"],
      ["tier_points", "Next tier threshold"],
      ["points_expiry_days", "Points expiry (days)"],
      ["adjustment_threshold", "Independent approval above (points)"],
    ],
  },
  {
    name: "Campaign governance",
    fields: [["promotion_limit_sen", "Maximum campaign budget (sen)"]],
  },
];
export function AdminSettings() {
  const { data, run, busy } = useWorkspace(),
    s = data.settings[0];
  return (
    <>
      <Heading
        title="Rules that keep everyone aligned."
        description="Administrator guardrails apply across the branch. Managers retain day-to-day capacity control."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run({
            type: "settings.update",
            payload: Object.fromEntries(new FormData(e.currentTarget)),
          });
        }}
      >
        <Card>
          <Field label="Dealer display name">
            <input name="dealer_name" defaultValue={s.dealer_name} required />
          </Field>
        </Card>
        <div className="settings-grid">
          {groups.map((g) => (
            <Card key={g.name}>
              <h2>
                <Settings2 size={18} />
                {g.name}
              </h2>
              {g.fields.map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    name={key}
                    type="number"
                    min={["lead_hours", "cancel_hours"].includes(key) ? 0 : 1}
                    max={key === "low_rating" ? 5 : 10000000}
                    defaultValue={Number(s[key as keyof typeof s])}
                    required
                  />
                </Field>
              ))}
            </Card>
          ))}
        </div>
        <div className="sticky-save">
          <span>Changes are validated and recorded in the audit trail.</span>
          <Button disabled={busy}>Save configuration</Button>
        </div>
      </form>
    </>
  );
}
export function Access() {
  const { data, actor, run, busy } = useWorkspace();
  const [edit, setEdit] = useState("");
  const m = data.memberships.find((m) => m.id === edit);
  return (
    <>
      <Heading
        title="People, roles & scope"
        description="Staff roles are assigned here. Customers cannot promote themselves."
      />
      <Card className="table-card">
        <Table headers={["Member", "Role", "Branch", "Status", "Actions"]}>
          {data.memberships.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>{m.name}</strong>
                <small>
                  {m.user_id === actor.user_id ? "Your account" : m.user_id}
                </small>
              </td>
              <td>
                <Badge>{roles[m.role]}</Badge>
              </td>
              <td>{m.branch_id}</td>
              <td>
                <Badge tone={m.active ? "green" : "red"}>
                  {m.active ? "Active" : "Suspended"}
                </Badge>
              </td>
              <td>
                <button
                  className="text-link"
                  disabled={m.user_id === actor.user_id}
                  onClick={() => setEdit(m.id)}
                >
                  Manage access
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="inline-note">
        New staff accounts are invited through Supabase Auth, then assigned a
        membership by an authorised administrator. No public staff registration
        or privileged key is exposed in this app.
      </div>
      {m && (
        <Card className="form-card">
          <h2>Manage {m.name}</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run({
                  type: "member.update",
                  id: m.id,
                  payload: {
                    role: f.get("role"),
                    active: f.get("active") === "on",
                    reason: f.get("reason"),
                  },
                })
              )
                setEdit("");
            }}
          >
            <Field label="Role">
              <select name="role" defaultValue={m.role}>
                {(["customer", "manager", "administrator"] as Role[]).map(
                  (r) => (
                    <option value={r} key={r}>
                      {roles[r]}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <label className="checkbox">
              <input type="checkbox" name="active" defaultChecked={m.active} />
              Access enabled
            </label>
            <Field label="Reason for change">
              <input name="reason" required maxLength={300} />
            </Field>
            <Button disabled={busy}>Save access</Button>
          </form>
        </Card>
      )}
      <Card>
        <SectionTitle title="Data access responsibilities" />
        <Table headers={["Role", "Data scope", "Primary responsibility"]}>
          {[
            [
              "Customer",
              "Own customer and verified vehicles",
              "Book, review, provide feedback and set preferences",
            ],
            [
              "Manager",
              "Authorised branch customers and operations",
              "Capacity, campaigns, team outcomes and approvals",
            ],
            [
              "Administrator",
              "Authorised tenant / branch governance",
              "Configure rules, access, verification and audits",
            ],
          ].map((r) => (
            <tr key={r[0]}>
              {r.map((t) => (
                <td key={t}>{t}</td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
export function LoyaltyAdmin() {
  const { data, actor, run, busy } = useWorkspace();
  const [request, setRequest] = useState(false);
  return (
    <>
      <Heading
        title="Loyalty with accountability"
        description="Requests, independent approvals and ledger posting stay separate."
        action={
          <Button onClick={() => setRequest(!request)}>
            Request adjustment
          </Button>
        }
      />
      {request && (
        <Card className="form-card">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run({
                  type: "adjustment.request",
                  payload: Object.fromEntries(new FormData(e.currentTarget)),
                })
              )
                setRequest(false);
            }}
          >
            <Field label="Customer">
              <select required name="customer_id">
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {balance(data, c.id)} pts
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Points (+ or −)">
              <input
                required
                name="points"
                type="number"
                min={-100000}
                max={100000}
              />
            </Field>
            <Field label="Reason">
              <textarea name="reason" required maxLength={1000} />
            </Field>
            <Button disabled={busy}>Submit request</Button>
          </form>
        </Card>
      )}
      <Card className="table-card">
        <Table
          headers={["Customer", "Adjustment", "Reason", "Status", "Actions"]}
        >
          {data.adjustments.map((a) => (
            <tr key={a.id}>
              <td>
                {data.customers.find((c) => c.id === a.customer_id)?.name}
              </td>
              <td>
                <strong>
                  {a.points > 0 ? "+" : ""}
                  {a.points} pts
                </strong>
              </td>
              <td>{a.reason}</td>
              <td>
                <Badge tone={a.status === "Posted" ? "green" : "amber"}>
                  {a.status}
                </Badge>
              </td>
              <td>
                {actor.role === "manager" && a.status === "Pending" && (
                  <button
                    className="text-link"
                    disabled={busy || a.requested_by === actor.user_id}
                    onClick={() =>
                      run({ type: "adjustment.approve", id: a.id, payload: {} })
                    }
                  >
                    Approve
                  </button>
                )}
                {actor.role === "administrator" && a.status !== "Posted" && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() =>
                      run({ type: "adjustment.post", id: a.id, payload: {} })
                    }
                  >
                    Post to ledger
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="inline-note">
        Above {data.settings[0].adjustment_threshold} points, a manager other
        than the requester must approve before an administrator can post.
        Balances cannot fall below zero.
      </div>
    </>
  );
}
export function AuditTrail() {
  const { data } = useWorkspace();
  return (
    <>
      <Heading
        title="An accountable history"
        description="Business actions record an actor, timestamp, entity and reason."
      />
      <Card className="table-card">
        <Table headers={["When", "Actor", "Action", "Entity", "Reason"]}>
          {[...data.audit_events]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.created_at).toLocaleString()}</td>
                <td>
                  {data.memberships.find((m) => m.user_id === a.actor_id)
                    ?.name || a.actor_id}
                </td>
                <td>{a.action}</td>
                <td className="mono">{a.entity_id.slice(0, 12)}</td>
                <td>{a.reason}</td>
              </tr>
            ))}
        </Table>
      </Card>
    </>
  );
}
export function Quality() {
  const { data, run } = useWorkspace();
  const pending = data.vehicles.filter((v) => !v.verified);
  return (
    <>
      <Heading
        title="Data quality & ownership"
        description="Check the evidence before linking a customer to a vehicle."
      />
      <div className="metrics">
        <Metric
          label="Pending verification"
          value={pending.length}
          detail="Manual ownership evidence review required"
        />
        <Metric
          label="Missing contact fields"
          value={data.customers.filter((c) => !c.phone || !c.email).length}
          detail="Phone or email unavailable"
        />
        <Metric
          label="Duplicate registrations"
          value={
            data.vehicles.length -
            new Set(data.vehicles.map((v) => v.registration)).size
          }
          detail="Flagged for review; never merged automatically"
        />
      </div>
      <Card>
        <SectionTitle title="Ownership verification queue" />
        {pending.map((v) => (
          <form
            className="verification-row"
            key={v.id}
            onSubmit={(e) => {
              e.preventDefault();
              void run({
                type: "vehicle.verify",
                id: v.id,
                payload: {
                  reason: new FormData(e.currentTarget).get("reason"),
                },
              });
            }}
          >
            <div>
              <h3>
                {v.registration} · {v.model}
              </h3>
              <p>{data.customers.find((c) => c.id === v.customer_id)?.name}</p>
            </div>
            <Field label="Evidence reference / verification reason">
              <input
                required
                name="reason"
                placeholder="Record the approved ownership evidence reference"
              />
            </Field>
            <Button>Verify ownership</Button>
          </form>
        ))}
        {!pending.length && <Empty title="No vehicles awaiting verification" />}
      </Card>
      <div className="inline-note">
        This Phase 1 workflow records a manual verification decision. Secure
        evidence upload and duplicate merge tooling remain separate
        implementation work.
      </div>
    </>
  );
}
