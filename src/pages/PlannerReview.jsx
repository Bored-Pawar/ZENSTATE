import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlanning } from "../services/usePlanning";
export default function PlannerReview() {
  const { state, conversationAction, error, setError, loading, path } =
      usePlanning(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [edits, setEdits] = useState({});
  const c = state.conversation;
  if (!c)
    return (
      <p>
        {loading
          ? "Loading saved draft…"
          : error || "Start a planning conversation first."}{" "}
        <Link to="/planner">Open planner</Link>
      </p>
    );
  if (c.status === "confirmed")
    return (
      <Link to={`/tasks/${c.confirmedTaskId}`}>
        This plan is confirmed. Open task.
      </Link>
    );
  const d = { ...c.draft, ...edits },
    change = (key, value) => setEdits({ ...edits, [key]: value });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await conversationAction(
        `/planner/conversations/${c.id}/draft`,
        {
          draftVersion: c.draftVersion,
          updates: {
            goal: d.goal,
            motivation: d.motivation,
            durationMinutes: Number(d.durationMinutes),
            durationEstimated: false,
            deadlineDate: d.deadlineDate || null,
            planningPreferences: d.planningPreferences || "",
            journalEnabled: d.journalEnabled ?? true,
            priority: d.priority || "medium",
          },
        },
        "PATCH",
      );
      if (!saved) return;
      navigate(path("/planner/availability"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flow-page">
      <p className="eyebrow">PLAN WITH ZEN · STEP 2 OF 4</p>
      <h2>Review the task before it takes space in your week.</h2>
      <p className="flow-copy">
        These fields are saved in your draft. Confirm them before choosing
        availability.
      </p>
      <form onSubmit={save}>
        <div className="review-card">
          <label>
            Task / goal
            <input
              required
              maxLength={2000}
              value={d.goal || ""}
              onChange={(e) => change("goal", e.target.value)}
            />
          </label>
          <label>
            Why it matters
            <textarea
              required
              maxLength={2000}
              value={d.motivation || ""}
              onChange={(e) => change("motivation", e.target.value)}
            />
          </label>
          <label>
            Total focused minutes{" "}
            {d.durationEstimated ? "(AI estimate — please check)" : ""}
            <input
              type="number"
              min="1"
              max="10080"
              step="1"
              required
              value={d.durationMinutes || ""}
              onChange={(e) =>
                change("durationMinutes", Number(e.target.value))
              }
            />
          </label>
          <label>
            Deadline (optional)
            <input
              type="date"
              value={d.deadlineDate || ""}
              onChange={(e) => change("deadlineDate", e.target.value)}
            />
          </label>
          <label>
            Preferences
            <textarea
              maxLength={2000}
              value={d.planningPreferences || ""}
              onChange={(e) => change("planningPreferences", e.target.value)}
            />
          </label>
          <label>
            Priority
            <select
              value={d.priority || "medium"}
              onChange={(e) => change("priority", e.target.value)}
            >
              {["low", "medium", "high"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="toggle-line">
            <input
              type="checkbox"
              checked={d.journalEnabled ?? true}
              onChange={(e) => change("journalEnabled", e.target.checked)}
            />
            Create a task journal
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="flow-actions">
          <Link className="secondary" to={path("/planner")}>
            Back to chat
          </Link>
          <button className="primary" disabled={busy || loading}>
            {busy ? "Saving…" : "Save and check available time"}
          </button>
        </div>
      </form>
    </section>
  );
}
