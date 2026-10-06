"use client";

import { Circle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/Frame";
import { CoachButton } from "@/components/CoachButton";
import { useApp } from "@/lib/store";

const week = [42, 68, 55, 83, 60, 35, 72];

export default function DisciplineReport() {
  const { state } = useApp();
  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.done).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const open = state.tasks.filter((t) => !t.done);

  return (
    <>
      <PageHeader eyebrow="Your week in review" title="Discipline report" />
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-7">
        <section className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-edge bg-tint-2 p-6">
          <div className="max-w-xl">
            <h2 className="mb-2 text-2xl font-semibold tracking-tight">Progress is a pattern, not a verdict.</h2>
            <p className="mb-4 text-[15px] leading-[1.6] text-ink-2">
              You showed up for {done} of {total} planned tasks. The aim is honesty, then a kinder adjustment.
            </p>
            <CoachButton />
          </div>
          <div className="text-center">
            <strong className="block text-5xl font-semibold tracking-tight text-accent-ink">{percent}%</strong>
            <span className="text-xs text-muted">completion rhythm</span>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card p-5 lg:col-span-2">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="eyebrow">Consistency</div>
                <h3 className="text-[17px] font-semibold">Your focus over seven days</h3>
              </div>
              <span className="text-xs text-muted">Completed</span>
            </div>
            <div className="flex h-44 items-end gap-3" role="img" aria-label="Focus by day, Monday to Sunday">
              {week.map((v, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="w-full rounded-t-md bg-accent" style={{ height: `${v}%` }} />
                  <small className="text-[11px] text-muted">{"MTWTFSS"[i]}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="card flex flex-col gap-3 p-5">
            <div className="eyebrow">Coach message</div>
            <h3 className="text-[17px] font-semibold leading-snug">“You lost momentum on Thursday, not your ability to finish.”</h3>
            <p className="text-[13px] leading-normal text-ink-3">The pattern suggests your plan becomes too tight after busy days. Next week, leave one evening intentionally empty.</p>
            <CoachButton compact />
          </section>
        </div>

        <section className="card p-5">
          <div className="eyebrow mb-1">Needs a new place</div>
          <h3 className="mb-3 text-[17px] font-semibold">
            {open.length ? `${open.length} task${open.length > 1 ? "s" : ""} still open.` : "Nothing outstanding."}
          </h3>
          <ul className="flex flex-col gap-2.5">
            {open.map((t) => (
              <li key={t.id} className="flex items-start gap-2.5">
                <Circle size={17} className="mt-0.5 text-[#c3c7d5]" />
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted">Move it, reduce it, or let it go.</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
