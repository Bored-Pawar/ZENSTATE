import { useState } from "react";
import { useApp } from "../context/AppContext";
import TaskRow from "../components/TaskRow";
export default function Tasks() {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const add = (e) => {
    e.preventDefault();
    if (!title) return;
    dispatch({
      type: "ADD_TASK",
      task: {
        id: crypto.randomUUID(),
        title,
        category: "Personal",
        due: "This week",
        duration: 30,
        done: false,
        note: "",
        priority: "Medium",
        scheduleType: "flexible",
        scheduledSlots: [],
        journalEnabled: false,
      },
    });
    setTitle("");
    setOpen(false);
  };
  return (
    <div>
      <section className="page-intro split">
        <div>
          <p className="eyebrow">COMMITTED, NOT CRAMMED</p>
          <h2>Tasks that serve your week.</h2>
          <p>
            {state.tasks.filter((t) => !t.done).length} tasks left. Each one has
            a place in the bigger picture.
          </p>
        </div>
        <button className="primary" onClick={() => setOpen(!open)}>
          Add task
        </button>
      </section>
      {open && (
        <form className="quick-add" onSubmit={add}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs your attention?"
          />
          <button className="primary">Add</button>
        </form>
      )}
      <section className="tasks-card">
        <p className="eyebrow task-group-title">SCHEDULED TASKS</p>
        <div className="task-table-head">
          <span>Task</span>
          <span>Priority</span>
          <span>Due</span>
        </div>
        {state.tasks.filter((task) => task.scheduleType === "scheduled").map((t) => (
          <TaskRow task={t} key={t.id} />
        ))}
        <p className="eyebrow task-group-title flexible-label">FLEXIBLE TASKS · SHOWING TODAY</p>
        {state.tasks.filter((task) => task.scheduleType !== "scheduled").map((t) => (
          <TaskRow task={{ ...t, due: "Today" }} key={t.id} />
        ))}
      </section>
    </div>
  );
}
