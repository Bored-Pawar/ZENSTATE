import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import TaskRow from "../components/TaskRow";
import TaskForm from "../components/TaskForm";
export default function Tasks() {
  const { state, today } = useApp(),
    [open, setOpen] = useState(false),
    [date, setDate] = useState(""),
    navigate = useNavigate();
  const tasks = state.tasks.filter(
    (t) =>
      !date ||
      t.flexibleDate === date ||
      t.sessionDates?.includes(date) ||
      t.deadlineDate === date,
  );
  return (
    <div>
      <section className="page-intro split">
        <div>
          <p className="eyebrow">COMMITTED, NOT CRAMMED</p>
          <h2>Tasks that serve your week.</h2>
          <p>
            {state.tasks.filter((t) => t.status !== "completed").length} active
            tasks. Every task has a saved placement or a place on your held
            list.
          </p>
        </div>
        <button className="primary" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Add task"}
        </button>
      </section>
      {open && (
        <TaskForm
          onSaved={(task) => navigate(`/tasks/${task.id}`)}
          onCancel={() => setOpen(false)}
        />
      )}
      <div className="toolbar">
        <label>
          Filter date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button className="secondary" onClick={() => setDate(today)}>
          Today
        </button>
        <button className="text-link" onClick={() => setDate("")}>
          All dates
        </button>
      </div>
      <section className="tasks-card">
        {["scheduled", "flexible", "held", "completed"].map((mode) => {
          const group = tasks.filter((t) =>
            mode === "completed"
              ? t.status === "completed"
              : t.status !== "completed" && t.placementMode === mode,
          );
          return (
            <section key={mode}>
              <p className="eyebrow task-group-title">
                {mode === "flexible"
                  ? "FLEXIBLE · ACTUAL ASSIGNED DATES"
                  : mode.toUpperCase()}
              </p>
              {group.length ? (
                group.map((t) => <TaskRow task={t} key={t.id} />)
              ) : (
                <p className="hint">
                  No {mode} tasks{date ? " for this date" : ""}.
                </p>
              )}
            </section>
          );
        })}
      </section>
    </div>
  );
}
