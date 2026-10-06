import { useState } from "react";
import { days } from "../data/demoData";
import { useApp } from "../context/AppContext";
export default function Timetable() {
  const { state, dispatch } = useApp();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    day: "Mon",
    start: 17,
    end: 18,
    title: "",
    kind: "focus",
  });
  const add = (e) => {
    e.preventDefault();
    if (!form.title) return;
    dispatch({
      type: "ADD_BLOCK",
      block: {
        ...form,
        id: crypto.randomUUID(),
        start: +form.start,
        end: +form.end,
      },
    });
    setShow(false);
    setForm({ day: "Mon", start: 17, end: 18, title: "", kind: "focus" });
  };
  return (
    <div>
      <section className="page-intro split">
        <div>
          <p className="eyebrow">YOUR ACTUAL WEEK</p>
          <h2>Protect the hours you really have.</h2>
          <p>
            Add fixed commitments first, then mark the spaces you can use for
            yourself. You can edit this whenever life changes.
          </p>
        </div>
        <button className="primary" onClick={() => setShow(!show)}>
          {show ? "Close" : "Add a block"}
        </button>
      </section>
      {show && (
        <form className="inline-form" onSubmit={add}>
          <label>
            Day
            <select
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
            >
              {days.map((d) => (
                <option>{d}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="number"
              min="6"
              max="22"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="number"
              min="7"
              max="23"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </label>
          <label>
            What is this?
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Type
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              <option value="fixed">Fixed</option>
              <option value="focus">Focus</option>
            </select>
          </label>
          <button className="primary">Save block</button>
        </form>
      )}
      <section className="calendar-card">
        <div className="calendar-head">
          <span>Time</span>
          {days.map((d) => (
            <strong key={d}>{d}</strong>
          ))}
        </div>
        <div className="calendar-body">
          <div className="hour-labels">
            {[8, 10, 12, 14, 16, 18, 20].map((h) => (
              <span key={h}>{String(h).padStart(2, "0")}:00</span>
            ))}
          </div>
          {days.map((day) => (
            <div className="day-column" key={day}>
              {[8, 10, 12, 14, 16, 18, 20].map((h) => (
                <div className="hour-line" key={h}></div>
              ))}
              {state.blocks
                .filter((b) => b.day === day)
                .map((b) => (
                  <button
                    onClick={() => dispatch({ type: "DELETE_BLOCK", id: b.id })}
                    title="Click to remove"
                    className={`time-block ${b.kind}`}
                    key={b.id}
                    style={{
                      top: `${(b.start - 8) * 34}px`,
                      height: `${Math.max((b.end - b.start) * 34 - 5, 28)}px`,
                    }}
                  >
                    <strong>{b.title}</strong>
                    <small>
                      {b.start}:00 - {b.end}:00
                    </small>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </section>
      <p className="hint">Tip: click any block to remove it in this demo.</p>
    </div>
  );
}
