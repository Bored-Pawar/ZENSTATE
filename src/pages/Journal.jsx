import { useState } from "react";
import { useApp } from "../context/AppContext";
export default function Journal() {
  const { state, dispatch } = useApp();
  const [text, setText] = useState("");
  const [mood, setMood] = useState("Calm");
  const activeTaskJournals = state.tasks.filter((task) => task.journalEnabled && !task.done);
  const save = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({
      type: "ADD_JOURNAL",
      entry: { id: crypto.randomUUID(), date: "Today, just now", mood, text, type: "daily" },
    });
    setText("");
  };
  return (
    <div className="journal-layout">
      <section>
        <div className="page-intro">
          <p className="eyebrow">A QUIET PLACE TO NOTICE</p>
          <h2>Journal</h2>
          <p>
            Not everything needs to become a task. Keep the thoughts that might
            help future you.
          </p>
        </div>
        <form className="journal-write" onSubmit={save}>
          <div className="journal-controls">
            <select value={mood} onChange={(e) => setMood(e.target.value)}>
              <option>Calm</option>
              <option>Focused</option>
              <option>Tired</option>
              <option>Hopeful</option>
            </select>
            <span>Private to you</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="How are you arriving today?"
          />
          <button className="primary">Save entry</button>
        </form>
        <section className="task-journal-section">
          <p className="eyebrow">ACTIVE TASK JOURNALS</p>
          {activeTaskJournals.length ? activeTaskJournals.map((task) => (
            <article className="task-journal-card" key={task.id}>
              <div><strong>{task.title}</strong><small>Visible while this task is active</small></div>
              <button className="secondary" onClick={() => setText(`Reflection for ${task.title}: `)}>Write reflection</button>
            </article>
          )) : <p className="hint">No active task journals. You can enable one while planning with Zen.</p>}
        </section>
      </section>
      <aside className="journal-list">
        <p className="eyebrow">RECENT ENTRIES</p>
        {state.journal.map((entry) => (
          <article className="journal-entry" key={entry.id}>
            <div>
              <span className="mood-dot"></span>
              <strong>{entry.mood}</strong>
              <small>{entry.date}</small>
            </div>
            <p>{entry.text}</p>
          </article>
        ))}
      </aside>
    </div>
  );
}
