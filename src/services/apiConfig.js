// Replace VITE_MOCK_API_URL in .env with your MockAPI project URL later.
export const API_BASE_URL = import.meta.env.VITE_MOCK_API_URL || "";

const wait = (payload) =>
  new Promise((resolve) => window.setTimeout(() => resolve(payload), 550));

export async function mockRequest(resource, fallback) {
  if (!API_BASE_URL) return wait({ ...fallback, source: "local demo" });

  try {
    const response = await fetch(`${API_BASE_URL}/${resource}`);
    if (!response.ok) throw new Error("Mock API request failed");
    return { ...(await response.json()), source: "MockAPI" };
  } catch {
    return wait({ ...fallback, source: "local demo fallback" });
  }
}
