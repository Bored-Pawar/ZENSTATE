import { useState } from "react";
export default function AsyncButton({
  onClick,
  children,
  className = "secondary",
  disabled = false,
  ...buttonProps
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <span className="async-control">
      <button
        {...buttonProps}
        className={className}
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : children}
      </button>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
