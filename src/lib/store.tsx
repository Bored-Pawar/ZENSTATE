"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import { initialTasks, type CommitmentId, type Task } from "./data";

type State = {
  tasks: Task[];
  committed: CommitmentId[];
};

type Action =
  | { type: "hydrate"; state: State }
  | { type: "toggleTask"; id: string }
  | { type: "addTask"; task: Task }
  | { type: "toggleCommitment"; id: CommitmentId };

const KEY = "zenstate-v2";

const initial: State = {
  tasks: initialTasks,
  committed: ["sleep", "college", "commute", "meals", "gym"],
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "toggleTask":
      return { ...s, tasks: s.tasks.map((t) => (t.id === a.id ? { ...t, done: !t.done } : t)) };
    case "addTask":
      return { ...s, tasks: [...s.tasks, a.task] };
    case "toggleCommitment":
      return {
        ...s,
        committed: s.committed.includes(a.id) ? s.committed.filter((c) => c !== a.id) : [...s.committed, a.id],
      };
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
