import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { browserZone } from "../services/dates";
export default function Login() {
  const { state, authenticate, error: sessionError } = useApp(),
    navigate = useNavigate();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    timezone: browserZone(),
  });
  if (state.user)
    return (
      <Navigate
        to={state.user.onboardingCompleted ? "/today" : "/setup"}
        replace
      />
    );
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await authenticate(
        register ? "register" : "login",
        register ? form : { email: form.email, password: form.password },
      );
      if (user) navigate(user.onboardingCompleted ? "/today" : "/setup");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <span className="brand-mark">z</span>
          <span>zenstate</span>
        </div>
        <p className="eyebrow">A QUIETER WAY TO MOVE FORWARD</p>
        <h1>Make room for what matters.</h1>
        <p className="login-copy">
          A planning space that respects your time, notices your effort, and
          helps you begin again.
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Your name
              <input
                required
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={8}
              maxLength={72}
              required
              autoComplete={register ? "new-password" : "current-password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {register && (
            <label>
              Timezone
              <input
                required
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </label>
          )}
          {(error || sessionError) && (
            <p role="alert" className="error">
              {error || sessionError}
            </p>
          )}
          <button className="primary wide" disabled={busy}>
            {busy
              ? "Connecting…"
              : register
                ? "Create my space"
                : "Enter Zenstate"}
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Already registered? Sign in"
              : "New here? Create an account"}
          </button>
        </form>
      </div>
      <section className="login-art">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="art-copy">
          <span className="soft-dot" />
          <p>One clear next step is enough.</p>
          <small>ZENSTATE / DAILY FOCUS</small>
        </div>
      </section>
    </div>
  );
}
