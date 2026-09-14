import { LoyaltyClaims } from "./features/LoyaltyClaims";
import { PhaseTwo } from "./features/PhaseTwo";
import { useEffect, useMemo, useState } from "react";
import {
  Home,
  CalendarDays,
  Gift,
  Menu,
  Users,
  HeartHandshake,
  Settings2,
  ShieldCheck,
  Activity,
  Megaphone,
  ClipboardCheck,
  LogOut,
  Bell,
  ChevronDown,
  ArrowUpRight,
  CarFront,
  MessageSquareText,
} from "lucide-react";
import type { Actor, Command, Data, Role } from "./lib/types";
import { WorkspaceContext } from "./lib/context";
import { roles } from "./lib/rules";
import { mode, supabase } from "./lib/supabase";
import { createDemoRepository } from "./data/demo";
import { demoActors } from "./data/seed";
import { supabaseRepository } from "./data/supabase";
import { Auth, ResetPassword } from "./features/Auth";
import {
  CustomerHome,
  CustomerVehicles,
  CustomerWallet,
  CustomerFeedback,
  CustomerMore,
  CustomerRecords,
} from "./features/Customer";
import { Appointments } from "./features/Appointments";
import {
  OperationsHome,
  Customers,
  RecoveryCases,
  Campaigns,
} from "./features/Operations";
import {
  AdminHome,
  AdminSettings,
  Access,
  LoyaltyAdmin,
  AuditTrail,
  Quality,
} from "./features/Admin";
import { Button, Card, Empty } from "./components/ui";
const navs = {
  customer: [
    ["home", "Home", Home],
    ["claims", "Points claims", Gift],
    ["vehicles", "Vehicles", CarFront],
    ["services", "Service & repairs", CarFront],
    ["appointments", "Bookings", CalendarDays],
    ["wallet", "Loyalty rewards", Gift],
    ["history", "Documents & history", ClipboardCheck],
    ["more", "Settings", Menu],
  ],
  manager: [
    ["home", "Overview", Home],
    ["claims", "Points claims", Gift],
    ["appointments", "Appointments", CalendarDays],
    ["services", "Service requests", CarFront],
    ["customers", "Customers & retention", Users],
    ["recovery", "Service recovery", HeartHandshake],
    ["campaigns", "Campaigns", Megaphone],
    ["loyalty", "Loyalty approvals", Gift],
    ["audit", "Business audit", Activity],
  ],
  advisor: [],
  administrator: [
    ["home", "Overview", Home],
    ["claims", "Points claims", Gift],
    ["access", "People & access", Users],
    ["settings", "Rules & configuration", Settings2],
    ["loyalty", "Loyalty governance", Gift],
    ["services", "Service catalogue", CarFront],
    ["quality", "Data quality", ShieldCheck],
    ["audit", "Audit trail", Activity],
  ],
} as const;
const allowed: Record<Role, string[]> = {
  customer: [
    "maintenance",
    "repairs",
    "parts",
    "insurance",
    "towing",
    "services",
    "claims",
    "home",
    "booking",
    "appointments",
    "wallet",
    "more",
    "vehicles",
    "feedback",
    "health",
    "history",
    "notifications",
    "offers",
  ],
  manager: [
    "services",
    "claims",
    "home",
    "appointments",
    "booking",
    "customers",
    "recovery",
    "campaigns",
    "loyalty",
    "audit",
  ],
  advisor: [],
  administrator: [
    "services",
    "claims",
    "home",
    "access",
    "settings",
    "loyalty",
    "quality",
    "audit",
  ],
};
function initialActor(): Actor | null {
  if (mode !== "demo") return null;
  const role = sessionStorage.getItem("autocare-demo-role") as Role;
  return role && role !== "advisor" && demoActors[role]
    ? demoActors[role]
    : null;
}
export default function App() {
  const [actor, setActor] = useState<Actor | null>(initialActor),
    [data, setData] = useState<Data | null>(null),
    [route, setRoute] = useState(location.hash.slice(1) || "home"),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(mode === "supabase" && !!supabase);
  const repository = useMemo(
    () => (mode === "supabase" ? supabaseRepository : createDemoRepository()),
    [],
  );
  const navigate = (r: string) => {
    location.hash = r;
    setRoute(r);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const handler = () => setRoute(location.hash.slice(1) || "home");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    async function sync() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase!.auth.getUser();
        if (!user) {
          if (alive) setActor(null);
          return;
        }
        let { data: members, error } = await supabase!
          .from("memberships")
          .select("*")
          .eq("user_id", user.id)
          .eq("active", true);
        if (error) throw error;
        if (!members?.length) {
          const tenant = import.meta.env.VITE_TENANT_ID,
            branch = import.meta.env.VITE_BRANCH_ID;
          if (!tenant || !branch)
            throw Error(
              "An administrator must configure the customer registration tenant and branch.",
            );
          const { error: enrolError } = await supabase!.rpc("enrol_customer", {
            p_tenant: tenant,
            p_branch: branch,
          });
          if (enrolError) throw enrolError;
          ({ data: members, error } = await supabase!
            .from("memberships")
            .select("*")
            .eq("user_id", user.id)
            .eq("active", true));
          if (error) throw error;
        }
        const m = members?.[0];
        if (!m)
          throw Error("No active membership. Contact your administrator.");
        if (m.role === "advisor")
          throw Error("Service Advisor workspace is on hold for this release.");
        if (alive)
          setActor({
            user_id: user.id,
            tenant_id: m.tenant_id,
            branch_id: m.branch_id,
            role: m.role,
            name: m.name,
          });
      } catch (e) {
        if (alive) {
          setActor(null);
          setData(null);
          setError((e as Error).message);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    void sync();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("reset-password");
        setLoading(false);
        return;
      }
      setTimeout(() => void sync(), 0);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!actor) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    repository
      .load(actor)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [actor, repository]);
  async function run(command: Command) {
    if (!actor || busy) return false;
    setBusy(true);
    try {
      await repository.execute(actor, command);
      setData(await repository.load(actor));
      setToast("Saved successfully.");
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function selectRole(role: Role) {
    if (role === "advisor") return;
    setData(null);
    sessionStorage.setItem("autocare-demo-role", role);
    setActor(demoActors[role]);
    navigate("home");
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    sessionStorage.removeItem("autocare-demo-role");
    setActor(null);
    setData(null);
    navigate("signup");
  }
  if (route === "reset-password") return <ResetPassword />;
  if (!actor && !loading)
    return (
      <>
        {error && <div className="error-message fixed-error">{error}</div>}
        <Auth onDemo={selectRole} />
      </>
    );
  if (loading && !data)
    return (
      <div className="loading-page">
        <span className="brand-symbol">A</span>
        <h2>Preparing your workspace…</h2>
      </div>
    );
  if (!actor || !data || !data.settings.length)
    return (
      <div className="loading-page">
        <h2>Workspace unavailable</h2>
        <p>
          {error ||
            "No branch settings were found. Ask your administrator to finish setup."}
        </p>
        <Button onClick={signOut}>Return to sign in</Button>
      </div>
    );
  let content;
  if (!allowed[actor.role].includes(route))
    content = (
      <Card>
        <Empty
          title="This page isn’t available in your role"
          description="Use the navigation to return to your authorised workspace."
        />
      </Card>
    );
  else
    switch (route) {
      case "claims":
        content = <LoyaltyClaims />;
        break;
      case "home":
        content =
          actor.role === "customer" ? (
            <CustomerHome />
          ) : actor.role === "administrator" ? (
            <AdminHome />
          ) : (
            <OperationsHome />
          );
        break;
      case "booking":
      case "appointments":
        content = <Appointments key={route} book={route === "booking"} />;
        break;
      case "maintenance":
      case "repairs":
      case "parts":
      case "insurance":
      case "towing":
      case "services":
        content = (
          <PhaseTwo
            key={route}
            initialCategory={
              route === "services"
                ? "Maintenance"
                : route[0].toUpperCase() + route.slice(1)
            }
          />
        );
        break;
      case "vehicles":
        content = <CustomerVehicles />;
        break;
      case "wallet":
        content = <CustomerWallet />;
        break;
      case "feedback":
        content = <CustomerFeedback />;
        break;
      case "more":
        content = <CustomerMore />;
        break;
      case "health":
      case "history":
      case "notifications":
      case "offers":
        content = <CustomerRecords kind={route} />;
        break;
      case "customers":
        content = <Customers />;
        break;
      case "recovery":
        content = <RecoveryCases />;
        break;
      case "campaigns":
        content = <Campaigns />;
        break;
      case "settings":
        content = <AdminSettings />;
        break;
      case "access":
        content = <Access />;
        break;
      case "loyalty":
        content = <LoyaltyAdmin />;
        break;
      case "quality":
        content = <Quality />;
        break;
      case "audit":
        content = <AuditTrail />;
        break;
      default:
        content = null;
    }
  return (
    <WorkspaceContext.Provider
      value={{ actor, data, busy, run, notify: setToast, route, navigate }}
    >
      <div
        className={`app-shell ${actor.role === "customer" ? "customer-shell" : "staff-shell"}`}
      >
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-symbol">A</span>AutoCare
            <span className="brand-dot">.</span>
          </div>
          <div className="workspace-label">{roles[actor.role]} workspace</div>
          <div className="branch-box">
            <ShieldCheck size={20} />
            <span>
              <strong>{data.settings[0].dealer_name}</strong>
              <small>Glenmarie · Phase 2</small>
            </span>
            <ChevronDown size={14} />
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Workspace navigation">
            {navs[actor.role].map(([path, label, Icon]) => (
              <button
                key={path}
                className={route === path ? "active" : ""}
                aria-current={route === path ? "page" : undefined}
                onClick={() => navigate(path)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="support-box">
              <ShieldCheck size={22} />
              <h3>Care beyond warranty.</h3>
              <p>Built around your next journey.</p>
            </div>
            <button className="profile-row" onClick={signOut}>
              <span className="avatar">
                {actor.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                <strong>{actor.name}</strong>
                <small>{roles[actor.role]}</small>
              </span>
              <LogOut size={17} />
            </button>
          </div>
        </aside>
        <div className="app-body">
          <header className="topbar">
            <div className="desktop-breadcrumb">
              Workspace <span>/</span>
              <strong>
                {navs[actor.role].find((n) => n[0] === route)?.[1] ||
                  route.replaceAll("-", " ")}
              </strong>
            </div>
            <div className="mobile-brand">
              <ShieldCheck size={21} />
              <span>
                {data.settings[0].dealer_name}
                <small>AUTHORISED DEALER CARE</small>
              </span>
            </div>
            <div className="topbar-actions">
              {mode === "demo" && (
                <label className="role-switch">
                  <span>DEMO</span>
                  <select
                    aria-label="Demo workspace"
                    value={actor.role}
                    onChange={(e) => selectRole(e.target.value as Role)}
                  >
                    {(["customer", "manager", "administrator"] as Role[]).map(
                      (r) => (
                        <option key={r} value={r}>
                          {roles[r]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <button
                aria-label="View notifications"
                className="notification-button"
                onClick={() =>
                  navigate(
                    actor.role === "customer"
                      ? "notifications"
                      : actor.role === "administrator"
                        ? "audit"
                        : "recovery",
                  )
                }
              >
                <Bell size={19} />
                <i />
              </button>
              <button
                className="avatar"
                aria-label="Sign out"
                onClick={signOut}
              >
                {actor.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </button>
            </div>
          </header>
          <main className="main-content">
            {mode === "demo" && (
              <div className="demo-strip">
                <span>INTERACTIVE PREVIEW</span>Fictional data · Changes stay in
                this browser
                <button onClick={signOut}>
                  Preview sign-up <ArrowUpRight size={13} />
                </button>
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            {actor.role !== "customer" && (
              <select
                className="mobile-staff-nav"
                aria-label="Workspace page"
                value={route}
                onChange={(e) => navigate(e.target.value)}
              >
                {navs[actor.role].map(([path, label]) => (
                  <option key={path} value={path}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {content}
            <footer>
              © {new Date().getFullYear()} AutoCare ·{" "}
              {data.settings[0].dealer_name}
              <span>Phase 2 · Ownership & care</span>
            </footer>
          </main>
          {actor.role === "customer" && (
            <nav className="bottom-nav" aria-label="Customer navigation">
              {navs.customer
                .filter((n) =>
                  [
                    "home",
                    "services",
                    "appointments",
                    "wallet",
                    "more",
                  ].includes(n[0]),
                )
                .map(([path, label, Icon]) => (
                  <button
                    key={path}
                    className={route === path ? "active" : ""}
                    onClick={() => navigate(path)}
                  >
                    <Icon size={21} />
                    {label}
                  </button>
                ))}
            </nav>
          )}
        </div>
      </div>
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
