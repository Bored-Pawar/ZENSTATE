import { retiredSession, withRescheduleHistory } from "../utils/sessions.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import {
  User,
  Task,
  Note,
  ScheduleBlock,
  Conversation,
  Message,
} from "../models/index.js";
import {
  parse,
  fail,
  timezone,
  taskFields,
  taskPatchFields,
  placementFields,
  draftFields,
  noteFields,
  dateOnly,
  instant,
  validateGoalPeriod,
} from "../utils/validation.js";
import { day, plusDays, today, DateTime } from "../utils/dates.js";
import {
  applyPlacement,
  placeTask,
  markMissed,
} from "../services/placementService.js";
import {
  getAvailability,
  loadSchedule,
  validateRecurring,
  validateCapacity,
} from "../services/availabilityService.js";
import {
  saveRecurring,
  deleteBlock,
  mutateSession,
  splitRecurring,
} from "../services/scheduleService.js";
import { invalidateContext } from "../services/taskContextService.js";
import {
  readConversation,
  sendMessage,
  confirmPlan,
} from "../services/plannerService.js";
import {
  dueReminders,
  claimReminder,
  snoozeReminder,
  reminderState,
} from "../services/reminderService.js";
import { weeklyReport } from "../services/reportService.js";

const send = (res, data, status = 200) => res.status(status).json({ data });
const own = async (Model, req, id = req.params.id) => {
  const result = await Model.findOne({ _id: id, userId: req.user._id });
  if (!result) fail("Record not found", 404);
  return result;
};
const tokenFor = (user) =>
  jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    algorithm: "HS256",
  });
const authFields = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(8).max(72),
  })
  .strict();
