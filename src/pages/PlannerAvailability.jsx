import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { mockRequest } from "../services/apiConfig";

const suggestions = [
  { day: "Tue", start: 17, end: 18.5, label: "Tuesday · 5:00 PM–6:30 PM" },
  { day: "Thu", start: 17, end: 18.5, label: "Thursday · 5:00 PM–6:30 PM" },
];

export default function PlannerAvailability() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Analysing timetable availability…");
  const [selected, setSelected] = useState(0);
  const draft = state.planningDraft || {};

  useEffect(() => {
    mockRequest("availability/1", { message: "Two realistic evening windows found." }).then((result) => setStatus(`${result.message} (${result.source})`));
  }, []);

  const useScheduled = () => {
    dispatch({ type: "SET_PLAN_DRAFT", value: { scheduleType: "scheduled", selectedSlots: [suggestions[selected]] } });
    navigate("/planner/confirmation");
  };
  const useFlexible = () => {
    dispatch({ type: "SET_PLAN_DRAFT", value: { scheduleType: "flexible", selectedSlots: [] } });
    navigate("/planner/confirmation");
  };

  return (
    <section className="flow-page">
      <p className="eyebrow">PLAN WITH ZEN · STEP 3 OF 4</p>
      <h2>There is room for this without using your sleep.</h2>
      <p className="flow-copy">{status} This plan needs {draft.duration || 90} minutes. Choose a fixed slot or reserve flexible time for it.</p>
      <div className="availability-grid">
        <article className="availability-card">
          <p className="eyebrow">SCHEDULED TASK</p>
          <h3>Place it in a real time slot</h3>
          {suggestions.map((slot, index) => (
            <label className="slot-option" key={slot.label}>
              <input type="radio" checked={selected === index} onChange={() => setSelected(index)} />
              <span>{slot.label}</span>
            </label>
          ))}
          <button className="primary" onClick={useScheduled}>Use selected slot</button>
        </article>
        <article className="availability-card flexible-card">
          <p className="eyebrow">FLEXIBLE TASK</p>
          <h3>Reserve the time, decide the exact moment later</h3>
          <p>{draft.duration || 90} minutes will appear in Flexible Reserved Time and show as “Today” in Tasks.</p>
          <button className="secondary" onClick={useFlexible}>Keep it flexible</button>
        </article>
      </div>
      <button className="text-link" onClick={() => navigate("/timetable")}>Open the full timetable first</button>
    </section>
  );
}
