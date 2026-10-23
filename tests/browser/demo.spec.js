import { test, expect } from "@playwright/test";

test("reminders: sequential due popups, persisted delivery/snooze, and no replay after refresh", async ({
  page,
}) => {
  await page.goto("/login");
  const base = "http://127.0.0.1:5001/api";
  const registered = await page.request.post(`${base}/auth/register`, {
    data: {
      name: "Reminder Student",
      email: `reminders-${Date.now()}@test.example`,
      password: "password123",
      timezone: "UTC",
    },
  });
  const {
    data: { token },
  } = await registered.json();
  const headers = { Authorization: `Bearer ${token}` };
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
  await page.evaluate(
    (token) => localStorage.setItem("zenstate-token", token),
    token,
  );
  await page.goto("/today");
  const date = new Date().toISOString().slice(0, 10),
    reminderAt = new Date(Date.now() + 2000).toISOString();
  const taskIds = [];
  for (const title of ["Reminder one", "Reminder two"]) {
    const r = await page.request.post(`${base}/tasks`, {
      headers,
      data: {
        title,
        durationMinutes: 1,
        placementMode: "flexible",
        flexibleDate: date,
        flexibleReminderAt: reminderAt,
      },
    });
    expect(r.ok()).toBeTruthy();
    taskIds.push((await r.json()).data.id);
  }
  const popup = page.getByRole("dialog", { name: "Task reminder" });
  await expect(popup).toBeVisible({ timeout: 18000 });
  await expect(popup.getByRole("heading")).toHaveText("Reminder one");
  await popup.getByRole("button", { name: "Snooze 10 min" }).click();
  const first = await page.request.get(`${base}/tasks/${taskIds[0]}`, {
    headers,
  });
  expect((await first.json()).data.reminderStatus).toBe("snoozed");
  await expect(popup).toBeVisible({ timeout: 18000 });
  await expect(popup.getByRole("heading")).toHaveText("Reminder two");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(popup).toHaveCount(0);
  const due = await page.request.get(`${base}/reminders/due`, { headers });
  expect((await due.json()).data).toEqual([]);
});

test("logout ignores a late response from the previous account", async ({
  page,
}) => {
  await page.goto("/login");
  const base = "http://127.0.0.1:5001/api";
  const registered = await page.request.post(`${base}/auth/register`, {
    data: {
      name: "Old Account",
      email: `late-${Date.now()}@test.example`,
      password: "password123",
      timezone: "UTC",
    },
  });
  const {
    data: { token },
  } = await registered.json();
  const headers = { Authorization: `Bearer ${token}` };
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
  await page.request.post(`${base}/tasks`, {
    headers,
    data: { title: "Private old task" },
  });
  await page.evaluate(
    (token) => localStorage.setItem("zenstate-token", token),
    token,
  );
  await page.goto("/tasks");
  await expect(
    page.getByRole("link", { name: "Private old task" }),
  ).toBeVisible();
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/tasks", async (route) => {
    const response = await route.fetch();
    await wait;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Enable voice reminders" }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  release();
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("link", { name: "Private old task" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("zenstate-token")),
  ).toBeNull();
});

test("real browser: new account, resumable setup, saved task/note, planner confirmation, report and login", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `browser-${Date.now()}@test.example`;
  await page.goto("/login");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Your name").fill("Browser Student");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Timezone", { exact: true }).fill("UTC");
  await page.getByRole("button", { name: "Create my space" }).click();
  await expect(page).toHaveURL(/\/setup/);
  await page.getByRole("button", { name: "Add sleep / commitment" }).click();
  await page.getByRole("button", { name: "Save block", exact: true }).click();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".time-block.sleep")).toHaveCount(14);
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText("No tasks assigned today.")).toBeVisible();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title", { exact: true }).fill("Browser lab task");
  await page.getByLabel("Why it matters").fill("Present the lab confidently");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser lab task" }),
  ).toBeVisible();
  await page
    .locator(".notes-editor textarea")
    .fill("useEffect cleanup is difficult; start with one example.");
  await page.route("**/api/notes", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "Test save failure. Please retry." },
          }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByText("Test save failure. Please retry."),
  ).toBeVisible();
  await expect(page.locator(".notes-editor textarea")).toHaveValue(
    "useEffect cleanup is difficult; start with one example.",
  );
  await page.unroute("**/api/notes");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.locator(".journal-entry p")).toContainText(
    "useEffect cleanup",
  );
  await page.reload();
  await expect(page.locator(".journal-entry p")).toContainText(
    "useEffect cleanup",
  );
  await expect(
    page.getByText("AI unavailable: current-source template is ready.", {
      exact: false,
    }),
  ).toBeVisible();
  // Verify the speech callback contract separately from real audible playback.
  await page.evaluate(() => {
    let current;
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
        speak(u) {
          current = u;
          u.onstart?.();
        },
        pause() {
          current?.onpause?.();
        },
        resume() {
          current?.onresume?.();
        },
        cancel() {
          current?.onerror?.({ error: "interrupted" });
          current = null;
        },
        getVoices() {
          return [];
        },
      },
    });
    window.dispatchEvent(new Event("focus"));
  });
  let deliveries = 0;
  page.on("request", (r) => {
    if (r.url().includes("/delivered")) deliveries++;
  });
  await page
    .getByRole("button", { name: "Preview reminder", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause Zen", exact: true }).click();
  await page.getByRole("button", { name: "Resume Zen", exact: true }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Preview reminder", exact: true }),
  ).toBeVisible();
  expect(deliveries).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: undefined,
    });
    window.dispatchEvent(new Event("focus"));
  });
  await expect(
    page.getByRole("button", { name: "Speech unavailable", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Your current note:", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Plan with Zen", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message to Zen" })
    .fill("I need 45 minutes to practise hooks for lab confidence.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry saved message" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fill missing details in review" })
    .click();
  await page.getByLabel("Task / goal").fill("Hooks planner task");
  await page.getByLabel("Why it matters").fill("Lab confidence");
  await page.getByLabel("Total focused minutes").fill("45");
  await page
    .getByRole("button", { name: "Save and check available time" })
    .click();
  await expect(page).toHaveURL(/planner\/availability/);
  await page.locator(".slot-list button").first().click();
  await page.getByRole("button", { name: "Review this placement" }).click();
  await page.getByRole("button", { name: "Confirm and add plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Your plan is saved." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open saved task" }).click();
  await expect(
    page.getByRole("heading", { name: "Hooks planner task" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Discipline report", exact: true })
    .click();
  await expect(
    page.getByText("0 completed · 0 missed · 1 upcoming or active sessions."),
  ).toBeVisible();
  await page.screenshot({
    path: ".test-artifacts/desktop-report.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Enter Zenstate", exact: true })
    .click();
  await expect(page).toHaveURL(/today/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Timetable", exact: true }).click();
  await page.getByRole("button", { name: "Add a block", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save block", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".test-artifacts/mobile-block-form.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
