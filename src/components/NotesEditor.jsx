import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { api } from "../services/apiConfig";
import { formatInstant } from "../services/dates";
export default function NotesEditor({ taskId = null, onSaved }) {
  const { act, zone } = useApp(),
    [notes, setNotes] = useState([]),
    [text, setText] = useState(""),
    [mood, setMood] = useState("Calm"),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const active = useRef(true);
  const load = () =>
    api(`/notes${taskId ? `?taskId=${taskId}` : ""}`).then((n) => {
      if (active.current) setNotes(n);
    });
  useEffect(() => {
    active.current = true;
    load().catch((e) => {
      if (active.current) setError(e.message);
    });
    return () => {
      active.current = false;
    };
  }, [taskId]);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await act(
        editing ? `/notes/${editing}` : "/notes",
        { text, mood, ...(!editing ? { taskId } : {}) },
        editing ? "PATCH" : "POST",
      );
      if (!active.current) return;
      await load();
      setText("");
      setEditing(null);
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    setBusy(true);
    setError("");
    try {
      await act(`/notes/${id}`, undefined, "DELETE");
      await load();
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="notes-editor">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{taskId ? "TASK NOTES" : "DAILY JOURNAL"}</p>
          <h3>What do you want to remember?</h3>
        </div>
        <span>
          {busy
            ? "Saving…"
            : saved
              ? "Saved"
              : "Unsaved text stays here until you save"}
        </span>
      </div>
      <form onSubmit={save}>
        <label>
          Mood
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            {["Calm", "Focused", "Tired", "Hopeful"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <textarea
          required
          maxLength={12000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          placeholder="Write a note or reflection…"
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="flow-actions">
          <button className="primary" disabled={busy || !text.trim()}>
            {editing ? "Save changes" : "Save note"}
          </button>
          {editing && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditing(null);
                setText("");
                setSaved(false);
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <div className="journal-list">
        {notes.length ? (
          notes.map((n) => (
            <article className="journal-entry" key={n.id}>
              <small>
                {formatInstant(n.createdAt, zone)} · {n.mood}
              </small>
              <p className="preserve-lines">{n.text}</p>
              <div className="flow-actions">
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => {
                    setEditing(n.id);
                    setText(n.text);
                    setMood(n.mood || "Calm");
                    setSaved(false);
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => remove(n.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="hint">No saved entries yet.</p>
        )}
      </div>
    </article>
  );
}
