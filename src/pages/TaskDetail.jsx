import { useEffect, useState, useRef } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api } from "../services/apiConfig";
import { formatInstant } from "../services/dates";
import AsyncButton from "../components/AsyncButton";
import CoachButton from "../components/CoachButton";
import TaskForm from "../components/TaskForm";
import NotesEditor from "../components/NotesEditor";
import PlacementForm from "../components/PlacementForm";
import SessionEditor from "../components/SessionEditor";
import { sessionPresentation } from "../services/dates";
export default function TaskDetail() {
  const [searchParams] = useSearchParams();
  const { taskId } = useParams(),
    { state, act, zone, conversationAction } = useApp(),
    navigate = useNavigate();
  const [task, setTask] = useState(null),
    [error, setError] = useState(""),
    [edit, setEdit] = useState(false),
    [placing, setPlacing] = useState(false),
    [placement, setPlacement] = useState({
      placementMode: "held",
      sessions: [],
    }),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [missing, setMissing] = useState(false),
    [sessionEditing, setSessionEditing] = useState(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    if (missing) return;
    let active = true;
    setTask((previous) => (previous?.id === taskId ? previous : null));
    const load = () => {
      const version = ++requestVersion.current;
      return api(`/tasks/${taskId}`)
        .then((t) => {
          if (active && version === requestVersion.current) {
            setTask(t);
            setError("");
          }
        })
        .catch((e) => {
          if (active && version === requestVersion.current) {
            if (e.status === 404) {
              setMissing(true);
              setTask(null);
              clearInterval(timer);
            } else setError(e.message);
          }
        });
    };
    const timer = setInterval(load, 4000);
    load();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [taskId, state.tasks, missing]);
  useEffect(() => {
    setMissing(false);
    setEdit(false);
    setPlacing(searchParams.get("placement") === "choose");
    setSessionEditing(null);
  }, [taskId, searchParams]);
  if (missing)
    return (
      <p role="status">
        Task not found. <Link to="/tasks">Back to tasks</Link>
      </p>
    );
  if (!task)
    return (
      <p className={error ? "error" : ""}>{error || "Loading saved task…"}</p>
    );
  const multiDay = task.taskType === "multi_day";
  const sessions = task.sessions || [],
    completedMinutes = sessions
      .filter((s) => s.status === "completed")
      .reduce(
        (n, s) => n + (+new Date(s.endAt) - +new Date(s.startAt)) / 60000,
        0,
      ),
    remaining = Math.max(0, task.durationMinutes - completedMinutes);
  const percent = task.durationMinutes
    ? Math.min(100, Math.round((completedMinutes / task.durationMinutes) * 100))
    : 0;
  return (
    <div className="detail-layout">
      <section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Link to="/tasks" className="back-link">
          ← Back to tasks
        </Link>
        <p className="eyebrow">
          {task.category} · {task.durationMinutes} MINUTES ·{" "}
          {task.placementMode} · {task.status}
        </p>
        <h2>{task.title}</h2>
        {multiDay && (
          <p>
            {task.goalStartDate} to {task.goalEndDate} · {task.durationMinutes}{" "}
            preferred minutes per daily session
          </p>
        )}
        <p className="detail-note">
          {task.motivation || "Give this task a clear, manageable finish line."}
        </p>
        <div className="detail-actions">
          <AsyncButton
            className="primary"
            onClick={() =>
              act(
                `/tasks/${task.id}/${task.status === "completed" ? "reopen" : "complete"}`,
                {},
              )
            }
          >
            {task.status === "completed"
              ? "Reopen as held"
              : multiDay
                ? "Complete goal"
                : "Complete task early"}
          </AsyncButton>
          <button className="secondary" onClick={() => setEdit(!edit)}>
            Edit details
          </button>
          <button
            className="secondary"
            disabled={task.status === "completed"}
            onClick={() => {
              if (!placing && multiDay)
                setPlacement({ placementMode: "scheduled", sessions: [] });
              setPlacing(!placing);
            }}
          >
            {multiDay ? "Schedule a day" : "Change placement"}
          </button>
        </div>
        <p className="hint">
          Completing the task early cancels unfinished sessions. Only sessions
          you complete count as completed planned effort.
        </p>
        {edit && (
          <TaskForm
            key={`details-${task.id}`}
            task={task}
            onSaved={() => setEdit(false)}
            onCancel={() => setEdit(false)}
          />
        )}
        {placing && (
          <section className="review-card">
            <h3>
              {multiDay
                ? "Schedule a day"
                : `Place remaining work · ${remaining} minutes`}
            </h3>
            <PlacementForm
              value={placement}
              onChange={setPlacement}
              durationMinutes={multiDay ? task.durationMinutes : remaining}
              taskId={task.id}
              deadlineDate={task.deadlineDate}
              multiDay={multiDay}
              goalStartDate={task.goalStartDate}
              goalEndDate={task.goalEndDate}
            />
            <AsyncButton
              className="primary"
              onClick={async () => {
                await act(`/tasks/${task.id}/placement`, placement);
                setPlacing(false);
              }}
            >
              Save placement
            </AsyncButton>
          </section>
        )}
        <section className="small-card">
          <p className="eyebrow">DATED SESSIONS · HISTORY</p>
          {sessions.length ? (
            sessions.map((s) => (
              <div className="session-item" key={s.id}>
                <div>
                  <strong>
                    {formatInstant(s.startAt, zone)} —{" "}
                    {formatInstant(s.endAt, zone)}
                  </strong>
                  <small>{sessionPresentation(s).label}</small>
                </div>
                {["pending", "missed"].includes(s.status) &&
                  !s.rescheduledToSessionId &&
                  !s.cancelReason &&
                  task.status !== "completed" && (
                    <button
                      className="secondary"
                      onClick={() => setSessionEditing(s)}
                    >
                      Reschedule session
                    </button>
                  )}
                {["pending", "missed"].includes(s.status) &&
                  !s.rescheduledToSessionId &&
                  !s.cancelReason &&
                  task.status !== "completed" && (
                    <AsyncButton
                      disabled={+new Date(s.startAt) > Date.now()}
                      onClick={() =>
                        act(`/schedule/sessions/${s.id}/complete`, {})
                      }
                    >
                      Complete session
                    </AsyncButton>
                  )}
              </div>
            ))
          ) : (
            <p>
              No dated sessions.{" "}
              {task.flexibleDate
                ? `Flexible on ${task.flexibleDate}.`
                : "This task is held until you assign it."}
            </p>
          )}
        </section>
        {sessionEditing && (
          <SessionEditor
            session={sessionEditing}
            onClose={() => setSessionEditing(null)}
          />
        )}
        <NotesEditor key={`notes-${task.id}`} taskId={task.id} />
        {task.sourceConversationId && (
          <AsyncButton
            onClick={async () => {
              await conversationAction("/planner/conversations", {
                taskId: task.id,
              });
              navigate(`/planner?conversation=${task.sourceConversationId}`);
            }}
          >
            Open saved planning chat
          </AsyncButton>
        )}
        <div className="flow-actions">
          <button
            className="text-link"
            onClick={() => setDeleteConfirm(!deleteConfirm)}
          >
            Delete task…
          </button>
          {deleteConfirm && (
            <>
              <p>
                Delete this task, sessions, notes and its conversation
                permanently?
              </p>
              <AsyncButton
                className="danger"
                onClick={async () => {
                  await act(`/tasks/${task.id}`, undefined, "DELETE");
                  navigate("/tasks");
                }}
              >
                Confirm deletion
              </AsyncButton>
            </>
          )}
        </div>
      </section>
      <aside>
        <article className="small-card">
          <p className="eyebrow">LATEST IMPORTANT CONTEXT</p>
          <p className="preserve-lines">
            {task.importantContext || "Preparing current context…"}
          </p>
          <p className="hint">
            {task.contextProcessingStatus === "failed"
              ? "AI unavailable: current-source template is ready. Retry when connected."
              : task.contextProcessingStatus === "pending"
                ? "Refreshing saved notes and progress…"
                : "Up to date"}{" "}
            · version {task.contextVersion}
          </p>
          <AsyncButton
            onClick={() => act(`/tasks/${task.id}/context/refresh`, {})}
          >
            Refresh context and message
          </AsyncButton>
        </article>
        <article className="small-card">
          <p className="eyebrow">PREPARED MOTIVATION</p>
          <p>
            {task.motivationalMessage ||
              "Preparing a message from your saved task."}
          </p>
          <small>{task.messageStatus || "pending"}</small>
          <CoachButton
            text={task.motivationalMessage}
            label="Preview reminder"
          />
          <p className="hint">
            Preview plays this saved text without consuming a reminder.
          </p>
        </article>
        <article className="progress-card">
          <p>Completed session effort</p>
          {!multiDay && (
            <div className="progress">
              <span style={{ width: `${percent}%` }} />
            </div>
          )}
          <strong>
            {multiDay
              ? `${sessions.filter((s) => s.status === "completed").length} sessions completed · ${completedMinutes} completed planned minutes`
              : `${completedMinutes} / ${task.durationMinutes} planned minutes`}
          </strong>
          {multiDay && (
            <p>
              Planned session effort, not actual tracked time. The goal stays
              active until you choose Complete goal.
            </p>
          )}
          <p>
            {task.status === "completed"
              ? "Task completed"
              : "Sessions and task completion are tracked separately."}
          </p>
        </article>
      </aside>
    </div>
  );
}
