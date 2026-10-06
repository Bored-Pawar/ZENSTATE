"use client";

import { Pause, Play } from "@phosphor-icons/react/dist/ssr";
import { useApp } from "@/lib/store";

export function CoachButton({ compact = false, label = "Hear from your coach" }: { compact?: boolean; label?: string }) {
  const { state, dispatch } = useApp();
  const on = state.coachPlaying;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => dispatch({ type: "setCoach", value: !on })}
      className={`btn btn-primary gap-[9px] ${compact ? "" : "px-5 py-3"}`}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
        {on ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" className="ml-px" />}
      </span>
      {on ? "Coach message playing" : label}
    </button>
  );
}
