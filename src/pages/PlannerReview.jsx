import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function PlannerReview() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const draft = state.planningDraft || {};

  const change = (key, value) => dispatch({ type: "SET_PLAN_DRAFT", value: { [key]: value } });

  return (
    <section className="flow-page">
      <p className="eyebrow">PLAN WITH ZEN · STEP 2 OF 4</p>
      <h2>Review the task before it takes space in your week.</h2>
      <p className="flow-copy">Zen has turned your chat into one clear commitment. Edit anything that does not feel accurate.</p>
      <div className="review-card">
        <label>
          Task title
          <input value={draft.goal || ""} onChange={(event) => change("goal", event.target.value)} />
        </label>
        <label>
          Why it matters
          <textarea value={draft.why || ""} onChange={(event) => change("why", event.target.value)} />
        </label>
        <label>
          Total focused minutes
          <input type="number" min="15" step="15" value={draft.duration || 90} onChange={(event) => change("duration", Number(event.target.value))} />
        </label>
        <label className="toggle-line">
          <input type="checkbox" checked={Boolean(draft.journalEnabled)} onChange={(event) => change("journalEnabled", event.target.checked)} />
          <span>
            <strong>Create a task journal</strong>
            <small>Keep reflections with this task while it is active.</small>
          </span>
        </label>
      </div>
      <div className="flow-actions">
        <button className="secondary" onClick={() => navigate("/planner")}>Back to chat</button>
        <button className="primary" onClick={() => navigate("/planner/availability")}>Check my available time</button>
      </div>
    </section>
  );
}
