import { StarFour } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

/** Progress / capacity bar. Segments are [percent, className-or-style]. */
export function Bar({ segs, h = 10, className = "" }: { segs: { pct: number; color: string; striped?: boolean }[]; h?: number; className?: string }) {
  return (
    <div className={`flex overflow-hidden bg-track ${className}`} style={{ height: h, borderRadius: h / 2 }}>
      {segs.map((s, i) => (
        <div
          key={i}
          style={{
            width: `${s.pct}%`,
            background: s.striped ? "repeating-linear-gradient(45deg,#e0dcf3 0 6px,#eae7f7 6px 12px)" : s.color,
          }}
        />
      ))}
    </div>
  );
}

export function Quote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-r-lg border-l-[3px] border-accent bg-tint-2 px-4 py-3">
      <div className="mb-1.5 text-[11px] uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="text-sm italic leading-[1.55] text-[#3a3550]">{children}</div>
    </div>
  );
}

export function CoachAvatar({ size = 30 }: { size?: number }) {
  return (
    <div className="flex flex-none items-center justify-center rounded-full bg-[#eee9fc]" style={{ width: size, height: size }}>
      <StarFour size={Math.round(size / 2.1)} weight="fill" className="text-accent-ink" />
    </div>
  );
}
