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
  const old = await ScheduleBlock.findOne({
    _id: id,
    userId,
    recordType: "session",
  });
  if (!user || !old) fail("Session not found", 404);
  const task = await Task.findOne({ _id: old.taskId, userId });
  if (!task) fail("Task not found", 404);
  if (old.status === "completed" || task.status === "completed")
    fail("Completed work cannot be moved or split", 409);
  if (task.placementMode !== "scheduled")
    fail(
      "Use Reschedule / change placement to assign held or flexible remaining work.",
      409,
    );
  const duration = +old.endAt - +old.startAt;
  const start = split ? +old.startAt : +new Date(body.startAt);
  const end = split ? +old.endAt : +new Date(body.endAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end - start !== duration
  )
    fail(
      "Keep the saved session duration unchanged. Use Split to divide it.",
      400,
      "INVALID_DURATION",
    );
  const existing =
    !split &&
    (await ScheduleBlock.findOne({
      userId,
      taskId: old.taskId,
      $or: [{ rescheduleSourceId: old._id }, { supersedesSessionId: old._id }],
    }));
  const retireOriginal = async (replacement) => {
    await ScheduleBlock.updateOne(
      { _id: old._id, userId, status: { $in: ["pending", "missed"] } },
      {
        $set: {
          status: +old.endAt < Date.now() ? "missed" : old.status,
          rescheduledToSessionId: replacement._id,
          cancelReason: "rescheduled",
          reminderStatus: "cancelled",
          snoozedUntil: null,
        },
      },
    );
  };
  if (existing) {
    if (+existing.startAt !== start || +existing.endAt !== end)
      fail(
        "This occurrence was already rescheduled. Open its replacement to move it again.",
        409,
        "ALREADY_RESCHEDULED",
      );
    await retireOriginal(existing); // Recover a lost response or interrupted link write.
    return [existing];
  }
  if (
    old.status === "cancelled" ||
    old.rescheduledToSessionId ||
    Boolean(old.cancelReason)
  )
    fail("This occurrence is no longer active. Open its replacement.", 409);
  if (split && (old.status !== "pending" || +old.startAt <= Date.now()))
    fail(
      "Only upcoming unfinished sessions can be split. Reschedule started or missed work instead.",
      409,
    );
  // A retry of a successful upcoming move must not reset its delivered reminder.
  if (
    !split &&
    old.status === "pending" &&
    +old.startAt === start &&
    +old.endAt === end
  )
    return [old];
  if (start <= Date.now()) fail("Choose a future start time", 400, "PAST_TIME");
  const point = split ? +new Date(body.splitAt) : null;
  if (
    split &&
    (!Number.isFinite(point) ||
      point <= start ||
      point >= end ||
      (point - start) % 60000)
  )
    fail(
      "Split point must be a whole minute strictly inside the saved session",
      400,
      "INVALID_SPLIT",
    );
  if (
    task.deadlineDate &&
    end >
      DateTime.fromISO(task.deadlineDate, { zone: user.timezone })
        .plus({ days: 1 })
        .startOf("day")
        .toMillis()
  )
    fail("Session ends after the task deadline", 400, "DEADLINE_VIOLATION");
  const { blocks, tasks } = await loadSchedule(userId);
  const retained = blocks.filter((b) => String(b._id) !== id);
  const dates = [
    DateTime.fromMillis(start, { zone: user.timezone }).toISODate(),
    DateTime.fromMillis(end - 1, { zone: user.timezone }).toISODate(),
  ];
  for (const date of new Set(dates))
    for (const b of occupiedOn(date, user.timezone, retained))
      if (overlaps({ start, end }, b))
        fail(`Selected time overlaps "${b.title}"`, 409, "SCHEDULE_CONFLICT");
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
    title: task.title,
    startAt: new Date(s),
    endAt: new Date(e),
    status: "pending",
  }));
  validateCapacity(dates, user.timezone, [...retained, ...proposed], tasks);
  if (split) {
    // Keep the first half's ID, including any incoming reschedule-history link.
    // Save the second half before shortening the first; restore on caught failure.
    const original = old.toObject();
    const second = new ScheduleBlock({
      ...proposed[1],
      supersedesSessionId: old.supersedesSessionId,
    });
    old.endAt = new Date(point);
    old.reminderStatus = "pending";
    old.reminderDeliveredAt = null;
    old.snoozedUntil = null;
    await second.validate();
    await old.validate();
    try {
      await second.save();
      await old.save();
      return [old, second];
    } catch (error) {
      try {
        await ScheduleBlock.replaceOne({ _id: old._id, userId }, original);
        await ScheduleBlock.deleteOne({ _id: second._id, userId });
      } catch {
        fail(
          "Split cleanup could not finish. Reload and inspect this session before retrying.",
          503,
          "PARTIAL_WRITE",
        );
      }
      throw error;
    }
  }
  if (old.status === "pending" && +old.startAt > Date.now()) {
    // An upcoming move is one document update, preserving ID and duration.
    const moved = await ScheduleBlock.findOneAndUpdate(
      {
        _id: old._id,
        userId,
        status: "pending",
        startAt: old.startAt,
        endAt: old.endAt,
      },
      {
        $set: {
          startAt: new Date(start),
          endAt: new Date(end),
          reminderStatus: "pending",
          reminderDeliveredAt: null,
          snoozedUntil: null,
        },
      },
      { new: true, runValidators: true },
    );
    if (!moved) fail("Session changed. Reload before moving it.", 409);
    return [moved];
  }
  const replacement = new ScheduleBlock({
    ...proposed[0],
    supersedesSessionId: old._id,
    rescheduleSourceId: old._id,
  });
  await replacement.validate();
  try {
    await replacement.save();
  } catch (error) {
    if (error.code !== 11000) throw error;
    const winner = await ScheduleBlock.findOne({
      userId,
      rescheduleSourceId: old._id,
    });
    if (!winner || +winner.startAt !== start || +winner.endAt !== end)
      fail("A reschedule is already saved. Reload this task.", 409);
    await retireOriginal(winner);
    return [winner];
  }
  // Keep the saved replacement if this last link fails. The unique source link
  // lets the exact same PATCH repair it on retry without another occurrence.
  try {
    await retireOriginal(replacement);
  } catch {
    fail(
      "Replacement saved. Retry this reschedule to finish retiring the old reminder.",
      503,
      "RESCHEDULE_SAVED",
    );
  }
  return [replacement];
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
