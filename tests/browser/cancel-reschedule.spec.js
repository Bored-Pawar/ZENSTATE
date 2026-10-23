import { test, expect } from "@playwright/test";
import { DateTime } from "luxon";
import { reminderEligible } from "../../server/src/services/reminderService.js";
const base = "http://127.0.0.1:5001/api";

test("cancelled occurrence reschedules through existing placement: red replacement, grey history, refresh, retry, reminders", async ({
  page,
}) => {
  const registered = await page.request.post(`${base}/auth/register`, {
    data: {
      name: "Cancel Student",
      email: `cancel-${Date.now()}@test.example`,
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
  const date = DateTime.now().toUTC().plus({ days: 1 }).toISODate();
  const interval = (hour) => ({
    startAt: `${date}T${hour}:00:00.000Z`,
    endAt: `${date}T${hour}:30:00.000Z`,
  });
  const created = await page.request.post(`${base}/tasks`, {
    headers,
    data: {
      title: "Cancelled then rescheduled",
      durationMinutes: 30,
      placementMode: "scheduled",
      sessions: [interval(12)],
    },
  });
  expect(created.ok()).toBeTruthy();
  const { data: task } = await created.json();
  const saved = async () =>
    (
      await (
        await page.request.get(`${base}/tasks/${task.id}`, { headers })
      ).json()
    ).data;
  const original = (await saved()).sessions[0];
  await page.request.post(`${base}/notes`, {
    headers,
    data: { taskId: task.id, text: "Keep my original notes." },
  });
  await page.request.post(`${base}/tasks`, {
    headers,
    data: {
      title: "Occupied target",
      durationMinutes: 30,
      placementMode: "scheduled",
      sessions: [interval(14)],
    },
  });
  await page.goto("/login");
  await page.evaluate(
    (token) => localStorage.setItem("zenstate-token", token),
    u.token,
  );
  const timetable = async (useNavigation = false) => {
    if (useNavigation)
      await page.getByRole("link", { name: "Timetable", exact: true }).click();
    else await page.goto("/timetable");
    if (
      DateTime.fromISO(date).startOf("week").toISODate() !==
      DateTime.now().toUTC().startOf("week").toISODate()
    )
      await page.getByRole("button", { name: /Next week/ }).click();
  };
  await timetable();
  const active = page.getByRole("button", {
    name: /^Cancelled then rescheduled: Unfinished/,
  });
  await active.click();
  await page
    .getByRole("button", {
      name: "Remove and hold remaining work",
      exact: true,
    })
    .click();
  const grey = page.getByRole("button", {
    name: /^Cancelled then rescheduled: Cancelled/,
  });
  await expect(grey).toHaveCSS("background-color", "rgb(236, 238, 241)");
  let data = await saved();
  expect(data.status).toBe("held");
  expect(data.sessions[0].status).toBe("cancelled");
  expect(data.sessions[0].reminderStatus).toBe("cancelled");
  await grey.click();
  await expect(
    page.getByRole("link", { name: "Reschedule task", exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await page
    .getByRole("link", { name: "Reschedule task", exact: true })
    .click();
  await expect(page.locator(".placement-form")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Placement", exact: true })
    .selectOption("scheduled");
  await page.getByLabel("Local date", { exact: true }).fill(date);
  const add = async (hour) => {
    await page
      .getByLabel("Or choose an exact local start", { exact: true })
      .fill(`${date}T${hour}:00`);
    await page
      .getByRole("button", { name: "Add exact session", exact: true })
      .click();
  };
  await add(14);
  await page
    .getByRole("button", { name: "Save placement", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/overlap/);
  await expect(page.locator(".placement-form")).toBeVisible();
  expect((await saved()).sessions).toHaveLength(1);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await add(15);
  const saveResponse = page.waitForResponse(
    (r) =>
      r.url() === `${base}/tasks/${task.id}/placement` &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save placement", exact: true })
    .click();
  const response = await saveResponse;
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).data.status).toBe("pending");
  const request = response.request().postDataJSON();
  await expect(page.locator(".placement-form")).toHaveCount(0);
  data = await saved();
  expect(data.id).toBe(task.id);
  expect(data.sessions).toHaveLength(2);
  const replacement = data.sessions.find((s) => s.status === "pending");
  expect(replacement.startAt).toBe(interval(15).startAt);
  expect(replacement.reminderStatus).toBe("pending");
  const old = data.sessions.find((s) => s.id === original.id);
  expect(old.startAt).toBe(original.startAt);
  expect(old.status).toBe("cancelled");
  expect(old.reminderStatus).toBe("cancelled");
  expect(reminderEligible(old, Date.parse(original.startAt))).toBeFalsy();
  expect(
    reminderEligible(replacement, Date.parse(replacement.startAt)),
  ).toBeTruthy();
  const oldReminder = await page.request.get(
    `${base}/reminders/session:${old.id}`,
    { headers },
  );
  expect((await oldReminder.json()).data.active).toBeFalsy();
  const availability = (
    await (
      await page.request.get(
        `${base}/availability?from=${date}&to=${date}&durationMinutes=30`,
        { headers },
      )
    ).json()
  ).data[0];
  expect(
    availability.suggestions.some((s) => s.startAt === interval(12).startAt),
  ).toBeTruthy();
  const retry = await page.request.post(`${base}/tasks/${task.id}/placement`, {
    headers,
    data: request,
  });
  expect(retry.ok()).toBeTruthy();
  expect((await saved()).sessions).toHaveLength(2);
  const notes = (
    await (
      await page.request.get(`${base}/notes?taskId=${task.id}`, { headers })
    ).json()
  ).data;
  expect(notes[0].text).toBe("Keep my original notes.");
  await timetable(true);
  const red = page.getByRole("button", {
    name: /^Cancelled then rescheduled: Unfinished/,
  });
  await expect(red).toHaveCount(1);
  await expect(red).toHaveCSS("background-color", "rgb(255, 228, 225)");
  await expect(red).toContainText("15:00");
  await expect(grey).toHaveCount(1);
  await expect(grey).toContainText("12:00");
  await page.reload();
  await expect(red).toHaveCSS("background-color", "rgb(255, 228, 225)");
  await expect(grey).toHaveCSS("background-color", "rgb(236, 238, 241)");
  expect((await saved()).sessions).toHaveLength(2);
});
