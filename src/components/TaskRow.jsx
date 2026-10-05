import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
export default function TaskRow({ task }) {
  const { dispatch } = useApp();
  return (
    <div className={`task-row ${task.done ? "done" : ""}`}>
      <button
        className="check"
        aria-label={`Mark ${task.title} complete`}
        onClick={() => dispatch({ type: "TOGGLE_TASK", id: task.id })}
      >
        {task.done ? "✓" : ""}
      </button>
      <div className="task-main">
        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
        <small>
          {task.category} · {task.duration} min
        </small>
      </div>
      <span className={`priority ${task.priority.toLowerCase()}`}>
        {task.priority}
      </span>
      <span className="task-due">{task.due}</span>
    </div>
  );
}
