import { test, expect } from "@playwright/test";
const base = "http://127.0.0.1:5001/api";
async function account(page) {
  const email = `stability-${Date.now()}-${Math.random().toString(36).slice(2)}@test.example`;
  const r = await page.request.post(`${base}/auth/register`, {
    data: {
      name: "Stability Student",
      email,
      password: "password123",
      timezone: "UTC",
    },
  });
  const { data } = await r.json();
  const headers = { Authorization: `Bearer ${data.token}` };
  await page.request.post(`${base}/schedule/blocks`, {
    headers,
    data: {
      title: "Sleep",
      kind: "sleep",
      daysPreset: "whole",
      startMinute: 1380,
      endMinute: 420,
      endsNextDay: true,
    },
  });
  await page.request.post(`${base}/onboarding/complete`, { headers, data: {} });
  await page.goto("/login");
  await page.evaluate(
    (token) => localStorage.setItem("zenstate-token", token),
    data.token,
  );
  return { ...data, headers, email };
}
test("edit stability: repeated open/cancel, refresh, save, complete/reopen keeps one editor and task ID", async ({
  page,
}) => {
  const user = await account(page);
  const r = await page.request.post(`${base}/tasks`, {
    headers: user.headers,
    data: { title: "Stable editor", durationMinutes: 30 },
  });
  const { data: task } = await r.json();
  let writes = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.url().includes(`/tasks/${task.id}`))
      writes.push(r.method() + " " + r.url());
  });
  await page.goto(`/tasks/${task.id}`);
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    await expect(page.locator("form.task-form")).toHaveCount(1);
    await page.getByLabel("Task title", { exact: true }).fill(`Unsaved ${i}`);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(150);
    await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
      `Unsaved ${i}`,
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator("form.task-form")).toHaveCount(0);
  }
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Task title", { exact: true }).fill("Edited once");
  let rejectSave = true;
  await page.route(`**/api/tasks/${task.id}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    await new Promise((r) => setTimeout(r, 150));
    if (rejectSave) {
      rejectSave = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Temporary edit failure" } }),
      });
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Temporary edit failure");
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
    "Edited once",
  );
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page.locator("form.task-form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.locator("form.task-form")).toHaveCount(0);
  expect(writes.filter((w) => w.startsWith("PATCH"))).toHaveLength(2); // one failed attempt and one successful save
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Edited once", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete task early", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen as held", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reopen as held", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Complete task early", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await expect(page.locator("form.task-form")).toHaveCount(1);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const saved = (
    await (
      await page.request.get(`${base}/tasks/${task.id}`, {
        headers: user.headers,
      })
    ).json()
  ).data;
  expect(saved.id).toBe(task.id);
  expect(saved.placementMode).toBe("held");
  expect(saved.status).toBe("held");
});
test("planner confirmation clears the active draft and pointer but preserves saved conversation", async ({
  page,
}) => {
  const user = await account(page);
  const c = (
    await (
      await page.request.post(`${base}/planner/conversations`, {
        headers: user.headers,
        data: {},
      })
    ).json()
  ).data.conversation;
  const edited = (
    await (
      await page.request.patch(`${base}/planner/conversations/${c.id}/draft`, {
        headers: user.headers,
        data: {
          draftVersion: 0,
          updates: {
            goal: "Fresh plan test",
            motivation: "Lab stability",
            durationMinutes: 30,
            placementMode: "held",
          },
        },
      })
    ).json()
  ).data.conversation;
  await page.evaluate(({ id, key }) => localStorage.setItem(key, id), {
    id: c.id,
    key: `zenstate-plan:${user.user.id}`,
  });
  await page.goto(`/planner/confirmation?conversation=${c.id}`);
  let loseResponse = true;
  await page.route(
    `**/api/planner/conversations/${c.id}/confirm`,
    async (route) => {
      if (loseResponse) {
        loseResponse = false;
        await route.fetch();
        return route.abort("failed");
      }
      return route.continue();
    },
  );
  await page.getByRole("button", { name: "Confirm and add plan" }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot reach Zenstate");
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      `zenstate-plan:${user.user.id}`,
    ),
  ).toBe(c.id);
  await page.getByRole("button", { name: "Confirm and add plan" }).click();
  await expect(
    page.getByRole("link", { name: "Open saved task", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      `zenstate-plan:${user.user.id}`,
    ),
  ).toBeNull();
  await page.getByRole("link", { name: "Plan with Zen", exact: true }).click();
  await expect(page).toHaveURL(/\/planner$/);
  await expect(page.getByText("One new goal", { exact: true })).toBeVisible();
  const saved = (
    await (
      await page.request.get(`${base}/planner/conversations/${c.id}`, {
        headers: user.headers,
      })
    ).json()
  ).data.conversation;
  expect(saved.status).toBe("confirmed");
  const repeat = (
    await (
      await page.request.post(`${base}/planner/conversations/${c.id}/confirm`, {
        headers: user.headers,
        data: { draftVersion: edited.draftVersion },
      })
    ).json()
  ).data;
  expect(repeat.id).toBe(saved.confirmedTaskId);
});

import mongoose from "../../server/node_modules/mongoose/index.js";
import { DateTime } from "luxon";
async function fixtureDb(action) {
  const uri = process.env.TEST_BROWSER_MONGODB_URI;
  const parsed = new URL(uri);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "27017" ||
    !/^\/zenstate_test_standalone_\d+_\d+$/.test(parsed.pathname)
  )
    throw new Error(
      "Browser fixtures require the exact isolated database printed by test-local --serve",
    );
  const client = new mongoose.mongo.MongoClient(uri);
  try {
    await client.connect();
    return await action(client.db());
  } finally {
    await client.close();
  }
}
const tomorrow = () => DateTime.now().toUTC().plus({ days: 1 }).toISODate();
const localAt = (date, hour, minute = 0) =>
  `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

test("move and split: start carries end, split ignores unsaved move, invalid split keeps records", async ({
  page,
}) => {
  const u = await account(page),
    date = tomorrow();
  const task = (
    await (
      await page.request.post(`${base}/tasks`, {
        headers: u.headers,
        data: {
          title: "Move and split",
          durationMinutes: 60,
          placementMode: "scheduled",
          sessions: [
            {
              startAt: localAt(date, 9) + ":00Z",
              endAt: localAt(date, 10) + ":00Z",
            },
          ],
        },
      })
    ).json()
  ).data;
  const saved = async () =>
    (
      await (
        await page.request.get(`${base}/tasks/${task.id}`, {
          headers: u.headers,
        })
      ).json()
    ).data;
  const original = (await saved()).sessions[0];
  await page.goto(`/tasks/${task.id}`);
  await page
    .getByRole("button", { name: "Reschedule session", exact: true })
    .click();
  await page.getByLabel("New start", { exact: true }).fill(localAt(date, 11));
  await expect(page.getByLabel("New end (duration preserved)")).toHaveValue(
    localAt(date, 12),
  );
  await page
    .getByLabel("New start", { exact: true })
    .fill(localAt(DateTime.now().toUTC().minus({ days: 1 }).toISODate(), 11));
  await page
    .getByRole("button", { name: "Save reschedule", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("future start");
  expect((await saved()).sessions[0].id).toBe(original.id);
  await page.getByLabel("New start", { exact: true }).fill(localAt(date, 11));
  await page
    .getByRole("button", { name: "Save reschedule", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Session placement" }),
  ).toHaveCount(0);
  expect((await saved()).sessions[0].id).toBe(original.id);
  await page
    .getByRole("button", { name: "Reschedule session", exact: true })
    .click();
  await page.getByLabel("New start", { exact: true }).fill(localAt(date, 15));
  await page
    .getByRole("button", { name: "Split instead", exact: true })
    .click();
  await expect(page.getByLabel("Split saved session at")).toHaveValue(
    localAt(date, 11, 30),
  );
  await page.getByLabel("Split saved session at").fill(localAt(date, 12));
  await page.getByRole("button", { name: "Save split", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("strictly inside");
  expect((await saved()).sessions).toHaveLength(1);
  await page.getByLabel("Split saved session at").fill(localAt(date, 11, 30));
  await page.getByRole("button", { name: "Save split", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Session placement" }),
  ).toHaveCount(0);
  const split = (await saved()).sessions;
  expect(split).toHaveLength(2);
  expect(
    split.reduce(
      (n, s) => n + (Date.parse(s.endAt) - Date.parse(s.startAt)) / 60000,
      0,
    ),
  ).toBe(60);
  expect(
    split.every(
      (s) => Date.parse(s.startAt) < Date.parse(localAt(date, 12) + ":00Z"),
    ),
  ).toBeTruthy();
});

test("calendar: completed green, unfinished red, early-cancelled grey persist after refresh and login", async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_BROWSER_MONGODB_URI,
    "Set the exact disposable fixture URI to seed saved historical sessions",
  );
  const u = await account(page);
  const task = (
    await (
      await page.request.post(`${base}/tasks`, {
        headers: u.headers,
        data: { title: "Calendar history", durationMinutes: 90 },
      })
    ).json()
  ).data;
  const now = Date.now(),
    future = now + 2 * 3600000;
  await fixtureDb(async (db) => {
    const owner = new mongoose.Types.ObjectId(u.user.id),
      tid = new mongoose.Types.ObjectId(task.id);
    await db
      .collection("tasks")
      .updateOne(
        { _id: tid },
        { $set: { placementMode: "scheduled", status: "in_progress" } },
      );
    const common = {
      userId: owner,
      taskId: tid,
      recordType: "session",
      kind: "task",
      title: "Calendar history",
      reminderStatus: "pending",
    };
    await db.collection("scheduleblocks").insertMany([
      {
        ...common,
        startAt: new Date(now - 7200000),
        endAt: new Date(now - 5400000),
        status: "completed",
        completedAt: new Date(now - 5400000),
      },
      {
        ...common,
        startAt: new Date(now - 3600000),
        endAt: new Date(now - 1800000),
        status: "missed",
      },
      {
        ...common,
        startAt: new Date(future),
        endAt: new Date(future + 1800000),
        status: "pending",
      },
    ]);
  });
  await page.goto("/timetable");
  await expect(page.locator(".time-block.task.session-completed")).toHaveCount(
    1,
  );
  await expect(page.locator(".time-block.task.session-unfinished")).toHaveCount(
    2,
  );
  const finish = await page.request.post(`${base}/tasks/${task.id}/complete`, {
    headers: u.headers,
    data: {},
  });
  expect(finish.ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator(".time-block.task.session-completed")).toHaveCount(
    1,
  );
  await expect(page.locator(".time-block.task.session-retired")).toHaveCount(1);
  await expect(page.locator(".time-block.task.session-retired")).toContainText(
    "task completed early",
  );
  await expect(page.locator(".time-block.task.session-unfinished")).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Enter Zenstate", exact: true })
    .click();
  await page.getByRole("link", { name: "Timetable", exact: true }).click();
  await expect(page.locator(".time-block.task.session-completed")).toHaveCount(
    1,
  );
  await expect(page.locator(".time-block.task.session-retired")).toHaveCount(1);
  const detail = (
    await (
      await page.request.get(`${base}/tasks/${task.id}`, { headers: u.headers })
    ).json()
  ).data;
  expect(detail.sessions).toHaveLength(3);
  expect(detail.sessions.filter((s) => s.status === "completed")).toHaveLength(
    1,
  );
});

test("started session reschedules through the same editor while notes, history and completed effort remain", async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_BROWSER_MONGODB_URI,
    "Historical fixture needs the exact disposable test database URI",
  );
  const u = await account(page),
    date = tomorrow();
  const task = (
    await (
      await page.request.post(`${base}/tasks`, {
        headers: u.headers,
        data: {
          title: "Started work",
          durationMinutes: 60,
          motivation: "Keep motivation",
        },
      })
    ).json()
  ).data;
  const now = Date.now();
  let original;
  await fixtureDb(async (db) => {
    const userId = new mongoose.Types.ObjectId(u.user.id),
      taskId = new mongoose.Types.ObjectId(task.id);
    await db
      .collection("tasks")
      .updateOne(
        { _id: taskId },
        { $set: { placementMode: "scheduled", status: "in_progress" } },
      );
    const common = {
      userId,
      taskId,
      recordType: "session",
      kind: "task",
      title: "Started work",
      reminderStatus: "pending",
    };
    await db.collection("scheduleblocks").insertOne({
      ...common,
      startAt: new Date(now - 7200000),
      endAt: new Date(now - 5400000),
      status: "completed",
    });
    original = (
      await db.collection("scheduleblocks").insertOne({
        ...common,
        startAt: new Date(now - 60000),
        endAt: new Date(now + 1740000),
        status: "pending",
      })
    ).insertedId.toString();
  });
  await page.request.post(`${base}/notes`, {
    headers: u.headers,
    data: { taskId: task.id, text: "Original note stays saved" },
  });
  await page.goto(`/tasks/${task.id}`);
  await page
    .getByRole("button", { name: "Reschedule session", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Split instead", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("New start", { exact: true }).fill(localAt(date, 11));
  await expect(page.getByLabel("New end (duration preserved)")).toHaveValue(
    localAt(date, 11, 30),
  );
  await page
    .getByRole("button", { name: "Save reschedule", exact: true })
    .click();
  await expect(page.getByText(/Rescheduled.*started occurrence/)).toBeVisible();
  await expect(page.locator(".journal-entry p")).toContainText(
    "Original note stays saved",
  );
  await expect(
    page.getByText("30 / 60 planned minutes", { exact: true }),
  ).toBeVisible();
  const t = (
    await (
      await page.request.get(`${base}/tasks/${task.id}`, { headers: u.headers })
    ).json()
  ).data;
  expect(t.id).toBe(task.id);
  expect(t.sessions).toHaveLength(3);
  const source = t.sessions.find((s) => s.id === original);
  expect(source.rescheduledToSessionId).toBeTruthy();
  expect(source.reminderStatus).toBe("cancelled");
});

test("missing task stays not-found on background refresh; ordinary refresh does not cancel preview speech", async ({
  page,
}) => {
  const u = await account(page);
  await page.goto("/tasks/000000000000000000000099");
  await expect(page.getByRole("status")).toContainText("Task not found");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("status")).toContainText("Task not found");
  const task = (
    await (
      await page.request.post(`${base}/tasks`, {
        headers: u.headers,
        data: { title: "Speech lifetime" },
      })
    ).json()
  ).data;
  await page.goto(`/tasks/${task.id}`);
  await expect(
    page.getByText(/AI unavailable: current-source template/),
  ).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => {
    window.__speech = { cancels: 0, speaks: 0 };
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(text) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {
          window.__speech.cancels++;
        },
        speak(u) {
          window.__speech.speaks++;
          u.onstart?.();
        },
        pause() {},
        resume() {},
        getVoices() {
          return [];
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "Preview reminder", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause Zen", exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(() => window.__speech.cancels);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(750);
  expect(await page.evaluate(() => window.__speech.cancels)).toBe(before);
  expect(await page.evaluate(() => window.__speech.speaks)).toBe(1);
  await page
    .getByRole("button", { name: "Complete task early", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__speech.cancels))
    .toBeGreaterThan(before);
});

test("late conversation restore cannot repopulate another signed-in user's fresh planner", async ({
  page,
}) => {
  const first = await account(page);
  const c = (
    await (
      await page.request.post(`${base}/planner/conversations`, {
        headers: first.headers,
        data: {},
      })
    ).json()
  ).data.conversation;
  await page.request.patch(`${base}/planner/conversations/${c.id}/draft`, {
    headers: first.headers,
    data: {
      draftVersion: 0,
      updates: {
        goal: "Previous user's private goal",
        motivation: "Private context",
        durationMinutes: 30,
      },
    },
  });
  let release, started;
  const gate = new Promise((r) => {
      release = r;
    }),
    ready = new Promise((r) => {
      started = r;
    });
  await page.route(`**/api/planner/conversations/${c.id}`, async (route) => {
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto(`/planner?conversation=${c.id}`);
  await ready;
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Your name").fill("New planner owner");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`new-owner-${Date.now()}@test.example`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Timezone", { exact: true }).fill("UTC");
  await page.getByRole("button", { name: "Create my space" }).click();
  await page.getByRole("button", { name: "Add sleep / commitment" }).click();
  await page.getByRole("button", { name: "Save block", exact: true }).click();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await page.getByRole("button", { name: "Finish setup" }).click();
  release();
  await page.waitForTimeout(250);
  await page.getByRole("link", { name: "Plan with Zen", exact: true }).click();
  await expect(page.getByText("One new goal", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Previous user's private goal", { exact: true }),
  ).toHaveCount(0);
});
