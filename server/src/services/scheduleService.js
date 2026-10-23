import { replaceBlocks } from "./blockWrites.js";
import { applyPlacement } from "./placementService.js";
import { randomUUID } from "node:crypto";
import { ScheduleBlock, Task, User } from "../models/index.js";
import {
  blockFields,
  parse,
  selectedDays,
  fail,
  scopeFields,
} from "../utils/validation.js";
import { recurringDuration, DateTime, today } from "../utils/dates.js";
import {
  loadSchedule,
  validateRecurring,
  validateCapacity,
  occupiedOn,
  overlaps,
} from "./availabilityService.js";

function capacityAfterRules(user, blocks, tasks) {
  validateCapacity(
    tasks
      .filter(
        (t) =>
          t.status !== "completed" && t.flexibleDate >= today(user.timezone),
      )
      .map((t) => t.flexibleDate),
    user.timezone,
    blocks,
    tasks,
  );
}
export async function saveRecurring(userId, id, body, scope = "one") {
  const fields = parse(blockFields, body);
  recurringDuration(fields);
  parse(scopeFields, scope);
  const user = await User.findById(userId);
  if (!user) fail("User not found", 404);
  const { blocks, tasks } = await loadSchedule(userId);
  const old = id ? blocks.find((b) => String(b._id) === id) : null;
  if (id && !old) fail("Block not found", 404);
  if (old && old.recordType !== "recurring")
    fail("Use the session editor for dated work");
  const originals = old
    ? blocks.filter(
        (b) =>
          String(b._id) === id ||
          (scope === "group" && b.groupId === old.groupId),
      )
    : [];
  const excluding = new Set(originals.map((b) => String(b._id)));
  const retained = blocks.filter((b) => !excluding.has(String(b._id)));
  const weekdays = old
    ? scope === "group"
      ? originals.map((b) => b.weekday)
      : [fields.weekday]
    : selectedDays(fields);
  if (!weekdays.length) fail("Choose at least one day");
  const groupId = old?.groupId || randomUUID();
  const proposed = weekdays.map((weekday) => ({
    userId,
    recordType: "recurring",
    title: fields.title,
    kind: fields.kind,
    weekday,
    startMinute: fields.startMinute,
    endMinute: fields.endMinute,
    endsNextDay: fields.endsNextDay,
    groupId,
  }));
  validateRecurring(proposed, retained, user.timezone);
  capacityAfterRules(user, [...retained, ...proposed], tasks);
  return replaceBlocks(userId, originals, proposed);
}
export async function deleteBlock(userId, id, scope = "one") {
  parse(scopeFields, scope);
  const block = await ScheduleBlock.findOne({ _id: id, userId });
  if (!block) fail("Block not found", 404);
  if (block.recordType === "session") {
    if (block.status !== "pending" || +block.startAt <= Date.now())
      fail("Only upcoming sessions can be removed; history is retained", 409);
    const task = await Task.findOne({ _id: block.taskId, userId });
    const user = await User.findById(userId);
    if (!task || !user) fail("Task not found", 404);
    await applyPlacement(user, task, { placementMode: "held" });
    return { taskId: block.taskId };
  }
  await ScheduleBlock.deleteMany(
    {
      userId,
      ...(scope === "group" ? { groupId: block.groupId } : { _id: id }),
    },
    {},
  );
  return {};
}
export async function mutateSession(userId, id, body, split = false) {
  const user = await User.findById(userId);
  if (!user) fail("User not found", 404);
  const old = await ScheduleBlock.findOne({
    _id: id,
    userId,
    recordType: "session",
  });
  if (!old) fail("Session not found", 404);
  if (old.status !== "pending" || +old.startAt <= Date.now())
    fail("Only upcoming sessions can be moved or split", 409);
  const start = split ? +old.startAt : +new Date(body.startAt),
    end = split ? +old.endAt : +new Date(body.endAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start <= Date.now() ||
    end <= start ||
    end - start !== +old.endAt - +old.startAt
  )
    fail("Moving must preserve the session duration and use future time");
  const point = split ? +new Date(body.splitAt) : null;
  if (
    split &&
    (!point || point <= start || point >= end || (point - start) % 60000)
  )
    fail("Split point must be a whole minute strictly inside the session");
  const { blocks, tasks } = await loadSchedule(userId);
  const retained = blocks.filter((b) => String(b._id) !== id);
  const task = await Task.findOne({ _id: old.taskId, userId });
  if (!task) fail("Task not found", 404);
  if (
    task.deadlineDate &&
    DateTime.fromMillis(end - 1, { zone: user.timezone }).toISODate() >
      task.deadlineDate
  )
    fail("Session ends after the deadline");
  const dates = [
    DateTime.fromMillis(start, { zone: user.timezone }).toISODate(),
    DateTime.fromMillis(end - 1, { zone: user.timezone }).toISODate(),
  ];
  for (const d of new Set(dates))
    for (const b of occupiedOn(d, user.timezone, retained))
      if (overlaps({ start, end }, b))
        fail(`Selected time overlaps “${b.title}”`, 409, "SCHEDULE_CONFLICT");
  const proposed = (
    split
      ? [
          [start, point],
          [point, end],
        ]
      : [[start, end]]
  ).map(([s, e]) => ({
    userId,
    taskId: old.taskId,
    recordType: "session",
    kind: "task",
    title: old.title,
    startAt: new Date(s),
    endAt: new Date(e),
    status: "pending",
  }));
  validateCapacity(dates, user.timezone, [...retained, ...proposed], tasks);
  return replaceBlocks(userId, [old.toObject()], proposed);
}
export async function splitRecurring(userId, id, body) {
  const user = await User.findById(userId);
  if (!user) fail("User not found", 404);
  const scope = parse(scopeFields, body.scope || "one");
  const old = await ScheduleBlock.findOne({
    _id: id,
    userId,
    recordType: "recurring",
  });
  if (!old) fail("Block not found", 404);
  const point = Number(body.splitMinute),
    duration = recurringDuration(old);
  const adjusted = point < old.startMinute ? point + 1440 : point;
  if (
    !Number.isInteger(point) ||
    point < 0 ||
    point > 1440 ||
    adjusted <= old.startMinute ||
    adjusted >= old.startMinute + duration
  )
    fail("Split time must be strictly inside the block");
  const { blocks, tasks } = await loadSchedule(userId);
  const originals = blocks.filter(
    (b) =>
      String(b._id) === id || (scope === "group" && b.groupId === old.groupId),
  );
  const ids = new Set(originals.map((b) => String(b._id))),
    retained = blocks.filter((b) => !ids.has(String(b._id)));
  const firstGroup = old.groupId,
    secondGroup = randomUUID(),
    proposed = [];
  for (const b of originals) {
    const originalDuration = recurringDuration(b),
      p = point < b.startMinute ? point + 1440 : point;
    if (p <= b.startMinute || p >= b.startMinute + originalDuration)
      fail("The split is not inside every selected group block");
    const base = {
      userId,
      recordType: "recurring",
      kind: b.kind,
      title: b.title,
    };
    const next = p >= 1440;
    proposed.push({
      ...base,
      weekday: b.weekday,
      startMinute: b.startMinute,
      endMinute: next ? (p === 1440 ? 1440 : point) : point,
      endsNextDay: next && p !== 1440,
      groupId: firstGroup,
    });
    proposed.push({
      ...base,
      weekday: next ? (b.weekday % 7) + 1 : b.weekday,
      startMinute: point === 1440 ? 0 : point,
      endMinute: b.endMinute,
      endsNextDay: b.endsNextDay && !next,
      groupId: secondGroup,
    });
  }
  validateRecurring(proposed, retained, user.timezone);
  capacityAfterRules(user, [...retained, ...proposed], tasks);
  return replaceBlocks(userId, originals, proposed);
}
