import { retiredSession } from "../utils/sessions.js";
import { Task, ScheduleBlock } from "../models/index.js";
import { fail } from "../utils/validation.js";
export function reminderEligible(record, now = Date.now()) {
  if (
    retiredSession(record) ||
    record.status === "completed" ||
    record.status === "cancelled" ||
    record.status === "held"
  )
    return false;
  if (["delivered", "cancelled"].includes(record.reminderStatus)) return false;
  if (record.snoozedUntil) return +new Date(record.snoozedUntil) <= now;
  const start = +new Date(record.startAt || record.flexibleReminderAt);
  return start <= now && start >= now - 5 * 60000;
}
export async function dueReminders(userId) {
  const now = Date.now();
  const tasks = await Task.find({
    userId,
    status: { $nin: ["completed", "held"] },
  }).lean();
  const blocks = await ScheduleBlock.find({
    userId,
    recordType: "session",
    status: { $in: ["pending", "missed"] },
    startAt: { $lte: new Date(now) },
    reminderStatus: { $nin: ["delivered", "cancelled"] },
  }).lean();
  const byId = new Map(tasks.map((t) => [String(t._id), t]));
  const due = [];
  for (const b of blocks) {
    const task = byId.get(String(b.taskId));
    if (task && reminderEligible(b, now))
      due.push({
        id: `session:${b._id}`,
        taskId: String(task._id),
        title: task.title,
        message:
          task.motivationalMessage ||
          "Your planned session is ready. Open the task to begin.",
        startAt: b.startAt,
      });
  }
  for (const t of tasks)
    if (
      t.placementMode === "flexible" &&
      t.flexibleReminderAt &&
      reminderEligible(t, now)
    )
      due.push({
        id: `task:${t._id}`,
        taskId: String(t._id),
        title: t.title,
        message: t.motivationalMessage,
        startAt: t.flexibleReminderAt,
      });
  return due.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
}
function target(id) {
  const [type, raw] = id.split(":");
  if (!["task", "session"].includes(type) || !/^[a-f\d]{24}$/i.test(raw))
    fail("Invalid reminder ID");
  return { model: type === "task" ? Task : ScheduleBlock, id: raw, type };
}
export async function claimReminder(userId, id) {
  const due = await dueReminders(userId);
  if (!due.some((r) => r.id === id))
    fail("Reminder is no longer due", 409, "REMINDER_EXPIRED");
  const t = target(id);
  const record = await t.model.findOneAndUpdate(
    {
      _id: t.id,
      userId,
      reminderStatus: { $nin: ["delivered", "cancelled"] },
      status: { $nin: ["completed", "cancelled", "held"] },
    },
    {
      $set: {
        reminderStatus: "delivered",
        reminderDeliveredAt: new Date(),
        snoozedUntil: null,
      },
    },
    { new: true },
  );
  if (!record)
    fail("This reminder was already delivered", 409, "ALREADY_DELIVERED");
  return due.find((r) => r.id === id);
}
export async function snoozeReminder(userId, id) {
  const t = target(id);
  const record = await t.model.findOne({ _id: t.id, userId });
  if (
    !record ||
    retiredSession(record) ||
    ["completed", "cancelled", "held"].includes(record.status)
  )
    fail("Reminder is no longer active", 409);
  if (!["delivered", "snoozed"].includes(record.reminderStatus))
    fail("Only a delivered reminder can be snoozed", 409);
  if (
    t.type === "session" &&
    !(await Task.exists({
      _id: record.taskId,
      userId,
      status: { $nin: ["completed", "held"] },
    }))
  )
    fail("Task is no longer active", 409);
  record.snoozedUntil = new Date(Date.now() + 10 * 60000);
  record.reminderStatus = "snoozed";
  await record.save();
  return record;
}
export async function reminderState(userId, id) {
  const t = target(id),
    record = await t.model.findOne({ _id: t.id, userId }).lean();
  if (!record) fail("Reminder not found", 404);
  const task =
    t.type === "task"
      ? record
      : await Task.findOne({ _id: record.taskId, userId }).lean();
  return {
    startAt: record.startAt || record.flexibleReminderAt || null,
    active: Boolean(
      task &&
        (t.type !== "task" ||
          (task.placementMode === "flexible" && task.flexibleReminderAt)) &&
        !retiredSession(record) &&
        record.reminderStatus !== "cancelled" &&
        !["completed", "held"].includes(task.status) &&
        !["completed", "cancelled", "held"].includes(record.status),
    ),
  };
}
