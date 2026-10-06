"use client";

import Link from "next/link";
import { Check, Info, Plus, Target } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/Frame";
import { useApp } from "@/lib/store";

export default function Tasks() {
  const { state, dispatch } = useApp();
  const open = state.tasks.filter((t) => !t.done);
  const hours = open.reduce((n, t) => n + t.hours, 0);

  const add = () => {
    const title = window.prompt("What needs doing?")?.trim();
    if (title) dispatch({ type: "addTask", task: { id: crypto.randomUUID(), title, goal: "Finish the capstone", hours: 1, scheduled: "Not scheduled yet", done: false, note: "" } });
  };

  return (
    <>
      <PageHeader eyebrow="Committed" title="Tasks">
        <span className="tag hidden border border-[#d4cdf5] text-accent-ink sm:inline-flex">All goals</span>
        <button className="btn btn-secondary px-3.5 py-2" onClick={add}>
          <Plus size={14} /> Add task
        </button>
      </PageHeader>
      <main className="flex flex-1 flex-col p-4 sm:p-7">
        <div className="mb-[18px] flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-tint-2 px-[18px] py-3.5">
          <Target size={20} weight="fill" className="text-accent-ink" />
          <div className="min-w-[200px] flex-1">
            <div className="text-sm font-semibold">
              {open.length} tasks committed · {hours} hours this week
            </div>
            <div className="text-xs text-ink-3">Each one is here because it serves something you said you wanted.</div>
          </div>
          <span className="text-xs text-muted">On track for Tue 4 Sep</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.08em] text-ink/60">
                <th className="w-11 p-2" />
                <th className="p-2 font-medium">Task</th>
                <th className="p-2 font-medium">In service of</th>
                <th className="w-[90px] p-2 font-medium">Hours</th>
                <th className="w-[190px] p-2 font-medium">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {state.tasks.map((t) => (
                <tr key={t.id} className="border-b border-ink/[0.07] hover:bg-ink/[0.03]">
                  <td className="p-2">
                    <button
                      role="checkbox"
                      aria-checked={t.done}
                      aria-label={`Mark ${t.title} done`}
                      onClick={() => dispatch({ type: "toggleTask", id: t.id })}
                      className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] ${t.done ? "border-accent bg-accent text-white" : "border-[#c3c7d5]"}`}
                    >
                      {t.done && <Check size={12} weight="bold" />}
                    </button>
                  </td>
                  <td className={`p-2 font-medium ${t.done ? "text-muted line-through" : ""}`}>
                    <Link href={`/tasks/${t.id}`} className="hover:text-accent-ink">
                      {t.title}
                    </Link>
                  </td>
                  <td className="p-2">
                    <span className="tag bg-tint-3 text-accent-chip">
                      <Target size={11} weight="fill" className="mr-[5px]" />
                      {t.goal}
                    </span>
                  </td>
                  <td className="p-2 text-ink-3">{t.hours}h</td>
                  <td className="p-2 text-muted">{t.scheduled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-[18px] text-xs text-muted">
          <Info size={15} className="flex-none" />
          Ticking a task off frees its hours back to your week. If plans change, the plan can change with them.
        </div>
      </main>
    </>
  );
}
