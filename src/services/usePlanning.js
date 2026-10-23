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
    if (!id || app.state.conversation?.id === id) return;
    let active = true;
    setLoading(true);
    app
      .loadConversation(id)
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const remember = (c) => {
    localStorage.setItem(key, c.id);
    setParams({ conversation: c.id });
  };
  const path = (pathname) =>
    `${pathname}${app.state.conversation ? `?conversation=${app.state.conversation.id}` : ""}`;
  return { ...app, error, setError, loading, remember, path };
}
