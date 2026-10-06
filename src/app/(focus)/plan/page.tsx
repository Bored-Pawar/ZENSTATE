"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarBlank, Clock, Microphone, PencilSimple, Target } from "@phosphor-icons/react/dist/ssr";
import { CoachAvatar } from "@/components/Bits";
import { Avatar } from "@/components/Nav";

type Msg = { from: "coach" | "you"; text: string };

const opening: Msg[] = [
  { from: "coach", text: "You mentioned finishing the capstone. Before we put anything in the calendar, I'd love to understand — why does this one matter to you?" },
  { from: "you", text: "Honestly, I want to graduate in spring without dragging this into summer. In first year I told myself I'd actually ship something I'm proud of, and this is the thing." },
  { from: "coach", text: "Thank you for that — it's worth holding onto. I'll keep \"ship something you're proud of\" close by, for the weeks that get a little loud. When you're ready, roughly how many sections are left, and when is it due?" },
  { from: "you", text: "Five sections. Two are basically done. It's due the 4th." },
];

function Bubble({ m }: { m: Msg }) {
  const you = m.from === "you";
  return (
    <div className={`flex items-start gap-3 ${you ? "flex-row-reverse" : ""}`}>
      {you ? <Avatar /> : <CoachAvatar />}
      <div
        className={`max-w-[520px] px-4 py-3 text-sm leading-[1.55] ${you ? "rounded-[14px_4px_14px_14px] bg-accent-ink text-white" : "rounded-[4px_14px_14px_14px] border border-line bg-white text-[#2a2d38]"}`}
      >
        {m.text}
      </div>
    </div>
  );
}

export default function PlanChat() {
  const [extra, setExtra] = useState<Msg[]>([]);
  const [captured, setCaptured] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  // The coach "thinks" for a moment, then summarises what it heard.
  useEffect(() => {
    const t = setTimeout(() => setCaptured(true), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [captured, extra]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setExtra((x) => [...x, { from: "you", text: draft.trim() }]);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center">
      <header className="flex h-16 w-full flex-none items-center gap-3 border-b border-line bg-white px-4 sm:px-7">
        <CoachAvatar size={32} />
        <div>
          <div className="text-[15px] font-semibold">Planning coach</div>
          <div className="text-xs text-muted">{captured ? "Here's what I heard" : "Getting to know what you're taking on"}</div>
        </div>
        {!captured && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
            <span className="h-[7px] w-[7px] rounded-full bg-[#7bb28a]" />
            Listening
          </span>
        )}
      </header>

      <div className="flex w-full max-w-[760px] flex-1 flex-col gap-[18px] px-4 py-7 sm:px-6">
        {(captured ? opening.slice(-1) : opening).map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {!captured && (
          <div className="flex items-center gap-3" aria-label="Coach is typing">
            <CoachAvatar />
            <div className="flex gap-1.5 rounded-[4px_14px_14px_14px] border border-line bg-white px-[18px] py-3.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-[7px] w-[7px] animate-pulse rounded-full bg-[#c3bbe8]" style={{ animationDelay: `${d * 200}ms` }} />
              ))}
            </div>
          </div>
        )}
        {captured && (
          <>
            <Bubble m={{ from: "coach", text: "Here's what I've gathered. Have a look whenever you're ready, and then we can see how it sits against the hours you have this week." }} />
            <section className="w-full max-w-[560px] self-start overflow-hidden rounded-[14px] border border-edge bg-white shadow-card sm:ml-[42px] sm:w-[calc(100%-42px)]">
              <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
                <Target size={18} weight="fill" className="text-accent-ink" />
                <span className="eyebrow">Goal captured</span>
                <PencilSimple size={15} className="ml-auto text-faint" />
              </div>
              <div className="flex flex-col gap-[18px] p-5">
                <div>
                  <div className="mb-1 text-xs text-muted">Goal</div>
                  <div className="text-[21px] font-semibold tracking-tight">Finish the capstone project</div>
                </div>
                <div className="rounded-r-lg border-l-[3px] border-accent bg-tint-2 px-4 py-3">
                  <div className="mb-[5px] text-[11px] uppercase tracking-[0.06em] text-muted">In your words</div>
                  <div className="text-sm italic leading-[1.55] text-[#3a3550]">&quot;I want to graduate in spring without dragging this into summer — and finally ship something I&apos;m proud of.&quot;</div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1 rounded-[10px] border border-line bg-field px-4 py-3.5">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                      <Clock size={14} /> Estimated work
                    </div>
                    <div className="text-xl font-semibold">14 hours</div>
                    <div className="text-[11px] text-muted">3 sections remaining</div>
                  </div>
                  <div className="flex-1 rounded-[10px] border border-line bg-field px-4 py-3.5">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
                      <CalendarBlank size={14} /> Deadline
                    </div>
                    <div className="text-xl font-semibold">Tue 4 Sep</div>
                    <div className="text-[11px] text-muted">3 weeks from now</div>
                  </div>
                </div>
                <Link href="/plan/fit?needed=14" className="btn btn-primary w-full py-3">
                  See how it fits my week <ArrowRight size={15} />
                </Link>
              </div>
            </section>
          </>
        )}
        {extra.map((m, i) => (
          <Bubble key={`x${i}`} m={m} />
        ))}
        <div ref={end} />
      </div>

      <form onSubmit={send} className="sticky bottom-14 w-full max-w-[760px] flex-none bg-bg px-4 pb-6 pt-2 sm:px-6 lg:bottom-0">
        <div className="flex items-center gap-3 rounded-[14px] border border-line bg-white py-2 pl-[18px] pr-2 shadow-card">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={captured ? "Anything I missed? Add it here." : "Type, or hold the mic to talk — whichever feels easier"}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <button
            type="button"
            aria-label={listening ? "Stop listening" : "Talk instead"}
            aria-pressed={listening}
            onClick={() => setListening((l) => !l)}
            className={`flex flex-none items-center justify-center border ${captured ? "h-10 w-10 rounded-lg border-line bg-field text-nav" : `h-11 w-11 rounded-full border-none ${listening ? "bg-accent-ink" : "bg-accent"} text-white`}`}
          >
            <Microphone size={captured ? 19 : 20} weight={captured ? "regular" : "fill"} />
          </button>
        </div>
        {!captured && <div className="mt-2 text-center text-[11px] text-faint">Talking or typing both work. Nothing is scheduled until you&apos;ve seen it laid out.</div>}
      </form>
    </div>
  );
}
