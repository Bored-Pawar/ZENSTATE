import { useState } from "react";
import { Link } from "react-router-dom";
import { usePlanning } from "../services/usePlanning";
import { formatInstant } from "../services/dates";
export default function PlannerConfirmation() {
  const { state, act, loadConversation, zone, error, setError, loading, path } =
      usePlanning(),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(null);
  const c = state.conversation;
  if (!c)
    return (
      <p>
        {loading ? "Restoring plan…" : error || "Start a plan first."}{" "}
        <Link to="/planner">Planner</Link>
      </p>
    );
  const d = c.draft,
    taskId = saved?.id || c.confirmedTaskId;
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const task = await act(`/planner/conversations/${c.id}/confirm`, {
        draftVersion: c.draftVersion,
      });
      if (task) {
        setSaved(task);
        await loadConversation(c.id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flow-page">
      <p className="eyebrow">PLAN WITH ZEN · STEP 4 OF 4</p>
      <h2>
        {taskId ? "Your plan is saved." : "Your plan is ready to become real."}
      </h2>
      <article className="confirmation-card">
        <div>
          <span>Task</span>
          <strong>{d.goal}</strong>
        </div>
        <div>
          <span>Focused time</span>
          <strong>{d.durationMinutes} minutes</strong>
        </div>
        <div>
          <span>Placement</span>
          <strong>
            {d.placementMode || "held"} {d.flexibleDate || ""}
          </strong>
          {d.sessions?.map((s) => (
            <small key={s.startAt}>
              {formatInstant(s.startAt, zone)} — {formatInstant(s.endAt, zone)}
            </small>
          ))}
        </div>
        <div>
          <span>Your reason</span>
          <strong>{d.motivation}</strong>
        </div>
      </article>
      <p className="hint">
        Confirmation checks your latest timetable again and atomically saves the
        task and sessions. Repeating confirmation returns the same task.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="flow-actions">
        {!taskId ? (
          <>
            <Link className="secondary" to={path("/planner/availability")}>
              Change placement
            </Link>
            <button
              className="primary"
              disabled={busy || loading}
              onClick={confirm}
            >
              {busy ? "Confirming…" : "Confirm and add plan"}
            </button>
          </>
        ) : (
          <>
            <Link className="primary" to={`/tasks/${taskId}`}>
              Open saved task
            </Link>
            <Link className="secondary" to="/timetable">
              View timetable
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
