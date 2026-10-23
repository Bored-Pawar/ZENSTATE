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

import {
  calendarSegments,
  sessionPresentation,
} from "../../src/services/dates.js";
test("retired calendar history stays visible but is excluded from planned effort and reminder eligibility", () => {
  const date = "2026-10-26",
    start = "2026-10-26T10:00:00Z";
  const session = {
    id: "source",
    recordType: "session",
    kind: "task",
    title: "History",
    startAt: start,
    endAt: "2026-10-26T10:30:00Z",
    status: "missed",
    rescheduledToSessionId: "replacement",
    reminderStatus: "cancelled",
  };
  const completed = {
    ...session,
    id: "complete",
    status: "completed",
    rescheduledToSessionId: undefined,
  };
  const replacement = {
    ...session,
    id: "replacement",
    status: "pending",
    startAt: "2026-10-26T13:00:00Z",
    endAt: "2026-10-26T13:30:00Z",
    rescheduledToSessionId: undefined,
  };
  const cancelled = {
    ...replacement,
    id: "cancelled",
    status: "cancelled",
    cancelReason: "task_completed_early",
  };
  const all = [session, completed, replacement, cancelled];
  assert.equal(calendarSegments(all, date, "UTC").length, 4);
  assert.equal(sessionPresentation(completed).tone, "session-completed");
  assert.equal(sessionPresentation(replacement).tone, "session-unfinished");
  assert.equal(
    sessionPresentation(cancelled).label,
    "Cancelled \u2014 task completed early.",
  );
  assert.equal(sessionPresentation(session).tone, "session-retired");
  const report = summariseSessions(
    all,
    [date],
    "UTC",
    Date.parse("2026-10-26T12:00:00Z"),
  );
  assert.equal(report.plannedSessions, 2);
  assert.equal(report.plannedMinutes, 60);
  assert.equal(report.completedMinutes, 30);
  assert.equal(report.missedSessions, 0);
  assert.equal(report.rescheduledSessions, 1);
  assert.equal(report.historicalMissedSessions, 1);
  assert.equal(
    reminderEligible({ ...session, reminderStatus: "pending" }, now),
    false,
  );
});
