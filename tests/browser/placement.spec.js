import { test, expect } from "@playwright/test";
import { DateTime } from "luxon";
const base = "http://127.0.0.1:5001/api";

test("task placement: explicit fixed/flexible/held requests persist; held deadline is not a placement; conversion retains ID and notes", async ({
  page,
}) => {
  const response = await page.request.post(`${base}/auth/register`, {
    data: {
      name: "Placement Student",
      email: `placement-${Date.now()}@test.example`,
      password: "password123",
      timezone: "UTC",
    },
  });
  expect(response.ok()).toBeTruthy();
  const { data: user } = await response.json();
  const headers = { Authorization: `Bearer ${user.token}` };
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
    user.token,
  );
  const today = DateTime.now().toUTC().startOf("day"),
    tomorrow = today.plus({ days: 1 }).toISODate(),
    later = today.plus({ days: 2 }).toISODate();
  const getTask = async (id) =>
    (await (await page.request.get(`${base}/tasks/${id}`, { headers })).json())
      .data;
  const created = {};
  for (const mode of ["scheduled", "flexible", "held"]) {
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    const title = `Creation ${mode}`;
    await page.getByLabel("Task title", { exact: true }).fill(title);
    await expect(
      page.getByRole("combobox", { name: "Placement", exact: true }),
    ).toHaveValue("");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.locator(".task-form")).toBeVisible();
    await page
      .getByRole("combobox", { name: "Placement", exact: true })
      .selectOption(mode);
    if (mode !== "held")
      await page
        .getByLabel("Local date", { exact: true })
        .fill(mode === "scheduled" ? tomorrow : later);
    if (mode === "scheduled") {
      await page
        .getByLabel("Or choose an exact local start", { exact: true })
        .fill(`${tomorrow}T12:00`);
      await page
        .getByRole("button", { name: "Add exact session", exact: true })
        .click();
    }
    if (mode === "held")
      await page
        .getByLabel("Deadline (optional, end of local day)", { exact: true })
        .fill(today.toISODate());
    const outgoing = page.waitForRequest(
      (r) => r.url() === `${base}/tasks` && r.method() === "POST",
    );
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    const body = (await outgoing).postDataJSON();
    expect(body.placementMode).toBe(mode);
    if (mode === "scheduled") {
      expect(body.sessions).toHaveLength(1);
      expect(body.sessions[0].startAt).toContain(`${tomorrow}T12:00`);
    }
    if (mode === "flexible") {
      expect(body.flexibleDate).toBe(later);
      expect(body.sessions).toHaveLength(0);
    }
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").at(-1);
    created[mode] = id;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    const saved = await getTask(id);
    expect(saved.placementMode).toBe(mode);
    expect(saved.sessions).toHaveLength(mode === "scheduled" ? 1 : 0);
    if (mode === "flexible") expect(saved.flexibleDate).toBe(later);
  }
  await page.goto("/tasks");
  const heldRow = page.locator(".task-row").filter({
    has: page.getByRole("link", { name: "Creation held", exact: true }),
  });
  await expect(heldRow.locator(".task-due")).toHaveText("Not scheduled");
  await expect(heldRow.locator(".task-due")).not.toContainText("Today");
  await heldRow
    .getByRole("link", { name: "Choose placement", exact: true })
    .click();
  await expect(page.locator(".placement-form")).toBeVisible();
  expect((await getTask(created.held)).placementMode).toBe("held");
  // Represent a previously saved held task with notes, without constraining it
  // to today's deadline. Conversions must reuse its ID and preserve its notes.
  const oldResponse = await page.request.post(`${base}/tasks`, {
    headers,
    data: {
      title: "Existing held",
      durationMinutes: 30,
      placementMode: "held",
    },
  });
  const { data: old } = await oldResponse.json();
  const note = await page.request.post(`${base}/notes`, {
    headers,
    data: { taskId: old.id, text: "Keep this note through placement changes." },
  });
  expect(note.ok()).toBeTruthy();
  for (const mode of ["scheduled", "held", "flexible"]) {
    await page.goto(`/tasks/${old.id}`);
    await page
      .getByRole("button", { name: "Change placement", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Placement", exact: true })
      .selectOption(mode);
    if (mode !== "held")
      await page
        .getByLabel("Local date", { exact: true })
        .fill(mode === "scheduled" ? tomorrow : later);
    if (mode === "scheduled") {
      await page
        .getByLabel("Or choose an exact local start", { exact: true })
        .fill(`${tomorrow}T13:00`);
      await page
        .getByRole("button", { name: "Add exact session", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "Save placement", exact: true })
      .click();
    await expect(page.locator(".placement-form")).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Existing held", exact: true }),
    ).toBeVisible();
    const saved = await getTask(old.id);
    expect(saved.id).toBe(old.id);
    expect(saved.placementMode).toBe(mode);
    const notes = (
      await (
        await page.request.get(`${base}/notes?taskId=${old.id}`, { headers })
      ).json()
    ).data;
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toContain("Keep this note");
    if (mode === "flexible") {
      expect(saved.flexibleDate).toBe(later);
      expect(saved.sessions.filter((s) => s.status === "pending")).toHaveLength(
        0,
      );
    }
  }
});
