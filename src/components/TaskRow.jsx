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
        aria-label={`${done ? "Reopen" : task.taskType === "multi_day" ? "Complete goal" : "Complete"} ${task.title}`}
        onClick={() =>
          act(`/tasks/${task.id}/${done ? "reopen" : "complete"}`, {})
        }
      >
        {done ? "✓" : "○"}
      </AsyncButton>
      <div className="task-main">
        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
        <small>
          {task.category} · {task.durationMinutes} min
          {task.taskType === "multi_day" ? " per session" : ""} ·{" "}
          {task.placementMode}
        </small>
        {!done && task.placementMode === "held" && (
          <Link to={`/tasks/${task.id}?placement=choose`}>
            Choose placement
          </Link>
        )}
      </div>
      <span className={`priority ${task.priority}`}>{task.priority}</span>
      <span className="task-due">
        {task.placementMode === "held"
          ? "Not scheduled"
          : task.placementMode === "flexible"
            ? dateLabel(task.flexibleDate, zone)
            : task.sessionDates?.length
              ? dateLabel(task.sessionDates[0], zone)
              : "No session data"}
      </span>
    </div>
  );
}
