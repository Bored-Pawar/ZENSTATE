import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../services/apiConfig";
import { DateTime } from "../services/dates";
import AsyncButton from "./AsyncButton";
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
  const { state, logout, zone, saveUser, error, setError, refresh } = useApp(),
    location = useLocation();
  const [clock, setClock] = useState(DateTime.now()),
    [active, setActive] = useState(null),
    [reminderError, setReminderError] = useState("");
  const activeRef = useRef(null),
    checking = useRef(false),
    queue = useRef([]),
    checkRef = useRef(null);
  useEffect(() => {
    const timer = setInterval(() => setClock(DateTime.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        if (activeRef.current) {
          try {
            const valid = await api(`/reminders/${activeRef.current.id}`);
            if (cancelled) return;
            if (
              !valid.active ||
              (valid.startAt &&
                +new Date(valid.startAt) !==
                  +new Date(activeRef.current?.startAt))
            ) {
              activeRef.current = null;
              if (!cancelled) setActive(null);
            }
          } catch (e) {
            if (e.status === 404) {
              activeRef.current = null;
              if (!cancelled) setActive(null);
            } else throw e;
          }
        }
        const due = await api("/reminders/due");
        if (cancelled) return;
        const dueIds = new Set(due.map((reminder) => reminder.id));
        queue.current = queue.current.filter((reminder) =>
          dueIds.has(reminder.id),
        );
        for (const reminder of due) {
          if (!queue.current.some((queued) => queued.id === reminder.id))
            queue.current.push(reminder);
        }
        if (!activeRef.current) {
          while (queue.current.length) {
            const reminder = queue.current.shift();
            if (cancelled) break;
            try {
              const claimed = await api(`/reminders/${reminder.id}/delivered`, {
                method: "POST",
                body: {},
              });
              if (!cancelled) {
                activeRef.current = claimed;
                setActive(claimed);
              }
              break;
            } catch (e) {
              if (e.status !== 409) throw e;
            }
          }
        }
        if (!cancelled) setReminderError("");
      } catch (e) {
        if (!cancelled) setReminderError(e.message);
      } finally {
        checking.current = false;
      }
    };
    checkRef.current = check;
    check();
    const timer = setInterval(check, 12000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      checkRef.current = null;
    };
  }, [state.user.id]);
  useEffect(() => {
    // Cached mutations can invalidate the current popup immediately, even if
    // a due-check request is still in flight. Ordinary refresh leaves it alone.
    const valid = (reminder) => {
      const task = state.tasks.find((t) => t.id === reminder.taskId);
      if (!task || ["completed", "held"].includes(task.status)) return false;
      if (!reminder.id.startsWith("session:"))
        return (
          task.placementMode === "flexible" &&
          task.reminderStatus !== "cancelled" &&
          +new Date(task.flexibleReminderAt) === +new Date(reminder.startAt)
        );
      const block = state.blocks.find((b) => b.id === reminder.id.slice(8));
      return (
        !block ||
        (!block.rescheduledToSessionId &&
          !block.cancelReason &&
          block.status !== "cancelled" &&
          block.status !== "completed" &&
          +new Date(block.startAt) === +new Date(reminder.startAt) &&
          block.reminderStatus !== "cancelled")
      );
    };
    queue.current = queue.current.filter(valid);
    if (activeRef.current && !valid(activeRef.current)) {
      activeRef.current = null;
      setActive(null);
    }
    void checkRef.current?.();
  }, [state.tasks, state.blocks]);
  useEffect(
    () => () => {
      queue.current = [];
      activeRef.current = null;
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const dismiss = () => {
    window.speechSynthesis?.cancel();
    activeRef.current = null;
    setActive(null);
  };
  const title =
    links.find(([p]) => location.pathname.startsWith(p))?.[1] ||
    "Set up your week";
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
              key={to}
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{state.user.name[0]}</div>
          <div>
            <strong>{state.user.name}</strong>
            <button className="text-link" onClick={logout}>
              Log out
            </button>
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
            <span className="date-chip">
              {clock.setZone(zone).toFormat("HH:mm")}
            </span>
            <AsyncButton
              onClick={async () => {
                window.speechSynthesis?.getVoices();
                await saveUser({
                  voiceRemindersEnabled: !state.user.voiceRemindersEnabled,
                });
              }}
            >
              {state.user.voiceRemindersEnabled
                ? "Voice enabled"
                : "Enable voice reminders"}
            </AsyncButton>
          </div>
          {active && (
            <NotificationPopup
              key={active.id}
              reminder={active}
              onClose={dismiss}
            />
          )}
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <AsyncButton
              onClick={async () => {
                await refresh();
                setError("");
              }}
            >
              Retry loading
            </AsyncButton>
          </div>
        )}
        {reminderError && (
          <p className="error">Reminder check: {reminderError}</p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
