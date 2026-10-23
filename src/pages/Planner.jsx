import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlanning } from "../services/usePlanning";
import { api } from "../services/apiConfig";
export default function Planner() {
  const {
      state,
      conversationAction,
      loadConversation,
      error,
      setError,
      loading,
      remember,
      path,
    } = usePlanning(),
    navigate = useNavigate();
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [older, setOlder] = useState([]),
    [cursor, setCursor] = useState(undefined);
  const conversation = state.conversation;
  useEffect(() => {
    setOlder([]);
    setCursor(undefined);
  }, [conversation?.id]);
  const olderCursor = cursor === undefined ? state.nextBefore : cursor;
  const loadOlder = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api(
        `/planner/conversations/${conversation.id}?before=${olderCursor}`,
      );
      setOlder((previous) => [...data.messages, ...previous]);
      setCursor(data.nextBefore);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await conversationAction("/planner/conversations", {});
      remember(d.conversation);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const send = async (e, retry) => {
    e?.preventDefault();
    if (busy) return;
    const content = retry?.content || text.trim();
    if (!content) return;
    setBusy(true);
    setError("");
    let id = conversation?.id;
    try {
      if (!id) {
        const d = await conversationAction("/planner/conversations", {});
        id = d.conversation.id;
        remember(d.conversation);
      }
      const failed = state.messages.findLast(
        (m) =>
          m.role === "user" &&
          m.content === content &&
          m.status !== "responded",
      );
      await conversationAction(`/planner/conversations/${id}/messages`, {
        content,
        clientMessageId:
          retry?.clientMessageId ||
          failed?.clientMessageId ||
          crypto.randomUUID(),
      });
      setText("");
    } catch (e) {
      setError(e.message);
      if (id) await loadConversation(id).catch(() => {});
    } finally {
      setBusy(false);
    }
  };
  const draft = state.planningTask || conversation?.draft || {},
    ready = Boolean(draft.goal && draft.motivation && draft.durationMinutes);
  return (
    <div className="planner-layout">
      <section className="coach-chat">
        <div className="chat-head">
          <div>
            <span className="zen-avatar">z</span>
            <strong>Zen, your planning guide</strong>
            <small>Chat → review → availability → confirmation</small>
          </div>
          <button
            className="text-link"
            disabled={busy || loading}
            onClick={start}
          >
            New plan
          </button>
        </div>
        <div className="messages">
          {olderCursor && (
            <button className="secondary" disabled={busy} onClick={loadOlder}>
              Load earlier messages
            </button>
          )}
          {!state.messages.length && (
            <div className="message">
              <span>ZEN</span>
              <p>
                What would you like to work on? Tell me the goal, why it
                matters, and the time you need. Include a deadline or
                preferences if you have them.
              </p>
            </div>
          )}
          {[...older, ...state.messages]
            .filter(
              (m, i, all) => all.findIndex((other) => other.id === m.id) === i,
            )
            .map((m) => (
              <div
                className={`message ${m.role === "user" ? "you" : "zen"}`}
                key={m.id}
              >
                <span>{m.role === "user" ? "YOU" : "ZEN"}</span>
                <p>{m.content}</p>
                {m.role === "user" && m.status === "failed" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => send(null, m)}
                  >
                    Retry saved message
                  </button>
                )}
              </div>
            ))}
          {busy && <p>Zen is preparing a reply…</p>}
          {loading && <p>Restoring saved conversation…</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        {conversation?.status === "confirmed" && (
          <div className="chat-input">
            <Link
              className="primary"
              to={`/tasks/${conversation.confirmedTaskId}`}
            >
              Open confirmed task
            </Link>
          </div>
        )}
        <form className="chat-input" onSubmit={send}>
          <input
            aria-label="Message to Zen"
            value={text}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              conversation?.status === "confirmed"
                ? "Reflect on this saved task…"
                : "What is on your mind?"
            }
          />
          <button
            className="primary"
            disabled={busy || loading || !text.trim()}
          >
            Send
          </button>
        </form>
      </section>
      <aside className="planner-side">
        <article className="small-card">
          <p className="eyebrow">
            {state.planningTask ? "CURRENT SAVED TASK" : "SAVED DRAFT"}
          </p>
          <h3>{draft.goal || "One new goal"}</h3>
          <p>{draft.motivation || "Your reason will guide the reminder."}</p>
          {state.planningTask && <p>{state.planningTask.importantContext}</p>}
          <p>
            {draft.durationMinutes
              ? `${draft.durationMinutes} minutes${draft.durationEstimated ? " (estimate — edit in review)" : ""}`
              : "Duration not yet supplied"}
          </p>
          <button
            className="primary"
            disabled={
              !conversation ||
              busy ||
              loading ||
              conversation.status === "confirmed"
            }
            onClick={() => navigate(path("/planner/review"))}
          >
            {ready ? "Review my plan" : "Fill missing details in review"}
          </button>
        </article>
        <article className="goal-card">
          <p className="eyebrow">PLANNING PRINCIPLE</p>
          <blockquote>
            “A plan should help you breathe, not prove you can do too much.”
          </blockquote>
          <Link className="secondary" to="/timetable">
            Review timetable
          </Link>
        </article>
        <article className="small-card">
          <p>
            Messages are saved before AI is called. No task is created until you
            explicitly confirm. AI availability errors can be retried; the
            editable review remains usable.
          </p>
        </article>
      </aside>
    </div>
  );
}
