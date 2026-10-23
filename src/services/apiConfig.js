export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
let token = localStorage.getItem("zenstate-token");
export function setToken(value) {
  token = value;
  if (value) localStorage.setItem("zenstate-token", value);
  else localStorage.removeItem("zenstate-token");
}
export const hasToken = () => Boolean(token);
export function normalise(value) {
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === "object") {
    const o = Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalise(v)]),
    );
    if (o._id) {
      o.id = String(o._id);
      delete o._id;
    }
    return o;
  }
  return value;
}
export async function api(path, { method = "GET", body, signal } = {}) {
  const requestToken = token;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error(
      "Cannot reach Zenstate. Start the backend and check your connection.",
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 401 &&
      requestToken === token &&
      !path.startsWith("/auth/")
    )
      window.dispatchEvent(new CustomEvent("zenstate-unauthorised"));
    const error = new Error(
      payload.error?.message || "Could not complete this request.",
    );
    error.status = response.status;
    error.code = payload.error?.code;
    throw error;
  }
  return normalise(payload.data);
}
