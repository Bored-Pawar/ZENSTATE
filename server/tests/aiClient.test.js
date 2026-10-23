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
