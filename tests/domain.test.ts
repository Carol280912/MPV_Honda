import { describe, it, expect } from "vitest";
import { makeSeed, demoActors } from "../src/data/seed";
import { applyCommand, scopeData } from "../src/data/demo";
import {
  balance,
  canTransition,
  csvCell,
  eligibleAudience,
  localDate,
  segment,
} from "../src/lib/rules";
import type { Actor } from "../src/lib/types";
const manager = demoActors.manager,
  admin = demoActors.administrator,
  customer = demoActors.customer;
describe("Phase 1 roles and data scope", () => {
  it("customers only see their own records", () => {
    const d = scopeData(makeSeed(), customer);
    expect(d.customers.map((c) => c.id)).toEqual(["c1"]);
    expect(d.vehicles.every((v) => v.customer_id === "c1")).toBe(true);
    expect(d.audit_events).toHaveLength(0);
    expect(d.recovery_cases).toHaveLength(0);
  });
  it("never crosses tenant or branch", () => {
    for (const patch of [{ tenant_id: "other" }, { branch_id: "other" }]) {
      const d = scopeData(makeSeed(), { ...manager, ...patch });
      expect(d.customers).toHaveLength(0);
      expect(d.settings).toHaveLength(0);
    }
  });
  it("blocks customers from rule and access edits", () => {
    for (const type of [
      "settings.update",
      "capacity.update",
      "member.update",
      "campaign.create",
    ])
      expect(() =>
        applyCommand(makeSeed(), customer, { type, payload: {} }),
      ).toThrow();
  });
  it("blocks Service Advisor actions while held", () =>
    expect(() =>
      applyCommand(makeSeed(), demoActors.advisor, {
        type: "appointment.create",
        payload: {},
      }),
    ).toThrow("on hold"));
  it("requires an active authoritative membership", () => {
    const d = makeSeed();
    d.memberships.find((m) => m.user_id === manager.user_id)!.active = false;
    expect(() =>
      applyCommand(d, manager, {
        type: "capacity.update",
        payload: { capacity: 5 },
      }),
    ).toThrow("Active membership");
  });
  it("prevents self access changes", () =>
    expect(() =>
      applyCommand(makeSeed(), admin, {
        type: "member.update",
        id: admin.user_id,
        payload: { role: "manager", reason: "test" },
      }),
    ).toThrow("own access"));
});
describe("Appointments and customer recovery", () => {
  it("allows sequential statuses only", () => {
    expect(canTransition("Confirmed", "Arrived")).toBe(true);
    expect(canTransition("Confirmed", "Completed")).toBe(false);
    expect(canTransition("Completed", "Booked")).toBe(false);
  });
  it("enforces capacity and closure dates", () => {
    const d = makeSeed();
    d.settings[0].capacity = 1;
    const command = {
      type: "appointment.create",
      payload: {
        customer_id: "c1",
        vehicle_id: "v1",
        service: "Periodic maintenance",
        date: localDate(3),
        time: "10:30",
      },
    };
    expect(() => applyCommand(d, customer, command)).toThrow("full");
    d.settings[0].closed_dates = [localDate(3)];
    expect(() => applyCommand(d, customer, command)).toThrow("closed");
  });
  it("rejects unverified vehicles and wrong customers", () => {
    const d = makeSeed();
    d.vehicles[0].verified = false;
    expect(() =>
      applyCommand(d, customer, {
        type: "appointment.create",
        payload: {
          customer_id: "c1",
          vehicle_id: "v1",
          service: "Periodic maintenance",
          date: localDate(5),
          time: "10:30",
        },
      }),
    ).toThrow("verified");
    expect(() =>
      applyCommand(d, customer, {
        type: "appointment.status",
        id: "a2",
        payload: { status: "Cancelled" },
      }),
    ).toThrow("scope");
  });
  it("preserves service and vehicle when rescheduling", () => {
    const d = applyCommand(makeSeed(), customer, {
      type: "appointment.reschedule",
      id: "a1",
      payload: { date: localDate(7), time: "12:00" },
    });
    expect(d.appointments[0].service).toBe("Periodic maintenance");
    expect(d.appointments[0].vehicle_id).toBe("v1");
    expect(d.appointments[0].time).toBe("12:00");
  });
  it("creates a timed case for low feedback and prevents duplicates", () => {
    const d = makeSeed();
    d.feedback = [];
    const command = {
      type: "feedback.create",
      payload: {
        customer_id: "c1",
        appointment_id: "a3",
        rating: 2,
        comments: "Delay",
        contact_requested: true,
      },
    };
    const result = applyCommand(d, customer, command);
    expect(result.recovery_cases.at(-1)?.rating).toBe(2);
    expect(
      new Date(result.recovery_cases.at(-1)!.due_at).getTime(),
    ).toBeGreaterThan(Date.now());
    expect(() => applyCommand(result, customer, command)).toThrow("already");
  });
  it("requires contact and outcome for closure", () => {
    expect(() =>
      applyCommand(makeSeed(), manager, {
        type: "recovery.update",
        id: "r1",
        payload: { status: "Resolved", outcome: "Fixed" },
      }),
    ).toThrow("contact");
    const d = applyCommand(makeSeed(), manager, {
      type: "recovery.update",
      id: "r1",
      payload: {
        status: "Resolved",
        outcome: "Customer confirmed resolution",
        contact_log: "Called customer",
      },
    });
    expect(d.recovery_cases[0].status).toBe("Resolved");
  });
});
describe("Loyalty and consent controls", () => {
  it("requires independent approval before large posting and posts once", () => {
    let d = makeSeed();
    expect(() =>
      applyCommand(d, admin, {
        type: "adjustment.post",
        id: "adjust-1",
        payload: {},
      }),
    ).toThrow("approval");
    d = applyCommand(d, manager, {
      type: "adjustment.approve",
      id: "adjust-1",
      payload: {},
    });
    d = applyCommand(d, admin, {
      type: "adjustment.post",
      id: "adjust-1",
      payload: {},
    });
    expect(balance(d, "c2")).toBe(2400);
    expect(() =>
      applyCommand(d, admin, {
        type: "adjustment.post",
        id: "adjust-1",
        payload: {},
      }),
    ).toThrow("already");
  });
  it("prevents self approval and negative balances", () => {
    let d = makeSeed();
    d.adjustments[0].requested_by = manager.user_id;
    expect(() =>
      applyCommand(d, manager, {
        type: "adjustment.approve",
        id: "adjust-1",
        payload: {},
      }),
    ).toThrow("different");
    d.adjustments[0].points = -2000;
    d.adjustments[0].approved_by = "other-manager";
    d.adjustments[0].status = "Approved";
    expect(() =>
      applyCommand(d, admin, {
        type: "adjustment.post",
        id: "adjust-1",
        payload: {},
      }),
    ).toThrow("negative");
  });
  it("suppresses unconsented customers", () => {
    const d = makeSeed();
    expect(
      eligibleAudience(d, d.settings[0], "All eligible").map((c) => c.id),
    ).not.toContain("c3");
    expect(
      eligibleAudience(d, d.settings[0], "Lapsed").map((c) => c.id),
    ).toEqual(["c2"]);
  });
  it("does not classify new customers as lapsed", () => {
    const d = makeSeed();
    d.customers[0].last_visit = null;
    expect(segment(d.customers[0], d.settings[0])).toBe("New");
  });
  it("validates thresholds and campaign budgets", () => {
    expect(() =>
      applyCommand(makeSeed(), admin, {
        type: "settings.update",
        payload: { lapse_days: 100, at_risk_days: 150 },
      }),
    ).toThrow("exceed");
    expect(() =>
      applyCommand(makeSeed(), manager, {
        type: "campaign.create",
        payload: { budget_sen: 9999999 },
      }),
    ).toThrow();
  });
  it("escapes spreadsheet formula injection in CSV", () =>
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"'));
});
