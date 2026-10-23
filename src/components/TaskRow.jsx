import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { dateLabel } from "../services/dates";
import AsyncButton from "./AsyncButton";
export default function TaskRow({ task }) {
  const { act, zone } = useApp(),
    done = task.status === "completed";
  return (
    <div className={`task-row ${done ? "done" : ""}`}>
      <AsyncButton
        className="check"
        aria-label={`${done ? "Reopen" : "Complete"} ${task.title}`}
        onClick={() =>
          act(`/tasks/${task.id}/${done ? "reopen" : "complete"}`, {})
        }
      >
        {done ? "✓" : "○"}
      </AsyncButton>
      <div className="task-main">
        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
        <small>
          {task.category} · {task.durationMinutes} min · {task.placementMode}
        </small>
      </div>
      <span className={`priority ${task.priority}`}>{task.priority}</span>
      <span className="task-due">
        {dateLabel(task.flexibleDate || task.deadlineDate, zone)}
      </span>
    </div>
  );
}
