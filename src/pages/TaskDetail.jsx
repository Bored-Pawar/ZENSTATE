import { Link, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
export default function TaskDetail() {
  const { taskId } = useParams();
  const { state, dispatch } = useApp();
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return <p>Task not found.</p>;
  return (
    <div className="detail-layout">
      <section>
        <Link to="/tasks" className="back-link">
          ← Back to tasks
        </Link>
        <p className="eyebrow">
          {task.category} · {task.duration} MINUTES
        </p>
        <h2>{task.title}</h2>
        <p className="detail-note">
          Give this task a small, clear finish line. It does not need to be
          perfect to count.
        </p>
        <div className="detail-actions">
          <button
            className={`primary ${task.done ? "complete" : ""}`}
            onClick={() => dispatch({ type: "TOGGLE_TASK", id: task.id })}
          >
            {task.done ? "Completed ✓" : "Mark complete"}
          </button>
          <span className="priority medium">{task.priority} priority</span>
        </div>
        <article className="notes-editor">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TASK NOTES</p>
              <h3>What do you want to remember?</h3>
            </div>
            <span>Autosaved</span>
          </div>
          <textarea
            value={task.note}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_TASK",
                task: { ...task, note: e.target.value },
              })
            }
            placeholder="Write notes, ideas or a reflection after you finish..."
          />
        </article>
      </section>
      <aside>
        <article className="small-card">
          <p className="eyebrow">A SMALL START</p>
          <h3>Try ten minutes.</h3>
          <p>
            Open the first source or write the first three rough points.
            Momentum is easier after motion.
          </p>
        </article>
        <article className="progress-card">
          <p>Task progress</p>
          <div className="progress">
            <span style={{ width: task.done ? "100%" : "32%" }}></span>
          </div>
          <strong>{task.done ? "Complete" : "In progress"}</strong>
        </article>
      </aside>
    </div>
  );
}