export const register = async (req, res) => {
  const b = parse(
    authFields.extend({ name: z.string().trim().min(1).max(80), timezone }),
    req.body,
  );
  if (await User.exists({ email: b.email }))
    fail("This email is already registered. Please sign in.", 409);
  const user = await User.create({
    name: b.name,
    email: b.email,
    timezone: b.timezone,
    passwordHash: await bcrypt.hash(b.password, 12),
  });
  send(res, { token: tokenFor(user), user }, 201);
};
export const login = async (req, res) => {
  const b = parse(authFields, req.body),
    user = await User.findOne({ email: b.email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(b.password, user.passwordHash)))
    fail("Email or password is incorrect", 401);
  send(res, { token: tokenFor(user), user });
};
export const me = async (req, res) => send(res, req.user);
export const updateUser = async (req, res) => {
  const b = parse(
    z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        timezone: timezone.optional(),
        voiceRemindersEnabled: z.boolean().optional(),
      })
      .strict(),
    req.body,
  );
  const user = req.user;
  if (b.timezone && b.timezone !== user.timezone) {
    const { blocks, tasks } = await loadSchedule(user._id);
    validateRecurring(
      blocks.filter((b) => b.recordType === "recurring"),
      blocks.filter((b) => b.recordType === "session"),
      b.timezone,
    );
    validateCapacity(
      tasks
        .filter(
          (t) =>
            t.flexibleDate >= today(b.timezone) && t.status !== "completed",
        )
        .map((t) => t.flexibleDate),
      b.timezone,
      blocks,
      tasks,
    );
  }
  Object.assign(user, b);
  await user.save();
  send(res, user);
};
export const finishSetup = async (req, res) => {
  const user = req.user;
  const sleeps = await ScheduleBlock.find({
    userId: user._id,
    recordType: "recurring",
    kind: "sleep",
  });
  const covered = new Set(sleeps.map((s) => s.weekday));
  if (covered.size < 7)
    fail(
      "Save a sleep block for each of the seven start weekdays before completing setup",
    );
  user.onboardingCompleted = true;
  await user.save();
  send(res, user);
};
export const listTasks = async (req, res) => {
  await markMissed(req.user._id);
  const tasks = await Task.find({ userId: req.user._id }).sort({
    createdAt: -1,
  });
  const sessions = withRescheduleHistory(
    await ScheduleBlock.find({
      userId: req.user._id,
      recordType: "session",
    }).lean(),
  );
  send(
    res,
    tasks.map((t) => ({
      ...t.toJSON(),
      sessionDates: [
        ...new Set(
          sessions
            .filter(
              (s) => String(s.taskId) === String(t._id) && !retiredSession(s),
            )
            .map((s) =>
              DateTime.fromJSDate(s.startAt, {
                zone: req.user.timezone,
              }).toISODate(),
            ),
        ),
      ],
      completedPlannedMinutes: sessions
        .filter(
          (s) => String(s.taskId) === String(t._id) && s.status === "completed",
        )
        .reduce((n, s) => n + (+s.endAt - +s.startAt) / 60000, 0),
    })),
  );
};
export const getTask = async (req, res) => {
  const task = await own(Task, req);
  const sessions = await ScheduleBlock.find({
    userId: req.user._id,
    taskId: task._id,
  }).sort({ startAt: 1 });
  send(res, {
    ...task.toJSON(),
    sessions: withRescheduleHistory(sessions.map((s) => s.toJSON())),
  });
};
export const createTask = async (req, res) => {
  const b = parse(taskFields.extend(placementFields.partial().shape), req.body);
  const {
    placementMode,
    flexibleDate,
    flexibleReminderAt,
    sessions,
    ...fields
  } = b;
  const task = new Task({ ...fields, userId: req.user._id });
  try {
    await applyPlacement(req.user, task, {
      placementMode: placementMode || "held",
      flexibleDate,
      flexibleReminderAt,
      sessions,
    });
  } catch (error) {
    // A new task has no original placement to restore. Remove only its own records.
    await ScheduleBlock.deleteMany({ userId: req.user._id, taskId: task._id });
    await Task.deleteOne({ _id: task._id, userId: req.user._id });
    throw error;
  }
  await invalidateContext(req.user._id, task._id);
  send(res, await Task.findById(task._id), 201);
};
export const updateTask = async (req, res) => {
  const b = parse(taskPatchFields, req.body);
  const user = req.user;
  const task = await own(Task, req);
  if (b.taskType !== undefined && b.taskType !== task.taskType)
    fail("Existing task type cannot be changed; create a separate goal");
  const proposed = { ...task.toObject(), ...b };
  validateGoalPeriod(proposed);
  if (
    task.taskType === "multi_day" &&
    (b.goalStartDate !== undefined || b.goalEndDate !== undefined)
  ) {
    const outside = await ScheduleBlock.exists({
      userId: user._id,
      taskId: task._id,
      $or: [
        {
          startAt: {
            $lt: day(proposed.goalStartDate, user.timezone).toJSDate(),
          },
        },
        {
          endAt: {
            $gt: day(
              plusDays(proposed.goalEndDate, 1),
              user.timezone,
            ).toJSDate(),
          },
        },
      ],
    });
    if (outside) fail("The goal period must include its saved session history");
  }
  if (
    b.durationMinutes !== undefined &&
    b.durationMinutes !== task.durationMinutes &&
    task.taskType !== "multi_day" &&
    task.placementMode !== "held"
  )
    fail("Hold the remaining work before changing planned duration");
  const completed = await ScheduleBlock.find({
    userId: user._id,
    taskId: task._id,
    status: "completed",
  });
  if (
    b.durationMinutes !== undefined &&
    task.taskType !== "multi_day" &&
    b.durationMinutes <
      completed.reduce((n, s) => n + (+s.endAt - +s.startAt) / 60000, 0)
  )
    fail("Duration cannot be less than completed planned effort");
  if (b.deadlineDate) {
    const late = await ScheduleBlock.exists({
      userId: user._id,
      taskId: task._id,
      status: "pending",
      endAt: {
        $gt: day(plusDays(b.deadlineDate, 1), user.timezone).toJSDate(),
      },
    });
    if (late || (task.flexibleDate && task.flexibleDate > b.deadlineDate))
      fail("Existing placement is after this deadline");
  }
  const changed = Object.keys(b).filter(
    (key) => String(task[key] ?? "") !== String(b[key] ?? ""),
  );
  Object.assign(task, b);
  if (changed.length) await task.save();
  if (b.title) {
    try {
      await ScheduleBlock.updateMany(
        { userId: user._id, taskId: task._id },
        { $set: { title: b.title } },
        {},
      );
    } catch {
      fail(
        "Task changes were saved. Retry the same edit to refresh timetable titles.",
        503,
        "TASK_SAVED",
      );
    }
  }
  if (
    changed.some((key) =>
      [
        "title",
        "goal",
        "motivation",
        "planningPreferences",
        "durationMinutes",
        "goalStartDate",
        "goalEndDate",
      ].includes(key),
    )
  )
    await invalidateContext(req.user._id, task._id, { preserveMessage: true });
  send(res, await Task.findById(task._id));
};
export const deleteTask = async (req, res) => {
  const task = await own(Task, req);
  const filter = { userId: req.user._id, taskId: task._id };
  // Parent is deleted last. If a child delete fails, the task remains visible and
  // the same DELETE can finish the cascade on retry. Never report success early.
  try {
    await Note.deleteMany(filter);
    if (task.sourceConversationId) {
      await Message.deleteMany({
        userId: req.user._id,
        conversationId: task.sourceConversationId,
      });
      await Conversation.deleteOne({
        _id: task.sourceConversationId,
        userId: req.user._id,
      });
    }
    await ScheduleBlock.deleteMany(filter);
    await task.deleteOne();
  } catch {
    fail(
      "Task deletion was incomplete. Some related records may already be removed. Retry deleting this task.",
      503,
      "PARTIAL_DELETE",
    );
  }
  send(res, { deleted: true });
};
export const placement = async (req, res) => {
  const t = await placeTask(req.user._id, req.params.id, req.body);
  if (t.$locals.placementChanged !== false)
    await invalidateContext(req.user._id, t._id);
  send(res, await Task.findById(t._id));
};
// Completion is a saved fact. Retrying also finishes pending-session cleanup.
export const completeTask = async (req, res) => {
  const task = await own(Task, req);
  await markMissed(req.user._id);
  task.status = "completed";
  task.completedAt ||= new Date();
  task.reminderStatus = "cancelled";
  await task.save();
  await cancelRemaining(req.user._id, task._id);
  await invalidateContext(req.user._id, task._id);
  send(res, await Task.findById(task._id));
};
async function cancelRemaining(userId, taskId) {
  try {
    await ScheduleBlock.updateMany(
      {
        userId,
        taskId,
        status: "pending",
        rescheduledToSessionId: { $exists: false },
        cancelReason: { $ne: "rescheduled" },
      },
      {
        $set: {
          status: "cancelled",
          cancelReason: "task_completed_early",
          reminderStatus: "cancelled",
          snoozedUntil: null,
        },
      },
    );
  } catch {
    fail(
      "Completion was saved, but remaining sessions could not be cancelled. Retry completion to finish cleanup.",
      503,
      "COMPLETION_SAVED",
    );
  }
}
export const reopen = async (req, res) => {
  const task = await own(Task, req);
  if (task.status !== "completed")
    fail("Only completed tasks can be reopened", 409);
  // Finish any earlier interrupted completion before changing its placement.
  await cancelRemaining(req.user._id, task._id);
  Object.assign(task, {
    status: "held",
    placementMode: "held",
    flexibleDate: null,
    flexibleReminderAt: null,
    completedAt: null,
    reminderStatus: "pending",
  });
  await task.save();
  await invalidateContext(req.user._id, task._id);
  send(res, task);
};
export const schedule = async (req, res) => {
  const from = parse(dateOnly, req.query.weekStart),
    end = plusDays(from, 7);
  await markMissed(req.user._id);
  const blocks = withRescheduleHistory(
    (await ScheduleBlock.find({ userId: req.user._id })).map((block) =>
      block.toJSON(),
    ),
  );
  send(
    res,
    blocks.filter(
      (b) =>
        b.recordType === "recurring" ||
        (+b.startAt < day(end, req.user.timezone).toMillis() &&
          +b.endAt > day(from, req.user.timezone).toMillis()),
    ),
  );
};
export const addBlock = async (req, res) =>
  send(res, await saveRecurring(req.user._id, null, req.body), 201);
