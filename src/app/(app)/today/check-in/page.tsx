import Link from "next/link";
import { CheckCircle, Circle, CircleDashed, GraduationCap, SealCheck, StarFour } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/Frame";
import { Bar, Quote } from "@/components/Bits";
import { CoachButton } from "@/components/CoachButton";

const sections = [
  { label: "Section 1", state: "done" },
  { label: "Section 2", state: "done" },
  { label: "Section 3 · in progress", state: "doing" },
  { label: "Section 4", state: "todo" },
  { label: "Write-up", state: "todo" },
] as const;

export default function CheckIn() {
  return (
    <>
      <PageHeader eyebrow="Monday, 1 September" title="Today" />
      <main className="flex flex-1 flex-col gap-[22px] p-4 sm:p-7">
        <article className="flex flex-col overflow-hidden rounded-[14px] border border-l-4 border-edge border-l-accent bg-white shadow-card lg:flex-row">
          <div className="flex flex-1 flex-col gap-4 px-5 py-6 sm:px-7">
            <div className="flex items-center gap-[9px]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eee9fc]">
                <StarFour size={15} weight="fill" className="text-accent-ink" />
              </span>
              <span className="eyebrow">A gentle check-in</span>
            </div>
            <div>
              <h2 className="mb-1.5 text-[23px] font-semibold tracking-tight">The capstone is due in three days</h2>
              <p className="max-w-[600px] text-[15px] leading-[1.6] text-ink-2">
                You&apos;ve finished two of the five sections. That&apos;s real ground covered — and the last stretch is usually the hardest to see clearly from the inside.
              </p>
            </div>
            <div className="max-w-[600px]">
              <Quote label="Why you said this matters">
                &quot;I want to graduate in spring without dragging this into summer — and finally ship something I&apos;m proud of.&quot;
              </Quote>
            </div>
            <div className="flex max-w-[600px] items-start gap-3 rounded-[10px] border border-line bg-field px-4 py-3.5">
              <SealCheck size={20} weight="fill" className="mt-px flex-none text-accent-ink" />
              <div>
                <div className="mb-0.5 text-xs text-muted">One small step, if you have 45 minutes tonight</div>
                <div className="text-[15px] font-medium">Sit with section 3&apos;s tests for a while</div>
                <div className="mt-0.5 text-[13px] leading-normal text-ink-3">It&apos;s the quiet piece that&apos;s holding up the other two. Starting there tends to loosen the rest.</div>
              </div>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3">
              <CoachButton label="Hear this from your coach" />
              <Link href="/plan/review" className="btn btn-secondary px-5 py-3">
                Open the plan
              </Link>
              <span className="text-xs text-faint">A 40-second spoken note, in your own words</span>
            </div>
          </div>
          <div className="flex flex-none flex-col gap-[18px] border-t border-line bg-[#fcfcfe] px-6 py-6 lg:w-[280px] lg:border-l lg:border-t-0">
            <div>
              <div className="mb-2.5 text-xs text-muted">Where the capstone stands</div>
              <div className="mb-2.5 flex gap-1.5">
                {[1, 1, 0, 0, 0].map((on, i) => (
                  <span key={i} className={`h-2 flex-1 rounded ${on ? "bg-accent" : "bg-[#e4e6f0]"}`} />
                ))}
              </div>
              <div className="text-sm font-semibold">2 of 5 sections done</div>
            </div>
            <ul className="flex flex-col gap-[11px] border-t border-line pt-4">
              {sections.map((s) => (
                <li key={s.label} className="flex items-center gap-2.5 text-[13px]">
                  {s.state === "done" && <CheckCircle size={17} weight="fill" className="text-ok" />}
                  {s.state === "doing" && <CircleDashed size={17} className="text-accent" />}
                  {s.state === "todo" && <Circle size={17} className="text-[#c3c7d5]" />}
                  <span className={s.state === "done" ? "text-muted line-through" : s.state === "doing" ? "font-medium" : "text-ink-3"}>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <div className="flex flex-col gap-[22px] lg:flex-row">
          <section className="flex-1">
            <h3 className="mb-3 text-[15px] font-semibold text-nav">Today&apos;s blocks</h3>
            <ul className="flex flex-col gap-2">
              <li className="flex items-center gap-3.5 rounded-lg border border-l-[3px] border-line border-l-accent bg-white px-4 py-[11px]">
                <span className="w-24 flex-none text-[13px] text-muted">09:00 – 13:00</span>
                <GraduationCap size={16} className="text-accent-ink" />
                <span className="flex-1 text-sm">Studio</span>
              </li>
              <li className="flex items-center gap-3.5 rounded-lg border border-l-[3px] border-edge border-l-accent bg-[#f4f1fd] px-4 py-[11px]">
                <span className="w-24 flex-none text-[13px] text-[#7d72b8]">20:00 – 22:00</span>
                <StarFour size={14} weight="fill" className="text-accent-ink" />
                <span className="flex-1 text-sm font-medium text-accent-deep">Capstone · section 3 tests</span>
              </li>
            </ul>
          </section>
          <div className="card self-start px-5 py-[18px] lg:w-[280px]">
            <div className="mb-1.5 text-xs text-muted">This week&apos;s usable hours</div>
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className="text-[28px] font-semibold tracking-tight">6</span>
              <span className="text-[13px] text-muted">left before the deadline</span>
            </div>
            <Bar h={8} segs={[{ pct: 80, color: "#9184d9" }]} />
            <div className="mt-2 text-xs leading-normal text-ink-3">Enough for the last two sections, if the evenings hold.</div>
          </div>
        </div>
      </main>
    </>
  );
}
