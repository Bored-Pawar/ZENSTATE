import { Task, ScheduleBlock, User } from "../models/index.js";
import {
  placementFields,
  parse,
  fail,
  validateGoalPeriod,
} from "../utils/validation.js";
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
      rescheduledToSessionId: { $exists: false },
      cancelReason: { $exists: false },
      endAt: { $lt: new Date() },
    },
    { $set: { status: "missed" } },
    {},
  );
}
export async function validatePlacement(user, task, raw) {
  validateGoalPeriod(task);
  const p = parse(placementFields, raw),
    now = Date.now();
  const multiDay = task.taskType === "multi_day";
  const { blocks, tasks } = await loadSchedule(
    user._id,
    multiDay ? undefined : task._id,
  );
  if (multiDay && p.placementMode === "flexible")
    fail(
      "Multi-day goals use individually dated sessions; choose held or schedule a day",
    );
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
    if (!p.sessions?.length || (!multiDay && !remaining))
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
      if (
        multiDay &&
        (date < task.goalStartDate ||
          endDate > task.goalEndDate ||
          date !== endDate)
      )
        fail("Choose a session within one local day of the goal period");
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
    if (!multiDay && minutes !== remaining)
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
  const requested = parse(placementFields, raw);
  if (task.taskType === "multi_day") return addGoalDay(user, task, requested);
  if (
    !task.isNew &&
    !(task.sourceConversationId && task.planConfirmationReady === false) &&
    requested.placementMode === task.placementMode
  ) {
    const current = await ScheduleBlock.find({
      userId: user._id,
      taskId: task._id,
      status: "pending",
      rescheduledToSessionId: { $exists: false },
      cancelReason: { $exists: false },
    }).sort({ startAt: 1 });
    const intervals = (values) =>
      values
        .map((b) => `${+new Date(b.startAt)}:${+new Date(b.endAt)}`)
        .sort()
        .join(",");
    if (
      (requested.placementMode === "scheduled" &&
        current.length &&
        intervals(current) === intervals(requested.sessions || [])) ||
      (requested.placementMode === "flexible" &&
        task.flexibleDate === requested.flexibleDate &&
        +(task.flexibleReminderAt || 0) ===
          +(requested.flexibleReminderAt
            ? new Date(requested.flexibleReminderAt)
            : 0)) ||
      (requested.placementMode === "held" && !current.length)
    ) {
      task.$locals.placementChanged = false;
      return task;
    }
  }
  const p = await validatePlacement(user, task, requested);
  task.$locals.placementChanged = true;
  await markMissed(user._id);
  const old = await ScheduleBlock.find({
    userId: user._id,
    taskId: task._id,
    status: { $in: ["pending", "missed"] },
    rescheduledToSessionId: { $exists: false },
    cancelReason: { $exists: false },
  }).lean();
  const missed = old
    .filter((b) => b.status === "missed" || +b.startAt <= Date.now())
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
      const historical = +block.startAt <= Date.now();
      const replacement = historical
        ? replacements[
            missed.findIndex((b) => String(b._id) === String(block._id))
          ] || replacements[0]
        : null;
      await ScheduleBlock.updateOne(
        { _id: block._id, userId: user._id },
        {
          $set: {
            status:
              block.status === "pending" && +block.endAt > Date.now()
                ? "cancelled"
                : block.status,
            ...(replacement
              ? {
                  rescheduledToSessionId: replacement._id,
                  cancelReason: "rescheduled",
                  status: +block.endAt < Date.now() ? "missed" : block.status,
                }
              : { cancelReason: "placement_changed" }),
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
// Each request adds one dated session. Existing placements are never replaced.
async function addGoalDay(user, task, requested) {
  validateGoalPeriod(task);
  if (requested.placementMode === "held") {
    if (
      await ScheduleBlock.exists({
        userId: user._id,
        taskId: task._id,
        status: { $ne: "cancelled" },
      })
    )
      fail("Use the individual session controls to change scheduled days", 409);
    Object.assign(task, { placementMode: "held", status: "held" });
    await task.save();
    return task;
  }
  if (
    requested.placementMode !== "scheduled" ||
    requested.sessions?.length !== 1
  )
    fail("Schedule one dated session at a time for a multi-day goal");
  const s = requested.sessions[0];
  const key = `${task._id}:${requested.placementRequestId || `${+new Date(s.startAt)}:${+new Date(s.endAt)}`}`;
  let block = await ScheduleBlock.findOne({
    userId: user._id,
    dayPlacementKey: key,
  });
  if (
    block &&
    (+block.startAt !== +new Date(s.startAt) ||
      +block.endAt !== +new Date(s.endAt))
  )
    fail(
      "This placement was already saved and changed. Reload the goal and use Schedule a day for a new placement.",
      409,
    );
  if (!block) {
    try {
      await validatePlacement(user, task, requested);
      block = await ScheduleBlock.create({
        userId: user._id,
        taskId: task._id,
        recordType: "session",
        kind: "task",
        title: task.title,
        ...s,
        status: "pending",
        dayPlacementKey: key,
      });
    } catch (error) {
      if (error.code !== 11000 && error.code !== "SCHEDULE_CONFLICT")
        throw error;
      block = await ScheduleBlock.findOne({
        userId: user._id,
        dayPlacementKey: key,
      });
      if (!block) throw error;
    }
  }
  // Keep the receipt/session if the task save fails: retry repairs this one task.
  Object.assign(task, {
    placementMode: "scheduled",
    status: task.status === "in_progress" ? "in_progress" : "pending",
  });
  try {
    await task.save();
  } catch {
    fail(
      "Session saved. Retry this placement to refresh the goal state.",
      503,
      "DAY_PLACEMENT_SAVED",
    );
  }
  return task;
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
