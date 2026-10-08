import { useMemo, useState } from "react";
import { days } from "../data/demoData";
import { useApp } from "../context/AppContext";

const hours = Array.from({ length: 24 }, (_, index) => index);
const blank = { day: "Mon", start: 17, end: 18, title: "", kind: "focus" };
const time = (hour) => `${String(Math.floor(hour)).padStart(2, "0")}:${hour % 1 ? "30" : "00"}`;

export default function Timetable() {
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const flexibleMinutes = useMemo(
    () => state.tasks.filter((task) => task.scheduleType === "flexible" && !task.done).reduce((total, task) => total + task.duration, 0),
    [state.tasks],
  );

  const saveNew = (event) => {
    event.preventDefault();
    if (!form.title || Number(form.end) <= Number(form.start)) return;
    dispatch({ type: "ADD_BLOCK", block: { ...form, id: crypto.randomUUID(), start: Number(form.start), end: Number(form.end) } });
    setForm(blank);
    setShowAdd(false);
  };
  const saveEdit = (event) => {
    event.preventDefault();
    dispatch({ type: "UPDATE_BLOCK", block: { ...editing, start: Number(editing.start), end: Number(editing.end) } });
    setEditing(null);
  };
  const splitBlock = () => {
    const middle = Math.round(((Number(editing.start) + Number(editing.end)) / 2) * 2) / 2;
    if (middle <= editing.start || middle >= editing.end) return;
    dispatch({ type: "DELETE_BLOCK", id: editing.id });
    dispatch({ type: "ADD_BLOCK", block: { ...editing, id: crypto.randomUUID(), title: `${editing.title} · part 1`, end: middle } });
    dispatch({ type: "ADD_BLOCK", block: { ...editing, id: crypto.randomUUID(), title: `${editing.title} · part 2`, start: middle } });
    setEditing(null);
  };

  return (
    <div>
      <section className="page-intro split">
        <div>
          <p className="eyebrow">YOUR ACTUAL WEEK · 24 HOURS</p>
          <h2>Protect the hours you really have.</h2>
          <p>Sleep and commitments are unavailable. Focus blocks and planned tasks can be moved whenever life changes.</p>
        </div>
        <button className="primary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Close" : "Add a block"}</button>
      </section>

      <section className="flexible-time-card">
        <div><p className="eyebrow">FLEXIBLE RESERVED TIME</p><h3>{Math.floor(flexibleMinutes / 60)}h {flexibleMinutes % 60}m reserved</h3></div>
        <p>Flexible tasks do not occupy a fixed timetable slot. They appear as “Today” until you decide when to complete them.</p>
      </section>

      {showAdd && (
        <form className="inline-form" onSubmit={saveNew}>
          <label>Day<select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>{days.map((day) => <option key={day}>{day}</option>)}</select></label>
          <label>From<input type="number" min="0" max="23.5" step="0.5" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label>
          <label>To<input type="number" min="0.5" max="24" step="0.5" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label>
          <label>What is this?<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Type<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="fixed">Fixed</option><option value="focus">Focus</option></select></label>
          <button className="primary">Save block</button>
        </form>
      )}

      <section className="calendar-card full-day-calendar">
        <div className="calendar-head"><span>Time</span>{days.map((day) => <strong key={day}>{day}</strong>)}</div>
        <div className="calendar-body">
          <div className="hour-labels">{hours.map((hour) => <span key={hour}>{time(hour)}</span>)}</div>
          {days.map((day) => (
            <div className="day-column" key={day}>
              {hours.map((hour) => <div className="hour-line" key={hour}></div>)}
              <div className="sleep-block" style={{ top: 0, height: `${7 * 30}px` }}>Sleep · 12 AM–7 AM</div>
              <div className="sleep-block" style={{ top: `${22 * 30}px`, height: `${2 * 30}px` }}>Sleep · 10 PM–12 AM</div>
              {state.blocks.filter((block) => block.day === day).map((block) => (
                <button key={block.id} className={`time-block ${block.kind}`} onClick={() => setEditing(block)} style={{ top: `${block.start * 30}px`, height: `${Math.max((block.end - block.start) * 30 - 4, 28)}px` }}>
                  <strong>{block.title}</strong><small>{time(block.start)} – {time(block.end)}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>
      <p className="hint">Click any non-sleep block to edit, move, split, convert it to flexible time, or delete it.</p>

      {editing && (
        <div className="modal-backdrop"><form className="edit-modal" onSubmit={saveEdit}>
          <p className="eyebrow">EDIT TIMETABLE BLOCK</p><h3>{editing.title}</h3>
          <label>Day<select value={editing.day} onChange={(event) => setEditing({ ...editing, day: event.target.value })}>{days.map((day) => <option key={day}>{day}</option>)}</select></label>
          <label>From<input type="number" min="0" max="23.5" step="0.5" value={editing.start} onChange={(event) => setEditing({ ...editing, start: event.target.value })} /></label>
          <label>To<input type="number" min="0.5" max="24" step="0.5" value={editing.end} onChange={(event) => setEditing({ ...editing, end: event.target.value })} /></label>
          <div className="modal-actions"><button type="button" className="secondary" onClick={splitBlock}>Split in two</button><button type="button" className="danger" onClick={() => { dispatch({ type: "DELETE_BLOCK", id: editing.id }); setEditing(null); }}>Delete</button><button className="primary">Save changes</button></div>
          <button type="button" className="text-link modal-close" onClick={() => setEditing(null)}>Cancel</button>
        </form></div>
      )}
    </div>
  );
}
