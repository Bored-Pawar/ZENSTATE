"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/Frame";
import { Bar } from "@/components/Bits";
import { useApp } from "@/lib/store";

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const { state, dispatch } = useApp();
  const task = state.tasks.find((t) => t.id === taskId);

  if (!task)
    return (
      <>
        <PageHeader eyebrow="Tasks" title="Task not found" />
        <main className="p-4 sm:p-7">
          <Link href="/tasks" className="btn btn-secondary">
            <ArrowLeft size={14} /> Back to tasks
          </Link>
        </main>
      </>
    );

  return (
    <>
      <PageHeader eyebrow={`${task.goal} · ${task.hours}h`} title={task.title} />
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-7 lg:flex-row">
        <section className="min-w-0 flex-1">
          <Link href="/tasks" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-accent-ink">
            <ArrowLeft size={14} /> Back to tasks
          </Link>
          <p className="mb-5 max-w-xl text-[15px] leading-[1.6] text-ink-2">Give this task a small, clear finish line. It does not need to be perfect to count.</p>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button className={`btn btn-primary ${task.done ? "bg-accent/10" : ""}`} onClick={() => dispatch({ type: "toggleTask", id: task.id })}>
              {task.done ? (
                <>
                  Completed <Check size={14} />
                </>
              ) : (
                "Mark complete"
              )}
            </button>
            <span className="tag bg-tint-3 text-accent-chip">{task.scheduled}</span>
          </div>
          <article className="card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Task notes</div>
                <h2 className="text-[17px] font-semibold">What do you want to remember?</h2>
              </div>
              <span className="text-xs text-muted">Autosaved</span>
            </div>
            <textarea
              className="input min-h-[200px] resize-y leading-[1.6]"
              value={task.note}
              onChange={(e) => dispatch({ type: "updateTask", task: { ...task, note: e.target.value } })}
              placeholder="Write notes, ideas or a reflection after you finish..."
            />
          </article>
        </section>
        <aside className="flex flex-none flex-col gap-5 lg:w-[320px]">
          <article className="card p-5">
            <div className="eyebrow mb-2">A small start</div>
            <h3 className="mb-1 text-lg font-semibold">Try ten minutes.</h3>
            <p className="text-[13px] leading-normal text-ink-3">Open the first source or write the first three rough points. Momentum is easier after motion.</p>
          </article>
          <article className="card p-5">
            <div className="mb-2 text-xs text-muted">Task progress</div>
            <Bar h={8} className="mb-2" segs={[{ pct: task.done ? 100 : 32, color: "#9184d9" }]} />
            <strong className="text-sm">{task.done ? "Complete" : "In progress"}</strong>
          </article>
        </aside>
      </main>
    </>
  );
}
