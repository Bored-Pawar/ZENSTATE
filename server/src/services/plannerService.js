import { z } from "zod";
import {
  Conversation,
  Message,
  Task,
  User,
  ScheduleBlock,
} from "../models/index.js";
import { callAI } from "./aiClient.js";
import { draftFields, taskFields, parse, fail } from "../utils/validation.js";
import { applyPlacement, validatePlacement } from "./placementService.js";
import { invalidateContext } from "./taskContextService.js";

export async function readConversation(userId, id, before) {
  const conversation = await Conversation.findOne({ _id: id, userId });
  if (!conversation) fail("Conversation not found", 404);
  const cursor = before
    ? await Message.findOne({ _id: before, userId, conversationId: id })
    : null;
  if (before && !cursor) fail("History cursor not found", 404);
  const older = cursor
    ? {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
        ],
      }
    : {};
  const page = await Message.find({ userId, conversationId: id, ...older })
    .sort({ createdAt: -1, _id: -1 })
    .limit(61);
  const hasMore = page.length > 60;
  const messages = page.slice(0, 60).reverse();
  return {
    conversation,
    planningTask: conversation.taskId
      ? await Task.findOne({ _id: conversation.taskId, userId })
      : null,
    messages,
    hasMore,
    nextBefore: hasMore ? String(messages[0]._id) : null,
  };
}
const aiResult = z
  .object({
    reply: z.string().trim().min(1).max(3000),
    draftUpdates: draftFields.omit({
      placementMode: true,
      flexibleDate: true,
      flexibleReminderAt: true,
      sessions: true,
    }),
    readyForReview: z.boolean(),
  })
  .strict();
