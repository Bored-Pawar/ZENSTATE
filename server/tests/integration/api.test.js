import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { createServer } from "node:http";
import { connectDB } from "../../src/config/db.js";
import {
  User,
  Task,
  ScheduleBlock,
  Note,
  Conversation,
  Message,
} from "../../src/models/index.js";
import { DateTime } from "../../src/utils/dates.js";
import {
  processContext,
  invalidateContext,
} from "../../src/services/taskContextService.js";
process.env.JWT_SECRET = "test-only-secret-012345678901234567890123456789";
delete process.env.AI_API_KEY;
delete process.env.AI_MODEL;
const { app } = await import("../../src/app.js");
const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? test : test.skip;
let a, b, aid, bid, mockServer;
const tomorrow = DateTime.now().setZone("UTC").plus({ days: 1 }).toISODate();
const at = (hour, date = tomorrow) =>
  `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const call = (token, method, url, body) =>
  request(app)
    [method](`/api${url}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
const ok = (response, status = 200) => {
  assert.equal(response.status, status, JSON.stringify(response.body));
  return response.body.data;
};
suite(
  "REPORT: direct task completion, cancelled sessions, and completed session effort stay distinct",
  async () => {
    const u = ok(
      await request(app).post("/api/auth/register").send({
        name: "Report Student",
        email: "report-states@test.example",
        password: "password123",
        timezone: "UTC",
      }),
      201,
    );
    const start = DateTime.now().toUTC().startOf("week");
    const getReport = async () =>
      ok(
        await call(
          u.token,
          "get",
          `/reports/weekly?weekStart=${start.toISODate()}`,
        ),
      );
    const empty = await getReport();
    assert.equal(empty.completedTasks, 0);
    assert.equal(empty.plannedSessions, 0);
    assert.match(empty.coachText, /No tasks completed and no session data/);
    const tasks = [];
    for (let i = 0; i < 2; i++) {
      const task = ok(
        await call(u.token, "post", "/tasks", {
          title: `Direct completion ${i}`,
          durationMinutes: 60,
        }),
        201,
      );
      tasks.push(task);
      ok(await call(u.token, "post", `/tasks/${task.id}/complete`, {}));
    }
    const direct = await getReport();
    assert.equal(direct.completedTasks, 2);
    assert.equal(direct.plannedSessions, 0);
    assert.equal(direct.completedMinutes, 0);
    assert.match(direct.coachText, /You completed 2 tasks this week/);
    assert.equal(await ScheduleBlock.countDocuments({ userId: u.user.id }), 0);
    const common = { userId: u.user.id, recordType: "session", kind: "task" };
    const cancelled = await ScheduleBlock.create({
      ...common,
      taskId: tasks[0].id,
      title: tasks[0].title,
      startAt: start.toJSDate(),
      endAt: start.plus({ minutes: 60 }).toJSDate(),
      status: "cancelled",
      cancelReason: "task_completed_early",
    });
    assert.equal((await getReport()).plannedSessions, 0);
    const task = ok(
      await call(u.token, "post", "/tasks", {
        title: "Actual session completion",
        durationMinutes: 30,
      }),
      201,
    );
    const session = await ScheduleBlock.create({
      ...common,
      taskId: task.id,
      title: task.title,
      startAt: start.toJSDate(),
      endAt: start.plus({ minutes: 30 }).toJSDate(),
      status: "pending",
    });
    ok(
      await call(
        u.token,
        "post",
        `/schedule/sessions/${session.id}/complete`,
        {},
      ),
    );
    const completed = await getReport();
    assert.equal(completed.completedTasks, 3);
    assert.equal(completed.plannedSessions, 1);
    assert.equal(completed.completedSessions, 1);
    assert.equal(completed.plannedMinutes, 30);
    assert.equal(completed.completedMinutes, 30);
    assert.equal(completed.completionPercent, 100);
    assert.equal(
      (await ScheduleBlock.findById(cancelled.id)).status,
      "cancelled",
    );
  },
);
before(async () => {
  if (!uri) return;
  const database = new URL(uri).pathname.slice(1);
  assert.match(
    database,
    /^zenstate_test_/,
    "Only isolated zenstate_test_* databases may be used",
  );
  await connectDB(uri);
  const u = ok(
    await request(app).post("/api/auth/register").send({
      name: "First Student",
      email: "first@test.example",
      password: "password123",
      timezone: "UTC",
    }),
    201,
  );
  a = u.token;
  aid = u.user.id;
  const v = ok(
    await request(app).post("/api/auth/register").send({
      name: "Other Student",
      email: "other@test.example",
      password: "password123",
      timezone: "UTC",
    }),
    201,
  );
  b = v.token;
  bid = v.user.id;
});
after(async () => {
  if (!uri) return;
  await new Promise((r) => setTimeout(r, 200));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mockServer) await new Promise((r) => mockServer.close(r));
});

suite(
  "PLAN-06: placement changing after review aborts confirmation without orphan task",
  async () => {
    const c = ok(
      await call(a, "post", "/planner/conversations", {}),
      201,
    ).conversation;
    const reviewed = ok(
      await call(a, "patch", `/planner/conversations/${c.id}/draft`, {
        draftVersion: 0,
        updates: {
          goal: "Stale slot",
          motivation: "Test current availability",
          durationMinutes: 60,
          placementMode: "scheduled",
          sessions: [{ startAt: at(18), endAt: at(19) }],
        },
      }),
    ).conversation;
    ok(
      await call(a, "post", "/tasks", {
        title: "Competing current task",
        durationMinutes: 60,
        placementMode: "scheduled",
        sessions: [{ startAt: at(18), endAt: at(19) }],
      }),
      201,
    );
    assert.equal(
      (
        await call(a, "post", `/planner/conversations/${c.id}/confirm`, {
          draftVersion: reviewed.draftVersion,
        })
      ).status,
      409,
    );
    assert.equal(await Task.countDocuments({ sourceConversationId: c.id }), 0);
    assert.equal((await Conversation.findById(c.id)).status, "draft");
  },
);

suite(
  "TIME/TASK: capacity/deadline checks and recurring-vs-dated conflict roll back every day",
  async () => {
    assert.equal(
      (
        await call(a, "post", "/tasks", {
          title: "Too much flexible effort",
          durationMinutes: 1440,
          placementMode: "flexible",
          flexibleDate: tomorrow,
        })
      ).status,
      409,
    );
    assert.equal(
      await Task.countDocuments({
        userId: aid,
        title: "Too much flexible effort",
      }),
      0,
    );
    const deadline = DateTime.fromISO(tomorrow).minus({ days: 1 }).toISODate();
    assert.equal(
      (
        await call(a, "post", "/tasks", {
          title: "Past deadline",
          durationMinutes: 60,
          deadlineDate: deadline,
          placementMode: "scheduled",
          sessions: [{ startAt: at(17), endAt: at(18) }],
        })
      ).status,
      400,
    );
    const count = await ScheduleBlock.countDocuments({ userId: aid });
    assert.equal(
      (
        await call(a, "post", "/schedule/blocks", {
          title: "Conflicts with actual task",
          kind: "fixed",
          daysPreset: "whole",
          startMinute: 18 * 60,
          endMinute: 19 * 60,
        })
      ).status,
      409,
    );
    assert.equal(await ScheduleBlock.countDocuments({ userId: aid }), count);
  },
);

