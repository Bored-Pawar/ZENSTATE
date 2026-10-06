"use client";

import { useState } from "react";
import { PageHeader } from "@/components/Frame";
import { DAYS, type TimeBlock } from "@/lib/data";
import { useApp } from "@/lib/store";

const HOURS = [8, 10, 12, 14, 16, 18, 20];
const PX = 34;
const blank = { day: "Mon" as TimeBlock["day"], start: 17, end: 18, title: "", kind: "focus" as TimeBlock["kind"] };

export default function Timetable() {
  const { state, dispatch } = useApp();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const bad = !form.title.trim() || form.end <= form.start;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (bad) return;
    dispatch({ type: "addBlock", block: { ...form, title: form.title.trim(), id: crypto.randomUUID() } });
    setShow(false);
    setForm(blank);
  };

  return (
    <>
      <PageHeader eyebrow="Your actual week" title="Protect the hours you really have.">
        <button className="btn btn-primary" onClick={() => setShow(!show)}>
          {show ? "Close" : "Add a block"}
        </button>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-7">
        <p className="max-w-2xl text-sm leading-normal text-ink-3">Add fixed commitments first, then mark the spaces you can use for yourself. You can edit this whenever life changes.</p>
        {show && (
          <form onSubmit={add} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <label className="text-xs text-muted">
              Day
              <select className="input mt-1" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value as TimeBlock["day"] })}>
                {DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              From
              <input className="input mt-1" type="number" min={6} max={22} value={form.start} onChange={(e) => setForm({ ...form, start: +e.target.value })} />
            </label>
            <label className="text-xs text-muted">
              To
              <input className="input mt-1" type="number" min={7} max={23} value={form.end} onChange={(e) => setForm({ ...form, end: +e.target.value })} />
            </label>
            <label className="text-xs text-muted">
              What is this?
              <input className="input mt-1" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="text-xs text-muted">
              Type
              <select className="input mt-1" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TimeBlock["kind"] })}>
                <option value="fixed">Fixed</option>
                <option value="focus">Focus</option>
              </select>
            </label>
            <button className="btn btn-primary" disabled={bad}>
              Save block
            </button>
          </form>
        )}

        <div className="overflow-x-auto rounded-[10px] border border-line bg-white">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-line-2 text-[11px] font-semibold text-[#6b6f80]">
              <span className="p-2 font-normal text-faint">Time</span>
              {DAYS.map((d) => (
                <strong key={d} className="p-2 text-center">
                  {d}
                </strong>
              ))}
            </div>
            <div className="grid grid-cols-[56px_repeat(7,1fr)]">
              <div className="relative" style={{ height: HOURS.length * 2 * PX }}>
                {HOURS.map((h) => (
                  <span key={h} className="absolute right-2 text-[10px] text-faint" style={{ top: (h - 8) * PX - 6 }}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {DAYS.map((day) => (
                <div key={day} className="relative border-l border-line-2" style={{ height: HOURS.length * 2 * PX, background: `repeating-linear-gradient(to bottom,#f2f3f8 0 1px,transparent 1px ${PX * 2}px)` }}>
                  {state.blocks
                    .filter((b) => b.day === day)
                    .map((b) => (
                      <button
                        key={b.id}
                        title="Click to remove"
                        onClick={() => dispatch({ type: "deleteBlock", id: b.id })}
                        className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-left ${b.kind === "focus" ? "border-l-[3px] border-accent bg-tint-3 text-accent-chip" : "border border-[#edeef4] bg-[#f4f5f9] text-[#797d8d]"}`}
                        style={{ top: (b.start - 8) * PX, height: Math.max((b.end - b.start) * PX - 5, 28) }}
                      >
                        <div className="truncate text-[11px] font-semibold">{b.title}</div>
                        <div className="text-[10px] opacity-85">
                          {b.start}:00 – {b.end}:00
                        </div>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">Tip: click any block to remove it in this demo.</p>
      </main>
    </>
  );
}
