import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useEffect, useState } from "react";
import NotificationPopup from "./NotificationPopup";
const links = [
  ["/today", "Today", "◉"],
  ["/timetable", "Timetable", "▦"],
  ["/planner", "Plan with Zen", "✦"],
  ["/tasks", "Tasks", "✓"],
  ["/journal", "Journal", "▤"],
  ["/discipline-report", "Discipline report", "◌"],
];
export default function AppLayout() {
  const { state } = useApp();
  const location = useLocation();
  const [showNotification, setShowNotification] = useState(false);
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const title =
    links.find(([p]) => location.pathname.startsWith(p))?.[1] || "ZenState";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/today" className="brand">
          <span className="brand-mark">z</span>
          <span>zenstate</span>
        </NavLink>
        <p className="sidebar-label">YOUR SPACE</p>
        <nav>
          {links.map(([to, label, icon]) => (
            <NavLink
              to={to}
              key={to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{state.user.name[0]}</div>
          <div>
            <strong>{state.user.name}</strong>
            <small>Building gently</small>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">ZENSTATE / PERSONAL SPACE</p>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <span className="date-chip">{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <button className="notification" onClick={() => setShowNotification(true)} title="Show reminder">●</button>
          </div>
          {showNotification && <NotificationPopup onClose={() => setShowNotification(false)} />}
        </header>
        <Outlet />
      </main>
    </div>
  );
}
