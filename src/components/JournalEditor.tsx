"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BatteryLow, CheckCircle, CloudCheck, Moon, Plus, Target, CheckSquare, UploadSimple, X } from "@phosphor-icons/react/dist/ssr";
import { useApp } from "@/lib/store";
import { longDate, shortDate } from "@/lib/format";
import type { JournalEntry, Parsed } from "@/lib/data";

const signalIcon = {
  done: <CheckCircle size={14} weight="fill" className="text-ok" />,
  energy: <BatteryLow size={14} className="text-warn" />,
  late: <Moon size={14} className="text-[#787c8c]" />,
};

const label = "mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted";

function Chip({ icon, children, onRemove, sub }: { icon: React.ReactNode; children: React.ReactNode; onRemove: () => void; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-2.5 py-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className={`flex-1 text-[13px] ${sub ? "font-medium" : ""}`}>{children}</span>
        <button type="button" aria-label="Remove" onClick={onRemove} className="text-faint hover:text-ink">
          <X size={12} />
        </button>
      </div>
      {sub && <div className="mt-[3px] pl-[22px] text-[11px] italic text-muted">&quot;{sub}&quot;</div>}
    </div>
  );
}

function ParsedPanel({ parsed, onChange }: { parsed: Parsed; onChange: (p: Parsed) => void }) {
  return (
    <aside className="flex flex-none flex-col border-t border-line bg-[#fcfcfe] xl:w-[312px] xl:border-l xl:border-t-0">
      <div className="border-b border-line px-5 pb-[13px] pt-[18px]">
        <div className="text-sm font-semibold">Parsed from this entry</div>
        <div className="mt-[3px] text-xs leading-normal text-muted">Suggested links for you to review. Remove anything that&apos;s wrong.</div>
      </div>
      <div className="flex flex-1 flex-col gap-[18px] px-[18px] py-4">
        <section>
          <div className={label}>Linked goals</div>
          <div className="flex flex-col gap-1.5">
            {parsed.goals.map((g) => (
              <Chip key={g} icon={<Target size={14} weight="fill" className="text-accent-ink" />} onRemove={() => onChange({ ...parsed, goals: parsed.goals.filter((x) => x !== g) })}>
                {g}
              </Chip>
            ))}
          </div>
        </section>
        <section>
          <div className={label}>Linked tasks</div>
          <div className="flex flex-col gap-1.5">
            {parsed.tasks.map((t) => (
              <Chip key={t} icon={<CheckSquare size={14} className="text-accent-ink" />} onRemove={() => onChange({ ...parsed, tasks: parsed.tasks.filter((x) => x !== t) })}>
                {t}
              </Chip>
            ))}
          </div>
        </section>
        <section>
          <div className={label}>Detected signals</div>
          <div className="flex flex-col gap-1.5">
            {parsed.signals.map((s) => (
              <Chip key={s.title} icon={signalIcon[s.kind]} sub={s.quote} onRemove={() => onChange({ ...parsed, signals: parsed.signals.filter((x) => x !== s) })}>
                {s.title}
              </Chip>
            ))}
          </div>
        </section>
        <button
          type="button"
          onClick={() => {
            const title = window.prompt("Task to link")?.trim();
            if (title) onChange({ ...parsed, tasks: [...parsed.tasks, title] });
          }}
          className="flex items-center justify-center gap-[7px] rounded-lg border border-dashed border-[#c3c7d5] p-[9px] text-[13px] text-accent-ink"
        >
          <Plus size={14} /> Add a link manually
        </button>
      </div>
      <div className="border-t border-line px-[18px] py-3 text-[11px] leading-normal text-faint">These feed your coaching later. You can change them any time.</div>
    </aside>
  );
}

export function JournalEditor({ id }: { id?: string }) {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const entry: JournalEntry | undefined = state.journal.find((e) => e.id === id) ?? (id ? undefined : state.journal[0]);
  const [text, setText] = useState(entry?.text ?? "");
  const [saved, setSaved] = useState(true);
  const loaded = useRef(entry?.id);

  // Switching entries (or hydrating from storage) resets the buffer.
  useEffect(() => {
    if (entry && loaded.current !== entry.id) {
      loaded.current = entry.id;
      setText(entry.text);
      setSaved(true);
    } else if (entry && saved) {
      setText(entry.text);
    }
  }, [entry, saved]);

  // Quiet autosave: no button, just a debounce.
  useEffect(() => {
    if (saved || !entry) return;
    const t = setTimeout(() => {
      dispatch({ type: "saveEntry", entry: { ...entry, text } });
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [text, saved, entry, dispatch]);

  const create = () => {
    const iso = new Date().toISOString().slice(0, 10);
    if (!state.journal.some((e) => e.id === iso)) dispatch({ type: "saveEntry", entry: { id: iso, date: iso, text: "" } });
    router.push(`/journal/${iso}`);
  };

  if (!entry) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-ink-3">No entry here yet.</p>
        <button className="btn btn-primary" onClick={create}>
          <Plus size={14} /> New entry
        </button>
      </main>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <nav aria-label="Entries" className="flex flex-none flex-col border-b border-line bg-[#fcfcfe] lg:w-[236px] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 px-[18px] pb-3 pt-[18px]">
            <span className="text-[15px] font-semibold">Entries</span>
            <Link href="/journal/import" aria-label="Import entries" className="ml-auto flex h-7 w-7 items-center justify-center rounded-[7px] border border-line bg-white text-accent-ink">
              <UploadSimple size={15} />
            </Link>
            <button type="button" aria-label="New entry" onClick={create} className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line bg-white text-accent-ink">
              <Plus size={15} />
            </button>
          </div>
          <ul className="flex gap-0.5 overflow-x-auto px-2.5 pb-2 lg:flex-col lg:overflow-hidden lg:pb-0">
            {state.journal.map((e) => (
              <li key={e.id} className="flex-none lg:flex-auto">
                <Link href={`/journal/${e.id}`} className={`block w-44 rounded-lg px-3 py-2.5 lg:w-auto ${e.id === entry.id ? "bg-tint" : "hover:bg-tint/60"}`}>
                  <div className={`text-[13px] ${e.id === entry.id ? "font-semibold text-accent-deep" : "font-medium"}`}>{shortDate(e.date)}</div>
                  <div className="truncate text-xs text-muted">{e.text ? `${e.text.slice(0, 42)}…` : "Empty entry"}</div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="flex h-14 flex-none items-center border-b border-line px-4 sm:px-7">
            <span className="text-[13px] text-muted">Journal entry</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-faint" aria-live="polite">
              <CloudCheck size={15} />
              {saved ? "Saved" : "Saving…"}
            </span>
          </div>
          <div className="flex flex-1 justify-center px-4 py-8 sm:px-6 sm:py-11">
            <div className="flex w-full max-w-[660px] flex-col font-mono">
              <div className="mb-[26px] text-[13px] text-muted">{longDate(entry.date)}</div>
              <textarea
                aria-label="Journal entry"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setSaved(false);
                }}
                placeholder="Write whatever is on your mind."
                className="min-h-[360px] w-full flex-1 resize-none bg-transparent text-[14.5px] leading-[1.9] text-[#2a2d38] caret-accent outline-none placeholder:text-faint"
              />
            </div>
          </div>
        </div>
      </div>
      {entry.parsed && <ParsedPanel parsed={entry.parsed} onChange={(p) => dispatch({ type: "saveEntry", entry: { ...entry, text, parsed: p } })} />}
    </div>
  );
}
