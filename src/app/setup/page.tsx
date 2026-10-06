"use client";

import Link from "next/link";
import { ArrowRight, Barbell, Bed, Car, Check, CaretRight, ForkKnife, GraduationCap, HandPointing, Plus } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/Nav";
import { Bar } from "@/components/Bits";
import { WeekGrid } from "@/components/WeekGrid";
import { OTHER_HOURS, TOTAL_HOURS, commitments, type BlockKind, type CommitmentId } from "@/lib/data";
import { useApp } from "@/lib/store";

const icons = { sleep: Bed, college: GraduationCap, commute: Car, meals: ForkKnife, gym: Barbell } as const;
const iconColor: Record<CommitmentId, string> = {
  sleep: "text-[#5b6070]",
  college: "text-accent-ink",
  commute: "text-[#787c8c]",
  meals: "text-[#797d8d]",
  gym: "text-warn-deep",
};

const steps = ["Your week", "Your goal", "Review"];

export default function Setup() {
  const { state, dispatch } = useApp();
  const { committed } = state;
  const kinds = committed.filter((c): c is BlockKind & CommitmentId => c !== "sleep");
  const empty = kinds.length === 0;
  const spoken = committed.reduce((n, id) => n + (commitments.find((c) => c.id === id)?.hours ?? 0), OTHER_HOURS);
  const usable = TOTAL_HOURS - spoken;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-[68px] flex-none flex-wrap items-center gap-x-8 gap-y-2 border-b border-line bg-white px-4 py-3 sm:px-7">
        <Logo />
        <ol className="flex items-center gap-[22px] text-[13px] text-muted">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-[22px]">
              <span className={`flex items-center gap-[7px] ${i === 0 ? "font-semibold text-accent-ink" : ""}`}>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${i === 0 ? "bg-accent-ink text-white" : "border-[1.5px] border-[#ccd0dd]"}`}
                >
                  {i + 1}
                </span>
                <span className={i === 0 ? "" : "hidden sm:inline"}>{s}</span>
              </span>
              {i < steps.length - 1 && <CaretRight size={12} className="hidden sm:block" />}
            </li>
          ))}
        </ol>
        <span className="ml-auto hidden text-[13px] text-muted sm:block">Setup · step 1 of 3</span>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-7 lg:flex-row">
        <section className="flex flex-none flex-col gap-3.5 lg:w-[270px]">
          <div>
            <h2 className="mb-1 text-xl font-semibold">{empty ? "Let's start with your week" : "Your week, as it stands"}</h2>
            <p className="text-[13px] leading-normal text-ink-3">
              {empty
                ? "Add the hours that repeat, whatever you plan. What's left is the time we'll work with — no more, no less."
                : "These are the hours already spoken for. Everything else is yours to spend."}
            </p>
          </div>
          <div className="mt-1 flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Recurring commitments</div>
            {commitments.map((c) => {
              const Icon = icons[c.id];
              const on = committed.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => dispatch({ type: "toggleCommitment", id: c.id })}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5 text-left hover:border-accent/50"
                >
                  <Icon size={18} className={iconColor[c.id]} />
                  <span className="flex-1 text-sm">{c.label}</span>
                  {on ? (
                    <>
                      <span className="text-xs text-muted">{c.hours}h</span>
                      <Check size={13} className="text-accent-ink" />
                    </>
                  ) : (
                    <Plus size={13} className="text-faint" />
                  )}
                </button>
              );
            })}
            {!empty && <p className="px-0.5 py-1 text-xs leading-[1.45] text-muted">Sleep sits 23:00–07:00 each day, just outside the hours shown here.</p>}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col gap-3.5">
          <WeekGrid
            kinds={kinds}
            className="flex-1"
            overlay={
              empty && (
                <div className="flex items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-xs text-ink-3 shadow-card">
                  <HandPointing size={16} />
                  Add a commitment from the left; and it settles onto your week
                </div>
              )
            }
          />
          <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-line bg-white px-[18px] py-3.5">
            <div className="flex-none">
              <div className="text-xs text-muted">Usable hours this week</div>
              {empty ? (
                <div className="text-[26px] font-semibold text-faint">—</div>
              ) : (
                <div className="text-[26px] font-semibold tracking-tight text-accent-ink">
                  {usable}
                  <span className="text-[15px] font-medium text-muted"> hours</span>
                </div>
              )}
            </div>
            <Bar
              className="min-w-[120px] flex-1"
              segs={empty ? [] : [{ pct: (spoken / TOTAL_HOURS) * 100, color: "#c9c2ee" }, { pct: (usable / TOTAL_HOURS) * 100, color: "#9184d9" }]}
            />
            <div className="max-w-[210px] text-xs leading-[1.45] text-muted sm:text-right">
              {empty
                ? "This fills in on its own once your recurring commitments are in. No rush."
                : `${spoken} hours already spoken for, ${usable} left to spend as you choose.`}
            </div>
            {empty ? (
              <button className="btn btn-primary" disabled>
                Continue <ArrowRight size={15} />
              </button>
            ) : (
              <Link href="/plan" className="btn btn-primary">
                Continue <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
