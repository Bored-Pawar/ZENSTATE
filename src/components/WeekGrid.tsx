import type { ReactNode } from "react";
import { DAYS, GRID_START, HOUR_PX, baselineWeek, studyWeek, type BlockKind, type WeekBlock } from "@/lib/data";
import { hh } from "@/lib/format";

const HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
const GRID_H = 576; // 18 hours at HOUR_PX

const look: Record<BlockKind, { box: string; text: string }> = {
  college: { box: "bg-[#ece9fb] border-l-[3px] border-accent", text: "text-accent-ink" },
  commute: { box: "bg-[#f1f3f8] border border-dashed border-[#d3d6e2]", text: "text-[#787c8c]" },
  meals: { box: "bg-[#f4f5f9] border border-[#edeef4]", text: "text-[#797d8d]" },
  gym: { box: "bg-warn-bg border border-[#edeef4]", text: "text-warn-deep" },
  study: { box: "bg-tint-3 border-l-[3px] border-accent", text: "text-accent-chip" },
};

function Block({ b, faded }: { b: WeekBlock; faded?: boolean }) {
  const l = look[b.kind];
  return (
    <div
      className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-[5px] ${l.box} ${faded ? "opacity-40" : ""}`}
      style={{ top: (b.start - GRID_START) * HOUR_PX, height: b.dur * HOUR_PX - 4 }}
    >
      <div className={`truncate text-[11px] font-semibold leading-tight ${l.text}`}>{b.label}</div>
      {b.sub && <div className={`text-[10px] leading-tight opacity-85 ${l.text}`}>{b.sub}</div>}
    </div>
  );
}

/**
 * Seven-day grid, 06:00–22:00. `plan` overlays the study blocks and fades the
 * baseline. `kinds` limits which baseline blocks are shown.
 */
export function WeekGrid({
  plan = false,
  kinds,
  overlay,
  className = "",
}: {
  plan?: boolean;
  kinds?: BlockKind[];
  overlay?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative overflow-x-auto rounded-[10px] border border-line bg-white ${className}`}>
      <div className="flex min-w-[640px]">
        <div className="w-[46px] flex-none border-r border-line-2 pt-7">
          <div className="relative" style={{ height: GRID_H }}>
            {HOURS.map((h) => (
              <div key={h} className="absolute right-1.5 text-[10px] text-faint" style={{ top: (h - GRID_START) * HOUR_PX - 6 }}>
                {hh(h)}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-1">
          {DAYS.map((d, i) => (
            <div key={d} className="min-w-0 flex-1 border-l border-line-2">
              <div className="flex h-7 items-center justify-center border-b border-line-2 text-[11px] font-semibold text-[#6b6f80]">{d}</div>
              <div
                className="relative"
                style={{
                  height: GRID_H,
                  background: "repeating-linear-gradient(to bottom,#f2f3f8 0 1px,transparent 1px 32px)",
                }}
              >
                {baselineWeek[i]
                  .filter((b) => !kinds || kinds.includes(b.kind))
                  .map((b, j) => (
                    <Block key={j} b={b} faded={plan} />
                  ))}
                {plan && studyWeek[i].map((b, j) => <Block key={`s${j}`} b={b} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
      {overlay && <div className="pointer-events-none absolute inset-0 flex items-center justify-center">{overlay}</div>}
    </div>
  );
}
