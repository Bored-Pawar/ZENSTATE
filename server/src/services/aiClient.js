import { AppError } from "../utils/validation.js";
// The only provider-specific boundary. Business prompts live in other services.

// Several keys can share the request load (AI_API_KEYS=k1,k2,...). The start
// key comes from a rolling hash that is folded forward on every call, so
// consecutive requests land on different keys without a shared counter table.
let rolling = 0;
let calls = 0;
const coolUntil = new Map(); // key -> timestamp until which it is skipped
const COOLDOWN_MS = 60000;
const RETRY_STATUS = new Set([401, 403, 429]);

const keyList = ({ AI_API_KEYS, AI_API_KEY }) =>
  (AI_API_KEYS || AI_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

// Keys in the order to try: rotated to the hashed start, cooled-down keys last.
export function orderKeys(keys, now = Date.now()) {
  calls += 1;
  rolling = (Math.imul(rolling, 31) + calls) >>> 0;
  const start = rolling % keys.length;
  const rotated = [...keys.slice(start), ...keys.slice(0, start)];
  const live = rotated.filter((k) => (coolUntil.get(k) || 0) <= now);
  return [...live, ...rotated.filter((k) => !live.includes(k))];
}

export async function callAI(
  { messages, temperature = 0.3, maxOutputTokens = 800 },
  fetcher = fetch,
) {
  const {
    AI_MODEL,
    AI_BASE_URL = "https://api.groq.com/openai/v1",
    AI_PROVIDER = "groq",
  } = process.env;
  if (AI_PROVIDER !== "groq" && AI_PROVIDER !== "openai-compatible")
    throw new AppError(503, "AI provider is not configured", "AI_UNAVAILABLE");
  const keys = keyList(process.env);
  if (
    !keys.length ||
    keys.some((k) => k.includes("<")) ||
    !AI_MODEL ||
    AI_MODEL.includes("<")
  )
    throw new AppError(
      503,
      "Planning AI is unavailable. Configure AI_API_KEYS (or AI_API_KEY) and AI_MODEL on the server. Your message is saved.",
      "AI_UNAVAILABLE",
    );
  const inputBudget = Math.max(
    6000,
    Number(process.env.AI_INPUT_CHAR_BUDGET) || 24000,
  );
  if (messages.reduce((n, m) => n + m.content.length, 0) > inputBudget) {
    throw new AppError(
      502,
      "This request has too much context. Shorten the draft or ask the server administrator to check the model context budget. Your input is saved.",
      "AI_CONTEXT_LIMIT",
    );
  }
  const body = JSON.stringify({
    model: AI_MODEL,
    ...(AI_MODEL.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" } : {}),
    messages,
    response_format: { type: "json_object" },
    temperature,
    max_tokens: Math.min(
      maxOutputTokens,
      Math.max(100, Number(process.env.AI_MAX_OUTPUT_TOKENS) || 1000),
    ),
  });
  try {
    let response;
    // Move to the next key only when this one is rejected or rate-limited.
    for (const key of orderKeys(keys)) {
      response = await fetcher(
        `${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 20000),
          body,
        },
      );
      if (!RETRY_STATUS.has(response.status)) break;
      coolUntil.set(key, Date.now() + COOLDOWN_MS);
    }
    if (!response.ok) {
      console.error("AI upstream status", response.status);
      throw new Error("Upstream rejected request");
    }
    const raw = await response.text();
    if (raw.length > 100000) throw new Error("AI response too large");
    const content = JSON.parse(raw).choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length > 30000)
      throw new Error("Missing AI response");
    return JSON.parse(content);
  } catch (error) {
    console.error("AI request failed:", error.name);
    throw new AppError(
      502,
      "Zen could not get a valid AI reply. Your input is saved; please retry.",
      "AI_RETRY",
    );
  }
}
