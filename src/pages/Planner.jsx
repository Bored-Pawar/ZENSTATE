import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { mockRequest } from "../services/apiConfig";

const prompts = [
  "What is one goal that would make this week feel meaningful?",
  "Why does this goal matter to you right now?",
  "How much focused time will it need? You can write a number of minutes.",
];

export default function Planner() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{ role: "zen", text: prompts[0] }]);
  const [text, setText] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [apiState, setApiState] = useState("Ready to simulate a planner endpoint");

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || loading) return;
    const answer = text.trim();
    const nextStep = step + 1;
    setText("");
    setLoading(true);
    setApiState("Calling planner chat endpoint…");
    setMessages((current) => [...current, { role: "you", text: answer }]);

    const reply = await mockRequest("plannerReplies/1", {
      text:
        step < 2
          ? prompts[nextStep]
          : "Great. I have captured the goal, your reason, and the time needed. Let’s review it before checking your timetable.",
    });

    if (step === 0) dispatch({ type: "SET_PLAN_DRAFT", value: { goal: answer } });
    if (step === 1) dispatch({ type: "SET_PLAN_DRAFT", value: { why: answer } });
    if (step === 2) {
      const parsedDuration = Number(answer.match(/\d+/)?.[0]);
      dispatch({
        type: "SET_PLAN_DRAFT",
        value: { duration: parsedDuration || state.planningDraft?.duration || 90 },
      });
    }

    setMessages((current) => [...current, { role: "zen", text: reply.text }]);
    setApiState(`Planner reply received from ${reply.source}`);
    setLoading(false);
    setStep(nextStep);
  };

  return (
    <div className="planner-layout">
      <section className="coach-chat">
        <div className="chat-head">
          <div>
            <span className="zen-avatar">z</span>
            <strong>Zen, your planning guide</strong>
            <small>Goal → reason → time → availability</small>
          </div>
          <span className="status">Demo ready</span>
        </div>
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <span>{message.role === "zen" ? "ZEN" : "YOU"}</span>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        {step < 3 ? (
          <form className="chat-input" onSubmit={send}>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write what is on your mind..."
            />
            <button className="primary" disabled={loading}>
              {loading ? "Thinking…" : "Send"}
            </button>
          </form>
        ) : (
          <div className="chat-input">
            <button className="primary" onClick={() => navigate("/planner/review")}>
              Review my plan
            </button>
          </div>
        )}
      </section>
      <aside className="planner-side">
        <article className="small-card">
          <p className="eyebrow">DEMO ENDPOINT</p>
          <h3>{apiState}</h3>
          <p>Set a MockAPI URL later; until then, the same prepared JSON response is used locally.</p>
        </article>
        <article className="goal-card">
          <p className="eyebrow">PLANNING PRINCIPLE</p>
          <blockquote>“A plan should help you breathe, not prove you can do too much.”</blockquote>
          <button className="secondary" onClick={() => navigate("/timetable")}>
            Review timetable
          </button>
        </article>
      </aside>
    </div>
  );
}
