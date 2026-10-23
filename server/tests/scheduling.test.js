import test from "node:test";
import assert from "node:assert/strict";
import {
  availabilityForDay,
  overlaps,
  mergeIntervals,
  validateRecurring,
  validateCapacity,
  occupiedOn,
} from "../src/services/availabilityService.js";
import {
  recurringDuration,
  occurrence,
  dateRange,
} from "../src/utils/dates.js";
import {
  parse,
  blockFields,
  selectedDays,
  taskPatchFields,
  draftFields,
} from "../src/utils/validation.js";
const zone = "Asia/Kolkata";
const rule = (weekday, startMinute, endMinute, endsNextDay = false) => ({
  recordType: "recurring",
  title: "Sleep",
  weekday,
  startMinute,
  endMinute,
  endsNextDay,
});
test("metadata/draft patches never inject creation defaults", () => {
  assert.deepEqual(parse(taskPatchFields, { title: "New" }), { title: "New" });
  assert.deepEqual(parse(draftFields, { goal: "New goal" }), {
    goal: "New goal",
  });
});
test("half-open overlaps allow adjacent blocks and merge occupied time once", () => {
  assert.equal(overlaps({ start: 1, end: 2 }, { start: 2, end: 3 }), false);
  assert.equal(overlaps({ start: 1, end: 3 }, { start: 2, end: 4 }), true);
  assert.deepEqual(
    mergeIntervals([
      { start: 0, end: 3 },
      { start: 2, end: 5 },
    ]),
    [{ start: 0, end: 5 }],
  );
});
test("presets and custom days create exactly selected weekdays", () => {
  for (const [preset, count] of [
    ["weekdays", 5],
    ["weekends", 2],
    ["whole", 7],
    ["selected", 1],
    ["custom", 2],
  ]) {
    const b = parse(blockFields, {
      title: "Lab",
      kind: "fixed",
      startMinute: 600,
      endMinute: 660,
      daysPreset: preset,
      days: [2, 4],
    });
    assert.equal(selectedDays(b).length, count);
  }
});
test("Sunday overnight sleep spills into Monday, including week boundary", () => {
  const b = rule(7, 1380, 420, true),
    monday = "2026-10-26";
  const result = availabilityForDay(monday, zone, [b], [], 0);
  assert.equal(result.freeMinutes, 17 * 60);
  assert.equal(occupiedOn(monday, zone, [b]).length, 1);
  assert.throws(
    () => validateRecurring([rule(1, 360, 480)], [b], zone),
    /overlaps/,
  );
});
test("whole group conflict is detected before any writing", () => {
  assert.throws(
    () =>
      validateRecurring(
        [rule(1, 600, 660), rule(2, 600, 660)],
        [rule(2, 630, 700)],
        zone,
      ),
    /weekday 2/,
  );
  assert.doesNotThrow(() =>
    validateRecurring([rule(1, 600, 660)], [rule(1, 660, 700)], zone),
  );
});
test("reversed, equal and over-24h rules fail; real midnight allowed", () => {
  for (const b of [
    rule(1, 600, 600),
    rule(1, 700, 600),
    rule(1, 60, 120, true),
  ])
    assert.throws(() => recurringDuration(b));
  assert.equal(recurringDuration(rule(1, 1380, 1440)), 60);
  assert.equal(recurringDuration(rule(1, 1380, 420, true)), 480);
});
test("capacity accounts for flexible minutes and never double-counts overlaps", () => {
  const b = [rule(1, 0, 420), rule(1, 60, 300)];
  const tasks = [
    {
      placementMode: "flexible",
      flexibleDate: "2026-10-26",
      durationMinutes: 60,
      status: "pending",
    },
  ];
  const a = availabilityForDay("2026-10-26", zone, b, tasks, 0);
  assert.equal(a.remainingMinutes, 960);
  assert.throws(
    () =>
      validateCapacity(
        ["2026-10-26"],
        zone,
        b,
        [{ ...tasks[0], durationMinutes: 1200 }],
        0,
      ),
    /free minutes/,
  );
});
test("today excludes elapsed time and bounded ranges reject invalid dates", () => {
  const noon = Date.parse("2026-10-26T12:00:00+05:30");
  assert.equal(
    availabilityForDay("2026-10-26", zone, [], [], noon).freeMinutes,
    720,
  );
  assert.throws(() => dateRange("2026-02-30", "2026-03-01"));
  assert.throws(() => dateRange("2026-01-01", "2026-03-01"));
});
test("weekly wall-clock times remain stable across DST", () => {
  const b = rule(7, 540, 600);
  const i = occurrence(b, "2026-03-08", "America/New_York");
  assert.equal(new Date(i.start).toISOString(), "2026-03-08T13:00:00.000Z");
});
