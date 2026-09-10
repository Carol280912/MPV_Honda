export type Role = "customer" | "manager" | "advisor" | "administrator";
export type Status =
  | "Booked"
  | "Confirmed"
  | "Arrived"
  | "In Service"
  | "Ready"
  | "Completed"
  | "Cancelled"
  | "No-show";
export interface Actor {
  user_id: string;
  role: Role;
  tenant_id: string;
  branch_id: string;
  name: string;
  customer_id?: string;
}
export interface Base {
  id: string;
  tenant_id: string;
  branch_id: string;
}
export interface Customer extends Base {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  advisor_id: string | null;
  last_visit: string | null;
  marketing_consent: boolean;
  consent_at: string;
  policy_version: string;
}
export interface Vehicle extends Base {
  customer_id: string;
  registration: string;
  model: string;
  year: number;
  mileage: number;
  next_service: number;
  health: number;
  verified: boolean;
}
export interface Appointment extends Base {
  customer_id: string;
  vehicle_id: string;
  advisor_id: string | null;
  service: string;
  date: string;
  time: string;
  status: Status;
  notes: string;
  updated_at: string;
}
export interface Recovery extends Base {
  customer_id: string;
  advisor_id: string | null;
  rating: number;
  comments: string;
  status: "Open" | "In progress" | "Resolved";
  due_at: string;
  contact_log: string;
  outcome: string;
  appointment_id: string;
  created_at: string;
}
export interface Campaign extends Base {
  title: string;
  segment: string;
  budget_sen: number;
  status: "Draft" | "Approved";
  starts_on: string;
  ends_on: string;
  description: string;
}
export interface Adjustment extends Base {
  customer_id: string;
  points: number;
  reason: string;
  requested_by: string;
  approved_by: string | null;
  status: "Pending" | "Approved" | "Posted";
}
export interface Ledger extends Base {
  customer_id: string;
  points: number;
  reason: string;
  reference: string;
  created_at: string;
}
export interface Member extends Base {
  user_id: string;
  name: string;
  role: Role;
  active: boolean;
}
export interface Settings extends Base {
  slot_minutes: number;
  lead_hours: number;
  cancel_hours: number;
  capacity: number;
  lapse_days: number;
  at_risk_days: number;
  recovery_hours: number;
  low_rating: number;
  adjustment_threshold: number;
  reward_points: number;
  reward_value_sen: number;
  tier_points: number;
  points_per_rm: number;
  points_expiry_days: number;
  promotion_limit_sen: number;
  dealer_name: string;
  closed_dates: string[];
}
export interface Audit extends Base {
  actor_id: string;
  action: string;
  entity_id: string;
  reason: string;
  created_at: string;
}
export interface Feedback extends Base {
  customer_id: string;
  appointment_id: string;
  rating: number;
  comments: string;
  contact_requested: boolean;
  created_at: string;
}
export interface Notification extends Base {
  customer_id: string;
  category: "Transactional" | "Marketing";
  title: string;
  body: string;
  created_at: string;
}
export interface Inspection extends Base {
  customer_id: string;
  vehicle_id: string;
  advisor_id: string;
  battery: string;
  tyres: string;
  brakes: string;
  oil: string;
  score: number;
  version: number;
  created_at: string;
}
export interface Data {
  customers: Customer[];
  vehicles: Vehicle[];
  appointments: Appointment[];
  recovery_cases: Recovery[];
  campaigns: Campaign[];
  adjustments: Adjustment[];
  loyalty_entries: Ledger[];
  memberships: Member[];
  settings: Settings[];
  audit_events: Audit[];
  feedback: Feedback[];
  notifications: Notification[];
  inspections: Inspection[];
}
export type Table = keyof Data;
export type Command = {
  type: string;
  id?: string;
  payload: Record<string, unknown>;
};
export interface Repository {
  load(actor: Actor): Promise<Data>;
  execute(actor: Actor, command: Command): Promise<void>;
}
