import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import CoachButton from "./CoachButton";
import AsyncButton from "./AsyncButton";
export default function NotificationPopup({ reminder, onClose }) {
  const { act, state } = useApp(),
    navigate = useNavigate();
  return (
    <aside
      className="notification-popup"
      role="dialog"
      aria-label="Task reminder"
    >
      <button
        className="close-popup"
        onClick={onClose}
        aria-label="Close reminder"
      >
        ×
      </button>
      <p className="eyebrow">ZEN REMINDER · NOW</p>
      <h3>{reminder.title}</h3>
      <p>{reminder.message}</p>
      <div className="popup-actions">
        <button
          className="primary"
          onClick={() => {
            onClose();
            navigate(`/tasks/${reminder.taskId}`);
          }}
        >
          Open task
        </button>
        <AsyncButton
          onClick={async () => {
            await act(`/reminders/${reminder.id}/snooze`, {});
            onClose();
          }}
        >
          Snooze 10 min
        </AsyncButton>
      </div>
      <CoachButton
        text={reminder.message}
        autoPlay={state.user.voiceRemindersEnabled}
        compact
      />
    </aside>
  );
}
