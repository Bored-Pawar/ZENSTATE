"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, HandHeart, Info, MinusCircle, CalendarPlus, Scales, Scissors, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Bar } from "./Bits";

const choices = [
  { id: "extend", Icon: CalendarPlus, title: "Extend the deadline", body: "Move the due date out by about a week. The scope stays whole, and the pressure eases." },
  { id: "cut", Icon: Scissors, title: "Cut the scope", body: (gap: number) => `Set aside one of the five sections, or ship a lighter version. Around ${gap} hours comes off.` },
  { id: "free", Icon: MinusCircle, title: "Free up a commitment", body: "Reclaim hours you've already spoken for — for instance, pausing the gym for three weeks." },
  { id: "overrun", Icon: HandHeart, warn: true, title: "Accept and overrun", body: (gap: number) => `Keep everything, knowing you'll likely work over — about ${gap} hours from somewhere. Eyes open.` },
] as const;

const Shell = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
  <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-9">
    <div className={`w-full ${wide ? "max-w-[760px]" : "max-w-[680px]"}`}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted">Seeing how it sits in your week</div>
      {children}
    </div>
  </main>
);

export function Feasibility({ needed, available }: { needed: number; available: number }) {
  const [picked, setPicked] = useState<string | null>(null);
  const gap = needed - available;
  const spare = available - needed;
  const kind = gap > 0 ? "over" : spare < 2 ? "tight" : "fits";

  if (kind === "over") {
    const pct = (available / needed) * 100;
    return (
      <Shell wide>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:px-8 sm:py-[30px]">
          <h1 className="mb-1.5 text-2xl font-semibold tracking-tight">There&apos;s more here than the week can hold</h1>
          <p className="mb-5 max-w-[640px] text-[15px] leading-[1.6] text-ink-2">
            As it stands, the plan asks for about <strong className="text-ink">{needed} hours</strong>, and you have <strong className="text-ink">{available}</strong> before Tuesday 4 September — a gap of about{" "}
            <strong className="text-warn-deep">{gap} hours</strong>. That&apos;s just what the numbers show, not a mark against you, and it&apos;s a kinder thing to see now than to feel later. The hours can&apos;t stretch, so this is a
            moment to choose what matters most. There&apos;s no wrong answer, and no rush.
          </p>
          <div className="mb-2 flex justify-between gap-3 text-[13px]">
            <span className="text-ink-3">{needed}h the plan asks for</span>
            <span className="text-warn-deep">about {gap}h the week can&apos;t hold</span>
          </div>
          <Bar h={20} className="mb-2" segs={[{ pct, color: "#9184d9" }, { pct: 100 - pct, color: "#e6c98a" }]} />
          <div className="relative mb-6 h-4">
            <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap border-l border-dashed border-[#b6bac8] pl-1.5 text-[11px] text-muted" style={{ left: `${pct}%` }}>
              your {available} usable hours reach to here
            </div>
          </div>
          <fieldset className="mb-[22px] grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">How would you like to proceed</legend>
            {choices.map((c) => {
              const on = picked === c.id;
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 ${on ? "border-accent bg-tint-2" : "border-line hover:border-edge"}`}
                >
                  <input type="radio" name="choice" className="sr-only" checked={on} onChange={() => setPicked(c.id)} />
                  <span className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] ${on ? "border-accent bg-accent" : "border-[#c3c7d5]"}`}>
                    {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="mb-[3px] flex items-center gap-2 text-[15px] font-semibold">
                      <c.Icon size={17} className={"warn" in c ? "text-warn" : "text-accent-ink"} />
                      {c.title}
                    </span>
                    <span className="text-[13px] leading-normal text-ink-3">{typeof c.body === "function" ? c.body(gap) : c.body}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-[18px]">
            <span className="min-w-[200px] flex-1 text-xs leading-normal text-muted">Nothing is chosen for you, and there&apos;s no auto-fix. Whichever you choose, you can come back and change it later.</span>
            {picked ? (
              <Link href="/plan/review" className="btn btn-primary px-[22px] py-3">
                Continue <ArrowRight size={15} />
              </Link>
            ) : (
              <button className="btn btn-primary px-[22px] py-3" disabled>
                Continue <ArrowRight size={15} />
              </button>
            )}
          </div>
        </section>
      </Shell>
    );
  }

  const tight = kind === "tight";
  return (
    <Shell>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full ${tight ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok-ink"}`}>
            {tight ? <Scales size={14} weight="fill" /> : <Check size={15} weight="bold" />}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{tight ? "It fits, with little to spare" : "There's room for this"}</h1>
        </div>
        <p className="mb-[26px] max-w-[560px] text-[15px] leading-[1.6] text-ink-2">
          {tight ? (
            <>
              Everything you&apos;ve listed comes to about <strong className="text-ink">{needed} hours</strong>, and you have <strong className="text-ink">{available}</strong>. It does fit — though with {spare === 1 ? "an hour" : `${spare} hours`} of margin, the week would
              need to go mostly as planned. That&apos;s worth knowing now, while it&apos;s easy to lighten if you&apos;d like to.
            </>
          ) : (
            <>
              Finishing the capstone asks for about <strong className="text-ink">{needed} hours</strong>, and you have <strong className="text-ink">{available}</strong> before Tuesday 4 September. It settles into the week with a little space left around it.
            </>
          )}
        </p>
        <div className="mb-2.5 flex justify-between text-[13px]">
          <span className="text-ink-3">{needed}h of focused work</span>
          <span className="text-muted">{available}h available</span>
        </div>
        <Bar
          h={20}
          className="mb-3"
          segs={[{ pct: (needed / available) * 100, color: "#9184d9" }, { pct: (spare / available) * 100, color: tight ? "#e6c98a" : "", striped: !tight }]}
        />
        <div className={`mb-7 flex items-center gap-2 text-[13px] ${tight ? "text-warn-deep" : "text-ink-3"}`}>
          {tight ? <Info size={16} /> : <ShieldCheck size={16} className="text-accent-ink" />}
          {tight ? `${spare === 1 ? "One hour" : `${spare} hours`} of margin. Nothing to worry about — just something to hold lightly.` : `${spare} hours of breathing room, so a quieter day won't put it at risk.`}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/plan/review" className="btn btn-primary px-5 py-3">
            Review the plan <ArrowRight size={15} />
          </Link>
          <Link href="/plan" className="btn btn-secondary px-5 py-3">
            {tight ? "Lighten it for more room" : "Adjust the goal"}
          </Link>
        </div>
      </section>
    </Shell>
  );
}
