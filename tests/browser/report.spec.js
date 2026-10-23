import { test, expect } from "@playwright/test";

test("report distinguishes empty and directly completed tasks from session effort", async ({
  page,
}) => {
  const base = "http://127.0.0.1:5001/api";
  const registered = await page.request.post(`${base}/auth/register`, {
    data: {
      name: "Report Student",
      email: `report-${Date.now()}@test.example`,
      password: "password123",
      timezone: "UTC",
    },
  });
  expect(registered.ok()).toBeTruthy();
  const { data } = await registered.json();
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
  await page.goto("/discipline-report");
  const hero = page.locator(".report-hero");
  await expect(
    hero.getByRole("heading", { name: "0 tasks completed this week" }),
  ).toBeVisible();
  await expect(hero.locator(".report-score")).toHaveText("No session data");
  await expect(hero).not.toContainText("0%");
  await expect(hero).not.toContainText("planned minutes completed");
  await expect(page.locator(".coach-panel")).toContainText(
    "No tasks completed and no session data",
  );
  for (let i = 0; i < 2; i++) {
    const created = await page.request.post(`${base}/tasks`, {
      headers,
      data: { title: `Direct task ${i}`, durationMinutes: 60 },
    });
    expect(created.ok()).toBeTruthy();
    const { data: task } = await created.json();
    const completed = await page.request.post(
      `${base}/tasks/${task.id}/complete`,
      { headers, data: {} },
    );
    expect(completed.ok()).toBeTruthy();
  }
  await page.reload();
  await expect(
    hero.getByRole("heading", { name: "2 tasks completed this week" }),
  ).toBeVisible();
  await expect(hero.locator(".report-score")).toHaveText("No session data");
  await expect(hero).not.toContainText("0%");
  await expect(hero).not.toContainText("planned minutes completed");
  await expect(page.locator(".coach-panel")).toContainText(
    "You completed 2 tasks this week",
  );
});