export async function sendMessage(userId, id, body, localDate) {
  const input = parse(
    z
      .object({
        content: z.string().trim().min(1).max(4000),
        clientMessageId: z.string().min(8).max(100),
      })
      .strict(),
    body,
  );
  const { conversation, planningTask } = await readConversation(userId, id);
  if (conversation.status === "archived")
    fail("This conversation is archived. Start a new plan.", 409);
  let message = await Message.findOne({
    userId,
    conversationId: id,
    clientMessageId: input.clientMessageId,
  });
  if (message?.content !== undefined && message.content !== input.content)
    fail("A retry ID must refer to the same message", 409);
  if (message?.status === "responded") return readConversation(userId, id);
  if (
    message &&
    (await Message.exists({
      userId,
      conversationId: id,
      replyTo: message._id,
      role: "assistant",
    }))
  ) {
    await Message.updateOne(
      { _id: message._id, userId },
      { $set: { status: "responded" } },
    );
    if (planningTask) await invalidateContext(userId, planningTask._id);
    return readConversation(userId, id);
  }
  if (!message) {
    try {
      message = await Message.create({
        userId,
        conversationId: id,
        role: "user",
        content: input.content,
        clientMessageId: input.clientMessageId,
        status: "saved",
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
      message = await Message.findOne({
        userId,
        conversationId: id,
        clientMessageId: input.clientMessageId,
      });
    }
  }
  const history = await Message.find({
    userId,
    conversationId: id,
    _id: { $ne: message._id },
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(12)
    .lean();
  const recent = [];
  const currentContext = planningTask
    ? {
        title: planningTask.title,
        goal: planningTask.goal,
        motivation: planningTask.motivation,
        durationMinutes: planningTask.durationMinutes,
        status: planningTask.status,
        planningPreferences: planningTask.planningPreferences,
        importantContext: planningTask.importantContext?.slice(0, 2400),
      }
    : { draft: conversation.draft };
  let chars = 0;
  const historyBudget = Math.min(
    10000,
    Math.max(
      0,
      (Number(process.env.AI_INPUT_CHAR_BUDGET) || 24000) -
        JSON.stringify(currentContext).length -
        input.content.length -
        2000,
    ),
  );
  for (const m of history) {
    if (chars + m.content.length > historyBudget) break;
    recent.unshift({ role: m.role, content: m.content });
    chars += m.content.length;
  }
  const prompts = [
    {
      role: "system",
      content:
        'You are Zen, a brief task planning assistant. Return JSON {"reply":string,"draftUpdates":object,"readyForReview":boolean}. Ask only missing essentials: goal, motivation, positive durationMinutes. Parse hours and minutes carefully, never assume the first number is duration. If estimating set durationEstimated:true and explain. Supported draftUpdates: goal, motivation, durationMinutes, durationEstimated, deadlineDate (YYYY-MM-DD), planningPreferences, priority (low/medium/high), category, journalEnabled. Do not invent dates; current local date supplied. Multiple essentials in one message require no scripted questionnaire. Never claim a placement was saved or there is free time: timetable is checked in the next screen. Never output IDs or ownership.',
    },
    {
      role: "system",
      content: JSON.stringify({ ...currentContext, localDate }),
    },
    ...recent,
    { role: "user", content: input.content },
  ];
  if (planningTask)
    prompts[0].content +=
      " This task is already confirmed. Discuss its current progress and motivation using the supplied latest task context. Return draftUpdates:{} and readyForReview:false. Do not propose or claim saved schedule/metadata changes. The user can edit task details and placement in the task screen.";
  try {
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const schema = planningTask
          ? aiResult.extend({
              draftUpdates: z.object({}).strict(),
              readyForReview: z.literal(false),
            })
          : aiResult;
        result = parse(schema, await callAI({ messages: prompts }));
        break;
      } catch (e) {
        if (e.status === 503) throw e;
        if (attempt === 1) {
          if (e.status === 400)
            fail(
              "Zen returned an invalid draft. Your message is saved; please retry.",
              502,
              "AI_RETRY",
            );
          throw e;
        }
        prompts.push({
          role: "system",
          content:
            "The last output was invalid. Return valid JSON with only the allowed fields and valid positive integer minutes. Do not include placement or IDs.",
        });
      }
    }
    if (
      planningTask &&
      !(await Task.exists({
        _id: planningTask._id,
        userId,
        contextVersion: planningTask.contextVersion,
      }))
    )
      fail(
        "The task changed while Zen replied. Reload and retry your saved message.",
        409,
        "STALE_CONTEXT",
      );
    const updated = await Conversation.findOneAndUpdate(
      {
        _id: id,
        userId,
        status: conversation.status,
        draftVersion: conversation.draftVersion,
      },
      {
        $set: { draft: { ...conversation.draft, ...result.draftUpdates } },
        $inc: { draftVersion: 1 },
      },
      { new: true },
    );
    if (!updated)
      fail(
        "The draft changed while Zen replied. Reload and retry your saved message.",
        409,
        "STALE_DRAFT",
      );
    try {
      await Message.create({
        userId,
        conversationId: id,
        role: "assistant",
        content: result.reply,
        status: "saved",
        replyTo: message._id,
      });
    } catch (error) {
      // Restore only our own draft version; never overwrite a later user edit.
      await Conversation.updateOne(
        {
          _id: id,
          userId,
          draftVersion: updated.draftVersion,
          status: conversation.status,
        },
        {
          $set: {
            draft: conversation.draft,
            draftVersion: conversation.draftVersion,
          },
        },
      );
      throw error;
    }
    // If this final write fails, retry finds the saved assistant reply above.
    await Message.updateOne(
      { _id: message._id, userId },
      { $set: { status: "responded" } },
    );
    if (planningTask) await invalidateContext(userId, planningTask._id);
    return readConversation(userId, id);
  } catch (e) {
    await Message.updateOne(
      { _id: message._id, userId, status: { $ne: "responded" } },
      { $set: { status: "failed" } },
    );
    throw e;
  }
}
export async function confirmPlan(userId, id, version) {
  const conversation = await Conversation.findOne({ _id: id, userId });
  if (!conversation) fail("Conversation not found", 404);
  if (conversation.confirmedTaskId)
    return Task.findOne({ _id: conversation.confirmedTaskId, userId });
  if (conversation.status !== "draft" || conversation.draftVersion !== version)
    fail("This draft has changed. Review it again.", 409, "STALE_DRAFT");
  const user = await User.findById(userId);
  if (!user) fail("User not found", 404);
  const d = conversation.draft;
  if (!d.goal?.trim() || !d.motivation?.trim() || !d.durationMinutes)
    fail("Review the goal, motivation and planned minutes first");
  const fields = parse(taskFields, {
    title: d.goal.slice(0, 160),
    ...Object.fromEntries(
      Object.keys(taskFields.shape)
        .filter((k) => k !== "title" && d[k] !== undefined)
        .map((k) => [k, d[k]]),
    ),
  });
  let task = await Task.findOne({
    userId,
    sourceConversationId: conversation._id,
  });
  if (task && !task.planConfirmationReady)
    fail(
      "Confirmation is in progress. Reload and retry shortly.",
      409,
      "CONFIRMATION_PENDING",
    );
  if (task && task.planDraftVersion !== version)
    fail(
      "A previously saved confirmation needs review. Inspect its task before confirming a changed draft.",
      409,
      "STALE_DRAFT",
    );
  if (!task) {
    task = new Task({
      ...fields,
      userId,
      sourceConversationId: conversation._id,
      planDraftVersion: version,
      planConfirmationReady: false,
    });
    const placement = {
      placementMode: d.placementMode || "held",
      flexibleDate: d.flexibleDate,
      flexibleReminderAt: d.flexibleReminderAt,
      sessions: d.sessions,
    };
    await validatePlacement(user, task, placement);
    // Existing unique sourceConversationId index is the duplicate-confirmation
    // guard. It is not a schedule lock and cannot prevent racing overlaps.
    try {
      await task.save();
    } catch (error) {
      if (error.code === 11000)
        fail(
          "Confirmation is in progress. Reload and retry shortly.",
          409,
          "CONFIRMATION_PENDING",
        );
      throw error;
    }
    try {
      await applyPlacement(user, task, placement);
      task.planConfirmationReady = true;
      await task.save();
    } catch (error) {
      await ScheduleBlock.deleteMany({ userId, taskId: task._id });
      await Task.deleteOne({ _id: task._id, userId });
      throw error;
    }
  }
  // If saving this link fails, keep the ready task. A retry links that same task
  // without generating another task or reapplying its placement.
  const linked = await Conversation.findOneAndUpdate(
    { _id: id, userId, status: "draft", draftVersion: version },
    {
      $set: {
        status: "confirmed",
        confirmedTaskId: task._id,
        taskId: task._id,
      },
    },
    { new: true },
  );
  if (!linked) {
    const current = await Conversation.findOne({ _id: id, userId });
    if (String(current?.confirmedTaskId) !== String(task._id)) {
      await ScheduleBlock.deleteMany({ userId, taskId: task._id });
      await Task.deleteOne({ _id: task._id, userId });
      fail(
        "This draft changed during confirmation. Review it again.",
        409,
        "STALE_DRAFT",
      );
    }
  }
  await invalidateContext(userId, task._id);
  return Task.findOne({ _id: task._id, userId });
}
