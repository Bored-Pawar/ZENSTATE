import { z } from "zod";
import { DateTime, IANAZone } from "luxon";

export class AppError extends Error {
  constructor(status, message, code = "INVALID_REQUEST", details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
export const fail = (message, status = 400, code, details) => {
  throw new AppError(status, message, code, details);
};
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => DateTime.fromISO(v).isValid, "Use a real calendar date");
export const instant = z.iso.datetime({ offset: true });
export const timezone = z
  .string()
  .refine((v) => IANAZone.isValidZone(v), "Use a valid IANA timezone");
const text = (max) => z.string().trim().max(max);
export const taskFields = z
  .object({
    title: text(160).min(1),
    goal: text(2000).default(""),
    motivation: text(2000).default(""),
    durationMinutes: z.number().int().min(1).max(10080).default(30),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    category: text(80).default("Personal"),
    deadlineDate: dateOnly.nullable().optional(),
    journalEnabled: z.boolean().default(true),
    planningPreferences: text(2000).default(""),
  })
  .strict();
export const placementFields = z
  .object({
    placementMode: z.enum(["scheduled", "flexible", "held"]),
    flexibleDate: dateOnly.nullable().optional(),
    flexibleReminderAt: instant.nullable().optional(),
    sessions: z
      .array(z.object({ startAt: instant, endAt: instant }).strict())
      .max(60)
      .optional(),
  })
  .strict();
// Zod 4 applies inner defaults even to optional fields. Patch schemas must strip
// creation defaults, otherwise changing a title would reset motivation/duration.
export const taskPatchFields = z
  .object(
    Object.fromEntries(
      Object.entries(taskFields.shape).map(([k, v]) => [
        k,
        v instanceof z.ZodDefault ? v.removeDefault() : v,
      ]),
    ),
  )
  .partial()
  .strict();
export const draftFields = taskPatchFields
  .omit({ title: true })
  .extend({
    goal: text(2000).optional(),
    durationEstimated: z.boolean().optional(),
    ...placementFields.partial().shape,
  })
  .strict();
export const blockFields = z
  .object({
    title: text(160).min(1),
    kind: z.enum(["sleep", "fixed", "focus"]),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(0).max(1440),
    endsNextDay: z.boolean().default(false),
    daysPreset: z
      .enum(["selected", "weekdays", "weekends", "whole", "custom"])
      .default("selected"),
    weekday: z.number().int().min(1).max(7).default(1),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  })
  .strict();
export function selectedDays(b) {
  return [
    ...new Set(
      b.daysPreset === "whole"
        ? [1, 2, 3, 4, 5, 6, 7]
        : b.daysPreset === "weekdays"
          ? [1, 2, 3, 4, 5]
          : b.daysPreset === "weekends"
            ? [6, 7]
            : b.daysPreset === "custom"
              ? b.days || []
              : [b.weekday],
    ),
  ];
}
export const scopeFields = z.enum(["one", "group"]);
export const noteFields = z
  .object({
    text: text(12000).min(1),
    taskId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .nullable()
      .optional(),
    mood: text(40).optional(),
  })
  .strict();
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success)
    fail(
      result.error.issues
        .map((i) => `${i.path.join(".") || "Request"}: ${i.message}`)
        .join("; "),
    );
  return result.data;
}
