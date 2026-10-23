import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/apiConfig";
import {
  weekStart,
  addDays,
  DateTime,
  clock,
  minutes,
  calendarSegments,
  sessionPresentation,
} from "../services/dates";
import AsyncButton from "../components/AsyncButton";
import SessionEditor from "../components/SessionEditor";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const blank = {
  title: "",
  kind: "fixed",
  weekday: 1,
  daysPreset: "selected",
  days: [1],
  startMinute: 540,
  endMinute: 600,
  endsNextDay: false,
};
export default function Timetable({ setup = false }) {
  const { state, act, zone, saveUser } = useApp(),
    navigate = useNavigate();
  const [week, setWeek] = useState(() => weekStart(zone)),
    [blocks, setBlocks] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(null),
    [editing, setEditing] = useState(null),
    [scope, setScope] = useState("one"),
    [split, setSplit] = useState(""),
    [zoneText, setZoneText] = useState(zone),
    [sessionEditing, setSessionEditing] = useState(null);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  useEffect(() => {
    let active = true;
    setLoaded(false);
    api(`/schedule?weekStart=${week}`)
      .then((b) => {
        if (active) {
          setBlocks(b);
          setLoaded(true);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [week, state.blocks]);
  const close = () => {
    setForm(null);
    setEditing(null);
    setSplit("");
    setError("");
  };
  const edit = (b) => {
    if (b.recordType === "session") {
      setSessionEditing(b);
      return;
    }
    setEditing(b);
    setScope("one");
    setSplit("");
    setError("");
    setForm({ ...blank, ...b });
  };
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const recurringBody = () => ({
    ...Object.fromEntries(Object.keys(blank).map((k) => [k, form[k]])),
    endMinute: minutes(form.endText ?? clock(form.endMinute)),
  });
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      await act(
        editing ? `/schedule/blocks/${editing.id}` : "/schedule/blocks",
        { ...recurringBody(), ...(editing ? { scope } : {}) },
        editing ? "PATCH" : "POST",
      );
    });
  };
  const splitBlock = () =>
    run(() =>
      act(`/schedule/blocks/${editing.id}/split`, {
        splitMinute: minutes(split),
        scope,
      }),
    );
  const flex = state.tasks.filter(
    (t) =>
      t.placementMode === "flexible" &&
      t.status !== "completed" &&
      dates.includes(t.flexibleDate),
  );
  return (
    <div>
      <section className="page-intro split">
        <div>
          <p className="eyebrow">
            {setup
              ? "WELCOME · BUILD YOUR WEEK"
              : "YOUR ACTUAL WEEK · 24 HOURS"}
          </p>
          <h2>
            {setup
              ? "Start with sleep and commitments."
              : "Protect the hours you really have."}
          </h2>
          <p>
            Recurring blocks repeat weekly. Task sessions belong to a real date.
            All occupied blocks reduce availability.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            close();
            setForm({
              ...blank,
              title: setup ? "Sleep" : "",
              kind: setup ? "sleep" : "fixed",
              daysPreset: setup ? "whole" : "selected",
              startMinute: setup ? 1380 : 540,
              endMinute: setup ? 420 : 600,
              endsNextDay: setup,
            });
          }}
        >
          Add {setup ? "sleep / commitment" : "a block"}
        </button>
      </section>
      <div className="toolbar">
        <span>Timezone: {zone}</span>
        <input
          aria-label="IANA timezone"
          value={zoneText}
          onChange={(e) => setZoneText(e.target.value)}
        />
        <AsyncButton onClick={() => saveUser({ timezone: zoneText })}>
          Save timezone
        </AsyncButton>
      </div>
      {setup && (
        <article className="small-card">
          <p>
            Your saved blocks remain here if you leave setup. Add sleep for all
            seven start weekdays; use Whole week for a quick start, then edit
            individual days.
          </p>
          <AsyncButton
            className="primary"
            onClick={async () => {
              await saveUser({}, true);
              navigate("/today");
            }}
          >
            Finish setup
          </AsyncButton>
        </article>
      )}
      <div className="toolbar">
        <button
          className="secondary"
          onClick={() => setWeek(addDays(week, -7))}
        >
          ← Previous week
        </button>
        <strong>
          {week} — {addDays(week, 6)}
        </strong>
        <button className="secondary" onClick={() => setWeek(addDays(week, 7))}>
          Next week →
        </button>
      </div>
      <section className="flexible-time-card">
        <div>
          <p className="eyebrow">FLEXIBLE RESERVED TIME · THIS WEEK</p>
          <h3>
            {flex.reduce(
              (n, t) =>
                n +
                Math.max(
                  0,
                  t.durationMinutes - (t.completedPlannedMinutes || 0),
                ),
              0,
            )}{" "}
            minutes
          </h3>
        </div>
        <p>
          {flex.length
            ? flex.map((t) => `${t.title} · ${t.flexibleDate}`).join(" | ")
            : "No flexible reservations for these dates."}
        </p>
      </section>
      {error && !form && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!loaded && <p>Loading timetable…</p>}
      <p className="calendar-legend">
        <span className="legend-completed">Green: completed session</span> ?{" "}
        <span className="legend-unfinished">Red: unfinished session</span> ?{" "}
        <span>Grey: cancelled / rescheduled history</span>. Sleep and recurring
        commitments keep their own styles.
      </p>
      <div className="calendar-scroll">
        <section className="calendar-card full-day-calendar">
          <div className="calendar-head">
            <span>Time</span>
            {dates.map((date, i) => (
              <strong key={date}>
                {days[i]}
                <small>{DateTime.fromISO(date).toFormat("d LLL")}</small>
              </strong>
            ))}
          </div>
          <div className="calendar-body">
            <div className="hour-labels">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h}>{clock(h * 60)}</span>
              ))}
            </div>
            {dates.map((date) => (
              <div className="day-column" key={date}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div className="hour-line" key={h} />
                ))}
                {calendarSegments(blocks, date, zone).map((b, i) => (
                  <button
                    key={`${b.id}-${i}`}
                    className={`time-block ${b.kind} ${b.status || ""} ${b.recordType === "session" ? sessionPresentation(b).tone : ""}`}
                    aria-label={`${b.title}: ${b.recordType === "session" ? sessionPresentation(b).label : b.kind}`}
                    title={`${b.title}: ${b.recordType === "session" ? sessionPresentation(b).label : b.kind}`}
                    style={{
                      top: `${b.displayStart / 2}px`,
                      height: `${Math.max((b.displayEnd - b.displayStart) / 2 - 2, 12)}px`,
                    }}
                    onClick={() => edit(b)}
                  >
                    <strong>{b.title}</strong>
                    <small>
                      {clock(b.displayStart)}–{clock(b.displayEnd)}
                      {b.recordType === "session"
                        ? ` · ${sessionPresentation(b).label}`
                        : ""}
                    </small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
      <p className="hint">
        Click saved sleep or any block to edit it. Overnight blocks continue
        into the next day. Session deletion offers to hold remaining work.
      </p>
      {sessionEditing && (
        <SessionEditor
          session={sessionEditing}
          onClose={() => setSessionEditing(null)}
        />
      )}
      {form && (
        <div className="modal-backdrop">
          <form className="edit-modal" onSubmit={save}>
            <p className="eyebrow">
              {editing ? "EDIT SAVED BLOCK" : "ADD RECURRING BLOCK"}
            </p>
            <h3>{editing?.title || "Make room in your week"}</h3>

            <>
              <label>
                Title
                <input
                  required
                  maxLength={160}
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
                  <option value="sleep">Sleep</option>
                  <option value="fixed">Commitment</option>
                  <option value="focus">Focus (occupied)</option>
                </select>
              </label>
              {!editing && (
                <label>
                  Days
                  <select
                    value={form.daysPreset}
                    onChange={(e) =>
                      setForm({ ...form, daysPreset: e.target.value })
                    }
                  >
                    <option value="selected">Selected day</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekends">Weekends</option>
                    <option value="whole">Whole week</option>
                    <option value="custom">Custom days</option>
                  </select>
                </label>
              )}
              {(form.daysPreset === "selected" || editing) && (
                <label>
                  Start weekday
                  <select
                    disabled={Boolean(editing && scope === "group")}
                    value={form.weekday}
                    onChange={(e) =>
                      setForm({ ...form, weekday: Number(e.target.value) })
                    }
                  >
                    {days.map((d, i) => (
                      <option key={d} value={i + 1}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!editing && form.daysPreset === "custom" && (
                <div className="day-choices">
                  {days.map((d, i) => (
                    <label key={d}>
                      <input
                        type="checkbox"
                        checked={form.days.includes(i + 1)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            days: e.target.checked
                              ? [...form.days, i + 1]
                              : form.days.filter((x) => x !== i + 1),
                          })
                        }
                      />
                      {d}
                    </label>
                  ))}
                </div>
              )}
              <label>
                From (HH:mm)
                <input
                  required
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                  value={clock(form.startMinute)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, startMinute: minutes(v) });
                  }}
                  type="time"
                />
              </label>
              <label>
                To (24:00 means end of day)
                <input
                  required
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00"
                  value={form.endText ?? clock(form.endMinute)}
                  onChange={(e) =>
                    setForm({ ...form, endText: e.target.value })
                  }
                />
              </label>
              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={form.endsNextDay}
                  onChange={(e) =>
                    setForm({ ...form, endsNextDay: e.target.checked })
                  }
                />
                Ends next day
              </label>
              {editing && (
                <label>
                  Apply to
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="one">This day</option>
                    <option value="group">Entire group</option>
                  </select>
                </label>
              )}
            </>
            {editing && (
              <label>
                Split at ( HH:mm, inside the saved block)
                <input
                  type="time"
                  value={split}
                  onChange={(e) => setSplit(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save block"}
              </button>
              {editing && (
                <>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || !split}
                    onClick={splitBlock}
                  >
                    Split
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        act(
                          `/schedule/blocks/${editing.id}?scope=${scope}`,
                          undefined,
                          "DELETE",
                        ),
                      )
                    }
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
