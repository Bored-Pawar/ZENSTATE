import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { connectDB } from "../src/config/db.js";
import { Task, Message } from "../src/models/index.js";
// Opt-in live provider smoke test. Uses the existing service, never zenstate_dev.
if (!process.env.AI_API_KEY || process.env.AI_API_KEY.includes("<")) {
  console.log(
    "BLOCKED: set AI_API_KEY in server/.env, then run npm --prefix server run test:groq. No live call or test database was created.",
  );
  process.exitCode = 2;
} else {
  const database = `zenstate_test_groq_${Date.now()}_${process.pid}`;
  const uri = `mongodb://127.0.0.1:27017/${database}`;
  try {
    assert.equal(process.env.AI_PROVIDER, "groq", "Live checker requires Groq");
    assert.equal(
      new URL(process.env.AI_BASE_URL).origin,
      "https://api.groq.com",
      "Live checker requires the official Groq endpoint, not a simulated server",
    );
    const response = await fetch(`${process.env.AI_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200, "Groq model-list request failed");
    assert.ok(
      (await response.json()).data.some((m) => m.id === process.env.AI_MODEL),
      "Configured model is not available for this account",
    );
    await connectDB(uri);
    process.env.JWT_SECRET ||= randomBytes(48).toString("hex");
    const { app } = await import("../src/app.js");
    const data = (r) => {
      assert.ok(
        r.status >= 200 && r.status < 300,
        `API failed (${r.status}, ${r.body.error?.code || "unknown"})`,
      );
      return r.body.data;
    };
    const account = data(
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Live integration verification",
          email: "groq-verification@test.example",
          password: randomBytes(16).toString("hex"),
          timezone: "UTC",
        }),
    );
    const call = (method, url, body) =>
      request(app)
        [method](`/api${url}`)
        .set("Authorization", `Bearer ${account.token}`)
        .send(body);
    const c = data(
      await call("post", "/planner/conversations", {}),
    ).conversation;
    const planned = data(
      await call("post", `/planner/conversations/${c.id}/messages`, {
        content:
          "My goal is to practise React useEffect cleanup. My motivation is confidence in my lab. I have exactly 30 minutes. No deadline. Please prepare the draft for review.",
        clientMessageId: "live-groq-plan-001",
      }),
    );
    assert.equal(planned.conversation.draft.durationMinutes, 30);
    assert.ok(
      planned.conversation.draft.goal && planned.conversation.draft.motivation,
    );
    assert.equal(
      await Message.countDocuments({ conversationId: c.id, role: "assistant" }),
      1,
    );
    assert.equal(
      data(await call("get", `/planner/conversations/${c.id}`)).messages.length,
      2,
    );
    const task = data(
      await call("post", `/planner/conversations/${c.id}/confirm`, {
        draftVersion: planned.conversation.draftVersion,
      }),
    );
    data(
      await call("post", "/notes", {
        taskId: task.id,
        text: "I struggle with useEffect cleanup. I prefer beginning with one small timer cleanup example before bigger exercises.",
      }),
    );
    let latest;
    const end = Date.now() + 65000;
    do {
      await new Promise((r) => setTimeout(r, 300));
      latest = await Task.findById(task.id);
      if (
        latest.contextProcessedVersion === latest.contextVersion &&
        latest.contextProcessingStatus !== "pending"
      )
        break;
    } while (Date.now() < end);
    assert.equal(
      latest.contextProcessingStatus,
      "ready",
      "Live context generation failed or timed out",
    );
    assert.equal(
      latest.messageStatus,
      "ready",
      "Template fallback is not a live AI success",
    );
    assert.equal(latest.contextProcessedVersion, latest.contextVersion);
    assert.match(
      latest.importantContext,
      /cleanup/i,
      "Latest note difficulty missing from AI context",
    );
    assert.ok(latest.motivationalMessage.length >= 10);
    console.log(
      "PASS: genuine Groq planning, persisted user/assistant conversation, explicit held confirmation, and note-derived current AI context/motivation. No template counted as live success.",
    );
  } catch (error) {
    console.error(
      `Live Groq verification failed (${error.name}). Check key/model access, network, and AI_RETRY/template status. No secrets are printed.`,
    );
    process.exitCode = 1;
  } finally {
    if (
      mongoose.connection.name === database &&
      /^zenstate_test_groq_\d+_\d+$/.test(database)
    )
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