export const editBlock = async (req, res) => {
  const b = await own(ScheduleBlock, req);
  if (b.recordType === "session") {
    const input = parse(
      z.object({ startAt: instant, endAt: instant }).strict(),
      req.body,
    );
    send(res, await mutateSession(req.user._id, req.params.id, input));
  } else {
    const { scope, ...fields } = req.body;
    send(
      res,
      await saveRecurring(req.user._id, req.params.id, fields, scope || "one"),
    );
  }
};
export const removeBlock = async (req, res) => {
  const r = await deleteBlock(
    req.user._id,
    req.params.id,
    req.query.scope || "one",
  );
  if (r.taskId) await invalidateContext(req.user._id, r.taskId);
  send(res, { deleted: true });
};
export const splitBlock = async (req, res) => {
  const b = await own(ScheduleBlock, req);
  const result =
    b.recordType === "session"
      ? await mutateSession(
          req.user._id,
          req.params.id,
          parse(z.object({ splitAt: instant }).strict(), req.body),
          true,
        )
      : await splitRecurring(
          req.user._id,
          req.params.id,
          parse(
            z
              .object({
                splitMinute: z.number().int().min(0).max(1440),
                scope: z.enum(["one", "group"]).default("one"),
              })
              .strict(),
            req.body,
          ),
        );
  send(res, result);
};
export const completeSession = async (req, res) => {
  const block = await own(ScheduleBlock, req);
  if (block.recordType !== "session" || retiredSession(block))
    fail("Session cannot be completed");
  if (+block.startAt > Date.now())
    fail("Complete this session after it has started");
  const task = await own(Task, req, block.taskId);
  if (block.status !== "completed") {
    block.status = "completed";
    block.completedAt = new Date();
    block.reminderStatus = "cancelled";
    await block.save();
  }
  // Recalculate even on retry: a previous task save may have failed after the
  // session was saved. Count documents rather than incrementing a counter.
  const completed = await ScheduleBlock.find({
    userId: req.user._id,
    taskId: task._id,
    status: "completed",
  });
  const minutes = completed.reduce(
    (n, b) => n + (+b.endAt - +b.startAt) / 60000,
    0,
  );
  if (task.status !== "completed")
    task.status =
      task.taskType === "multi_day"
        ? "in_progress"
        : minutes >= task.durationMinutes
          ? "completed"
          : "in_progress";
  if (task.status === "completed") {
    task.completedAt ||= new Date();
    task.reminderStatus = "cancelled";
  }
  try {
    await task.save();
  } catch {
    fail(
      "Session completion was saved. Retry this session completion to refresh task progress.",
      503,
      "SESSION_COMPLETION_SAVED",
    );
  }
  if (task.status === "completed")
    await cancelRemaining(req.user._id, task._id);
  await invalidateContext(req.user._id, task._id);
  send(res, await Task.findById(task._id));
};
export const availability = async (req, res) => {
  const q = parse(
    z
      .object({
        from: dateOnly,
        to: dateOnly,
        durationMinutes: z.coerce.number().int().min(1).max(10080).default(30),
        taskId: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
      })
      .strict(),
    req.query,
  );
  const task = q.taskId ? await own(Task, req, q.taskId) : null;
  if (
    task?.taskType === "multi_day" &&
    (q.from < task.goalStartDate || q.to > task.goalEndDate)
  )
    fail("Choose availability within the goal period");
  send(
    res,
    await getAvailability(
      req.user,
      q.from,
      q.to,
      q.durationMinutes,
      task?.taskType === "multi_day" ? undefined : q.taskId,
    ),
  );
};
export const notes = async (req, res) => {
  if (req.query.taskId) await own(Task, req, req.query.taskId);
  send(
    res,
    await Note.find({
      userId: req.user._id,
      taskId: req.query.taskId || null,
    }).sort({ createdAt: -1, _id: -1 }),
  );
};
export const saveNote = async (req, res) => {
  const b = parse(noteFields, req.body);
  if (b.taskId) await own(Task, req, b.taskId);
  const n = await Note.create({
    ...b,
    userId: req.user._id,
    type: b.taskId ? "task" : "daily",
  });
  if (n.taskId) await invalidateContext(req.user._id, n.taskId);
  send(res, n, 201);
};
export const editNote = async (req, res) => {
  const b = parse(noteFields.omit({ taskId: true }).partial(), req.body);
  const n = await own(Note, req);
  Object.assign(n, b);
  n.version++;
  await n.save();
  if (n.taskId) await invalidateContext(req.user._id, n.taskId);
  send(res, n);
};
export const removeNote = async (req, res) => {
  const n = await own(Note, req);
  await n.deleteOne();
  if (n.taskId) await invalidateContext(req.user._id, n.taskId);
  send(res, { deleted: true });
};
export const newConversation = async (req, res) => {
  const b = parse(
    z
      .object({
        taskId: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
      })
      .strict(),
    req.body,
  );
  if (b.taskId) {
    const t = await own(Task, req, b.taskId);
    if (t.sourceConversationId)
      return send(
        res,
        await readConversation(req.user._id, t.sourceConversationId),
      );
    fail(
      "This manual task has no planning conversation. Edit its preferences in task details.",
    );
  }
  const c = await Conversation.create({
    userId: req.user._id,
    draft: { journalEnabled: true },
  });
  send(
    res,
    {
      conversation: c,
      planningTask: null,
      messages: [],
      hasMore: false,
      nextBefore: null,
    },
    201,
  );
};
export const getConversation = async (req, res) =>
  send(
    res,
    await readConversation(
      req.user._id,
      req.params.id,
      req.query.before
        ? parse(z.string().regex(/^[a-f\d]{24}$/i), req.query.before)
        : undefined,
    ),
  );
