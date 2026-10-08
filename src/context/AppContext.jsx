import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { initialBlocks, initialJournal, initialTasks } from "../data/demoData";

const AppContext = createContext();
const defaultState = {
  user: { name: "Aditya", email: "aditya@zenstate.app" },
  blocks: initialBlocks,
  tasks: initialTasks,
  journal: initialJournal,
  coachPlaying: false,
  planningDraft: {
    goal: "Prepare the ZenState classroom demonstration",
    why: "I want to feel confident explaining the product flow.",
    duration: 90,
    journalEnabled: true,
    scheduleType: "scheduled",
    selectedSlots: [{ day: "Tue", start: 17, end: 18.5 }],
  },
};
const saved = localStorage.getItem("zenstate-demo");
const persisted = saved ? JSON.parse(saved) : null;
const initialState = persisted
  ? {
      ...defaultState,
      ...persisted,
      tasks: persisted.tasks.map((task) => ({
        ...initialTasks.find((item) => item.id === task.id),
        ...task,
      })),
      planningDraft: { ...defaultState.planningDraft, ...persisted.planningDraft },
    }
  : defaultState;
function reducer(state, action) {
  switch (action.type) {
    case "TOGGLE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, done: !t.done } : t,
        ),
      };
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.task] };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.task.id ? action.task : t,
        ),
      };
    case "ADD_BLOCK":
      return { ...state, blocks: [...state.blocks, action.block] };
    case "DELETE_BLOCK":
      return {
        ...state,
        blocks: state.blocks.filter((b) => b.id !== action.id),
      };
    case "ADD_JOURNAL":
      return { ...state, journal: [action.entry, ...state.journal] };
    case "SET_COACH":
      return { ...state, coachPlaying: action.value };
    case "SET_PLAN_DRAFT":
      return { ...state, planningDraft: { ...state.planningDraft, ...action.value } };
    case "ADD_TASK_AND_BLOCKS":
      return {
        ...state,
        tasks: [...state.tasks, action.task],
        blocks: [...state.blocks, ...action.blocks],
      };
    case "UPDATE_BLOCK":
      return {
        ...state,
        blocks: state.blocks.map((block) =>
          block.id === action.block.id ? action.block : block,
        ),
      };
    default:
      return state;
  }
}
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  useEffect(
    () => localStorage.setItem("zenstate-demo", JSON.stringify(state)),
    [state],
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export const useApp = () => useContext(AppContext);