suite(
  "REPORT-03: missed rescheduling preserves the old occurrence and links replacement",
  async () => {
    const t = ok(
      await call(b, "post", "/tasks", {
        title: "Missed effort",
        durationMinutes: 30,
      }),
      201,
    );
    const yesterday = DateTime.now()
      .setZone("UTC")
      .minus({ days: 1 })
      .toISODate();
    const old = await ScheduleBlock.create({
      userId: bid,
      taskId: t.id,
      title: t.title,
      recordType: "session",
      kind: "task",
      startAt: at(12, yesterday),
      endAt: at(12, yesterday).replace("12:00", "12:30"),
      status: "missed",
    });
    ok(
      await call(b, "post", `/tasks/${t.id}/reschedule`, {
        mode: "scheduled",
        date: tomorrow,
      }),
    );
    assert.equal((await ScheduleBlock.findById(old.id)).status, "missed");
    assert.equal(
      (await ScheduleBlock.findById(old.id)).reminderStatus,
      "cancelled",
    );
    const replacement = await ScheduleBlock.findOne({
      taskId: t.id,
      userId: bid,
      status: "pending",
    });
    assert.equal(String(replacement.supersedesSessionId), old.id);
    const oldWeek = DateTime.fromISO(yesterday).startOf("week").toISODate();
    const report = ok(
      await call(b, "get", `/reports/weekly?weekStart=${oldWeek}`),
    );
    assert.ok(report.historicalMissedSessions >= 1);
    assert.ok(report.rescheduledSessions >= 1);
    assert.ok((await ScheduleBlock.findById(old.id)).rescheduledToSessionId);
  },
);
suite(
  "AUTH-01–04: hashing, duplicate/wrong password, reload and isolated tasks",
  async () => {
    const raw = await User.findById(aid).select("+passwordHash");
    assert.notEqual(raw.passwordHash, "password123");
    assert.equal(raw.onboardingCompleted, false);
    assert.equal(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: raw.email, password: "wrongpass" })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(app).post("/api/auth/register").send({
          name: "Duplicate",
          email: raw.email,
          password: "password123",
          timezone: "UTC",
        })
      ).status,
      409,
    );
    const logged = ok(
      await request(app)
        .post("/api/auth/login")
        .send({ email: raw.email, password: "password123" }),
    );
    assert.equal(logged.user.id, aid);
    assert.equal(logged.user.passwordHash, undefined);
    const t = ok(
      await call(a, "post", "/tasks", { title: "Private task" }),
      201,
    );
    assert.equal((await call(b, "get", `/tasks/${t.id}`)).status, 404);
    assert.equal(
      (await call(b, "patch", `/tasks/${t.id}`, { title: "Stolen" })).status,
      404,
    );
    assert.equal(
      (
        await call(b, "post", `/tasks/${t.id}/placement`, {
          placementMode: "held",
        })
      ).status,
      404,
    );
    assert.equal(
      ok(await call(b, "get", "/tasks")).some((item) => item.id === t.id),
      false,
    );
    assert.equal(ok(await call(a, "get", "/auth/me")).id, aid);
  },
);
suite(
  "SETUP/TIME: saved whole-week overnight sleep; conflicting group rolls back; scoped edit/delete",
  async () => {
    const sleep = {
      title: "Sleep",
      kind: "sleep",
      daysPreset: "whole",
      startMinute: 1380,
      endMinute: 420,
      endsNextDay: true,
    };
    const blocks = ok(await call(a, "post", "/schedule/blocks", sleep), 201);
    assert.equal(blocks.length, 7);
    assert.equal(
      ok(await call(a, "post", "/onboarding/complete", {})).onboardingCompleted,
      true,
    );
    const count = await ScheduleBlock.countDocuments({ userId: aid });
    assert.equal(
      (
        await call(a, "post", "/schedule/blocks", {
          ...sleep,
          title: "Collision",
          kind: "fixed",
          startMinute: 360,
          endMinute: 480,
          endsNextDay: false,
          daysPreset: "weekdays",
        })
      ).status,
      409,
    );
    assert.equal(await ScheduleBlock.countDocuments({ userId: aid }), count);
    const one = blocks.find((b) => b.weekday === 1);
    ok(
      await call(a, "patch", `/schedule/blocks/${one.id}`, {
        ...sleep,
        title: "Monday sleep",
        daysPreset: "selected",
        weekday: 1,
        startMinute: 1320,
        scope: "one",
      }),
    );
    assert.equal(
      await ScheduleBlock.countDocuments({
        userId: aid,
        title: "Monday sleep",
      }),
      1,
    );
    const weekend = ok(
      await call(a, "post", "/schedule/blocks", {
        title: "Weekend walk",
        kind: "fixed",
        daysPreset: "weekends",
        startMinute: 600,
        endMinute: 630,
      }),
      201,
    );
    assert.equal(weekend.length, 2);
    ok(
      await call(a, "delete", `/schedule/blocks/${weekend[0].id}?scope=group`),
    );
    assert.equal(
      await ScheduleBlock.countDocuments({
        userId: aid,
        title: "Weekend walk",
      }),
      0,
    );
    const custom = ok(
      await call(a, "post", "/schedule/blocks", {
        title: "Custom",
        kind: "focus",
        daysPreset: "custom",
        days: [2, 4],
        startMinute: 600,
        endMinute: 630,
      }),
      201,
    );
    assert.deepEqual(custom.map((c) => c.weekday).sort(), [2, 4]);
    ok(await call(a, "delete", `/schedule/blocks/${custom[0].id}?scope=one`));
    assert.equal(
      await ScheduleBlock.countDocuments({ userId: aid, title: "Custom" }),
      1,
    );
    ok(await call(a, "delete", `/schedule/blocks/${custom[1].id}?scope=group`));
    const grouped = ok(
      await call(
        a,
        "patch",
        `/schedule/blocks/${blocks.find((b) => b.weekday === 2).id}`,
        { ...sleep, title: "Weekly sleep", scope: "group" },
      ),
    );
    assert.equal(grouped.length, 7);
    assert.equal(
      await ScheduleBlock.countDocuments({
        userId: aid,
        title: "Weekly sleep",
      }),
      7,
    );
  },
);
suite(
  "TASK-01–03: exact 45-minute sessions, conversions and next-day reservation",
  async () => {
    const t = ok(
      await call(a, "post", "/tasks", {
        title: "45 minute effort",
        motivation: "Learn accurately",
        durationMinutes: 45,
      }),
      201,
    );
    ok(
      await call(a, "post", `/tasks/${t.id}/placement`, {
        placementMode: "scheduled",
        sessions: [
          { startAt: at(12), endAt: at(12).replace("12:00", "12:45") },
        ],
      }),
    );
    assert.equal(
      await ScheduleBlock.countDocuments({
        userId: aid,
        taskId: t.id,
        status: "pending",
      }),
      1,
    );
    ok(
      await call(a, "post", `/tasks/${t.id}/placement`, {
        placementMode: "flexible",
        flexibleDate: tomorrow,
      }),
    );
    assert.equal(
      await ScheduleBlock.countDocuments({
        userId: aid,
        taskId: t.id,
        status: "pending",
      }),
      0,
    );
    const av = ok(
      await call(
        a,
        "get",
        `/availability?from=${tomorrow}&to=${tomorrow}&durationMinutes=45`,
      ),
    );
    assert.equal(av[0].reservedMinutes, 45);
    ok(
      await call(a, "post", `/tasks/${t.id}/placement`, {
        placementMode: "held",
      }),
    );
    assert.equal(
      ok(
        await call(a, "get", `/availability?from=${tomorrow}&to=${tomorrow}`),
      )[0].reservedMinutes,
      0,
    );
    ok(await call(a, "patch", `/tasks/${t.id}`, { title: "Renamed" }));
    assert.equal((await Task.findById(t.id)).motivation, "Learn accurately");
  },
);
suite(
  "TIME-07–08: selected dated session move/split preserves total and rejects invalid split",
  async () => {
    const t = ok(
      await call(b, "post", "/tasks", {
        title: "Split work",
        durationMinutes: 60,
        placementMode: "scheduled",
        sessions: [{ startAt: at(12), endAt: at(13) }],
      }),
      201,
    );
    let session = await ScheduleBlock.findOne({ taskId: t.id, userId: bid });
    assert.equal(
      (
        await call(b, "post", `/schedule/blocks/${session.id}/split`, {
          splitAt: at(12),
        })
      ).status,
      400,
    );
    assert.equal(await ScheduleBlock.countDocuments({ taskId: t.id }), 1);
    ok(
      await call(b, "patch", `/schedule/blocks/${session.id}`, {
        startAt: at(13),
        endAt: at(14),
      }),
    );
    session = await ScheduleBlock.findOne({ taskId: t.id, userId: bid });
    const split = ok(
      await call(b, "post", `/schedule/blocks/${session.id}/split`, {
        splitAt: at(13).replace("13:00", "13:30"),
      }),
    );
    assert.equal(split.length, 2);
    assert.equal(
      split.reduce(
        (n, s) => n + (Date.parse(s.endAt) - Date.parse(s.startAt)) / 60000,
        0,
      ),
      60,
    );
    assert.equal(
      split.every((s) => s.taskId === t.id),
      true,
    );
  },
);
suite(
  "TIME: overnight recurring split keeps Sunday/Monday links and total duration",
  async () => {
    const blocks = ok(
      await call(b, "post", "/schedule/blocks", {
        title: "Sunday sleep",
        kind: "sleep",
        weekday: 7,
        startMinute: 1380,
        endMinute: 420,
        endsNextDay: true,
      }),
      201,
    );
    const split = ok(
      await call(b, "post", `/schedule/blocks/${blocks[0].id}/split`, {
        splitMinute: 120,
        scope: "one",
      }),
    );
    assert.deepEqual(
      split.map((s) => s.weekday),
      [7, 1],
    );
    assert.equal(
      split.reduce(
        (n, s) => n + s.endMinute + (s.endsNextDay ? 1440 : 0) - s.startMinute,
        0,
      ),
      480,
    );
  },
);
suite(
  "NOTE/CTX: persisted notes, user separation, edit/delete invalidates old context",
  async () => {
    const t = ok(
      await call(a, "post", "/tasks", { title: "React hooks" }),
      201,
    );
    const n = ok(
      await call(a, "post", "/notes", {
        taskId: t.id,
        text: "useEffect is difficult. Remember cleanup.",
      }),
      201,
    );
    assert.equal(
      ok(await call(a, "get", `/notes?taskId=${t.id}`))[0].text,
      "useEffect is difficult. Remember cleanup.",
    );
    assert.equal(
      (await call(b, "patch", `/notes/${n.id}`, { text: "Stolen" })).status,
      404,
    );
    assert.equal(
      (await call(b, "post", "/notes", { taskId: t.id, text: "Stolen" }))
        .status,
      404,
    );
    await new Promise((r) => setTimeout(r, 350));
    let task = await Task.findById(t.id);
    assert.match(task.motivationalMessage, /useEffect/);
    assert.equal(task.messageStatus, "template");
    ok(
      await call(a, "patch", `/notes/${n.id}`, {
        text: "Now practise routing instead.",
      }),
    );
    await new Promise((r) => setTimeout(r, 350));
    task = await Task.findById(t.id);
    assert.doesNotMatch(task.motivationalMessage, /useEffect/);
    ok(await call(a, "delete", `/notes/${n.id}`));
    await new Promise((r) => setTimeout(r, 350));
    task = await Task.findById(t.id);
    assert.doesNotMatch(task.motivationalMessage, /routing|useEffect/);
    ok(
      await call(a, "post", "/notes", {
        text: "Daily journal: unrelated topic.",
      }),
      201,
    );
    await invalidateContext(aid, t.id);
    await new Promise((r) => setTimeout(r, 350));
    task = await Task.findById(t.id);
    assert.doesNotMatch(task.importantContext, /unrelated topic/);
    const version = task.contextVersion;
    await Task.updateOne(
      { _id: t.id },
      {
        $inc: { contextVersion: 1 },
        $set: { importantContext: "Newer authoritative context" },
      },
    );
    await processContext(aid, t.id, version);
    assert.equal(
      (await Task.findById(t.id)).importantContext,
      "Newer authoritative context",
    );
  },
);
suite(
  "PLAN-04–07: saved failed message retries, versioned draft and concurrent confirmation idempotency",
  async () => {
    const c = ok(
      await call(a, "post", "/planner/conversations", {}),
      201,
    ).conversation;
    const body = {
      content: "Practice React for 45 minutes to prepare for my lab.",
      clientMessageId: "test-retry-message-1",
    };
    assert.equal(
      (await call(a, "post", `/planner/conversations/${c.id}/messages`, body))
        .status,
      503,
    );
    assert.equal(
      await Message.countDocuments({ conversationId: c.id, role: "user" }),
      1,
    );
    assert.equal(
      (await call(a, "post", `/planner/conversations/${c.id}/messages`, body))
        .status,
      503,
    );
    assert.equal(
      await Message.countDocuments({ conversationId: c.id, role: "user" }),
      1,
    );
    assert.equal(
      (await call(b, "get", `/planner/conversations/${c.id}`)).status,
      404,
    );
    const saved = ok(
      await call(a, "patch", `/planner/conversations/${c.id}/draft`, {
        draftVersion: 0,
        updates: {
          goal: "Practice React",
          motivation: "Pass my lab",
          durationMinutes: 45,
          placementMode: "held",
        },
      }),
    );
    assert.equal(
      (
        await call(a, "post", `/planner/conversations/${c.id}/confirm`, {
          draftVersion: 0,
        })
      ).status,
      409,
    );
    const results = await Promise.all([
      call(a, "post", `/planner/conversations/${c.id}/confirm`, {
        draftVersion: saved.conversation.draftVersion,
      }),
      call(a, "post", `/planner/conversations/${c.id}/confirm`, {
        draftVersion: saved.conversation.draftVersion,
      }),
    ]);
    assert.ok(results.some((r) => r.status === 200));
    assert.ok(results.every((r) => [200, 409].includes(r.status)));
    const tasks = [];
    for (const response of results)
      tasks.push(
        ok(
          response.status === 409
            ? await call(a, "post", `/planner/conversations/${c.id}/confirm`, {
                draftVersion: saved.conversation.draftVersion,
              })
            : response,
        ),
      );
    assert.equal(tasks[0].id, tasks[1].id);
    assert.equal(await Task.countDocuments({ sourceConversationId: c.id }), 1);
  },
);
suite(
  "PLAN-01–02,07: simulated Groq-compatible JSON, malformed output and message exactly once",
  async () => {
    let mode = "valid",
      captured;
    const providerRequests = [];
    let releaseOld, notifyOld;
    const oldStarted = new Promise((resolve) => {
      notifyOld = resolve;
    });
    const oldGate = new Promise((resolve) => {
      releaseOld = resolve;
    });
    mockServer = createServer(async (req, res) => {
      let raw = "";
      for await (const c of req) raw += c;
      captured = JSON.parse(raw);
      providerRequests.push(captured);
      res.setHeader("Content-Type", "application/json");
      if (mode === "context") {
        const source = JSON.parse(captured.messages.at(-1).content);
        if (source.title === "Old snapshot") {
          notifyOld();
          await oldGate;
        }
        return res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    context: source.title,
                    message: `Current message for ${source.title}`,
                  }),
                },
              },
            ],
          }),
        );
      }
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  mode === "reflection"
                    ? JSON.stringify({
                        reply:
                          "Try one cleanup example; record what you learn.",
                        draftUpdates: {},
                        readyForReview: false,
                      })
                    : mode === "valid"
                      ? JSON.stringify({
                          reply: "Ready to review your 90-minute task.",
                          draftUpdates: {
                            goal: "Practise React hooks",
                            motivation: "Lab confidence",
                            durationMinutes: 90,
                          },
                          readyForReview: true,
                        })
                      : "{malformed",
              },
            },
          ],
        }),
      );
    });
    await new Promise((r) => mockServer.listen(0, "127.0.0.1", r));
    process.env.AI_BASE_URL = `http://127.0.0.1:${mockServer.address().port}`;
    process.env.AI_API_KEY = "test-only-placeholder";
    process.env.AI_MODEL = "test-model";
    const c = ok(
      await call(b, "post", "/planner/conversations", {}),
      201,
    ).conversation;
    const input = {
      content:
        "Practise React hooks for 1 hour 30 minutes for my lab confidence",
      clientMessageId: "all-essentials-at-once",
    };
    const result = ok(
      await call(b, "post", `/planner/conversations/${c.id}/messages`, input),
    );
    assert.equal(result.conversation.draft.durationMinutes, 90);
    assert.equal(
      providerRequests
        .findLast((r) => r.messages.at(-1).content === input.content)
        .messages.filter((m) => m.content === input.content).length,
      1,
    );
    const corrected = ok(
      await call(b, "patch", `/planner/conversations/${c.id}/draft`, {
        draftVersion: result.conversation.draftVersion,
        updates: { placementMode: "held" },
      }),
    );
    const linked = ok(
      await call(b, "post", `/planner/conversations/${c.id}/confirm`, {
        draftVersion: corrected.conversation.draftVersion,
      }),
    );
    mode = "reflection";
    const reflection = ok(
      await call(b, "post", `/planner/conversations/${c.id}/messages`, {
        content: "Cleanup is still difficult; I prefer one small example.",
        clientMessageId: "linked-task-reflection",
      }),
    );
    assert.equal(reflection.conversation.status, "confirmed");
    assert.equal(reflection.planningTask.id, linked.id);
    assert.equal(await Task.countDocuments({ sourceConversationId: c.id }), 1);
    assert.ok(reflection.planningTask.contextVersion >= 2);
    assert.ok(
      providerRequests
        .findLast(
          (r) =>
            r.messages.at(-1).content ===
            "Cleanup is still difficult; I prefer one small example.",
        )
        .messages.some((m) => m.content.includes("importantContext")),
    );
    mode = "malformed";
    assert.equal(
      (
        await call(b, "post", `/planner/conversations/${c.id}/messages`, {
          content: "Another preference",
          clientMessageId: "malformed-json-retry",
        })
      ).status,
      502,
    );
    assert.equal(
      await Message.countDocuments({
        conversationId: c.id,
        content: "Another preference",
      }),
      1,
    );
    mode = "context";
    const contextTask = await Task.create({
      userId: bid,
      title: "Old snapshot",
      goal: "Goal",
      durationMinutes: 30,
      status: "pending",
      contextVersion: 1,
    });
    const olderJob = processContext(bid, contextTask.id, 1);
    await oldStarted;
    await Task.updateOne(
      { _id: contextTask.id },
      { $set: { title: "New snapshot", contextVersion: 2 } },
    );
    await processContext(bid, contextTask.id, 2);
    releaseOld();
    await olderJob;
    const current = await Task.findById(contextTask.id);
    assert.equal(current.importantContext, "New snapshot");
    assert.equal(current.contextProcessedVersion, 2);
    assert.equal(
      current.motivationalMessage,
      "Current message for New snapshot",
    );
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
  },
);
suite(
  "Sequential overlapping placements: second placement conflicts",
  async () => {
    const [t1, t2] = await Promise.all(
      ["Race A", "Race B"].map((title) =>
        call(a, "post", "/tasks", { title, durationMinutes: 60 }).then((r) =>
          ok(r, 201),
        ),
      ),
    );
    const p = {
      placementMode: "scheduled",
      sessions: [{ startAt: at(15), endAt: at(16) }],
    };
    const responses = [
      await call(a, "post", `/tasks/${t1.id}/placement`, p),
      await call(a, "post", `/tasks/${t2.id}/placement`, p),
    ];
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  },
);
suite(
  "Planning history paginates by owned timestamp/ID without missing messages",
  async () => {
    const c = ok(
      await call(a, "post", "/planner/conversations", {}),
      201,
    ).conversation;
    await Message.insertMany(
      Array.from({ length: 65 }, (_, i) => ({
        userId: aid,
        conversationId: c.id,
        role: i % 2 ? "assistant" : "user",
        content: `History ${i}`,
        status: "responded",
        createdAt: new Date(Date.now() + i),
      })),
    );
    const current = ok(await call(a, "get", `/planner/conversations/${c.id}`));
    assert.equal(current.messages.length, 60);
    assert.equal(current.hasMore, true);
    const older = ok(
      await call(
        a,
        "get",
        `/planner/conversations/${c.id}?before=${current.nextBefore}`,
      ),
    );
    assert.equal(older.messages.length, 5);
    assert.equal(older.hasMore, false);
    assert.equal(
      new Set([...older.messages, ...current.messages].map((m) => m.id)).size,
      65,
    );
    assert.equal(
      (
        await call(
          b,
          "get",
          `/planner/conversations/${c.id}?before=${current.nextBefore}`,
        )
      ).status,
      404,
    );
  },
);
suite(
  "TIME-09: recurring rules repeat next week while dated sessions stay in their real week",
  async () => {
    const week = DateTime.fromISO(tomorrow).startOf("week");
    const current = ok(
      await call(b, "get", `/schedule?weekStart=${week.toISODate()}`),
    );
    const next = ok(
      await call(
        b,
        "get",
        `/schedule?weekStart=${week.plus({ weeks: 1 }).toISODate()}`,
      ),
    );
    assert.ok(current.some((b) => b.recordType === "session"));
    assert.equal(
      next.some((b) => b.recordType === "session"),
      false,
    );
    assert.deepEqual(
      current
        .filter((b) => b.recordType === "recurring")
        .map((b) => b.id)
        .sort(),
      next
        .filter((b) => b.recordType === "recurring")
        .map((b) => b.id)
        .sort(),
    );
  },
);
suite(
  "TASK/REM/REPORT: independent session completion, early completion cancellation, reminder claim/snooze",
  async () => {
    const t = ok(
      await call(a, "post", "/tasks", {
        title: "Reminder effort",
        motivation: "Build lab confidence",
        durationMinutes: 60,
      }),
      201,
    );
    const start = new Date(Date.now() - 60000),
      end = new Date(Date.now() + 29 * 60000);
    const s = await ScheduleBlock.create({
      userId: aid,
      taskId: t.id,
      title: t.title,
      recordType: "session",
      kind: "task",
      startAt: start,
      endAt: end,
      status: "pending",
    });
    const s2 = await ScheduleBlock.create({
      userId: aid,
      taskId: t.id,
      title: t.title,
      recordType: "session",
      kind: "task",
      startAt: new Date(Date.now() + 60 * 60000),
      endAt: new Date(Date.now() + 90 * 60000),
      status: "pending",
    });
    await Task.updateOne(
      { _id: t.id },
      { $set: { placementMode: "scheduled", status: "pending" } },
    );
    const due = ok(await call(a, "get", "/reminders/due"));
    assert.equal(
      due.some((r) => r.id === `session:${s.id}`),
      true,
    );
    const claims = await Promise.all([
      call(a, "post", `/reminders/session:${s.id}/delivered`, {}),
      call(a, "post", `/reminders/session:${s.id}/delivered`, {}),
    ]);
    assert.deepEqual(claims.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      ok(await call(a, "get", "/reminders/due")).some(
        (r) => r.id === `session:${s.id}`,
      ),
      false,
    );
    ok(await call(a, "post", `/reminders/session:${s.id}/snooze`, {}));
    assert.equal(
      (await ScheduleBlock.findById(s.id)).reminderStatus,
      "snoozed",
    );
    await ScheduleBlock.updateOne(
      { _id: s.id },
      { $set: { snoozedUntil: new Date(Date.now() - 1) } },
    );
    assert.equal(
      ok(await call(a, "get", "/reminders/due")).some(
        (r) => r.id === `session:${s.id}`,
      ),
      true,
    );
    const partial = ok(
      await call(a, "post", `/schedule/sessions/${s.id}/complete`, {}),
    );
    assert.equal(partial.status, "in_progress");
    ok(await call(a, "post", `/tasks/${t.id}/complete`, {}));
    assert.equal((await ScheduleBlock.findById(s2.id)).status, "cancelled");
    assert.equal(
      ok(await call(a, "get", `/reminders/session:${s.id}`)).active,
      false,
    );
    const from = DateTime.now().setZone("UTC").startOf("week").toISODate(),
      report = ok(await call(a, "get", `/reports/weekly?weekStart=${from}`));
    assert.ok(report.completedMinutes >= 30);
    assert.match(report.coachText, /Build lab confidence/);
    assert.ok(report.upcomingSessions >= 0);
  },
);

