"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, ClipboardText, FileText, Files, Info, UploadSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/Frame";
import { sampleImport, type ImportFile, type JournalEntry } from "@/lib/data";
import { medDate } from "@/lib/format";
import { useApp } from "@/lib/store";

const dateOf = (name: string) => name.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export default function ImportEntries() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<"files" | "paste">("files");
  const [files, setFiles] = useState<ImportFile[]>(sampleImport);
  const [pasted, setPasted] = useState("");
  const [pasteDate, setPasteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);

  const read = async (list: FileList | File[]) => {
    const next: ImportFile[] = [];
    for (const f of Array.from(list)) {
      if (!/\.(md|txt)$/i.test(f.name)) continue;
      const date = dateOf(f.name);
      next.push({ name: f.name, date, on: !!date, text: await f.text() });
    }
    if (next.length) setFiles(next);
  };

  const set = (i: number, patch: Partial<ImportFile>) => setFiles((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const chosen = files.filter((f) => f.on && f.date);
  const skipped = files.length - chosen.length;

  const unique = (date: string, taken: Set<string>) => {
    let id = date;
    for (let n = 2; taken.has(id); n++) id = `${date}-${n}`;
    taken.add(id);
    return id;
  };

  const importAll = () => {
    const taken = new Set(state.journal.map((e) => e.id));
    const entries: JournalEntry[] = chosen.map((f) => ({
      id: unique(f.date!, taken),
      date: f.date!,
      text: f.text || `Imported from ${f.name}`,
    }));
    dispatch({ type: "addEntries", entries });
    router.push("/journal");
  };

  const importPaste = () => {
    if (!pasted.trim() || !validDate(pasteDate)) return;
    dispatch({ type: "addEntries", entries: [{ id: unique(pasteDate, new Set(state.journal.map((e) => e.id))), date: pasteDate, text: pasted.trim() }] });
    router.push("/journal");
  };

  const tabCls = (on: boolean) =>
    `-mb-px flex items-center gap-[7px] px-4 py-2.5 text-sm ${on ? "border-b-2 border-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`;

  return (
    <>
      <PageHeader eyebrow="Journal" title="Import entries" />
      <main className="flex flex-1 justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex w-full max-w-[720px] flex-col gap-5">
          <div role="tablist" className="flex gap-1 border-b border-line">
            <button role="tab" aria-selected={tab === "files"} className={tabCls(tab === "files")} onClick={() => setTab("files")}>
              <Files size={16} /> Files or folder
            </button>
            <button role="tab" aria-selected={tab === "paste"} className={tabCls(tab === "paste")} onClick={() => setTab("paste")}>
              <ClipboardText size={16} /> Paste text
            </button>
          </div>

          {tab === "paste" ? (
            <div className="flex flex-col gap-3">
              <textarea className="input min-h-[240px] font-mono leading-[1.7]" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste plain text here" />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[13px] text-ink-3">
                  Entry date
                  <input type="date" className="input !w-auto" value={pasteDate} onChange={(e) => setPasteDate(e.target.value)} />
                </label>
                <button className="btn btn-primary ml-auto px-[18px] py-[11px]" disabled={!pasted.trim() || !validDate(pasteDate)} onClick={importPaste}>
                  Import 1 entry <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  read(e.dataTransfer.files);
                }}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed p-[26px] text-center ${over ? "border-accent bg-tint-2" : "border-[#c3c7d5] bg-[#fafbfe]"}`}
              >
                <UploadSimple size={28} className="text-accent" />
                <div className="text-[15px] font-semibold">Drop markdown files here</div>
                <div className="text-[13px] text-muted">
                  .md and .txt · or{" "}
                  <button type="button" onClick={() => pick.current?.click()} className="text-accent-ink underline underline-offset-2">
                    browse your files
                  </button>{" "}
                  ·{" "}
                  <button type="button" onClick={() => folder.current?.click()} className="text-accent-ink underline underline-offset-2">
                    choose a folder
                  </button>
                </div>
                <input ref={pick} type="file" multiple accept=".md,.txt" hidden onChange={(e) => e.target.files && read(e.target.files)} />
                <input
                  ref={(el) => {
                    folder.current = el;
                    el?.setAttribute("webkitdirectory", "");
                  }}
                  type="file"
                  hidden
                  onChange={(e) => e.target.files && read(e.target.files)}
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-white">
                <div className="flex items-center bg-[#fafbfe] px-4 py-[11px]">
                  <span className="flex-1 text-xs font-semibold text-nav">{files.length} files found</span>
                  <span className="hidden w-[120px] text-[11px] text-muted sm:block">Detected date</span>
                  <span className="w-11 text-center text-[11px] text-muted">Import</span>
                </div>
                {files.map((f, i) => (
                  <div key={`${f.name}${i}`} className="flex items-center gap-3 border-t border-[#f4f5f9] px-4 py-[11px]">
                    <FileText size={18} className={f.date ? "text-accent-ink" : "text-[#c3c7d5]"} />
                    <span className={`min-w-0 flex-1 truncate font-mono text-[13px] ${f.date ? "" : "text-muted"}`}>{f.name}</span>
                    <span className="w-[120px] flex-none">
                      {f.date ? (
                        <span className="text-[13px] text-ink-3">{medDate(f.date)}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-warn">
                          <WarningCircle size={14} />
                          No date —{" "}
                          <button
                            type="button"
                            className="underline"
                            onClick={() => {
                              const d = window.prompt("Date for this entry (YYYY-MM-DD)")?.trim();
                              if (d && validDate(d)) set(i, { date: d, on: true });
                            }}
                          >
                            set it
                          </button>
                        </span>
                      )}
                    </span>
                    <span className="flex w-11 justify-center">
                      <button
                        role="switch"
                        aria-checked={f.on}
                        aria-label={`Import ${f.name}`}
                        disabled={!f.date}
                        onClick={() => set(i, { on: !f.on })}
                        className={`relative h-5 w-[34px] rounded-full disabled:cursor-not-allowed ${f.on ? "bg-accent" : "bg-[#d3d6e2]"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${f.on ? "left-4" : "left-0.5"}`} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-tint-2 px-[18px] py-[15px]">
                <Info size={18} className="text-accent-ink" />
                <span className="min-w-[200px] flex-1 text-[13px] leading-normal text-[#3a3550]">
                  {chosen.length} of {files.length} files selected. {chosen.length} {chosen.length === 1 ? "entry" : "entries"} will be created
                  {skipped ? `; ${skipped} ${skipped === 1 ? "file" : "files"} skipped until ${skipped === 1 ? "it has" : "they have"} a date` : ""}.
                </span>
                <button className="btn btn-primary px-[18px] py-[11px]" disabled={!chosen.length} onClick={importAll}>
                  Import {chosen.length} {chosen.length === 1 ? "entry" : "entries"} <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
