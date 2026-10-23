import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import NotesEditor from "../components/NotesEditor";
export default function Journal() {
  const { state } = useApp(),
    active = state.tasks.filter(
      (t) => t.journalEnabled && t.status !== "completed",
    );
  return (
    <div className="journal-layout">
      <section>
        <div className="page-intro">
          <p className="eyebrow">A QUIET PLACE TO NOTICE</p>
          <h2>Journal</h2>
          <p>
            Daily entries stay separate from task motivation. Open a task
            journal to save a reflection linked to that task.
          </p>
        </div>
        <NotesEditor />
      </section>
      <aside className="task-journal-section">
        <p className="eyebrow">ACTIVE TASK JOURNALS</p>
        {active.length ? (
          active.map((t) => (
            <article className="task-journal-card" key={t.id}>
              <div>
                <strong>{t.title}</strong>
                <small>Reflections are linked by task ID</small>
              </div>
              <Link className="text-link" to={`/tasks/${t.id}`}>
                Write reflection
              </Link>
            </article>
          ))
        ) : (
          <p className="hint">No active task journals.</p>
        )}
      </aside>
    </div>
  );
}
