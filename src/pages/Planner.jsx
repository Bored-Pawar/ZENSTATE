import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
const prompts = [
  "What is one goal that would make this week feel meaningful?",
  "Why does this goal matter to you right now?",
  "How much focused time do you think it needs?",
];
export default function Planner() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{ role: "zen", text: prompts[0] }]);
  const [text, setText] = useState("");
  const [step, setStep] = useState(0);
  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "you", text },
      ...(step < 2
        ? [{ role: "zen", text: prompts[step + 1] }]
        : [
            {
              role: "zen",
              text: "That is a thoughtful plan. I found two open blocks in your timetable. Shall I add a first task?",
            },
          ]),
    ]);
    if (step === 2)
      setTimeout(
        () =>
          dispatch({
            type: "ADD_TASK",
            task: {
              id: crypto.randomUUID(),
              title: "Make progress on my weekly goal",
              category: "Planned with Zen",
              due: "Tomorrow",
              duration: 90,
              done: false,
              note: text,
              priority: "High",
            },
          }),
        150,
      );
    setStep((s) => s + 1);
    setText("");
  };
  return (
    <div className="planner-layout">
      <section className="coach-chat">
        <div className="chat-head">
          <div>
            <span className="zen-avatar">z</span>
            <strong>Zen, your planning guide</strong>
            <small>Uses your timetable to keep plans realistic</small>
          </div>
          <span className="status">Available</span>
        </div>
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <span>{m.role === "zen" ? "ZEN" : "YOU"}</span>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
        <form className="chat-input" onSubmit={send}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write what is on your mind..."
          />
          <button className="primary">Send</button>
        </form>
      </section>
      <aside className="planner-side">
        <article className="small-card">
          <p className="eyebrow">THIS WEEK</p>
          <h3>
            {state.blocks
              .filter((b) => b.kind === "focus")
              .reduce((a, b) => a + b.end - b.start, 0)}{" "}
            focused hours visible
          </h3>
          <p>
            Zen uses only the blocks you marked available. Nothing is quietly
            squeezed into your week.
          </p>
        </article>
        <article className="goal-card">
          <p className="eyebrow">PLANNING PRINCIPLE</p>
          <blockquote>
            “A plan should help you breathe, not prove you can do too much.”
          </blockquote>
          <button className="secondary" onClick={() => navigate("/timetable")}>
            Review timetable
          </button>
        </article>
      </aside>
    </div>
  );
}
