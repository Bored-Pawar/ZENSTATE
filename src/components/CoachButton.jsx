import { useEffect, useRef, useState } from "react";
export default function CoachButton({
  text = "",
  compact = false,
  autoPlay = false,
  label = "Hear from Zen",
}) {
  const [status, setStatus] = useState("idle"),
    utterance = useRef(null),
    startTimer = useRef(null);
  const available =
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
  const play = () => {
    if (!available || !text) return;
    clearTimeout(startTimer.current);
    utterance.current = null;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    utterance.current = u;
    const update = (value) => {
      if (utterance.current === u) setStatus(value);
    };
    u.onstart = () => update("playing");
    u.onpause = () => update("paused");
    u.onresume = () => update("playing");
    u.onend = () => update("idle");
    u.onerror = (event) =>
      update(
        ["interrupted", "canceled"].includes(event.error) ? "idle" : "blocked",
      );
    setStatus("starting");
    window.speechSynthesis.speak(u);
    startTimer.current = window.setTimeout(() => {
      if (utterance.current === u)
        setStatus((s) => (s === "starting" ? "blocked" : s));
    }, 2000);
  };
  useEffect(() => {
    if (autoPlay) play();
    return () => {
      clearTimeout(startTimer.current);
      if (utterance.current) {
        utterance.current = null;
        window.speechSynthesis?.cancel();
      }
    };
  }, [text, autoPlay]);
  const toggle = () => {
    if (status === "playing") {
      window.speechSynthesis.pause();
      setStatus("paused");
    } else if (status === "paused") {
      window.speechSynthesis.resume();
    } else play();
  };
  return (
    <div className="speech-controls">
      <button
        className={`coach-button ${compact ? "compact" : ""}`}
        disabled={!available || !text}
        onClick={toggle}
      >
        <span
          aria-hidden="true"
          className={`sound-wave ${status === "playing" ? "playing" : ""}`}
        >
          {status === "playing" ? "Ⅱ" : "▶"}
        </span>
        {!available
          ? "Speech unavailable"
          : status === "playing"
            ? "Pause Zen"
            : status === "paused"
              ? "Resume Zen"
              : status === "blocked"
                ? "Play message"
                : label}
      </button>
      {["playing", "paused", "starting"].includes(status) && (
        <button
          className="text-link"
          onClick={() => {
            clearTimeout(startTimer.current);
            utterance.current = null;
            window.speechSynthesis.cancel();
            setStatus("idle");
          }}
        >
          Stop
        </button>
      )}
      {status === "blocked" && (
        <small>Automatic speech was blocked. Press Play to listen.</small>
      )}
    </div>
  );
}
