import { useEffect, useState } from "react";
import CoachButton from "./CoachButton";
import { mockRequest } from "../services/apiConfig";

export default function NotificationPopup({ onClose }) {
  const [message, setMessage] = useState("A small start still counts today.");
  const [snoozed, setSnoozed] = useState(false);

  useEffect(() => {
    mockRequest("coachMessages/1", { text: "A small start still counts today." }).then((result) => setMessage(result.text));
  }, []);

  return (
    <aside className="notification-popup" role="status">
      <button className="close-popup" onClick={onClose} aria-label="Close notification">×</button>
      <p className="eyebrow">ZEN REMINDER · NOW</p>
      <h3>{snoozed ? "Reminder moved by 10 minutes" : "Finish competitor research"}</h3>
      <p>{snoozed ? "Zen will check in again shortly." : message}</p>
      {!snoozed && (
        <div className="popup-actions">
          <button className="primary" onClick={onClose}>Start task</button>
          <button className="secondary" onClick={() => setSnoozed(true)}>Snooze</button>
        </div>
      )}
      <CoachButton compact />
    </aside>
  );
}
