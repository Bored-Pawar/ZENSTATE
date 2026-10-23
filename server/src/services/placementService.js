import { Task, ScheduleBlock, User } from "../models/index.js";
import { placementFields, parse, fail } from "../utils/validation.js";
import { DateTime, day, plusDays, today } from "../utils/dates.js";
import {
  loadSchedule,
  occupiedOn,
  overlaps,
  validateCapacity,
} from "./availabilityService.js";

export async function markMissed(userId) {
  await ScheduleBlock.updateMany(
    {
      userId,
      recordType: "session",
      status: "pending",
      endAt: { $lt: new Date() },
    },
    { $set: { status: "missed" } },
    {},
  );
}
export async function validatePlacement(user, task, raw) {
  const p = parse(placementFields, raw),
    now = Date.now();
  const { blocks, tasks } = await loadSchedule(user._id, task._id);
  const completed = blocks
    .filter(
      (b) => String(b.taskId) === String(task._id) && b.status === "completed",
    )
    .reduce((n, b) => n + (+b.endAt - +b.startAt) / 60000, 0);
  const remaining = Math.max(0, task.durationMinutes - completed);
  const deadline = task.deadlineDate
    ? day(plusDays(task.deadlineDate, 1), user.timezone).toMillis()
    : Infinity;
  const dates = tasks
    .filter(
      (t) =>
        t.placementMode === "flexible" &&
        t.status !== "completed" &&
        t.flexibleDate >= today(user.timezone),
    )
    .map((t) => t.flexibleDate);
  if (p.placementMode === "scheduled") {
    if (!p.sessions?.length || !remaining)
      fail("Provide dated sessions for the remaining planned effort");
    let minutes = 0;
    for (const s of p.sessions) {
      const start = +new Date(s.startAt),
        end = +new Date(s.endAt),
        duration = (end - start) / 60000;
      if (
        start <= now ||
        end <= start ||
        !Number.isInteger(duration) ||
        duration > 1440
      )
        fail(
          "Sessions need future starts and positive whole-minute durations up to 24 hours",
        );
      if (end > deadline) fail("Session ends after the task deadline");
      const date = DateTime.fromISO(s.startAt, {
        zone: user.timezone,
      }).toISODate();
      const endDate = DateTime.fromMillis(end - 1, {
        zone: user.timezone,
      }).toISODate();
      for (const d of new Set([date, endDate])) {
        for (const b of occupiedOn(d, user.timezone, blocks))
          if (overlaps({ start, end }, b))
            fail(
              `${d}: selected session overlaps “${b.title}”`,
              409,
              "SCHEDULE_CONFLICT",
            );
        dates.push(d);
      }
      blocks.push({
        recordType: "session",
        ...s,
        title: task.title,
        status: "pending",
      });
      minutes += duration;
    }
    if (minutes !== remaining)
      fail(
        `Sessions must total exactly ${remaining} remaining minutes; selected ${minutes}`,
      );
  } else if (p.placementMode === "flexible") {
    if (!p.flexibleDate || p.flexibleDate < today(user.timezone))
      fail("Choose today or a future flexible date");
    if (day(plusDays(p.flexibleDate, 1), user.timezone).toMillis() > deadline)
      fail("Flexible date is after the deadline");
    if (p.flexibleReminderAt) {
      const reminder = DateTime.fromISO(p.flexibleReminderAt, {
        zone: user.timezone,
      });
      if (reminder.toISODate() !== p.flexibleDate || reminder.toMillis() <= now)
        fail("Reminder must be in the future on the flexible date");
    }
    dates.push(p.flexibleDate);
    tasks.push({
      ...(task.toObject?.() || task),
      ...p,
      durationMinutes: remaining,
      status: "pending",
    });
  }
  validateCapacity(dates, user.timezone, blocks, tasks);
  return p;
}
// Replacement sessions save first. Old session snapshots are used only for this
// placement operation's cleanup; ordinary writes are not transactionally atomic.
export async function applyPlacement(user, task, raw) {
  const p = await validatePlacement(user, task, raw);
  await markMissed(user._id);
  const old = await ScheduleBlock.find({
    userId: user._id,
    taskId: task._id,
    status: { $in: ["pending", "missed"] },
  }).lean();
  const missed = old
    .filter((b) => b.status === "missed")
    .sort((a, b) => +a.startAt - +b.startAt);
  const replacements =
    p.placementMode === "scheduled"
      ? p.sessions.map(
          (s, i) =>
            new ScheduleBlock({
              userId: user._id,
              taskId: task._id,
              recordType: "session",
              kind: "task",
              title: task.title,
              ...s,
              status: "pending",
              supersedesSessionId: missed[i]?._id,
            }),
        )
      : [];
  for (const block of replacements) await block.validate();
  const originalTask = task.toObject();
  Object.assign(task, {
    placementMode: p.placementMode,
    flexibleDate: p.placementMode === "flexible" ? p.flexibleDate : null,
    flexibleReminderAt:
      p.placementMode === "flexible" ? p.flexibleReminderAt : null,
    reminderStatus: "pending",
    snoozedUntil: null,
    reminderDeliveredAt: null,
    status: p.placementMode === "held" ? "held" : "pending",
  });
  await task.validate();
  try {
    for (const block of replacements) await block.save();
    // Flexible/held placement lives on Task, so save that replacement too
    // before retiring any existing session. A caught later failure restores it.
    await task.save();
    // Restrict updates to the captured IDs: never cancel the new sessions.
    for (const block of old) {
      await ScheduleBlock.updateOne(
        { _id: block._id, userId: user._id },
        {
          $set: {
            status:
              block.status === "pending" && +block.endAt > Date.now()
                ? "cancelled"
                : block.status,
            reminderStatus: "cancelled",
            snoozedUntil: null,
          },
        },
      );
    }
    return task;
  } catch (error) {
    try {
      for (const block of old)
        await ScheduleBlock.replaceOne(
          { _id: block._id, userId: user._id },
          block,
          { upsert: true },
        );
      // Also restores the task when the driver acknowledged a save before failing.
      if (!task.isNew)
        await Task.replaceOne(
          { _id: task._id, userId: user._id },
          originalTask,
        );
      await ScheduleBlock.deleteMany({
        userId: user._id,
        _id: { $in: replacements.map((b) => b._id) },
      });
    } catch {
      fail(
        "Placement cleanup could not finish. Reload the timetable and inspect this task before retrying.",
        503,
        "PARTIAL_WRITE",
      );
    }
    throw error;
  }
}
export async function placeTask(userId, id, raw) {
  const user = await User.findById(userId);
  if (!user) fail("User not found", 404);
  const task = await Task.findOne({ _id: id, userId });
  if (!task) fail("Task not found", 404);
  if (task.status === "completed")
    fail("Reopen the task before changing placement", 409);
  return applyPlacement(user, task, raw);
}
