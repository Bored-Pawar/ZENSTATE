import { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import PlacementForm from "./PlacementForm";
export default function TaskForm({ task, onSaved, onCancel }) {
  const { act } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  const [fields, setFields] = useState({
    title: task?.title || "",
    goal: task?.goal || "",
    motivation: task?.motivation || "",
    durationMinutes: task?.durationMinutes || 30,
    taskType: task?.taskType || "one_off",
    goalStartDate: task?.goalStartDate || "",
    goalEndDate: task?.goalEndDate || "",
    priority: task?.priority || "medium",
    category: task?.category || "Personal",
    deadlineDate: task?.deadlineDate || "",
    journalEnabled: task?.journalEnabled ?? true,
    planningPreferences: task?.planningPreferences || "",
  });
  const [placement, setPlacement] = useState({
    placementMode: "",
    flexibleDate: null,
    sessions: [],
  });
  const field = (key, value) => setFields({ ...fields, [key]: value });
  const save = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (!task && !placement.placementMode)
        throw new Error(
          "Choose Fixed, Flexible, or Schedule later before saving.",
        );
      const body = {
        ...fields,
        deadlineDate: fields.deadlineDate || null,
        goalStartDate: fields.goalStartDate || null,
        goalEndDate: fields.goalEndDate || null,
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
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <form className="review-card task-form" onSubmit={save}>
      <label>
        Task type
        <select
          value={fields.taskType}
          disabled={Boolean(task)}
          onChange={(e) => {
            field("taskType", e.target.value);
            setPlacement({ placementMode: "", sessions: [] });
          }}
        >
          <option value="one_off">One-off task</option>
          <option value="multi_day">Multi-day goal</option>
        </select>
      </label>
      {fields.taskType === "multi_day" && (
        <div className="form-columns">
          <label>
            Goal start date
            <input
              type="date"
              required
              value={fields.goalStartDate}
              onChange={(e) => field("goalStartDate", e.target.value)}
            />
          </label>
          <label>
            Goal end date
            <input
              type="date"
              required
              min={fields.goalStartDate}
              value={fields.goalEndDate}
              onChange={(e) => field("goalEndDate", e.target.value)}
            />
          </label>
        </div>
      )}
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
          {fields.taskType === "multi_day"
            ? "Preferred daily session minutes"
            : "Planned minutes"}
          <input
            disabled={Boolean(
              task &&
                task.taskType !== "multi_day" &&
                task.placementMode !== "held",
            )}
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
          requireChoice
          onChange={setPlacement}
          durationMinutes={fields.durationMinutes}
          deadlineDate={fields.deadlineDate}
          multiDay={fields.taskType === "multi_day"}
          goalStartDate={fields.goalStartDate}
          goalEndDate={fields.goalEndDate}
        />
      )}
      <p className="hint">
        {fields.taskType === "multi_day"
          ? "The period and preferred session minutes are separate. Save held to schedule days later; unplaced days reserve no time."
          : task
            ? "Hold the task before changing duration. Placement changes have their own form below."
            : "Choose Fixed for a date and time, Flexible for a day, or Schedule later to leave this task held. A deadline does not schedule the task."}
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
