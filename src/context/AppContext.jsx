import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { initialBlocks, initialJournal, initialTasks } from "../data/demoData";

const AppContext = createContext();
const saved = localStorage.getItem("zenstate-demo");
const initialState = saved
  ? JSON.parse(saved)
  : {
      user: { name: "Aditya", email: "aditya@zenstate.app" },
      blocks: initialBlocks,
      tasks: initialTasks,
      journal: initialJournal,
      coachPlaying: false,
    };
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