// These tests use real standalone persistence. Only selected writes are faulted
// to exercise recovery; a database outage/crash cannot be made atomic by cleanup.
async function faultOnce(target, method, matches, action) {
  const original = target[method];
  let fired = false;
  target[method] = function (...args) {
    if (!fired && matches.call(this, ...args)) {
      fired = true;
      throw new Error("Injected write failure");
    }
    return original.apply(this, args);
  };
  try {
    await action();
    assert.ok(fired, "Fault must reach the intended write");
  } finally {
    target[method] = original;
  }
}
let recoveryToken, recoveryUser;
suite(
  "STANDALONE: grouped edit/split save failure and partial original deletion restore original IDs",
  async () => {
    const u = ok(
      await request(app).post("/api/auth/register").send({
        name: "Recovery",
        email: "recovery@test.example",
        password: "password123",
        timezone: "UTC",
      }),
      201,
    );
    recoveryToken = u.token;
    recoveryUser = u.user.id;
    const fields = {
      title: "Recovery group",
      kind: "fixed",
      startMinute: 600,
      endMinute: 660,
      daysPreset: "weekdays",
    };
    const original = ok(
      await call(recoveryToken, "post", "/schedule/blocks", fields),
      201,
    );
    const ids = original.map((b) => b.id).sort();
    let saves = 0;
    await faultOnce(
      ScheduleBlock.prototype,
      "save",
      function () {
        return ++saves === 2;
      },
      async () => {
        assert.equal(
          (
            await call(recoveryToken, "patch", `/schedule/blocks/${ids[0]}`, {
              ...fields,
              startMinute: 700,
              endMinute: 760,
              scope: "group",
            })
          ).status,
          500,
        );
      },
    );
    assert.deepEqual(
      (await ScheduleBlock.find({ userId: recoveryUser }).lean())
        .map((b) => String(b._id))
        .sort(),
      ids,
    );
    let deletes = 0;
    await faultOnce(
      ScheduleBlock,
      "deleteOne",
      () => ++deletes === 2,
      async () => {
        assert.equal(
          (
            await call(recoveryToken, "patch", `/schedule/blocks/${ids[0]}`, {
              ...fields,
              startMinute: 700,
              endMinute: 760,
              scope: "group",
            })
          ).status,
          500,
        );
      },
    );
    assert.deepEqual(
      (await ScheduleBlock.find({ userId: recoveryUser }).lean())
        .map((b) => String(b._id))
        .sort(),
      ids,
    );
    saves = 0;
    await faultOnce(
      ScheduleBlock.prototype,
      "save",
      function () {
        return ++saves === 2;
      },
      async () => {
        assert.equal(
          (
            await call(
              recoveryToken,
              "post",
              `/schedule/blocks/${ids[0]}/split`,
              { splitMinute: 630, scope: "group" },
            )
          ).status,
          500,
        );
      },
    );
    assert.deepEqual(
      (await ScheduleBlock.find({ userId: recoveryUser }).lean())
        .map((b) => String(b._id))
        .sort(),
      ids,
    );
    ok(
      await call(
        recoveryToken,
        "delete",
        `/schedule/blocks/${ids[0]}?scope=group`,
      ),
    );
  },
);
suite(
  "STANDALONE: failed replacement/split/conversion keeps original placement, then all modes convert",
  async () => {
    const token = recoveryToken;
    const task = ok(
      await call(token, "post", "/tasks", {
        title: "Placement recovery",
        durationMinutes: 60,
        placementMode: "scheduled",
        sessions: [{ startAt: at(8), endAt: at(9) }],
      }),
      201,
    );
    const original = await ScheduleBlock.findOne({
      taskId: task.id,
      status: "pending",
    }).lean();
    await faultOnce(
      ScheduleBlock,
      "updateOne",
      (filter) => String(filter._id) === String(original._id),
      async () => {
        assert.equal(
          (
            await call(token, "post", `/tasks/${task.id}/placement`, {
              placementMode: "flexible",
              flexibleDate: tomorrow,
            })
          ).status,
          500,
        );
      },
    );
    assert.equal((await Task.findById(task.id)).placementMode, "scheduled");
    assert.equal(
      (await ScheduleBlock.findById(original._id)).status,
      "pending",
    );
    await faultOnce(
      Task.prototype,
      "save",
      function () {
        return String(this._id) === task.id;
      },
      async () => {
        assert.equal(
          (
            await call(token, "post", `/tasks/${task.id}/placement`, {
              placementMode: "scheduled",
              sessions: [{ startAt: at(13), endAt: at(14) }],
            })
          ).status,
          500,
        );
      },
    );
    assert.equal(await ScheduleBlock.countDocuments({ taskId: task.id }), 1);
    assert.equal(
      (await ScheduleBlock.findById(original._id)).status,
      "pending",
    );
    assert.equal((await Task.findById(task.id)).placementMode, "scheduled");
    let saves = 0;
    await faultOnce(
      ScheduleBlock.prototype,
      "save",
      function () {
        return ++saves === 2;
      },
      async () => {
        assert.equal(
          (
            await call(
              token,
              "post",
              `/schedule/blocks/${original._id}/split`,
              { splitAt: at(8).replace("08:00", "08:30") },
            )
          ).status,
          500,
        );
      },
    );
    assert.equal(await ScheduleBlock.countDocuments({ taskId: task.id }), 1);
    await faultOnce(
      Task.prototype,
      "save",
      function () {
        return String(this._id) === task.id;
      },
      async () => {
        assert.equal(
          (
            await call(token, "post", `/tasks/${task.id}/placement`, {
              placementMode: "held",
            })
          ).status,
          500,
        );
      },
    );
    assert.equal(
      (await ScheduleBlock.findById(original._id)).status,
      "pending",
    );
    ok(
      await call(token, "post", `/tasks/${task.id}/placement`, {
        placementMode: "held",
      }),
    );
    ok(
      await call(token, "post", `/tasks/${task.id}/placement`, {
        placementMode: "flexible",
        flexibleDate: tomorrow,
      }),
    );
    ok(
      await call(token, "post", `/tasks/${task.id}/placement`, {
        placementMode: "scheduled",
        sessions: [{ startAt: at(13), endAt: at(14) }],
      }),
    );
    assert.equal((await Task.findById(task.id)).flexibleDate, null);
    assert.equal(
      await ScheduleBlock.countDocuments({
        taskId: task.id,
        status: "pending",
      }),
      1,
    );
  },
);
suite(
  "STANDALONE: confirmation link retry reuses ready task; failed placement removes new task",
  async () => {
    const c = ok(
      await call(recoveryToken, "post", "/planner/conversations", {}),
      201,
    ).conversation;
    const draft = ok(
      await call(
        recoveryToken,
        "patch",
        `/planner/conversations/${c.id}/draft`,
        {
          draftVersion: 0,
          updates: {
            goal: "Recovery plan",
            motivation: "Lab",
            durationMinutes: 30,
            placementMode: "held",
          },
        },
      ),
    ).conversation;
    await faultOnce(
      Conversation,
      "findOneAndUpdate",
      (filter, update) => update.$set?.status === "confirmed",
      async () => {
        assert.equal(
          (
            await call(
              recoveryToken,
              "post",
              `/planner/conversations/${c.id}/confirm`,
              { draftVersion: draft.draftVersion },
            )
          ).status,
          500,
        );
      },
    );
    const pending = await Task.findOne({ sourceConversationId: c.id });
    assert.equal(pending.planConfirmationReady, true);
    const retry = ok(
      await call(
        recoveryToken,
        "post",
        `/planner/conversations/${c.id}/confirm`,
        { draftVersion: draft.draftVersion },
      ),
    );
    assert.equal(retry.id, String(pending._id));
    assert.equal(await Task.countDocuments({ sourceConversationId: c.id }), 1);
    const c2 = ok(
      await call(recoveryToken, "post", "/planner/conversations", {}),
      201,
    ).conversation;
    const d2 = ok(
      await call(
        recoveryToken,
        "patch",
        `/planner/conversations/${c2.id}/draft`,
        {
          draftVersion: 0,
          updates: {
            goal: "Failed placement",
            motivation: "Lab",
            durationMinutes: 30,
            placementMode: "held",
          },
        },
      ),
    ).conversation;
    await faultOnce(
      Task.prototype,
      "save",
      function () {
        return !this.isNew && String(this.sourceConversationId) === c2.id;
      },
      async () => {
        assert.equal(
          (
            await call(
              recoveryToken,
              "post",
              `/planner/conversations/${c2.id}/confirm`,
              { draftVersion: d2.draftVersion },
            )
          ).status,
          500,
        );
      },
    );
    assert.equal(await Task.countDocuments({ sourceConversationId: c2.id }), 0);
    assert.equal((await Conversation.findById(c2.id)).status, "draft");
  },
);
suite(
  "STANDALONE: saved session progress and early completion cleanup repair on retry; deletion is retryable",
  async () => {
    const task = ok(
      await call(recoveryToken, "post", "/tasks", {
        title: "Progress recovery",
        durationMinutes: 60,
      }),
      201,
    );
    const session = await ScheduleBlock.create({
      userId: recoveryUser,
      taskId: task.id,
      recordType: "session",
      kind: "task",
      title: task.title,
      startAt: new Date(Date.now() - 1800000),
      endAt: new Date(),
      status: "pending",
    });
    await faultOnce(
      Task.prototype,
      "save",
      function () {
        return String(this._id) === task.id;
      },
      async () => {
        const r = await call(
          recoveryToken,
          "post",
          `/schedule/sessions/${session._id}/complete`,
          {},
        );
        assert.equal(r.status, 503);
        assert.equal(r.body.error.code, "SESSION_COMPLETION_SAVED");
      },
    );
    assert.equal(
      (await ScheduleBlock.findById(session._id)).status,
      "completed",
    );
    assert.equal(
      ok(
        await call(
          recoveryToken,
          "post",
          `/schedule/sessions/${session._id}/complete`,
          {},
        ),
      ).status,
      "in_progress",
    );
    assert.equal(
      ok(
        await call(
          recoveryToken,
          "post",
          `/schedule/sessions/${session._id}/complete`,
          {},
        ),
      ).status,
      "in_progress",
    );
    await ScheduleBlock.create({
      userId: recoveryUser,
      taskId: task.id,
      recordType: "session",
      kind: "task",
      title: task.title,
      startAt: at(17),
      endAt: at(17).replace("17:00", "17:30"),
      status: "pending",
    });
    await faultOnce(
      ScheduleBlock,
      "updateMany",
      (filter) => !!filter.taskId,
      async () => {
        const r = await call(
          recoveryToken,
          "post",
          `/tasks/${task.id}/complete`,
          {},
        );
        assert.equal(r.status, 503);
        assert.equal(r.body.error.code, "COMPLETION_SAVED");
      },
    );
    assert.equal((await Task.findById(task.id)).status, "completed");
    ok(await call(recoveryToken, "post", `/tasks/${task.id}/complete`, {}));
    assert.equal(
      await ScheduleBlock.countDocuments({
        taskId: task.id,
        status: "pending",
      }),
      0,
    );
    const note = ok(
      await call(recoveryToken, "post", "/notes", {
        taskId: task.id,
        text: "Delete deliberately",
      }),
      201,
    );
    await faultOnce(
      ScheduleBlock,
      "deleteMany",
      (filter) => String(filter.taskId) === task.id,
      async () => {
        const r = await call(recoveryToken, "delete", `/tasks/${task.id}`);
        assert.equal(r.status, 503);
        assert.equal(r.body.error.code, "PARTIAL_DELETE");
      },
    );
    assert.ok(await Task.exists({ _id: task.id }));
    assert.equal(await Note.exists({ _id: note.id }), null); // Documented partial delete, not a rollback claim.
    ok(await call(recoveryToken, "delete", `/tasks/${task.id}`));
    assert.equal(await Task.exists({ _id: task.id }), null);
    assert.equal(await ScheduleBlock.countDocuments({ taskId: task.id }), 0);
  },
);
suite(
  "STANDALONE: failed assistant save restores draft; retry after status failure reuses saved reply",
  async () => {
    const server = createServer(async (req, res) => {
      for await (const chunk of req) {
        /* consume request */
      }
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "Ready to review.",
                  draftUpdates: {
                    goal: "Small goal",
                    motivation: "Lab",
                    durationMinutes: 30,
                  },
                  readyForReview: true,
                }),
              },
            },
          ],
        }),
      );
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const previous = {
      url: process.env.AI_BASE_URL,
      key: process.env.AI_API_KEY,
      model: process.env.AI_MODEL,
    };
    process.env.AI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.AI_API_KEY = "test-only";
    process.env.AI_MODEL = "test-model";
    try {
      const c = ok(
        await call(recoveryToken, "post", "/planner/conversations", {}),
        201,
      ).conversation;
      const input = {
        content: "Plan 30 minutes for my lab",
        clientMessageId: "partial-reply-test",
      };
      await faultOnce(
        Message,
        "create",
        (fields) => fields.role === "assistant",
        async () => {
          assert.equal(
            (
              await call(
                recoveryToken,
                "post",
                `/planner/conversations/${c.id}/messages`,
                input,
              )
            ).status,
            500,
          );
        },
      );
      assert.equal((await Conversation.findById(c.id)).draftVersion, 0);
      await faultOnce(
        Message,
        "updateOne",
        (filter, update) => update.$set?.status === "responded",
        async () => {
          assert.equal(
            (
              await call(
                recoveryToken,
                "post",
                `/planner/conversations/${c.id}/messages`,
                input,
              )
            ).status,
            500,
          );
        },
      );
      const retry = ok(
        await call(
          recoveryToken,
          "post",
          `/planner/conversations/${c.id}/messages`,
          input,
        ),
      );
      assert.equal(retry.conversation.draftVersion, 1);
      assert.equal(
        await Message.countDocuments({
          conversationId: c.id,
          role: "assistant",
        }),
        1,
      );
      assert.equal(
        await Message.countDocuments({ conversationId: c.id, role: "user" }),
        1,
      );
    } finally {
      for (const [key, value] of [
        ["AI_BASE_URL", previous.url],
        ["AI_API_KEY", previous.key],
        ["AI_MODEL", previous.model],
      ]) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await new Promise((r) => server.close(r));
    }
  },
);

