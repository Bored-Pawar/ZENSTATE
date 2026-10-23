import test from "node:test";
import assert from "node:assert/strict";
import { reminderEligible } from "../src/services/reminderService.js";
import {
  noteExcerpt,
  templateMessage,
} from "../src/services/taskContextService.js";
import { summariseSessions } from "../src/services/reportService.js";
const now = Date.parse("2026-10-26T12:00:00Z");
test("reminders catch up five minutes, deduplicate delivery and respect snooze", () => {
  const r = {
    status: "pending",
    startAt: new Date(now - 60000),
    endAt: new Date(now + 3600000),
    reminderStatus: "pending",
  };
  assert.equal(reminderEligible(r, now), true);
  assert.equal(
    reminderEligible({ ...r, reminderStatus: "delivered" }, now),
    false,
  );
  assert.equal(
    reminderEligible({ ...r, reminderStatus: "cancelled" }, now),
    false,
  );
  assert.equal(
    reminderEligible({ ...r, startAt: new Date(now - 6 * 60000) }, now),
    false,
  );
  assert.equal(
    reminderEligible({ ...r, snoozedUntil: new Date(now + 600000) }, now),
    false,
  );
  assert.equal(
    reminderEligible(
      {
        ...r,
        startAt: new Date(now - 30 * 60000),
        snoozedUntil: new Date(now - 1),
      },
      now,
    ),
    true,
  );
  for (const status of ["completed", "cancelled", "held"])
    assert.equal(reminderEligible({ ...r, status }, now), false);
});
test("completed templates recognise a finish and current excerpts retain difficulties", () => {
  assert.match(
    templateMessage({ title: "React", status: "completed" }),
    /completed React/,
  );
  assert.match(
    noteExcerpt("Opening. I find useEffect difficult. Closing."),
    /useEffect difficult/,
  );
  assert.doesNotMatch(
    templateMessage({ title: "New title", status: "pending" }),
    /Old title/,
  );
});
test("reports distinguish upcoming, missed, completed and cancelled with honest empty state", () => {
  const session = (status, start, end) => ({
    status,
    startAt: `2026-10-26T${start}:00Z`,
    endAt: `2026-10-26T${end}:00Z`,
  });
  const r = summariseSessions(
    [
      session("completed", "08:00", "09:00"),
      session("pending", "09:00", "10:00"),
      session("pending", "13:00", "14:00"),
      session("cancelled", "15:00", "16:00"),
    ],
    ["2026-10-26"],
    "UTC",
    now,
  );
  assert.equal(r.plannedSessions, 3);
  assert.equal(r.completedMinutes, 60);
  assert.equal(r.missedSessions, 1);
  assert.equal(r.upcomingSessions, 1);
  assert.equal(
    summariseSessions([], ["2026-10-26"], "UTC", now).completionPercent,
    0,
  );
});
