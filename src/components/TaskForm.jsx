import { useState } from "react";
import { useApp } from "../context/AppContext";
import PlacementForm from "./PlacementForm";
export default function TaskForm({ task, onSaved, onCancel }) {
  const { act } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [fields, setFields] = useState({
    title: task?.title || "",
    goal: task?.goal || "",
    motivation: task?.motivation || "",
    durationMinutes: task?.durationMinutes || 30,
    priority: task?.priority || "medium",
    category: task?.category || "Personal",
    deadlineDate: task?.deadlineDate || "",
    journalEnabled: task?.journalEnabled ?? true,
    planningPreferences: task?.planningPreferences || "",
  });
  const [placement, setPlacement] = useState({
    placementMode: "held",
    flexibleDate: null,
    sessions: [],
  });
  const field = (key, value) => setFields({ ...fields, [key]: value });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...fields,
        deadlineDate: fields.deadlineDate || null,
        ...(!task ? placement : {}),
      };
      const saved = await act(
        task ? `/tasks/${task.id}` : "/tasks",
        body,
        task ? "PATCH" : "POST",
      );
      if (saved) onSaved?.(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="review-card task-form" onSubmit={save}>
      <label>
        Task title
        <input
          required
          maxLength={160}
          value={fields.title}
          onChange={(e) => field("title", e.target.value)}
        />
      </label>
      <label>
        Why it matters
        <textarea
          maxLength={2000}
          value={fields.motivation}
          onChange={(e) => field("motivation", e.target.value)}
        />
      </label>
      <div className="form-columns">
        <label>
          Planned minutes
          <input
            type="number"
            min="1"
            max="10080"
            step="1"
            required
            value={fields.durationMinutes}
            onChange={(e) => field("durationMinutes", Number(e.target.value))}
          />
        </label>
        <label>
          Priority
          <select
            value={fields.priority}
            onChange={(e) => field("priority", e.target.value)}
          >
            {["low", "medium", "high"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Category
        <input
          maxLength={80}
          value={fields.category}
          onChange={(e) => field("category", e.target.value)}
        />
      </label>
      <label>
        Deadline (optional, end of local day)
        <input
          type="date"
          value={fields.deadlineDate}
          onChange={(e) => field("deadlineDate", e.target.value)}
        />
      </label>
      <label>
        Planning preferences
        <textarea
          maxLength={2000}
          value={fields.planningPreferences}
          onChange={(e) => field("planningPreferences", e.target.value)}
        />
      </label>
      <label className="toggle-line">
        <input
          type="checkbox"
          checked={fields.journalEnabled}
          onChange={(e) => field("journalEnabled", e.target.checked)}
        />
        Enable task journal
      </label>
      {!task && (
        <PlacementForm
          value={placement}
          onChange={setPlacement}
          durationMinutes={fields.durationMinutes}
          deadlineDate={fields.deadlineDate}
        />
      )}
      <p className="hint">
        {task
          ? "Hold the task before changing duration. Placement changes have their own form below."
          : "Title-only tasks use a default 30 minutes and stay held until assigned."}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="flow-actions">
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save task"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