export const message = async (req, res) => {
  const localDate = today(req.user.timezone);
  send(
    res,
    await sendMessage(req.user._id, req.params.id, { ...req.body }, localDate),
  );
};
export const editDraft = async (req, res) => {
  const b = parse(
    z
      .object({ draftVersion: z.number().int().min(0), updates: draftFields })
      .strict(),
    req.body,
  );
  const c = await own(Conversation, req);
  if (c.status !== "draft") fail("This plan is already confirmed", 409);
  const updated = await Conversation.findOneAndUpdate(
    {
      _id: c._id,
      userId: req.user._id,
      draftVersion: b.draftVersion,
      status: "draft",
    },
    {
      $set: { draft: { ...c.draft, ...b.updates } },
      $inc: { draftVersion: 1 },
    },
    { new: true },
  );
  if (!updated) fail("Draft changed. Reload and review.", 409, "STALE_DRAFT");
  send(res, {
    conversation: updated,
    messages: (await readConversation(req.user._id, c._id)).messages,
  });
};
export const confirm = async (req, res) => {
  const b = parse(
    z.object({ draftVersion: z.number().int().min(0) }).strict(),
    req.body,
  );
  send(res, await confirmPlan(req.user._id, req.params.id, b.draftVersion));
};
export const refreshContext = async (req, res) => {
  await own(Task, req);
  await invalidateContext(req.user._id, req.params.id);
  send(res, await own(Task, req));
};
export const due = async (req, res) =>
  send(res, await dueReminders(req.user._id));
