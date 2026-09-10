import type { Actor, Customer, Data, Settings, Status } from "./types";
export const roles = {
  customer: "Customer",
  manager: "Manager",
  advisor: "Service Advisor",
  administrator: "Administrator",
};
export const transitions: Record<Status, Status[]> = {
  Booked: ["Confirmed", "Cancelled"],
  Confirmed: ["Arrived", "Cancelled", "No-show"],
  Arrived: ["In Service"],
  "In Service": ["Ready"],
  Ready: ["Completed"],
  Completed: [],
  Cancelled: [],
  "No-show": [],
};
export function canTransition(from: Status, to: Status) {
  return transitions[from].includes(to);
}
export function segment(c: Customer, s: Settings, now = new Date()): string {
  if (!c.last_visit) return "New";
  const days = Math.floor(
    (now.getTime() - new Date(c.last_visit).getTime()) / 86400000,
  );
  return days >= s.lapse_days
    ? "Lapsed"
    : days >= s.at_risk_days
      ? "At risk"
      : days >= 90
        ? "Due"
        : "Active";
}
export function balance(data: Data, customerId: string) {
  return data.loyalty_entries
    .filter((e) => e.customer_id === customerId)
    .reduce((n, e) => n + e.points, 0);
}
export function money(sen: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(sen / 100);
}
export function inScope(
  actor: Actor,
  row: { tenant_id: string; branch_id: string },
) {
  return actor.tenant_id === row.tenant_id && actor.branch_id === row.branch_id;
}
export function eligibleAudience(data: Data, s: Settings, target: string) {
  return data.customers.filter(
    (c) =>
      c.marketing_consent &&
      (target === "All eligible" || segment(c, s) === target),
  );
}
export function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
