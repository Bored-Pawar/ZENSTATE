import mongoose from "mongoose";
const { Schema } = mongoose;
const ref = { type: Schema.Types.ObjectId, required: true, index: true };
const owned = { userId: { ...ref, ref: "User" } };
const options = {
  timestamps: true,
  toJSON: {
    transform(_doc, obj) {
      obj.id = String(obj._id);
      delete obj._id;
      delete obj.__v;
      delete obj.passwordHash;
      return obj;
    },
  },
};
const schema = (fields) => new Schema(fields, options);
const user = schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  timezone: { type: String, required: true },
  onboardingCompleted: { type: Boolean, default: false },
  voiceRemindersEnabled: { type: Boolean, default: false },
  // Legacy stored counter retained for compatibility; no longer used as a lock.
  scheduleVersion: Number,
});
const task = schema({
  ...owned,
  title: String,
  goal: String,
  motivation: String,
  durationMinutes: Number,
  priority: { type: String, enum: ["low", "medium", "high"] },
  category: String,
  deadlineDate: String,
  placementMode: {
    type: String,
    enum: ["scheduled", "flexible", "held"],
    default: "held",
  },
  flexibleDate: String,
  flexibleReminderAt: Date,
  status: {
    type: String,
    enum: ["pending", "in_progress", "completed", "held"],
    default: "held",
  },
  completedAt: Date,
  journalEnabled: Boolean,
  planningPreferences: String,
  importantContext: String,
  contextVersion: { type: Number, default: 0 },
  contextProcessedVersion: { type: Number, default: 0 },
  contextProcessingStatus: { type: String, default: "pending" },
  motivationalMessage: String,
  messageContextVersion: Number,
  messageGeneratedAt: Date,
  messageStatus: String,
  sourceConversationId: Schema.Types.ObjectId,
  // Small durable confirmation receipt; existing confirmed tasks need no migration.
  planConfirmationReady: Boolean,
  planDraftVersion: Number,
  reminderStatus: { type: String, default: "pending" },
  reminderDeliveredAt: Date,
  snoozedUntil: Date,
});
task.index(
  { sourceConversationId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceConversationId: { $type: "objectId" } },
  },
);
const block = schema({
  ...owned,
  recordType: { type: String, enum: ["recurring", "session"], required: true },
  title: String,
  kind: { type: String, enum: ["sleep", "fixed", "focus", "task"] },
  weekday: Number,
  startMinute: Number,
  endMinute: Number,
  endsNextDay: Boolean,
  groupId: String,
  taskId: { type: Schema.Types.ObjectId, ref: "Task" },
  startAt: Date,
  endAt: Date,
  status: {
    type: String,
    enum: ["pending", "completed", "missed", "cancelled"],
  },
  completedAt: Date,
  supersedesSessionId: Schema.Types.ObjectId,
  rescheduledToSessionId: Schema.Types.ObjectId,
  // Unique only for new per-session reschedules; legacy records are untouched.
  rescheduleSourceId: Schema.Types.ObjectId,
  cancelReason: String,
  reminderStatus: { type: String, default: "pending" },
  reminderDeliveredAt: Date,
  snoozedUntil: Date,
});
block.pre("validate", function () {
  if (this.recordType === "recurring") {
    if (
      ![1, 2, 3, 4, 5, 6, 7].includes(this.weekday) ||
      !Number.isInteger(this.startMinute) ||
      !Number.isInteger(this.endMinute) ||
      this.startMinute < 0 ||
      this.startMinute > 1439 ||
      this.endMinute < 0 ||
      this.endMinute > 1440 ||
      this.startMinute === this.endMinute ||
      this.endMinute + (this.endsNextDay ? 1440 : 0) - this.startMinute <= 0 ||
      this.endMinute + (this.endsNextDay ? 1440 : 0) - this.startMinute > 1440
    )
      this.invalidate("startMinute", "Invalid recurring interval");
  } else if (
    !this.taskId ||
    !this.startAt ||
    !this.endAt ||
    this.endAt <= this.startAt
  )
    this.invalidate("startAt", "Invalid task session");
});
block.index({ userId: 1, weekday: 1 });
block.index({ userId: 1, startAt: 1 });
block.index(
  { rescheduleSourceId: 1 },
  {
    unique: true,
    partialFilterExpression: { rescheduleSourceId: { $type: "objectId" } },
  },
);
const note = schema({
  ...owned,
  taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
  type: { type: String, enum: ["task", "daily"] },
  text: String,
  mood: String,
  version: { type: Number, default: 1 },
});
const conversation = schema({
  ...owned,
  taskId: Schema.Types.ObjectId,
  status: {
    type: String,
    default: "draft",
    enum: ["draft", "confirmed", "archived"],
  },
  draft: { type: Schema.Types.Mixed, default: {} },
  draftVersion: { type: Number, default: 0 },
  confirmedTaskId: Schema.Types.ObjectId,
});
const message = schema({
  ...owned,
  conversationId: { ...ref, ref: "Conversation" },
  role: { type: String, enum: ["user", "assistant"] },
  content: String,
  clientMessageId: String,
  status: String,
  replyTo: Schema.Types.ObjectId,
});
message.index(
  { conversationId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } },
  },
);
message.index({ userId: 1, conversationId: 1, createdAt: 1, _id: 1 });
export const User = mongoose.model("User", user);
export const Task = mongoose.model("Task", task);
export const ScheduleBlock = mongoose.model("ScheduleBlock", block);
export const Note = mongoose.model("Note", note);
export const Conversation = mongoose.model("Conversation", conversation);
export const Message = mongoose.model("Message", message);
