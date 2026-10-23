import test from "node:test";
import assert from "node:assert/strict";
import { callAI } from "../src/services/aiClient.js";
test("provider adapter validates JSON, handles timeout and keeps secrets out of user errors", async () => {
  const previous = {
    key: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    provider: process.env.AI_PROVIDER,
  };
  process.env.AI_API_KEY = "test-only-key";
  process.env.AI_MODEL = "test-model";
  process.env.AI_PROVIDER = "groq";
  try {
    let captured;
    const result = await callAI(
      { messages: [{ role: "user", content: "Test" }] },
      async (url, options) => {
        captured = { url, options };
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"reply":"Hello"}' } }],
          }),
        );
      },
    );
    assert.equal(result.reply, "Hello");
    assert.equal(JSON.parse(captured.options.body).model, "test-model");
    assert.ok(captured.options.signal instanceof AbortSignal);
    await assert.rejects(
      callAI({ messages: [] }, async () => {
        throw new DOMException("test-only-key", "TimeoutError");
      }),
      (e) => e.status === 502 && !e.message.includes("test-only-key"),
    );
    await assert.rejects(
      callAI(
        { messages: [] },
        async () =>
          new Response(
            JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
          ),
      ),
      (e) => e.status === 502,
    );
  } finally {
    for (const [name, value] of [
      ["AI_API_KEY", previous.key],
      ["AI_MODEL", previous.model],
      ["AI_PROVIDER", previous.provider],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("multiple keys rotate between calls and fail over on 429", async () => {
  const saved = ["AI_API_KEYS", "AI_API_KEY", "AI_MODEL", "AI_PROVIDER"].map(
    (n) => [n, process.env[n]],
  );
  process.env.AI_API_KEYS = "key-a, key-b, key-c";
  process.env.AI_MODEL = "test-model";
  process.env.AI_PROVIDER = "groq";
  const ok = () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content: '{"reply":"hi"}' } }] }),
    );
  try {
    const used = [];
    for (let i = 0; i < 12; i++)
      await callAI({ messages: [] }, async (_url, o) => {
        used.push(o.headers.Authorization);
        return ok();
      });
    assert.equal(new Set(used).size, 3, "all keys are used");

    // key-a rate-limited: the call still succeeds through another key.
    const tried = [];
    const result = await callAI({ messages: [] }, async (_url, o) => {
      tried.push(o.headers.Authorization);
      return o.headers.Authorization.endsWith("key-a")
        ? new Response("{}", { status: 429 })
        : ok();
    });
    assert.equal(result.reply, "hi");
    assert.ok(!tried.at(-1).endsWith("key-a"));

    // every key rejected: normal retryable error, no key in the message.
    await assert.rejects(
      callAI({ messages: [] }, async () => new Response("{}", { status: 401 })),
      (e) => e.status === 502 && !/key-/.test(e.message),
    );
  } finally {
    for (const [n, v] of saved)
      v === undefined ? delete process.env[n] : (process.env[n] = v);
  }
});
