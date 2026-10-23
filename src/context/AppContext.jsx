import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, setToken, hasToken } from "../services/apiConfig";
import { weekStart, localToday, browserZone } from "../services/dates";
const AppContext = createContext();
const empty = {
  user: null,
  tasks: [],
  blocks: [],
  journal: [],
  conversation: null,
  planningTask: null,
  messages: [],
  hasMore: false,
  nextBefore: null,
};
export function AppProvider({ children }) {
  const [state, setState] = useState(empty),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [, setClockTick] = useState(0);
  const generation = useRef(0),
    refreshVersion = useRef(0),
    userRef = useRef(null),
    conversationRequest = useRef(0);
  const logout = () => {
    generation.current++;
    conversationRequest.current++;
    userRef.current = null;
    setToken(null);
    setState(empty);
    setLoading(false);
    setError("");
    window.speechSynthesis?.cancel();
  };
  const refresh = async (user = userRef.current) => {
    if (!user) return;
    const epoch = generation.current,
      sequence = ++refreshVersion.current;
    const [tasks, blocks, journal] = await Promise.all([
      api("/tasks"),
      api(`/schedule?weekStart=${weekStart(user.timezone)}`),
      api("/notes"),
    ]);
    if (epoch === generation.current && sequence === refreshVersion.current)
      setState((s) => ({ ...s, user, tasks, blocks, journal }));
  };
  useEffect(() => {
    let active = true;
    const epoch = generation.current;
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    api("/auth/me")
      .then(async (user) => {
        if (!active || epoch !== generation.current) return;
        userRef.current = user;
        await refresh(user);
      })
      .catch((e) => {
        if (active && epoch === generation.current) {
          if (e.status === 401) logout();
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const on401 = () => {
      logout();
      setError("Your session expired. Please sign in again.");
    };
    window.addEventListener("zenstate-unauthorised", on401);
    return () => window.removeEventListener("zenstate-unauthorised", on401);
  }, []);
  useEffect(() => {
    if (!state.user) return;
    const check = () => {
      const epoch = generation.current;
      setClockTick((t) => t + 1);
      refresh().catch((e) => {
        if (epoch === generation.current) setError(e.message);
      });
    };
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [state.user?.id]);
  const authenticate = async (mode, body) => {
    const epoch = ++generation.current;
    setState(empty);
    userRef.current = null;
    const data = await api(`/auth/${mode}`, { method: "POST", body });
    if (epoch !== generation.current) return;
    setToken(data.token);
    userRef.current = data.user;
    await refresh(data.user);
    setError("");
    return data.user;
  };
  const act = async (path, body, method = "POST") => {
    const epoch = generation.current;
    const result = await api(path, { method, body });
    if (epoch === generation.current) {
      try {
        await refresh();
      } catch (e) {
        if (epoch === generation.current)
          setError(
            `Change saved, but the view could not refresh. ${e.message}`,
          );
      }
    }
    return epoch === generation.current ? result : null;
  };
  const saveUser = async (body, complete = false) => {
    const epoch = generation.current;
    const user = await api(complete ? "/onboarding/complete" : "/users/me", {
      method: complete ? "POST" : "PATCH",
      body,
    });
    if (epoch === generation.current) {
      userRef.current = user;
      await refresh(user);
    }
    return user;
  };
  const resetPlanner = () => {
    conversationRequest.current++;
    if (userRef.current)
      localStorage.removeItem(`zenstate-plan:${userRef.current.id}`);
    setState((s) => ({
      ...s,
      conversation: null,
      planningTask: null,
      messages: [],
      hasMore: false,
      nextBefore: null,
    }));
  };
  const loadConversation = async (id) => {
    const epoch = generation.current,
      sequence = ++conversationRequest.current;
    const data = await api(`/planner/conversations/${id}`);
    if (
      epoch === generation.current &&
      sequence === conversationRequest.current
    )
      setState((s) => ({ ...s, ...data }));
    return epoch === generation.current &&
      sequence === conversationRequest.current
      ? data
      : null;
  };
  const conversationAction = async (path, body, method = "POST") => {
    const epoch = generation.current,
      sequence = ++conversationRequest.current;
    let data;
    try {
      data = await api(path, { method, body });
    } catch (error) {
      if (
        epoch !== generation.current ||
        sequence !== conversationRequest.current
      )
        return null;
      throw error;
    }
    if (
      epoch === generation.current &&
      sequence === conversationRequest.current
    )
      setState((s) => ({ ...s, ...data }));
    return epoch === generation.current &&
      sequence === conversationRequest.current
      ? data
      : null;
  };
  const setConversation = (data) => setState((s) => ({ ...s, ...data }));
  const zone = state.user?.timezone || browserZone();
  return (
    <AppContext.Provider
      value={{
        state,
        loading,
        error,
        setError,
        logout,
        authenticate,
        refresh,
        act,
        saveUser,
        loadConversation,
        conversationAction,
        setConversation,
        resetPlanner,
        zone,
        today: localToday(zone),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export const useApp = () => useContext(AppContext);