export const reminderStatus = async (req, res) =>
  send(res, await reminderState(req.user._id, req.params.id));
export const delivered = async (req, res) =>
  send(res, await claimReminder(req.user._id, req.params.id));
export const snooze = async (req, res) =>
  send(res, await snoozeReminder(req.user._id, req.params.id));
export const report = async (req, res) =>
  send(res, await weeklyReport(req.user, parse(dateOnly, req.query.weekStart)));
export const coach = async (req, res) => {
  const b = parse(
    z
      .object({
        taskId: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .optional(),
        weekStart: dateOnly.optional(),
      })
      .strict(),
    req.body,
  );
  if (b.taskId) {
    const task = await own(Task, req, b.taskId);
    send(res, { text: task.motivationalMessage, status: task.messageStatus });
  } else
    send(res, {
      text: (
        await weeklyReport(
          req.user,
          b.weekStart ||
            DateTime.now()
              .setZone(req.user.timezone)
              .startOf("week")
              .toISODate(),
        )
      ).coachText,
    });
};
export const reschedule = async (req, res) => {
  const b = parse(
    z
      .object({
        mode: z.enum(["scheduled", "flexible", "held"]),
        date: dateOnly.optional(),
      })
      .strict(),
    req.body,
  );
  const task = await own(Task, req),
    date = b.date || plusDays(today(req.user.timezone), 1);
  let p = { placementMode: b.mode };
  if (b.mode === "flexible") p.flexibleDate = date;
  if (b.mode === "scheduled") {
    const complete = await ScheduleBlock.find({
      userId: req.user._id,
      taskId: task._id,
      status: "completed",
    }).lean();
    const remaining =
      task.taskType === "multi_day"
        ? task.durationMinutes
        : task.durationMinutes -
          complete.reduce((n, s) => n + (+s.endAt - +s.startAt) / 60000, 0);
    const a = await getAvailability(
        req.user,
        date,
        date,
        remaining,
        task.taskType === "multi_day" ? undefined : task._id,
      ),
      slot = a[0].suggestions[0];
    if (!slot)
      fail(
        "No fixed slot fits. Try flexible time if capacity permits, or hold the task.",
        409,
        "NO_CAPACITY",
      );
    p.sessions = [slot];
  }
  const t = await placeTask(req.user._id, task._id, p);
  if (t.$locals.placementChanged !== false)
    await invalidateContext(req.user._id, t._id);
  send(res, t);
};
