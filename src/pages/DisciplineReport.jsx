import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/apiConfig";
import { weekStart, addDays, DateTime } from "../services/dates";
import CoachButton from "../components/CoachButton";
import AsyncButton from "../components/AsyncButton";
export default function DisciplineReport() {
  const { state, zone, act } = useApp(),
    [week, setWeek] = useState(() => weekStart(zone)),
    [report, setReport] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setReport(null);
    api(`/reports/weekly?weekStart=${week}`)
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
  }, [week, state.tasks, state.blocks]);
  if (!report)
    return (
      <p className={error ? "error" : ""}>
        {error || "Calculating saved weekly data…"}
      </p>
    );
  const max = Math.max(1, ...report.daily.map((d) => d.completedMinutes));
  const hasSessionData = report.plannedSessions > 0;
  return (
    <div>
      <div className="toolbar">
        <button
          className="secondary"
          onClick={() => setWeek(addDays(week, -7))}
        >
          ← Previous week
        </button>
        <strong>
          {week} — {addDays(week, 6)}
        </strong>
        <button className="secondary" onClick={() => setWeek(addDays(week, 7))}>
          Next week →
        </button>
      </div>
      <section className="report-hero">
        <div>
          <p className="eyebrow">YOUR WEEK IN REVIEW</p>
          <h2>Progress is a pattern, not a verdict.</h2>
          <h3>
            {report.completedTasks}{" "}
            {report.completedTasks === 1 ? "task" : "tasks"} completed this week
          </h3>
          {hasSessionData && (
            <>
              <p>
                {report.completedSessions} completed · {report.missedSessions}{" "}
                missed · {report.upcomingSessions} upcoming or active sessions.
              </p>
              <p>
                {report.completedMinutes} / {report.plannedMinutes} planned
                minutes completed.
              </p>
            </>
          )}
          {report.rescheduledSessions > 0 && (
            <p className="hint">
              {report.rescheduledSessions} rescheduled occurrences retained (
              {report.historicalMissedSessions} previously missed). These
              history records are excluded from current planned effort.
            </p>
          )}
          <CoachButton text={report.coachText} />
        </div>
        <div className="report-score">
          {hasSessionData ? (
            <>
              <strong>{report.completionPercent}%</strong>
              <span>session completion</span>
            </>
          ) : (
            <span>No session data</span>
          )}
        </div>
      </section>
      <div className="report-grid">
        <section className="chart-card">
          <p className="eyebrow">COMPLETED PLANNED MINUTES · BY SESSION DATE</p>
          <h3>Your focus over seven days</h3>
          <div className="bar-chart">
            {report.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.completedMinutes} completed planned minutes, ${d.plannedSessions} sessions`}
              >
                <small>{d.completedMinutes}</small>
                <span
                  style={{ height: `${(d.completedMinutes / max) * 75}%` }}
                />
                <small>{DateTime.fromISO(d.date).toFormat("ccc")}</small>
              </div>
            ))}
          </div>
          <p className="hint">
            Planned session effort, not measured time tracking. Cancelled
            sessions are excluded.
          </p>
        </section>
        <section className="coach-panel">
          <p className="eyebrow">WEEKLY COACH</p>
          <h3>A realistic next step.</h3>
          <p>{report.coachText}</p>
          <CoachButton text={report.coachText} compact />
        </section>
        <section className="missed-card">
          <p className="eyebrow">NEEDS A NEW PLACE</p>
          <h3>
            {report.unfinished.length
              ? "Review unfinished work for tomorrow."
              : "No unfinished work needs review for this week."}
          </h3>
          <p>
            {report.overdueFlexible.length} overdue flexible tasks (their
            assigned local day has ended).
          </p>
          {report.unfinished.map((t) => (
            <div className="missed-task" key={t.id}>
              <div>
                <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                <small>
                  Missed history is retained. New placement never displaces
                  another task.
                </small>
                <div className="flow-actions">
                  {["scheduled", "flexible", "held"].map((mode) => (
                    <AsyncButton
                      key={mode}
                      onClick={() => act(`/tasks/${t.id}/reschedule`, { mode })}
                    >
                      {mode === "scheduled"
                        ? "Find slot tomorrow"
                        : mode === "flexible"
                          ? "Flexible tomorrow"
                          : "Hold remaining work"}
                    </AsyncButton>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
