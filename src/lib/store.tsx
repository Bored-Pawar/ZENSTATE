"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import { initialBlocks, initialJournal, initialTasks, type CommitmentId, type JournalEntry, type Task, type TimeBlock } from "./data";

type State = {
  tasks: Task[];
  blocks: TimeBlock[];
  journal: JournalEntry[];
  committed: CommitmentId[];
  coachPlaying: boolean;
};

type Action =
  | { type: "hydrate"; state: State }
  | { type: "toggleTask"; id: string }
  | { type: "addTask"; task: Task }
  | { type: "updateTask"; task: Task }
  | { type: "addBlock"; block: TimeBlock }
  | { type: "deleteBlock"; id: string }
  | { type: "toggleCommitment"; id: CommitmentId }
  | { type: "saveEntry"; entry: JournalEntry }
  | { type: "addEntries"; entries: JournalEntry[] }
  | { type: "setCoach"; value: boolean };

const KEY = "zenstate-v2";

const initial: State = {
  tasks: initialTasks,
  blocks: initialBlocks,
  journal: initialJournal,
  committed: ["sleep", "college", "commute", "meals", "gym"],
  coachPlaying: false,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "toggleTask":
      return { ...s, tasks: s.tasks.map((t) => (t.id === a.id ? { ...t, done: !t.done } : t)) };
    case "addTask":
      return { ...s, tasks: [...s.tasks, a.task] };
    case "updateTask":
      return { ...s, tasks: s.tasks.map((t) => (t.id === a.task.id ? a.task : t)) };
    case "addBlock":
      return { ...s, blocks: [...s.blocks, a.block] };
    case "deleteBlock":
      return { ...s, blocks: s.blocks.filter((b) => b.id !== a.id) };
    case "toggleCommitment":
      return {
        ...s,
        committed: s.committed.includes(a.id) ? s.committed.filter((c) => c !== a.id) : [...s.committed, a.id],
      };
    case "saveEntry":
      return {
        ...s,
        journal: s.journal.some((e) => e.id === a.entry.id)
          ? s.journal.map((e) => (e.id === a.entry.id ? a.entry : e))
          : [a.entry, ...s.journal],
      };
    case "addEntries":
      return { ...s, journal: [...a.entries, ...s.journal].sort((x, y) => y.date.localeCompare(x.date)) };
    case "setCoach":
      return { ...s, coachPlaying: a.value };
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const hydrated = useRef(false);

  // Load after mount so server and first client render match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) dispatch({ type: "hydrate", state: { ...initial, ...JSON.parse(raw) } });
    } catch {}
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
