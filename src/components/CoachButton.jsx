import { useApp } from "../context/AppContext";
export default function CoachButton({ compact = false }) {
  const { state, dispatch } = useApp();
  const toggle = () =>
    dispatch({ type: "SET_COACH", value: !state.coachPlaying });
  return (
    <button
      className={`coach-button ${compact ? "compact" : ""}`}
      onClick={toggle}
    >
      <span
        className={state.coachPlaying ? "sound-wave playing" : "sound-wave"}
      >
        {state.coachPlaying ? "❚❚" : "▶"}
      </span>
      <span>
        {state.coachPlaying ? "Coach message playing" : "Hear from Zen"}
      </span>
    </button>
  );
}
