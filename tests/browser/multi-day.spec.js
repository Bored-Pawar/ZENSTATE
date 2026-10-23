import { test, expect } from "@playwright/test";
import { DateTime } from "luxon";
import mongoose from "../../server/node_modules/mongoose/index.js";
const base = "http://127.0.0.1:5001/api";

test("multi-day goal: save without reservations, add two days through the existing form, refresh and complete one session", async ({
  page,
}) => {
  const uri = process.env.TEST_BROWSER_MONGODB_URI;
  test.skip(
    !uri,
    "Use the exact disposable test database to advance one fixture session into the past",
  );
  const parsed = new URL(uri);
  expect(parsed.hostname).toBe("127.0.0.1");
  expect(parsed.pathname).toMatch(/^\/zenstate_test_standalone_\d+_\d+$/);
  const registered = await page.request.post(`${base}/auth/register`, {
    data: {
      name: "Daily Goal",
      email: `daily-${Date.now()}@test.example`,
      password: "password123",
      timezone: "UTC",
    },
  });
  expect(registered.ok()).toBeTruthy();
  const { data: u } = await registered.json();
  const headers = { Authorization: `Bearer ${u.token}` };
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
    u.token,
  );
  const today = DateTime.now().toUTC().startOf("day");
  const end = today.plus({ months: 6 }).minus({ days: 1 }).toISODate();
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Task type", exact: true })
    .selectOption("multi_day");
  await page
    .getByLabel("Goal start date", { exact: true })
    .fill(today.toISODate());
  await page.getByLabel("Goal end date", { exact: true }).fill(end);
  await page.getByLabel("Task title", { exact: true }).fill("Six-month DSA");
  await page
    .getByLabel("Preferred daily session minutes", { exact: true })
    .fill("60");
  await page
    .getByRole("combobox", { name: "Placement", exact: true })
    .selectOption("held");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Six-month DSA", exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1);
  const saved = async () =>
    (await (await page.request.get(`${base}/tasks/${id}`, { headers })).json())
      .data;
  expect((await saved()).sessions).toHaveLength(0);
  for (const [days, hour] of [
    [1, 8],
    [2, 11],
  ]) {
    await page
      .getByRole("button", { name: "Schedule a day", exact: true })
      .click();
    await page
      .getByLabel("Local date", { exact: true })
      .fill(today.plus({ days }).toISODate());
    await expect(
      page.locator(".placement-form .slot-list button").first(),
    ).toBeVisible();
    await page
      .getByLabel("Or choose an exact local start", { exact: true })
      .fill(today.plus({ days, hours: hour }).toFormat("yyyy-MM-dd'T'HH:mm"));
    await page
      .getByRole("button", { name: "Add exact session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save placement", exact: true })
      .click();
    await expect(page.locator(".placement-form")).toHaveCount(0);
  }
  let task = await saved();
  expect(task.sessions).toHaveLength(2);
  expect(
    task.sessions.map((s) => DateTime.fromISO(s.startAt).toUTC().hour),
  ).toEqual([8, 11]);
  await page.reload();
  await expect(page.locator(".small-card .session-item")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Complete goal", exact: true }),
  ).toBeVisible();
  // Change only this disposable fixture's first start time so the real UI/API
  // completion path can be exercised without waiting until tomorrow.
  const fixtureStart = Date.now() - 60000;
  const c = new mongoose.mongo.MongoClient(uri);
  try {
    await c.connect();
    await c
      .db()
      .collection("scheduleblocks")
      .updateOne(
        {
          _id: new mongoose.Types.ObjectId(task.sessions[0].id),
          userId: new mongoose.Types.ObjectId(u.user.id),
        },
        {
          $set: {
            startAt: new Date(fixtureStart),
            endAt: new Date(fixtureStart + 60 * 60000),
          },
        },
      );
  } finally {
    await c.close();
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Complete session", exact: true })
    .first()
    .click();
  await expect(page.locator(".progress-card")).toContainText(
    "1 sessions completed",
  );
  await page.reload();
  task = await saved();
  expect(task.status).toBe("in_progress");
  expect(task.sessions.filter((s) => s.status === "completed")).toHaveLength(1);
  expect(task.sessions.filter((s) => s.status === "pending")).toHaveLength(1);
  await expect(page.locator(".small-card .session-item")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Complete goal", exact: true }),
  ).toBeVisible();
  await page.goto("/timetable");
  await expect(page.locator(".time-block.task.session-completed")).toHaveCount(
    1,
  );
  await expect(page.locator(".time-block.task.session-unfinished")).toHaveCount(
    1,
  );
});
