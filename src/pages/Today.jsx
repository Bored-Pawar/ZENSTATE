import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../services/apiConfig";
import { DateTime, weekStart } from "../services/dates";
import CoachButton from "../components/CoachButton";
import StatCard from "../components/StatCard";
import TaskRow from "../components/TaskRow";
export default function Today() {
  const { state, today, zone } = useApp(),
    [report, setReport] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api(`/reports/weekly?weekStart=${weekStart(zone)}`)
      .then((r) => {
        if (active) {
          setReport(r);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [state.tasks, state.blocks, today]);
  const sessions = state.blocks.filter(
    (b) =>
      b.recordType === "session" &&
      b.status !== "cancelled" &&
      DateTime.fromISO(b.startAt, { zone }).toISODate() === today,
  );
  const tasks = state.tasks.filter((t) =>
    t.placementMode === "flexible"
      ? t.flexibleDate === today
      : sessions.some((s) => s.taskId === t.id),
  );
  const minutes =
    sessions.reduce(
      (n, b) => n + (+new Date(b.endAt) - +new Date(b.startAt)) / 60000,
      0,
    ) +
    tasks
      .filter((t) => t.placementMode === "flexible")
      .reduce(
        (n, t) =>
          n + Math.max(0, t.durationMinutes - (t.completedPlannedMinutes || 0)),
        0,
      );
  const next = tasks.find((t) => t.status !== "completed");
  return (
    <div className="page-grid today-page">
      <section className="hero-card">
        <div>
          <p className="eyebrow">
            {DateTime.now().setZone(zone).toFormat("cccc, d LLLL")}
          </p>
          <h2>Welcome, {state.user.name}.</h2>
          <p>
            {tasks.filter((t) => t.status !== "completed").length} tasks remain
            in today’s plan. Start with one manageable step.
          </p>
          <CoachButton text={next?.motivationalMessage || report?.coachText} />
        </div>
        <div className="focus-orb">
          <span>{tasks.length}</span>
          <small>tasks today</small>
        </div>
      </section>
      <section className="today-content">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR DAY</p>
            <h2>Today’s focus</h2>
          </div>
          <Link className="text-link" to="/tasks">
            See all tasks
          </Link>
        </div>
        <div className="task-list">
          {tasks.length ? (
            tasks.map((t) => <TaskRow key={t.id} task={t} />)
          ) : (
            <p>
              No tasks assigned today.{" "}
              <Link to="/planner">Plan a small goal with Zen.</Link>
            </p>
          )}
        </div>
      </section>
      <aside className="right-rail">
        <StatCard
          label="PLANNED TODAY"
          value={`${Math.floor(minutes / 60)}h ${minutes % 60}m`}
          detail="planned effort, not measured tracking"
        />
        <StatCard
          label="WEEKLY SESSIONS"
          value={
            report
              ? `${report.completedSessions}/${report.plannedSessions}`
              : "…"
          }
          detail="completed / planned sessions"
          tone="yellow"
        />
        {error && <p className="error">{error}</p>}
        <article className="small-card">
          <p className="eyebrow">A GENTLE NUDGE</p>
          <h3>Leave room to begin again.</h3>
          <p>
            {next?.motivation ||
              "A small, realistic plan is a good place to start."}
          </p>
        </article>
      </aside>
    </div>
  );
}
