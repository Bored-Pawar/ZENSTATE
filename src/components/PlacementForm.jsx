import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../services/apiConfig";
import {
  formatInstant,
  localInputToUTC,
  inputFromUTC,
} from "../services/dates";
export default function PlacementForm({
  value,
  onChange,
  durationMinutes,
  taskId,
  deadlineDate,
}) {
  const { today, zone } = useApp(),
    [date, setDate] = useState(value.flexibleDate || today),
    [availability, setAvailability] = useState(null),
    [error, setError] = useState(""),
    [part, setPart] = useState(durationMinutes),
    [manual, setManual] = useState("");
  const sessions = value.sessions || [];
  const selectedMinutes = sessions.reduce(
    (n, s) => n + (+new Date(s.endAt) - +new Date(s.startAt)) / 60000,
    0,
  );
  useEffect(() => {
    setPart(Math.max(1, durationMinutes - selectedMinutes));
  }, [durationMinutes, selectedMinutes]);
  useEffect(() => {
    let active = true;
    setAvailability(null);
    setError("");
    if (!date || !part) return;
    api(
      `/availability?from=${date}&to=${date}&durationMinutes=${part}${taskId ? `&taskId=${taskId}` : ""}`,
    )
      .then((a) => {
        if (active) setAvailability(a[0]);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [date, part, taskId]);
  const setMode = (mode) =>
    onChange({
      ...value,
      placementMode: mode,
      flexibleDate: mode === "flexible" ? date : null,
      flexibleReminderAt: null,
      sessions: mode === "scheduled" ? sessions : [],
    });
  const add = (slot) => onChange({ ...value, sessions: [...sessions, slot] });
  return (
    <div className="placement-form">
      <label>
        Placement
        <select
          value={value.placementMode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="held">Held — choose a date later</option>
          <option value="scheduled">Scheduled — dated sessions</option>
          <option value="flexible">Flexible — reserve one day</option>
        </select>
      </label>
      {value.placementMode !== "held" && (
        <>
          <label>
            Local date
            <input
              type="date"
              min={today}
              max={deadlineDate || undefined}
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (value.placementMode === "flexible")
                  onChange({
                    ...value,
                    flexibleDate: e.target.value,
                    flexibleReminderAt: null,
                  });
              }}
            />
          </label>
          {availability ? (
            <p className="hint">
              {availability.freeMinutes} free minutes ·{" "}
              {availability.reservedMinutes} already reserved ·{" "}
              {availability.remainingMinutes} minutes remaining
              {taskId ? " (excluding this task’s current placement)" : ""}
            </p>
          ) : (
            <p className="hint">Checking saved availability…</p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
      {value.placementMode === "flexible" && (
        <label>
          Optional reminder (local time)
          <input
            type="datetime-local"
            value={
              value.flexibleReminderAt
                ? inputFromUTC(value.flexibleReminderAt, zone)
                : ""
            }
            onChange={(e) => {
              try {
                onChange({
                  ...value,
                  flexibleReminderAt: e.target.value
                    ? localInputToUTC(e.target.value, zone)
                    : null,
                });
                setError("");
              } catch (e) {
                setError(e.message);
              }
            }}
          />
          <small>
            Without a reminder time, this task supports manual playback only.
          </small>
        </label>
      )}
      {value.placementMode === "scheduled" && (
        <>
          <p>
            {selectedMinutes} / {durationMinutes} minutes selected. Sessions
            must total the exact remaining effort.
          </p>
          {sessions.map((s, i) => (
            <div className="session-item" key={`${s.startAt}-${i}`}>
              <span>
                {formatInstant(s.startAt, zone)} —{" "}
                {formatInstant(s.endAt, zone)}
              </span>
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  onChange({
                    ...value,
                    sessions: sessions.filter((_, index) => index !== i),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          {selectedMinutes < durationMinutes && (
            <>
              <label>
                Minutes in next session
                <input
                  type="number"
                  min="1"
                  max={durationMinutes - selectedMinutes}
                  step="1"
                  value={part}
                  onChange={(e) => setPart(Number(e.target.value))}
                />
              </label>
              <div className="slot-list">
                {availability?.suggestions
                  .filter(
                    (s) =>
                      !sessions.some(
                        (p) => p.startAt < s.endAt && s.startAt < p.endAt,
                      ),
                  )
                  .map((s) => (
                    <button
                      type="button"
                      className="secondary"
                      key={s.startAt}
                      onClick={() => add(s)}
                    >
                      {formatInstant(s.startAt, zone)} · {part} min
                    </button>
                  ))}
              </div>
              {availability && !availability.suggestions.length && (
                <p>
                  No fixed slot fits this duration on this date. Try a shorter
                  session, another date, flexible time if capacity permits, or
                  held.
                </p>
              )}
              <label>
                Or choose an exact local start
                <input
                  type="datetime-local"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
              </label>
              <button
                className="secondary"
                type="button"
                disabled={!manual || !part}
                onClick={() => {
                  try {
                    const startAt = localInputToUTC(manual, zone);
                    add({
                      startAt,
                      endAt: new Date(
                        +new Date(startAt) + part * 60000,
                      ).toISOString(),
                    });
                    setManual("");
                    setError("");
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Add exact session
              </button>
              <p className="hint">
                Final confirmation checks conflicts, deadlines and daily
                capacity again.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
