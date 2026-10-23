import { Task, ScheduleBlock } from "../models/index.js";
import {
  day,
  plusDays,
  dateRange,
  occurrence,
  recurringDuration,
  DateTime,
} from "../utils/dates.js";
import { fail } from "../utils/validation.js";

export const overlaps = (a, b) => a.start < b.end && b.start < a.end;
export function mergeIntervals(intervals) {
  const result = [];
  for (const current of [...intervals].sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && current.start <= last.end)
      last.end = Math.max(last.end, current.end);
    else result.push({ ...current });
  }
  return result;
}
export function freeIntervals(start, end, occupied) {
  const free = [];
  let cursor = start;
  for (const b of mergeIntervals(occupied)) {
    if (b.end <= cursor || b.start >= end) continue;
    if (b.start > cursor)
      free.push({ start: cursor, end: Math.min(b.start, end) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < end) free.push({ start: cursor, end });
  return free;
}
export function occupiedOn(date, zone, blocks) {
  const start = day(date, zone).toMillis(),
    end = day(plusDays(date, 1), zone).toMillis();
  const intervals = [];
  for (const b of blocks) {
    if (b.recordType === "recurring") {
      for (const d of [plusDays(date, -1), date])
        if (day(d, zone).weekday === b.weekday)
          intervals.push(occurrence(b, d, zone));
    } else if (b.status !== "cancelled")
      intervals.push({
        start: +new Date(b.startAt),
        end: +new Date(b.endAt),
        title: b.title,
        id: String(b._id),
      });
  }
  return intervals.filter((i) => i.start < end && i.end > start);
}
export function availabilityForDay(
  date,
  zone,
  blocks,
  tasks,
  now = Date.now(),
) {
  const start = Math.max(day(date, zone).toMillis(), now),
    end = day(plusDays(date, 1), zone).toMillis();
  const free =
    start < end
      ? freeIntervals(start, end, occupiedOn(date, zone, blocks))
      : [];
  const freeMinutes = Math.floor(
    free.reduce((sum, i) => sum + (i.end - i.start) / 60000, 0),
  );
  const reservedMinutes = tasks
    .filter(
      (t) =>
        t.placementMode === "flexible" &&
        t.status !== "completed" &&
        t.flexibleDate === date,
    )
    .reduce((sum, t) => sum + t.durationMinutes, 0);
  return {
    date,
    intervals: free.map((i) => ({
      startAt: new Date(i.start).toISOString(),
      endAt: new Date(i.end).toISOString(),
      minutes: Math.floor((i.end - i.start) / 60000),
    })),
    freeMinutes,
    reservedMinutes,
    remainingMinutes: Math.max(0, freeMinutes - reservedMinutes),
  };
}
export async function loadSchedule(userId, excludeTaskId) {
  const blocks = await ScheduleBlock.find({ userId }).lean();
  const tasks = await Task.find({ userId }).lean();
  return {
    blocks: blocks.filter(
      (b) =>
        !(
          excludeTaskId &&
          String(b.taskId) === String(excludeTaskId) &&
          b.status === "pending" &&
          +b.endAt > Date.now()
        ),
    ),
    tasks: tasks
      .filter((t) => String(t._id) !== String(excludeTaskId))
      .map((t) => ({
        ...t,
        durationMinutes: Math.max(
          0,
          t.durationMinutes -
            blocks
              .filter(
                (b) =>
                  String(b.taskId) === String(t._id) &&
                  b.status === "completed",
              )
              .reduce((n, b) => n + (+b.endAt - +b.startAt) / 60000, 0),
        ),
      })),
  };
}
export async function getAvailability(
  user,
  from,
  to,
  duration = 30,
  excludeTaskId,
) {
  const dates = dateRange(from, to);
  const { blocks, tasks } = await loadSchedule(user._id, excludeTaskId);
  return dates.map((date) => {
    const result = availabilityForDay(date, user.timezone, blocks, tasks);
    const suggestions = [];
    if (result.remainingMinutes >= duration)
      for (const i of result.intervals) {
        const local = DateTime.fromISO(i.startAt).setZone(user.timezone);
        const rounded = local.startOf("hour").plus({
          minutes:
            Math.ceil(
              (local.minute +
                (local.second > 0 || local.millisecond > 0 ? 1 : 0)) /
                30,
            ) * 30,
        });
        for (
          let start = rounded.toMillis();
          start + duration * 60000 <= +new Date(i.endAt) &&
          suggestions.length < 24;
          start += 30 * 60000
        )
          suggestions.push({
            startAt: new Date(start).toISOString(),
            endAt: new Date(start + duration * 60000).toISOString(),
          });
      }
    return { ...result, suggestions };
  });
}
function conflict(a, b, date) {
  fail(
    `${date}: “${a.title || "Selected time"}” overlaps “${b.title}”`,
    409,
    "SCHEDULE_CONFLICT",
    [{ date, title: b.title }],
  );
}
export function validateRecurring(proposed, existing, zone, now = Date.now()) {
  for (const b of proposed) recurringDuration(b);
  const all = [
    ...existing.filter((b) => b.recordType === "recurring"),
    ...proposed,
  ];
  // A synthetic full week plus both edges covers every recurring weekly boundary.
  const anchors = dateRange("2026-01-04", "2026-01-12");
  for (const a of proposed)
    for (const date of anchors)
      if (day(date, zone).weekday === a.weekday) {
        const i = occurrence(a, date, zone);
        for (const b of all)
          if (b !== a)
            for (const d of [plusDays(date, -1), date, plusDays(date, 1)]) {
              if (
                day(d, zone).weekday === b.weekday &&
                overlaps(i, occurrence(b, d, zone))
              )
                conflict(a, b, `weekday ${a.weekday}`);
            }
      }
  for (const b of existing.filter(
    (b) =>
      b.recordType === "session" &&
      b.status !== "cancelled" &&
      +new Date(b.endAt) > now,
  )) {
    const date = DateTime.fromJSDate(new Date(b.startAt), { zone }).toISODate();
    for (const a of proposed)
      for (const d of [plusDays(date, -1), date, plusDays(date, 1)])
        if (
          day(d, zone).weekday === a.weekday &&
          overlaps(occurrence(a, d, zone), {
            start: +new Date(b.startAt),
            end: +new Date(b.endAt),
          })
        )
          conflict(a, b, date);
  }
}
export function validateCapacity(dates, zone, blocks, tasks, now = Date.now()) {
  for (const date of new Set(dates)) {
    const a = availabilityForDay(date, zone, blocks, tasks, now);
    if (a.reservedMinutes > a.freeMinutes)
      fail(
        `${date} has ${a.freeMinutes} free minutes and ${a.reservedMinutes} flexible minutes reserved`,
        409,
        "CAPACITY_CONFLICT",
      );
  }
}
