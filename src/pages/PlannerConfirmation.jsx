import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { mockRequest } from "../services/apiConfig";

export default function PlannerConfirmation() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const draft = state.planningDraft || {};
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const slots = draft.selectedSlots || [];

  const confirm = async () => {
    setSaving(true);
    setMessage("Creating the task and updating the timetable…");
    const response = await mockRequest("plannedTasks/1", { message: "Task saved" });
    const id = crypto.randomUUID();
    const task = {
      id,
      title: draft.goal || "My planned task",
      category: "Planned with Zen",
      due: draft.scheduleType === "flexible" ? "Today" : slots[0]?.day || "This week",
      duration: Number(draft.duration) || 90,
      done: false,
      note: draft.why || "",
      priority: "High",
      scheduleType: draft.scheduleType || "flexible",
      scheduledSlots: slots,
      journalEnabled: Boolean(draft.journalEnabled),
    };
    const blocks = slots.map((slot) => ({ ...slot, id: crypto.randomUUID(), title: task.title, kind: "task", taskId: id }));
    dispatch({ type: "ADD_TASK_AND_BLOCKS", task, blocks });
    setMessage(`${response.message} through ${response.source}. Your plan is now visible across ZenState.`);
    setSaving(false);
  };

  return (
    <section className="flow-page">
      <p className="eyebrow">PLAN WITH ZEN · STEP 4 OF 4</p>
      <h2>Your plan is ready to become real.</h2>
      <article className="confirmation-card">
        <div><span>Task</span><strong>{draft.goal}</strong></div>
        <div><span>Focused time</span><strong>{draft.duration || 90} minutes</strong></div>
        <div><span>Placement</span><strong>{draft.scheduleType === "flexible" ? "Flexible Reserved Time" : slots[0]?.label || "Scheduled time"}</strong></div>
        <div><span>Task journal</span><strong>{draft.journalEnabled ? "Enabled" : "Not needed"}</strong></div>
      </article>
      {message && <p className="endpoint-result">{message}</p>}
      <div className="flow-actions">
        <button className="secondary" onClick={() => navigate("/planner/availability")}>Change placement</button>
        <button className="primary" disabled={saving || Boolean(message)} onClick={confirm}>{saving ? "Saving…" : "Add plan to ZenState"}</button>
        {message && <button className="primary" onClick={() => navigate("/timetable")}>View in timetable</button>}
      </div>
    </section>
  );
}
