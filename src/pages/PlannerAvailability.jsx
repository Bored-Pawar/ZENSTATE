import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlanning } from "../services/usePlanning";
import PlacementForm from "../components/PlacementForm";
export default function PlannerAvailability() {
  const { state, conversationAction, error, setError, loading, path } =
      usePlanning(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [selection, setSelection] = useState(null);
  const c = state.conversation;
  if (!c)
    return (
      <p>
        {loading ? "Loading draft…" : error || "Start a plan first."}{" "}
        <Link to="/planner">Planner</Link>
      </p>
    );
  const d = c.draft,
    p = selection || {
      placementMode:
        d.placementMode || (d.taskType === "multi_day" ? "held" : "scheduled"),
      sessions: d.sessions || [],
      flexibleDate: d.flexibleDate,
      flexibleReminderAt: d.flexibleReminderAt,
    };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const saved = await conversationAction(
        `/planner/conversations/${c.id}/draft`,
        { draftVersion: c.draftVersion, updates: p },
        "PATCH",
      );
      if (!saved) return;
      navigate(path("/planner/confirmation"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flow-page">
      <p className="eyebrow">PLAN WITH ZEN · STEP 3 OF 4</p>
      <h2>Choose time that really fits.</h2>
      <p className="flow-copy">
        {d.taskType === "multi_day"
          ? "Choose held to save the goal without reserving any days, or place one daily session now. Add more days later with Schedule a day on Task Detail. "
          : ""}
        {d.durationMinutes} minutes needed. The server excludes sleep, occupied
        commitments, task sessions, flexible reservations and elapsed time
        today. Choose held if there is no room.
      </p>
      <div className="review-card">
        <PlacementForm
          value={p}
          onChange={setSelection}
          durationMinutes={d.durationMinutes || 30}
          deadlineDate={d.deadlineDate}
          multiDay={d.taskType === "multi_day"}
          goalStartDate={d.goalStartDate}
          goalEndDate={d.goalEndDate}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="flow-actions">
        <Link className="secondary" to={path("/planner/review")}>
          Back to review
        </Link>
        <button
          className="primary"
          disabled={busy || loading || c.status === "confirmed"}
          onClick={save}
        >
          {busy ? "Saving…" : "Review this placement"}
        </button>
      </div>
    </section>
  );
}