suite(
  "STABILITY: metadata/no-op edits preserve task placement, prepared message, notes and completion state",
  async () => {
    const t = ok(
      await call(recoveryToken, "post", "/tasks", {
        title: "Metadata stability",
        motivation: "Keep this reason",
        durationMinutes: 30,
      }),
      201,
    );
    const n = ok(
      await call(recoveryToken, "post", "/notes", {
        taskId: t.id,
        text: "Keep this note",
      }),
      201,
    );
    await new Promise((r) => setTimeout(r, 350));
    await Task.updateOne(
      { _id: t.id },
      {
        $set: {
          motivationalMessage: "Prepared message stays available",
          messageStatus: "ready",
        },
      },
    );
    const before = await Task.findById(t.id);
    for (const body of [
      { priority: "high" },
      { priority: "high" },
      { category: "Lab", journalEnabled: false },
    ]) {
      const saved = ok(
        await call(recoveryToken, "patch", `/tasks/${t.id}`, body),
      );
      assert.equal(saved.id, t.id);
      assert.equal(saved.placementMode, "held");
      assert.equal(saved.status, "held");
      assert.equal(
        saved.motivationalMessage,
        "Prepared message stays available",
      );
      assert.equal(saved.contextVersion, before.contextVersion);
    }
    const renamed = ok(
      await call(recoveryToken, "patch", `/tasks/${t.id}`, {
        title: "Renamed metadata stability",
      }),
    );
    assert.equal(
      renamed.motivationalMessage,
      "Prepared message stays available",
    );
    assert.equal(await Note.countDocuments({ _id: n.id, taskId: t.id }), 1);
    assert.equal(await Task.countDocuments({ _id: t.id }), 1);
    assert.equal(
      (
        await call(recoveryToken, "patch", `/tasks/${t.id}`, {
          status: "completed",
        })
      ).status,
      400,
    );
  },
);
suite(
  "STABILITY: upcoming move keeps ID, duration and reminder retry state; errors leave placement intact",
  async () => {
    const user = ok(
      await request(app).post("/api/auth/register").send({
        name: "Move checks",
        email: "move-stability@test.example",
        password: "password123",
        timezone: "UTC",
      }),
      201,
    );
    const token = user.token,
      uid = user.user.id;
    const t = ok(
      await call(token, "post", "/tasks", {
        title: "Future move",
        durationMinutes: 60,
        placementMode: "scheduled",
        sessions: [{ startAt: at(9), endAt: at(10) }],
      }),
      201,
    );
    const old = await ScheduleBlock.findOne({ taskId: t.id });
    await ScheduleBlock.updateOne(
      { _id: old._id },
      { $set: { reminderStatus: "delivered", snoozedUntil: new Date() } },
    );
    const move = { startAt: at(11), endAt: at(12) };
    const moved = ok(
      await call(token, "patch", `/schedule/blocks/${old.id}`, move),
    )[0];
    assert.equal(moved.id, old.id);
    assert.equal(
      ok(await call(token, "get", `/reminders/session:${old.id}`)).startAt,
      move.startAt,
    );
    assert.equal(moved.reminderStatus, "pending");
    assert.equal(moved.snoozedUntil, null);
    await ScheduleBlock.updateOne(
      { _id: old._id },
      { $set: { reminderStatus: "delivered" } },
    );
    assert.equal(
      ok(await call(token, "patch", `/schedule/blocks/${old.id}`, move))[0]
        .reminderStatus,
      "delivered",
    );
    assert.equal(await ScheduleBlock.countDocuments({ taskId: t.id }), 1);
    for (const [body, code] of [
      [{ startAt: at(11), endAt: at(13) }, "INVALID_DURATION"],
      [
        {
          startAt: new Date(Date.now() - 7200000).toISOString(),
          endAt: new Date(Date.now() - 3600000).toISOString(),
        },
        "PAST_TIME",
      ],
    ]) {
      const r = await call(token, "patch", `/schedule/blocks/${old.id}`, body);
      assert.equal(r.body.error.code, code);
    }
    ok(
      await call(token, "post", "/schedule/blocks", {
        title: "Commitment",
        kind: "fixed",
        weekday: DateTime.fromISO(tomorrow).weekday,
        startMinute: 780,
        endMinute: 840,
      }),
      201,
    );
    assert.equal(
      (
        await call(token, "patch", `/schedule/blocks/${old.id}`, {
          startAt: at(13),
          endAt: at(14),
        })
      ).body.error.code,
      "SCHEDULE_CONFLICT",
    );
    await Task.updateOne({ _id: t.id }, { $set: { deadlineDate: tomorrow } });
    const later = DateTime.fromISO(tomorrow).plus({ days: 1 }).toISODate();
    assert.equal(
      (
        await call(token, "patch", `/schedule/blocks/${old.id}`, {
          startAt: at(11, later),
          endAt: at(12, later),
        })
      ).body.error.code,
      "DEADLINE_VIOLATION",
    );
    assert.equal(
      +(await ScheduleBlock.findById(old.id)).startAt,
      +new Date(move.startAt),
    );
    assert.equal(
      (
        await call(token, "post", `/schedule/blocks/${old.id}/split`, {
          splitAt: at(12),
        })
      ).body.error.code,
      "INVALID_SPLIT",
    );
    const split = ok(
      await call(token, "post", `/schedule/blocks/${old.id}/split`, {
        splitAt: at(11).replace("11:00", "11:30"),
      }),
    );
    assert.equal(
      split.reduce(
        (n, s) => n + (Date.parse(s.endAt) - Date.parse(s.startAt)) / 60000,
        0,
      ),
      60,
    );
    assert.ok(
      split.every((s) => s.taskId === t.id && s.reminderStatus === "pending"),
    );
  },
);
suite(
  "STABILITY: started/missed reschedule retains history and completed effort; repeated requests make one replacement",
  async () => {
    const user = ok(
      await request(app).post("/api/auth/register").send({
        name: "History checks",
        email: "history-stability@test.example",
        password: "password123",
        timezone: "UTC",
      }),
      201,
    );
    for (const missed of [false, true]) {
      const t = ok(
        await call(user.token, "post", "/tasks", {
          title: missed ? "Missed move" : "Started move",
          motivation: "Keep motivation",
          durationMinutes: 60,
        }),
        201,
      );
      await Task.updateOne(
        { _id: t.id },
        { $set: { placementMode: "scheduled", status: "in_progress" } },
      );
      await ScheduleBlock.create({
        userId: user.user.id,
        taskId: t.id,
        recordType: "session",
        kind: "task",
        title: t.title,
        startAt: new Date(Date.now() - 7200000),
        endAt: new Date(Date.now() - 5400000),
        status: "completed",
      });
      const source = await ScheduleBlock.create({
        userId: user.user.id,
        taskId: t.id,
        recordType: "session",
        kind: "task",
        title: t.title,
        startAt: new Date(Date.now() - (missed ? 3600000 : 60000)),
        endAt: new Date(Date.now() + (missed ? -1800000 : 1740000)),
        status: missed ? "missed" : "pending",
        reminderStatus: "snoozed",
        snoozedUntil: new Date(),
      });
      const note = ok(
        await call(user.token, "post", "/notes", {
          taskId: t.id,
          text: "Preserved task note",
        }),
        201,
      );
      await new Promise((r) => setTimeout(r, 350));
      const before = await Task.findById(t.id);
      const hour = missed ? 16 : 14;
      const body = {
        startAt: at(hour),
        endAt: at(hour).replace(":00:", ":30:"),
      };
      const responses = await Promise.all([
        call(user.token, "patch", `/schedule/blocks/${source.id}`, body),
        call(user.token, "patch", `/schedule/blocks/${source.id}`, body),
      ]);
      const first = ok(responses[0])[0],
        second = ok(responses[1])[0];
      assert.equal(first.id, second.id);
      const original = await ScheduleBlock.findById(source.id);
      assert.equal(original.status, missed ? "missed" : "pending");
      assert.equal(String(original.rescheduledToSessionId), first.id);
      assert.equal(original.reminderStatus, "cancelled");
      assert.equal(first.supersedesSessionId, source.id);
      assert.equal(
        await ScheduleBlock.countDocuments({ rescheduleSourceId: source.id }),
        1,
      );
      assert.equal(
        ok(await call(user.token, "get", `/reminders/session:${source.id}`))
          .active,
        false,
      );
      assert.equal(
        (
          await call(
            user.token,
            "post",
            `/schedule/sessions/${source.id}/complete`,
            {},
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            user.token,
            "post",
            `/schedule/blocks/${source.id}/split`,
            { splitAt: source.endAt.toISOString() },
          )
        ).status,
        409,
      );
      const after = await Task.findById(t.id);
      assert.equal(after.contextVersion, before.contextVersion);
      assert.equal(after.motivation, before.motivation);
      assert.equal(after.status, "in_progress");
      assert.ok(await Note.exists({ _id: note.id, taskId: t.id }));
      const listed = ok(await call(user.token, "get", "/tasks")).find(
        (x) => x.id === t.id,
      );
      assert.equal(listed.completedPlannedMinutes, 30);
      const schedule = ok(
        await call(
          user.token,
          "get",
          `/schedule?weekStart=${DateTime.now().setZone("UTC").startOf("week").toISODate()}`,
        ),
      );
      assert.ok(schedule.some((s) => s.id === source.id));
    }
  },
);
suite(
  "STABILITY: interrupted reschedule link is repairable, and early completion retains cancelled calendar records",
  async () => {
    const t = ok(
      await call(recoveryToken, "post", "/tasks", {
        title: "Link retry",
        durationMinutes: 30,
      }),
      201,
    );
    await Task.updateOne(
      { _id: t.id },
      { $set: { placementMode: "scheduled", status: "pending" } },
    );
    const source = await ScheduleBlock.create({
      userId: recoveryUser,
      taskId: t.id,
      recordType: "session",
      kind: "task",
      title: t.title,
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() - 1800000),
      status: "missed",
    });
    const move = { startAt: at(18), endAt: at(18).replace("18:00", "18:30") };
    await faultOnce(
      ScheduleBlock,
      "updateOne",
      (filter, update) => !!update.$set?.rescheduledToSessionId,
      async () => {
        const r = await call(
          recoveryToken,
          "patch",
          `/schedule/blocks/${source.id}`,
          move,
        );
        assert.equal(r.status, 503);
        assert.equal(r.body.error.code, "RESCHEDULE_SAVED");
      },
    );
    const result = ok(
      await call(recoveryToken, "patch", `/schedule/blocks/${source.id}`, move),
    )[0];
    assert.equal(
      await ScheduleBlock.countDocuments({ rescheduleSourceId: source.id }),
      1,
    );
    ok(await call(recoveryToken, "post", `/tasks/${t.id}/complete`, {}));
    const replacement = await ScheduleBlock.findById(result.id);
    assert.equal(replacement.status, "cancelled");
    assert.equal(replacement.cancelReason, "task_completed_early");
    const week = DateTime.fromISO(tomorrow).startOf("week").toISODate();
    const blocks = ok(
      await call(recoveryToken, "get", `/schedule?weekStart=${week}`),
    );
    assert.ok(
      blocks.some((s) => s.id === result.id && s.status === "cancelled"),
    );
    assert.equal(
      ok(await call(recoveryToken, "get", `/reminders/session:${result.id}`))
        .active,
      false,
    );
    assert.equal(
      (
        await call(
          recoveryToken,
          "patch",
          `/schedule/blocks/${result.id}`,
          move,
        )
      ).status,
      409,
    );
  },
);
suite(
  "STABILITY: confirmed drafts stay read-only while repeated/lost-response confirmation returns saved task",
  async () => {
    const c = ok(
      await call(recoveryToken, "post", "/planner/conversations", {}),
      201,
    ).conversation;
    const draft = ok(
      await call(
        recoveryToken,
        "patch",
        `/planner/conversations/${c.id}/draft`,
        {
          draftVersion: 0,
          updates: {
            goal: "Lifecycle check",
            motivation: "One task only",
            durationMinutes: 30,
            placementMode: "held",
          },
        },
      ),
    ).conversation;
    const original = ok(
      await call(
        recoveryToken,
        "post",
        `/planner/conversations/${c.id}/confirm`,
        { draftVersion: draft.draftVersion },
      ),
    );
    const retry = ok(
      await call(
        recoveryToken,
        "post",
        `/planner/conversations/${c.id}/confirm`,
        { draftVersion: 0 },
      ),
    );
    assert.equal(retry.id, original.id);
    assert.equal(
      (
        await call(
          recoveryToken,
          "patch",
          `/planner/conversations/${c.id}/draft`,
          {
            draftVersion: draft.draftVersion,
            updates: { goal: "Must not become another task" },
          },
        )
      ).status,
      409,
    );
    assert.equal(await Task.countDocuments({ sourceConversationId: c.id }), 1);
    const saved = ok(
      await call(recoveryToken, "get", `/planner/conversations/${c.id}`),
    );
    assert.equal(saved.planningTask.id, original.id);
  },
);

