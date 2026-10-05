import { useNavigate } from "react-router-dom";
export default function Login() {
  const navigate = useNavigate();
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate("/today");
          }}
        >
          <label>
            Email
            <input type="email" defaultValue="aditya@zenstate.app" required />
          </label>
          <label>
            Password
            <input type="password" defaultValue="zenstate" required />
          </label>
          <button className="primary wide">Enter ZenState</button>
        </form>
        <p className="form-note">Demo mode - any email and password work.</p>
      </div>
      <section className="login-art">
        <div className="orbit orbit-one"></div>
        <div className="orbit orbit-two"></div>
        <div className="art-copy">
          <span className="soft-dot"></span>
          <p>One clear next step is enough.</p>
          <small>ZENSTATE / DAILY FOCUS</small>
        </div>
      </section>
    </div>
  );
}
