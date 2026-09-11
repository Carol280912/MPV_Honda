import type {
  Actor,
  Command,
  Data,
  Repository,
  Settings,
  Table,
} from "../lib/types";
import {
  balance,
  canTransition,
  eligibleAudience,
  inScope,
} from "../lib/rules";
import { makeSeed } from "./seed";
const KEY = "autocare-phase1-v2";
export function scopeData(d: Data, a: Actor): Data {
  const out = structuredClone(d);
  const customers = d.customers.filter(
    (c) =>
      inScope(a, c) &&
      (a.role === "customer"
        ? c.user_id === a.user_id
        : a.role === "advisor"
          ? c.advisor_id === a.user_id
          : true),
  );
  const ids = new Set(customers.map((c) => c.id));
  for (const key of Object.keys(out) as Table[]) {
    (out as unknown as Record<string, unknown[]>)[key] = d[key].filter((r) => {
      if (!inScope(a, r)) return false;
      if (key === "customers") return ids.has(r.id);
      if (key === "memberships")
        return (
          a.role === "administrator" ||
          a.role === "manager" ||
          ("user_id" in r && r.user_id === a.user_id)
        );
      if (key === "audit_events")
        return (
          a.role === "administrator" ||
          (a.role === "manager" &&
            "action" in r &&
            !["member.update", "settings.update", "vehicle.verify"].includes(
              r.action,
            ))
        );
      if (key === "recovery_cases" || key === "adjustments")
        return a.role === "administrator" || a.role === "manager";
      if (key === "service_catalogue")
        return (
          a.role !== "advisor" &&
          (a.role !== "customer" || ("active" in r && r.active))
        );
      if (key === "settings") return true;
      if (key === "campaigns")
        return (
          a.role === "manager" ||
          a.role === "administrator" ||
          ("status" in r && r.status === "Approved")
        );
      if ("customer_id" in r) return ids.has(r.customer_id);
      return false;
    });
  }
  return out;
}
function requireRole(a: Actor, roles: Actor["role"][]) {
  if (!roles.includes(a.role))
    throw Error("Your role does not have permission for this action.");
}
function number(x: unknown, min: number, max: number) {
  const n = Number(x);
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`Enter a whole number between ${min} and ${max}.`);
  return n;
}
function required(x: unknown) {
  const s = String(x ?? "").trim();
  if (!s) throw Error("Please complete the required fields.");
  return s;
}
export function applyCommand(input: Data, a: Actor, c: Command): Data {
  if (a.role === "advisor")
    throw Error("Service Advisor workspace is on hold.");
  if (
    !input.memberships.some(
      (m) =>
        inScope(a, m) &&
        m.user_id === a.user_id &&
        m.role === a.role &&
        m.active,
    )
  )
    throw Error("Active membership required.");
  const d = structuredClone(input),
    p = c.payload,
    s = d.settings.find((x) => inScope(a, x));
  if (!s) throw Error("No branch configuration found.");
  const now = new Date().toISOString(),
    id = crypto.randomUUID(),
    base = { tenant_id: a.tenant_id, branch_id: a.branch_id };
  const customer = (cid: string) => {
    const r = d.customers.find((x) => x.id === cid);
    if (!r || !scopeData(d, a).customers.some((x) => x.id === cid))
      throw Error("Customer is outside your authorised scope.");
    return r;
  };
  const audit = (reason: string) =>
    d.audit_events.unshift({
      ...base,
      id: crypto.randomUUID(),
      actor_id: a.user_id,
      action: c.type,
      entity_id: c.id || id,
      reason,
      created_at: now,
    });
  switch (c.type) {
    case "document.register": {
      requireRole(a, ["customer"]);
      const r = d.service_requests.find(
        (x) => x.id === p.request_id && inScope(a, x),
      );
      if (!r) throw Error("Request unavailable.");
      customer(r.customer_id);
      const mime = required(p.mime_type),
        url = required(p.demo_url);
      if (
        !["image/jpeg", "image/png", "application/pdf"].includes(mime) ||
        !url.startsWith("data:" + mime + ";base64,") ||
        url.length > 1500000
      )
        throw Error("Unsupported document or file too large.");
      if (
        !["Receipt", "Invoice", "Supporting document"].includes(String(p.kind))
      )
        throw Error("Invalid document type.");
      d.service_documents.push({
        ...base,
        id,
        request_id: r.id,
        customer_id: r.customer_id,
        filename: required(p.filename),
        mime_type: mime,
        storage_path: "",
        demo_url: url,
        kind: String(p.kind),
        amount_sen: number(p.amount_sen, 0, 100000000),
        payment_reference: String(p.payment_reference || ""),
        status: "Awaiting verification",
        review_note: "",
        reviewed_by: null,
        created_at: now,
      });
      audit("Document submitted for manual verification");
      break;
    }
    case "document.review": {
      requireRole(a, ["manager"]);
      const doc = d.service_documents.find(
        (x) => x.id === c.id && inScope(a, x),
      );
      if (!doc || doc.status !== "Awaiting verification")
        throw Error("Document is no longer awaiting verification.");
      if (!["Verified", "Rejected"].includes(String(p.status)))
        throw Error("Invalid review status.");
      doc.status = p.status as typeof doc.status;
      doc.review_note = required(p.review_note);
      doc.reviewed_by = a.user_id;
      audit(doc.review_note);
      break;
    }
    case "phase2.catalogue.create": {
      requireRole(a, ["administrator"]);
      const effective = required(p.effective_on);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(effective) ||
        !Number.isFinite(Date.parse(effective))
      )
        throw Error("Valid effective date required.");
      d.service_catalogue.push({
        ...base,
        id,
        title: required(p.title),
        category: required(p.category),
        description: required(p.description),
        price_sen: number(p.price_sen, 0, 10000000),
        effective_on: effective,
        active: true,
      });
      audit("Catalogue version created");
      break;
    }
    case "phase2.catalogue.archive": {
      requireRole(a, ["administrator"]);
      const item = d.service_catalogue.find(
        (x) => x.id === c.id && inScope(a, x),
      );
      if (!item) throw Error("Catalogue item unavailable.");
      item.active = false;
      audit("Catalogue item archived");
      break;
    }
    case "phase2.request.create": {
      requireRole(a, ["customer"]);
      const cid = required(p.customer_id);
      customer(cid);
      const vehicle = d.vehicles.find(
        (x) =>
          x.id === p.vehicle_id &&
          x.customer_id === cid &&
          inScope(a, x) &&
          x.verified,
      );
      if (!vehicle) throw Error("Choose your verified vehicle.");
      const category = required(p.category);
      if (
        ![
          "Maintenance",
          "Repairs",
          "Parts",
          "Insurance",
          "Towing",
          "Referral",
          "Trade-in",
        ].includes(category)
      )
        throw Error("Unknown service category.");
      d.service_requests.unshift({
        ...base,
        id,
        customer_id: cid,
        vehicle_id: vehicle.id,
        category,
        details: required(p.details),
        status: "Requested",
        outcome: "",
        created_at: now,
      });
      audit("Customer service request received");
      break;
    }
    case "phase2.request.update": {
      requireRole(a, ["manager"]);
      const item = d.service_requests.find(
        (x) => x.id === c.id && inScope(a, x),
      );
      if (!item) throw Error("Request unavailable.");
      const next = required(p.status);
      const transitions: Record<string, string[]> = {
        Requested: ["In progress", "Closed"],
        "In progress": ["Waiting for customer", "Closed"],
        "Waiting for customer": ["In progress", "Closed"],
      };
      if (!transitions[item.status]?.includes(next))
        throw Error("Invalid request transition.");
      item.outcome = required(p.outcome);
      item.status = next;
      d.notifications.unshift({
        ...base,
        id: crypto.randomUUID(),
        customer_id: item.customer_id,
        category: "Transactional",
        title: item.category + " request updated",
        body: item.outcome,
        created_at: now,
      });
      audit(item.outcome);
      break;
    }
    case "appointment.create":
    case "appointment.reschedule": {
      requireRole(a, ["customer", "advisor", "manager"]);
      const existing = c.id
        ? d.appointments.find((x) => x.id === c.id)
        : undefined;
      if (
        c.type === "appointment.reschedule" &&
        (!existing || !inScope(a, existing))
      )
        throw Error("Appointment not found.");
      const cid = existing?.customer_id || required(p.customer_id);
      customer(cid);
      const v = d.vehicles.find(
        (x) =>
          x.id === (existing?.vehicle_id || p.vehicle_id) &&
          x.customer_id === cid &&
          x.verified,
      );
      if (!v) throw Error("A verified vehicle is required.");
      const date = required(p.date),
        time = required(p.time),
        when = new Date(`${date}T${time}:00+08:00`).getTime();
      if (!Number.isFinite(when) || when < Date.now() + s.lead_hours * 3600000)
        throw Error("Choose a time outside the booking lead-time window.");
      const [hours, minutes] = time.split(":").map(Number);
      if (
        hours * 60 + minutes < 540 ||
        hours * 60 + minutes > 990 ||
        (hours * 60 + minutes - 540) % s.slot_minutes !== 0
      )
        throw Error("Choose an allowed branch time slot.");
      if (s.closed_dates.includes(date))
        throw Error("The branch is closed on this date.");
      if (
        existing &&
        (!["Booked", "Confirmed"].includes(existing.status) ||
          new Date(`${existing.date}T${existing.time}:00+08:00`).getTime() <
            Date.now() + s.cancel_hours * 3600000)
      )
        throw Error("This appointment is outside the rescheduling window.");
      const count = d.appointments.filter(
        (x) =>
          inScope(a, x) &&
          x.id !== c.id &&
          x.date === date &&
          x.time === time &&
          !["Cancelled", "No-show"].includes(x.status),
      ).length;
      if (count >= s.capacity)
        throw Error("This time slot is full. Please choose another.");
      if (existing) {
        existing.date = date;
        existing.time = time;
        existing.updated_at = now;
      } else
        d.appointments.push({
          ...base,
          id,
          customer_id: cid,
          vehicle_id: v.id,
          advisor_id: customer(cid).advisor_id,
          service: required(p.service),
          date,
          time,
          status: "Booked",
          notes: String(p.notes || ""),
          updated_at: now,
        });
      audit("Appointment saved");
      break;
    }
    case "appointment.status": {
      const r = d.appointments.find((x) => x.id === c.id);
      if (!r || !inScope(a, r)) throw Error("Appointment not found.");
      customer(r.customer_id);
      const next = p.status as typeof r.status;
      if (a.role === "customer") {
        if (
          next !== "Cancelled" ||
          !["Booked", "Confirmed"].includes(r.status) ||
          new Date(`${r.date}T${r.time}:00+08:00`).getTime() <
            Date.now() + s.cancel_hours * 3600000
        )
          throw Error("Cancellation is unavailable. Contact your advisor.");
      } else requireRole(a, ["advisor", "manager"]);
      if (!canTransition(r.status, next))
        throw Error("This status transition is not allowed.");
      r.status = next;
      r.updated_at = now;
      if (next === "Completed")
        customer(r.customer_id).last_visit = now.slice(0, 10);
      d.notifications.unshift({
        ...base,
        id: crypto.randomUUID(),
        customer_id: r.customer_id,
        category: "Transactional",
        title: "Appointment updated",
        body: "Your appointment is now " + next + ".",
        created_at: now,
      });
      audit(required(p.reason || "Status updated"));
      break;
    }
    case "capacity.update":
      requireRole(a, ["manager"]);
      s.capacity = number(p.capacity, 1, 50);
      s.closed_dates = Array.isArray(p.closed_dates)
        ? p.closed_dates.map(String)
        : s.closed_dates;
      audit("Operational capacity updated");
      break;
    case "settings.update": {
      requireRole(a, ["administrator"]);
      const fields = [
        "slot_minutes",
        "lead_hours",
        "cancel_hours",
        "lapse_days",
        "at_risk_days",
        "recovery_hours",
        "low_rating",
        "adjustment_threshold",
        "reward_points",
        "reward_value_sen",
        "tier_points",
        "points_per_rm",
        "points_expiry_days",
        "promotion_limit_sen",
      ] as const;
      for (const k of fields)
        if (p[k] !== undefined)
          s[k] = number(
            p[k],
            k === "lead_hours" || k === "cancel_hours" ? 0 : 1,
            k === "low_rating" ? 5 : 10000000,
          );
      if (s.slot_minutes < 15 || s.slot_minutes > 240)
        throw Error("Slot duration must be 15–240 minutes.");
      if (s.lead_hours > 720 || s.cancel_hours > 720 || s.recovery_hours > 720)
        throw Error("Time windows cannot exceed 720 hours.");
      if (s.lapse_days <= s.at_risk_days)
        throw Error("Lapsed threshold must exceed the at-risk threshold.");
      if (p.dealer_name) s.dealer_name = required(p.dealer_name);
      audit("Administrator guardrails updated");
      break;
    }
    case "feedback.create": {
      requireRole(a, ["customer"]);
      const cid = required(p.customer_id);
      customer(cid);
      const ap = d.appointments.find(
        (x) =>
          x.id === p.appointment_id &&
          x.customer_id === cid &&
          x.status === "Completed",
      );
      if (!ap)
        throw Error("Feedback must relate to your completed appointment.");
      if (d.feedback.some((x) => x.appointment_id === ap.id))
        throw Error("Feedback already submitted for this appointment.");
      const rating = number(p.rating, 1, 5),
        comments = String(p.comments || "");
      d.feedback.push({
        ...base,
        id,
        customer_id: cid,
        appointment_id: ap.id,
        rating,
        comments,
        contact_requested: Boolean(p.contact_requested),
        created_at: now,
      });
      if (rating <= s.low_rating)
        d.recovery_cases.push({
          ...base,
          id: crypto.randomUUID(),
          customer_id: cid,
          advisor_id: ap.advisor_id,
          appointment_id: ap.id,
          rating,
          comments,
          status: "Open",
          due_at: new Date(
            Date.now() + s.recovery_hours * 3600000,
          ).toISOString(),
          contact_log: "",
          outcome: "",
          created_at: now,
        });
      audit("Customer feedback received");
      break;
    }
    case "recovery.update": {
      requireRole(a, ["manager", "advisor"]);
      const r = d.recovery_cases.find((x) => x.id === c.id);
      if (!r || !inScope(a, r)) throw Error("Case not found.");
      customer(r.customer_id);
      if (p.advisor_id) {
        requireRole(a, ["manager"]);
        if (
          !d.memberships.some(
            (m) =>
              inScope(a, m) &&
              m.user_id === p.advisor_id &&
              m.role === "advisor" &&
              m.active,
          )
        )
          throw Error("Select an active branch advisor.");
        r.advisor_id = String(p.advisor_id);
      }
      if (p.contact_log)
        r.contact_log += `${now} · ${a.name}: ${String(p.contact_log)}\n`;
      if (p.status === "Resolved") {
        r.outcome = required(p.outcome);
        if (!r.contact_log.trim())
          throw Error("Record a contact action before resolving the case.");
      }
      if (
        p.status &&
        !["Open", "In progress", "Resolved"].includes(String(p.status))
      )
        throw Error("Invalid case status.");
      r.status = (p.status || r.status) as typeof r.status;
      audit(r.outcome || "Recovery case updated");
      break;
    }
    case "campaign.create": {
      requireRole(a, ["manager"]);
      const budget = number(p.budget_sen, 0, s.promotion_limit_sen);
      if (String(p.ends_on) < String(p.starts_on))
        throw Error("End date must be after start date.");
      d.campaigns.unshift({
        ...base,
        id,
        title: required(p.title),
        segment: required(p.segment),
        budget_sen: budget,
        status: "Draft",
        starts_on: required(p.starts_on),
        ends_on: required(p.ends_on),
        description: required(p.description),
      });
      audit("Campaign draft created");
      break;
    }
    case "campaign.approve": {
      requireRole(a, ["manager"]);
      const r = d.campaigns.find((x) => x.id === c.id && inScope(a, x));
      if (!r || r.budget_sen > s.promotion_limit_sen)
        throw Error("Campaign not eligible for approval.");
      r.status = "Approved";
      audit(
        `Approved for ${eligibleAudience(d, s, r.segment).length} consented customers; not sent`,
      );
      break;
    }
    case "adjustment.request": {
      requireRole(a, ["advisor", "manager", "administrator"]);
      const cid = required(p.customer_id);
      customer(cid);
      const pts = number(p.points, -100000, 100000);
      if (!pts) throw Error("Points adjustment cannot be zero.");
      d.adjustments.unshift({
        ...base,
        id,
        customer_id: cid,
        points: pts,
        reason: required(p.reason),
        requested_by: a.user_id,
        approved_by: null,
        status: "Pending",
      });
      audit(required(p.reason));
      break;
    }
    case "adjustment.approve": {
      requireRole(a, ["manager"]);
      const r = d.adjustments.find((x) => x.id === c.id && inScope(a, x));
      if (!r || r.status !== "Pending")
        throw Error("Request is no longer pending.");
      if (r.requested_by === a.user_id)
        throw Error("A different manager must approve this request.");
      r.approved_by = a.user_id;
      r.status = "Approved";
      audit(r.reason);
      break;
    }
    case "adjustment.post": {
      requireRole(a, ["administrator"]);
      const r = d.adjustments.find((x) => x.id === c.id && inScope(a, x));
      if (!r || r.status === "Posted")
        throw Error("Adjustment already posted or unavailable.");
      if (
        Math.abs(r.points) > s.adjustment_threshold &&
        (!r.approved_by || r.approved_by === r.requested_by)
      )
        throw Error("An independent manager approval is required.");
      if (balance(d, r.customer_id) + r.points < 0)
        throw Error("Adjustment would create a negative balance.");
      d.loyalty_entries.push({
        ...base,
        id,
        customer_id: r.customer_id,
        points: r.points,
        reason: r.reason,
        reference: r.id,
        created_at: now,
      });
      r.status = "Posted";
      audit(r.reason);
      break;
    }
    case "member.update": {
      requireRole(a, ["administrator"]);
      const m = d.memberships.find((x) => x.id === c.id && inScope(a, x));
      if (!m || m.user_id === a.user_id)
        throw Error("You cannot change your own access.");
      if (
        p.role &&
        !["customer", "manager", "administrator"].includes(String(p.role))
      )
        throw Error("Unknown role.");
      if (p.role) m.role = p.role as typeof m.role;
      if (p.active !== undefined) m.active = Boolean(p.active);
      audit(required(p.reason));
      break;
    }
    case "customer.update": {
      const r = customer(required(p.customer_id));
      if (a.role === "manager")
        throw Error("Managers have read-only customer access.");
      if (p.phone) r.phone = required(p.phone);
      if (p.marketing_consent !== undefined) {
        r.marketing_consent = Boolean(p.marketing_consent);
        r.consent_at = now;
      }
      audit("Customer-requested contact/preferences update");
      break;
    }
    case "vehicle.create": {
      requireRole(a, ["customer"]);
      const cid = required(p.customer_id);
      customer(cid);
      d.vehicles.push({
        ...base,
        id,
        customer_id: cid,
        registration: required(p.registration).toUpperCase(),
        model: required(p.model),
        year: number(p.year, 1980, 2100),
        mileage: number(p.mileage, 0, 2000000),
        next_service: 0,
        health: 0,
        verified: false,
      });
      audit("Vehicle ownership verification requested");
      break;
    }
    case "vehicle.verify": {
      requireRole(a, ["administrator"]);
      const v = d.vehicles.find((x) => x.id === c.id && inScope(a, x));
      if (!v) throw Error("Vehicle not found.");
      if (
        d.vehicles.some(
          (x) =>
            x.id !== v.id &&
            x.tenant_id === v.tenant_id &&
            x.verified &&
            x.registration === v.registration,
        )
      )
        throw Error("Registration already linked. Review ownership first.");
      v.verified = true;
      audit(required(p.reason));
      break;
    }
    default:
      throw Error("This operation is not available in Phase 1.");
  }
  return d;
}
export function createDemoRepository(): Repository {
  const read = () => {
    try {
      const s = localStorage.getItem(KEY);
      const saved = s ? (JSON.parse(s) as Data) : makeSeed();
      return {
        ...saved,
        service_catalogue:
          saved.service_catalogue ?? makeSeed().service_catalogue,
        service_requests: saved.service_requests ?? [],
        service_documents: saved.service_documents ?? [],
      };
    } catch {
      return makeSeed();
    }
  };
  return {
    load: async (a) => scopeData(read(), a),
    execute: async (a, c) => {
      const d = applyCommand(read(), a, c);
      localStorage.setItem(KEY, JSON.stringify(d));
    },
  };
}