suite(
  "STABILITY: legacy replacement links are recognised across weeks without rewriting saved history",
  async () => {
    const u = ok(
      await request(app).post("/api/auth/register").send({
        name: "Legacy history",
        email: "legacy-history@test.example",
        password: "password123",
        timezone: "UTC",
      }),
      201,
    );
    const t = ok(
      await call(u.token, "post", "/tasks", {
        title: "Existing linked history",
        durationMinutes: 30,
      }),
      201,
    );
    await Task.updateOne(
      { _id: t.id },
      { $set: { placementMode: "scheduled", status: "pending" } },
    );
    const oldDate = DateTime.now().toUTC().minus({ days: 8 }).toISODate();
    const common = {
      userId: u.user.id,
      taskId: t.id,
      recordType: "session",
      kind: "task",
      title: t.title,
    };
    const source = await ScheduleBlock.create({
      ...common,
      startAt: at(9, oldDate),
      endAt: at(9, oldDate).replace("09:00", "09:30"),
      status: "missed",
      reminderStatus: "cancelled",
    });
    const replacement = await ScheduleBlock.create({
      ...common,
      startAt: at(9),
      endAt: at(9).replace("09:00", "09:30"),
      status: "pending",
      supersedesSessionId: source._id,
    });
    const detail = ok(await call(u.token, "get", `/tasks/${t.id}`));
    assert.equal(
      String(
        detail.sessions.find((s) => s.id === source.id).rescheduledToSessionId,
      ),
      replacement.id,
    );
    const week = DateTime.fromISO(oldDate).startOf("week").toISODate();
    const report = ok(
      await call(u.token, "get", `/reports/weekly?weekStart=${week}`),
    );
    assert.equal(report.plannedSessions, 0);
    assert.equal(report.rescheduledSessions, 1);
    assert.equal(report.historicalMissedSessions, 1);
    const blocks = ok(
      await call(u.token, "get", `/schedule?weekStart=${week}`),
    );
    assert.equal(
      String(
        blocks.find((s) => String(s.id || s._id) === source.id)
          .rescheduledToSessionId,
      ),
      replacement.id,
    );
    assert.equal(
      (await ScheduleBlock.findById(source.id)).rescheduledToSessionId,
      undefined,
      "Read compatibility must not migrate documents",
    );
    const moved = ok(
      await call(u.token, "patch", `/schedule/blocks/${source.id}`, {
        startAt: at(9),
        endAt: at(9).replace("09:00", "09:30"),
      }),
    );
    assert.equal(moved[0].id, replacement.id);
    assert.equal(await ScheduleBlock.countDocuments({ taskId: t.id }), 2);
    const halves = ok(
      await call(u.token, "post", `/schedule/blocks/${replacement.id}/split`, {
        splitAt: at(9).replace("09:00", "09:15"),
      }),
    );
    assert.equal(halves[0].id, replacement.id);
    assert.equal(
      halves.reduce(
        (n, s) => n + (Date.parse(s.endAt) - Date.parse(s.startAt)) / 60000,
        0,
      ),
      30,
    );
    assert.equal(
      String((await ScheduleBlock.findById(source.id)).rescheduledToSessionId),
      replacement.id,
    );
  },
);
