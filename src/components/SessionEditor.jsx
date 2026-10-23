import { useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import {
  inputFromUTC,
  localInputToUTC,
  formatInstant,
  sessionPresentation,
} from "../services/dates";

// Both the task page and calendar use this editor. Split always uses the saved
// interval; changing an unsaved move never changes the split boundaries.
export default function SessionEditor({ session, onClose }) {
  const { act, zone, state } = useApp();
  const duration =
    (+new Date(session.endAt) - +new Date(session.startAt)) / 60000;
  const [start, setStart] = useState(inputFromUTC(session.startAt, zone));
  const [point, setPoint] = useState(
    inputFromUTC(
      new Date(
        +new Date(session.startAt) + Math.floor(duration / 2) * 60000,
      ).toISOString(),
      zone,
    ),
  );
  const [mode, setMode] = useState("move"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  const retired =
    session.status === "cancelled" ||
    session.rescheduledToSessionId ||
    Boolean(session.cancelReason);
  const completed =
    session.status === "completed" ||
    state.tasks.find((t) => t.id === session.taskId)?.status === "completed";
  const movable = !retired && !completed;
  const splittable =
    movable &&
    session.status === "pending" &&
    +new Date(session.startAt) > Date.now() &&
    duration > 1;
  let end = "";
  try {
    end = inputFromUTC(
      new Date(
        +new Date(localInputToUTC(start, zone)) + duration * 60000,
      ).toISOString(),
      zone,
    );
  } catch {
    /* Keep incomplete input editable. */
  }
  const save = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (!movable)
        throw new Error(
          "This is saved history. Only unfinished active work can be rescheduled.",
        );
      if (mode === "split") {
        if (!splittable)
          throw new Error(
            "Split is available only before an unfinished session starts.",
          );
        const splitAt = localInputToUTC(point, zone),
          value = +new Date(splitAt);
        if (
          value <= +new Date(session.startAt) ||
          value >= +new Date(session.endAt)
        )
          throw new Error(
            "Choose a split point strictly inside the saved session.",
          );
        await act(`/schedule/blocks/${session.id}/split`, { splitAt });
      } else {
        if (!Number.isInteger(duration) || duration < 1)
          throw new Error("Invalid saved duration. Reload this session.");
        const startAt = localInputToUTC(start, zone);
        if (+new Date(startAt) <= Date.now())
          throw new Error("Choose a future start time.");
        await act(
          `/schedule/blocks/${session.id}`,
          {
            startAt,
            endAt: new Date(
              +new Date(startAt) + duration * 60000,
            ).toISOString(),
          },
          "PATCH",
        );
      }
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <form
        className="edit-modal"
        role="dialog"
        aria-label="Session placement"
        onSubmit={save}
      >
        <h3>{session.title}</h3>
        <p>
          {formatInstant(session.startAt, zone)} —{" "}
          {formatInstant(session.endAt, zone)}
        </p>
        <p>
          {duration} minutes · {sessionPresentation(session).label}
        </p>
        {movable ? (
          <>
            <div className="flow-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setMode("move");
                  setError("");
                }}
              >
                Reschedule
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy || !splittable}
                onClick={() => {
                  setMode("split");
                  setError("");
                }}
              >
                Split instead
              </button>
            </div>
            {mode === "move" ? (
              <>
                <label>
                  New start
                  <input
                    type="datetime-local"
                    required
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label>
                  New end (duration preserved)
                  <input type="datetime-local" readOnly value={end} />
                </label>
                <p className="hint">
                  The full {duration} saved minutes move. Elapsed time is not
                  completed effort. Started or missed occurrences remain as
                  rescheduled history.
                </p>
              </>
            ) : (
              <>
                <p className="hint">
                  Split the saved interval above. Unsaved move fields are
                  ignored.
                </p>
                <label>
                  Split saved session at
                  <input
                    type="datetime-local"
                    required
                    value={point}
                    onChange={(e) => setPoint(e.target.value)}
                  />
                </label>
              </>
            )}
            {!splittable && (
              <p className="hint">
                Started/missed sessions can be rescheduled, but not split or
                rewritten.
              </p>
            )}
          </>
        ) : (
          <p className="hint">
            This occurrence is retained calendar history. It cannot be moved or
            split.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {movable && +new Date(session.startAt) > Date.now() && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (submitting.current) return;
                submitting.current = true;
                setBusy(true);
                setError("");
                try {
                  await act(
                    `/schedule/blocks/${session.id}`,
                    undefined,
                    "DELETE",
                  );
                  onClose();
                } catch (e) {
                  setError(e.message);
                } finally {
                  submitting.current = false;
                  setBusy(false);
                }
              }}
            >
              Remove and hold remaining work
            </button>
          )}
          {movable && (
            <button className="primary" disabled={busy}>
              {busy
                ? "Saving…"
                : mode === "split"
                  ? "Save split"
                  : "Save reschedule"}
            </button>
          )}
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
