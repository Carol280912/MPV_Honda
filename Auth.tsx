import { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, CarFront } from "lucide-react";
import { Button, Field, Badge } from "../components/ui";
import { supabase, mode, configurationError } from "../lib/supabase";
import type { Role } from "../lib/types";
import { roles } from "../lib/rules";
export function Auth({ onDemo }: { onDemo: (role: Role) => void }) {
  const [screen, setScreen] = useState<"signin" | "signup" | "recover">(
      "signup",
    ),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const f = new FormData(e.currentTarget);
    if (screen === "signup" && f.get("password") !== f.get("confirm"))
      return setError("Passwords do not match.");
    if (mode === "demo")
      return setSuccess(
        "Sign-up preview complete. No account was created and no password was saved. Use a demo workspace below to explore.",
      );
    if (!supabase)
      return setError(configurationError || "Authentication unavailable.");
    setBusy(true);
    try {
      const email = String(f.get("email")),
        password = String(f.get("password"));
      if (screen === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: location.origin,
            data: {
              full_name: String(f.get("name")),
              phone: String(f.get("phone")),
              marketing_consent: f.get("marketing") === "on",
              policy_version: "1.0",
            },
          },
        });
        if (error) throw error;
        setSuccess(
          "Check your email to verify your account, then sign in. Vehicle ownership is verified separately.",
        );
      } else if (screen === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/#reset-password",
        });
        if (error) throw error;
        setSuccess(
          "If the account exists, a password reset email will arrive shortly.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <div className="brand">
          <span className="brand-symbol">A</span>AutoCare
          <span className="brand-dot">.</span>
        </div>
        <div className="auth-story-copy">
          <Badge tone="light">YOUR OWNERSHIP COMPANION</Badge>
          <h1>
            Your warranty ends.
            <br />
            Our care doesn’t.
          </h1>
          <p>
            One place for your vehicle, your next visit, and the rewards that
            make every journey count.
          </p>
          <img
            src="/vehicle-civic.png"
            alt="Silver vehicle from the supplied design"
          />
          <div className="auth-benefits">
            <span>
              <ShieldCheck />
              Authorised dealer care
            </span>
            <span>
              <CarFront />
              Made for your vehicle
            </span>
          </div>
        </div>
        <small>PREMIER AUTO GROUP · CARE BEYOND THE WARRANTY</small>
      </aside>
      <main className="auth-main">
        <div className="auth-top">
          <span>Already part of AutoCare?</span>
          <button
            className="text-link"
            onClick={() => {
              setScreen(screen === "signin" ? "signup" : "signin");
              setError("");
              setSuccess("");
            }}
          >
            {screen === "signin" ? "Create an account" : "Sign in"}{" "}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="auth-form">
          <div className="eyebrow">LET’S GET YOU ON THE ROAD</div>
          <h1>
            {screen === "signup"
              ? "Care starts here."
              : screen === "recover"
                ? "Let’s get you back in."
                : "Welcome back."}
          </h1>
          <p>
            {screen === "signup"
              ? "Create your account and make ownership a little easier."
              : screen === "recover"
                ? "We’ll email you a secure recovery link."
                : "Sign in to your customer or assigned staff workspace."}
          </p>
          {mode === "demo" && (
            <div className="inline-note">
              Demo preview · No account or password will be stored.
            </div>
          )}
          {configurationError && (
            <div className="error-message">{configurationError}</div>
          )}
          <form onSubmit={submit}>
            {screen === "signup" && (
              <>
                <Field label="Full name">
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    placeholder="Your full name"
                    maxLength={100}
                  />
                </Field>
                <Field label="Mobile number">
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    pattern="(\+?60|0)[0-9 -]{8,13}"
                    required
                    placeholder="+60 12 345 6789"
                  />
                </Field>
              </>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </Field>
            {screen !== "recover" && (
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    screen === "signup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={12}
                  placeholder="At least 12 characters"
                />
              </Field>
            )}
            {screen === "signup" && (
              <>
                <Field label="Confirm password">
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    placeholder="Re-enter your password"
                  />
                </Field>
                <label className="checkbox">
                  <input type="checkbox" required />I acknowledge that this
                  preview’s privacy terms must be replaced by the pilot dealer’s
                  approved policy before launch.
                </label>
                <label className="checkbox">
                  <input name="marketing" type="checkbox" />
                  Send me offers and ownership tips. Optional; change this any
                  time.
                </label>
              </>
            )}
            {screen === "signin" && (
              <button
                type="button"
                className="text-link"
                onClick={() => setScreen("recover")}
              >
                Forgot password?
              </button>
            )}
            {error && (
              <div role="alert" className="error-message">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="success-message">
                <CheckCircle2 size={19} />
                {success}
              </div>
            )}
            <Button
              disabled={busy || !!configurationError}
              className="button primary full"
            >
              {busy
                ? "Please wait…"
                : screen === "signup"
                  ? "Create my account"
                  : screen === "recover"
                    ? "Send recovery link"
                    : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </form>
          {mode === "demo" && (
            <div className="demo-entrance">
              <span>EXPLORE A DEMO WORKSPACE</span>
              <div>
                {(["customer", "manager", "administrator"] as Role[]).map(
                  (r) => (
                    <button key={r} onClick={() => onDemo(r)}>
                      {roles[r]}
                      <ArrowRight size={14} />
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
          <p className="auth-foot">
            Staff access is assigned by an administrator.
            <br />
            Public sign-up never grants a staff role.
          </p>
        </div>
      </main>
    </div>
  );
}
export function ResetPassword() {
  const [message, setMessage] = useState("");
  return (
    <div className="auth-form standalone">
      <h1>Choose a new password</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (f.get("password") !== f.get("confirm"))
            return setMessage("Passwords do not match.");
          if (!supabase) return setMessage("Supabase is not configured.");
          const { error } = await supabase.auth.updateUser({
            password: String(f.get("password")),
          });
          setMessage(
            error
              ? error.message
              : "Password updated. You can return to your workspace.",
          );
        }}
      >
        <Field label="New password">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        <Field label="Confirm password">
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        <Button>Update password</Button>
        <p role="status">{message}</p>
        <a href="#home">Return to workspace</a>
      </form>
    </div>
  );
}
