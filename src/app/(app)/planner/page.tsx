"use client";

import Link from "next/link";
import { useState } from "react";
import { CoachAvatar } from "@/components/Bits";
import { PageHeader } from "@/components/Frame";
import { useApp } from "@/lib/store";

const prompts = [
  "What is one goal that would make this week feel meaningful?",
  "Why does this goal matter to you right now?",
  "How much focused time do you think it needs?",
];
const closing = "That is a thoughtful plan. I found two open blocks in your timetable. Shall I add a first task?";

export default function Planner() {
  const { state, dispatch } = useApp();
  const [messages, setMessages] = useState([{ role: "coach", text: prompts[0] }]);
  const [text, setText] = useState("");
  const [step, setStep] = useState(0);
  const focusHours = state.blocks.filter((b) => b.kind === "focus").reduce((n, b) => n + b.end - b.start, 0);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { role: "you", text: t }, { role: "coach", text: step < 2 ? prompts[step + 1] : closing }]);
    if (step === 2)
      dispatch({ type: "addTask", task: { id: crypto.randomUUID(), title: "Make progress on my weekly goal", goal: "Planned with your coach", hours: 1.5, scheduled: "Tomorrow", done: false, note: t } });
    setStep((s) => s + 1);
    setText("");
  };

  return (
    <>
      <PageHeader eyebrow="Plan" title="Plan with your coach" />
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-7 lg:flex-row">
        <section className="card flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-line p-4">
            <CoachAvatar size={32} />
            <div className="flex-1">
              <div className="text-[15px] font-semibold">Your planning guide</div>
              <div className="text-xs text-muted">Uses your timetable to keep plans realistic</div>
            </div>
            <span className="text-xs text-muted">Available</span>
          </div>
          <div className="flex min-h-[280px] flex-1 flex-col gap-3 p-4">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[520px] rounded-xl px-4 py-3 text-sm leading-[1.55] ${m.role === "you" ? "self-end bg-accent-ink text-white" : "self-start border border-line bg-white text-[#2a2d38]"}`}>
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write what is on your mind..." />
            <button className="btn btn-primary">Send</button>
          </form>
        </section>
        <aside className="flex flex-none flex-col gap-5 lg:w-[320px]">
          <article className="card p-5">
            <div className="eyebrow mb-2">This week</div>
            <h2 className="mb-1 text-lg font-semibold">{focusHours} focused hours visible</h2>
            <p className="text-[13px] leading-normal text-ink-3">Only the blocks you marked as focus are used. Nothing is quietly squeezed into your week.</p>
          </article>
          <article className="card p-5">
            <div className="eyebrow mb-2">Planning principle</div>
            <blockquote className="mb-3 text-sm italic leading-normal text-[#3a3550]">“A plan should help you breathe, not prove you can do too much.”</blockquote>
            <Link href="/timetable" className="btn btn-secondary">
              Review timetable
            </Link>
          </article>
        </aside>
      </main>
    </>
  );
}
