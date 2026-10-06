"use client";

import Link from "next/link";
import { Car, ForkKnife, GraduationCap, MoonStars, Path, StarFour } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/Frame";
import { Bar } from "@/components/Bits";
import { todayBlocks } from "@/lib/data";
import { useDates } from "@/lib/dates";

const icon = { car: Car, "graduation-cap": GraduationCap, "fork-knife": ForkKnife, star: StarFour, "moon-stars": MoonStars };

export default function Today() {
  const d = useDates();
  return (
    <>
      <PageHeader eyebrow={d?.today ?? " "} title="Today">
        <Link href="/plan" className="btn btn-primary">
          <Path size={16} /> Plan a goal
        </Link>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-7 lg:flex-row">
        <section className="min-w-0 flex-1">
          <h2 className="mb-3.5 text-[17px] font-semibold">Today&apos;s blocks</h2>
          <ul className="flex flex-col gap-2">
            {todayBlocks.map((b) => {
              const Icon = icon[b.icon];
              const focus = "focus" in b && b.focus;
              return (
                <li
                  key={b.time}
                  className={`flex items-center gap-3.5 rounded-lg border border-l-[3px] px-4 py-3 ${focus ? "border-edge bg-[#f4f1fd]" : "border-line bg-white"}`}
                  style={{ borderLeftColor: b.edge === "accent" ? "#9184d9" : b.edge }}
                >
                  <span className={`w-24 flex-none text-[13px] ${focus ? "text-[#7d72b8]" : "text-muted"}`}>{b.time}</span>
                  <Icon size={focus ? 15 : 16} weight={focus ? "fill" : "regular"} className={focus || b.icon === "graduation-cap" ? "text-accent-ink" : "text-[#787c8c]"} />
                  <span className={`flex-1 text-sm ${focus ? "font-medium text-accent-deep" : ""}`}>{b.label}</span>
                  {"tag" in b && b.tag && (
                    <span className={`tag text-[10px] ${focus ? "bg-tint-3 text-accent-chip" : "border border-[#d4cdf5] text-muted"}`}>{b.tag}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="flex flex-none flex-col gap-5 lg:w-[340px]">
          <div className="card p-5">
            <div className="mb-1.5 text-xs text-muted">This week&apos;s usable hours</div>
            <div className="mb-3.5 flex items-baseline gap-2">
              <span className="text-[38px] font-semibold tracking-tight">18</span>
              <span className="text-sm text-muted">hours to spend</span>
            </div>
            <Bar className="mb-2.5" segs={[{ pct: 77.8, color: "#9184d9" }]} />
            <div className="flex justify-between text-xs text-muted">
              <span>
                <span className="font-semibold text-accent-ink">14h</span> held for a goal
              </span>
              <span>4h open</span>
            </div>
          </div>
          <div className="card flex flex-col gap-3 p-5">
            <div className="eyebrow !text-[10px]">Goal in progress</div>
            <div className="text-lg font-semibold tracking-tight">Finish the capstone project</div>
            <div className="flex items-center gap-2.5">
              <Bar className="flex-1" h={8} segs={[{ pct: 40, color: "#9184d9" }]} />
              <span className="text-[13px] font-medium text-ink-3">2 / 5 sections</span>
            </div>
            <div className="flex justify-between pt-0.5 text-xs text-muted">
              <span>{d ? `Due ${d.deadlineMed}` : " "}</span>
              <span>{d ? `${d.daysAhead} days ahead` : " "}</span>
            </div>
            <div className="border-t border-line pt-3 text-xs italic leading-normal text-ink-3">&quot;…ship something I&apos;m proud of before spring.&quot;</div>
          </div>
          <Link href="/plan" className="btn btn-secondary w-full py-3">
            <Path size={16} /> Plan another goal
          </Link>
        </aside>
      </main>
    </>
  );
}
