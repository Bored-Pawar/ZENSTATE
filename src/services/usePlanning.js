import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
export function usePlanning() {
  const app = useApp(),
    [params, setParams] = useSearchParams(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const key = `zenstate-plan:${app.state.user.id}`,
    id = params.get("conversation") || localStorage.getItem(key);
  useEffect(() => {
    if (!id) {
      if (app.state.conversation?.status === "confirmed") app.resetPlanner();
      return;
    }
    if (app.state.conversation?.id === id) return;
    let active = true;
    setLoading(true);
    app
      .loadConversation(id)
      .then((data) => {
        // Explicit task-linked URLs still open saved reflection/history.
        if (
          active &&
          data?.conversation.status === "confirmed" &&
          !params.get("conversation")
        )
          app.resetPlanner();
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, app.state.conversation?.id]);
  const remember = (c) => {
    if (!c) return;
    localStorage.setItem(key, c.id);
    setParams({ conversation: c.id });
  };
  const path = (pathname) =>
    `${pathname}${app.state.conversation ? `?conversation=${app.state.conversation.id}` : ""}`;
  const clearActivePlan = () => {
    app.resetPlanner();
    setParams({}, { replace: true });
  };
  return { ...app, error, setError, loading, remember, path, clearActivePlan };
}
