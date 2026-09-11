import { useState } from "react";
import { Plus, CalendarDays, ArrowRight } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Table,
} from "../components/ui";
import { useWorkspace } from "../lib/context";
import { localDate, transitions } from "../lib/rules";
import type { Appointment } from "../lib/types";
export function Appointments({ book = false }: { book?: boolean }) {
  const { data, actor, run, busy, navigate } = useWorkspace();
  const [edit, setEdit] = useState<Appointment | null>(null),
    [filter, setFilter] = useState("Upcoming");
  const staff = actor.role !== "customer";
  const [customer, setCustomer] = useState(
    actor.customer_id || data.customers[0]?.id || "",
  );
  const s = data.settings[0];
  const canBook = ["customer", "manager", "advisor"].includes(actor.role);
  const vehicles = data.vehicles.filter(
    (v) => v.customer_id === customer && v.verified,
  );
  const list = data.appointments
    .filter(
      (a) =>
        filter === "All" ||
        (filter === "Upcoming"
          ? !["Completed", "Cancelled", "No-show"].includes(a.status)
          : ["Completed", "Cancelled", "No-show"].includes(a.status)),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return (
    <>
      <Heading
        title={
          book
            ? "Plan your next visit"
            : staff
              ? "Appointments & capacity"
              : "My appointments"
        }
        description={
          book
            ? "Choose a time that works for you. We’ll take care of the rest."
            : "Keep every visit moving, from booking to completion."
        }
        action={
          !book && canBook ? (
            <Button onClick={() => navigate("booking")}>
              <Plus size={17} />
              New appointment
            </Button>
          ) : undefined
        }
      />
      {book || edit ? (
        <Card className="form-card">
          <div className="row">
            <h2>{edit ? "Reschedule appointment" : "Book an appointment"}</h2>
            <Badge>Glenmarie branch</Badge>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = await run({
                type: edit ? "appointment.reschedule" : "appointment.create",
                id: edit?.id,
                payload: { ...Object.fromEntries(f), customer_id: customer },
              });
              if (ok) {
                setEdit(null);
                navigate("appointments");
              }
            }}
          >
            <div className="form-grid">
              {staff && !edit && (
                <Field label="Customer">
                  <select
                    name="customer_id"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  >
                    {data.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {!edit && (
                <Field label="Verified vehicle">
                  <select name="vehicle_id" required>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration} · {v.model}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {!edit && (
                <Field label="Visit type">
                  <select name="service">
                    <option>Periodic maintenance</option>
                    <option>Vehicle health check</option>
                    <option>Customer consultation</option>
                  </select>
                </Field>
              )}
              <Field label="Date">
                <input
                  name="date"
                  type="date"
                  defaultValue={edit?.date || localDate(1)}
                  min={localDate()}
                  required
                />
              </Field>
              <Field label="Arrival time">
                <select
                  name="time"
                  defaultValue={edit?.time || "10:30"}
                  required
                >
                  {Array.from(
                    { length: Math.floor(450 / s.slot_minutes) + 1 },
                    (_, i) => 540 + i * s.slot_minutes,
                  ).map((m) => {
                    const t =
                      String(Math.floor(m / 60)).padStart(2, "0") +
                      ":" +
                      String(m % 60).padStart(2, "0");
                    return (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </div>
            <Field label="Notes for your advisor">
              <textarea
                name="notes"
                maxLength={1000}
                defaultValue={edit?.notes}
              />
            </Field>
            <div className="inline-note">
              Book at least {s.lead_hours} hours ahead. Reschedule or cancel at
              least {s.cancel_hours} hours before the visit. Appointment
              requests do not include a price quotation.
            </div>
            <div className="button-row">
              <Button disabled={busy || (!edit && !vehicles.length)}>
                Confirm {edit ? "new time" : "booking"}
                <ArrowRight size={17} />
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEdit(null);
                  navigate("appointments");
                }}
              >
                Back
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <div className="tabs">
              {["Upcoming", "Past", "All"].map((f) => (
                <button
                  className={filter === f ? "active" : ""}
                  onClick={() => setFilter(f)}
                  key={f}
                >
                  {f}
                </button>
              ))}
            </div>
            <Badge>{list.length} appointments</Badge>
          </div>
          <Card className="table-card">
            <Table
              headers={
                staff
                  ? [
                      "Customer / visit",
                      "Date & time",
                      "Advisor",
                      "Status",
                      "Actions",
                    ]
                  : ["Visit", "Date & time", "Status", "Actions"]
              }
            >
              {list.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>
                      {staff
                        ? data.customers.find((c) => c.id === a.customer_id)
                            ?.name
                        : a.service}
                    </strong>
                    <small>{staff ? a.service : a.notes}</small>
                  </td>
                  <td>
                    {a.date}
                    <small>{a.time} · Glenmarie</small>
                  </td>
                  {staff && (
                    <td>
                      {data.memberships.find((m) => m.user_id === a.advisor_id)
                        ?.name || "Assigned advisor"}
                    </td>
                  )}
                  <td>
                    <Badge
                      tone={
                        a.status === "Completed"
                          ? "green"
                          : a.status === "Cancelled"
                            ? "red"
                            : "blue"
                      }
                    >
                      {a.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      {canBook &&
                        ["Booked", "Confirmed"].includes(a.status) && (
                          <>
                            <button onClick={() => setEdit(a)}>
                              Reschedule
                            </button>
                            <button
                              className="danger-text"
                              onClick={() => {
                                if (confirm("Cancel this appointment?"))
                                  void run({
                                    type: "appointment.status",
                                    id: a.id,
                                    payload: {
                                      status: "Cancelled",
                                      reason: "Cancellation requested",
                                    },
                                  });
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      {staff &&
                        actor.role !== "administrator" &&
                        transitions[a.status]
                          .filter((t) => t !== "Cancelled")
                          .map((t) => (
                            <button
                              key={t}
                              onClick={() =>
                                run({
                                  type: "appointment.status",
                                  id: a.id,
                                  payload: {
                                    status: t,
                                    reason: "Operational status update",
                                  },
                                })
                              }
                            >
                              {t}
                            </button>
                          ))}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
            {!list.length && (
              <Empty
                title="No appointments in this view"
                description="New bookings will appear here."
              />
            )}
          </Card>
          {actor.role === "manager" && (
            <Card className="form-card">
              <h2>
                <CalendarDays size={20} /> Branch capacity
              </h2>
              <p className="muted">
                Operational controls stay within the Administrator’s booking
                guardrails.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run({
                    type: "capacity.update",
                    payload: {
                      capacity: Number(f.get("capacity")),
                      closed_dates: String(f.get("closed_dates"))
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    },
                  });
                }}
              >
                <div className="form-grid">
                  <Field label="Vehicles per time slot">
                    <input
                      name="capacity"
                      type="number"
                      min={1}
                      max={50}
                      required
                      defaultValue={s.capacity}
                    />
                  </Field>
                  <Field label="Closure dates (comma separated YYYY-MM-DD)">
                    <input
                      name="closed_dates"
                      defaultValue={s.closed_dates.join(", ")}
                    />
                  </Field>
                </div>
                <Button disabled={busy}>Save capacity</Button>
              </form>
            </Card>
          )}
        </>
      )}
    </>
  );
}
