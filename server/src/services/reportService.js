import { Task, ScheduleBlock } from "../models/index.js";
import { day, dateRange, plusDays, DateTime, today } from "../utils/dates.js";
export function summariseSessions(sessions, dates, zone, now = Date.now()) {
  const daily = dates.map((date) => ({
    date,
    plannedSessions: 0,
    completedSessions: 0,
    missedSessions: 0,
    upcomingSessions: 0,
    plannedMinutes: 0,
    completedMinutes: 0,
  }));
  for (const b of sessions.filter((s) => s.status !== "cancelled")) {
    const date = DateTime.fromJSDate(new Date(b.startAt), { zone }).toISODate(),
      d = daily.find((d) => d.date === date);
    if (!d) continue;
    const minutes = (+new Date(b.endAt) - +new Date(b.startAt)) / 60000;
    d.plannedSessions++;
    d.plannedMinutes += minutes;
    if (b.status === "completed") {
      d.completedSessions++;
      d.completedMinutes += minutes;
    } else if (b.status === "missed" || +new Date(b.endAt) < now)
      d.missedSessions++;
    else d.upcomingSessions++;
  }
  const totals = Object.fromEntries(
    [
      "plannedSessions",
      "completedSessions",
      "missedSessions",
      "upcomingSessions",
      "plannedMinutes",
      "completedMinutes",
    ].map((k) => [k, daily.reduce((n, d) => n + d[k], 0)]),
  );
  return {
    ...totals,
    daily,
    completionPercent: totals.plannedSessions
      ? Math.round((totals.completedSessions / totals.plannedSessions) * 100)
      : 0,
  };
}
export async function weeklyReport(user, from) {
  const dates = dateRange(from, plusDays(from, 6));
  const sessions = await ScheduleBlock.find({
    userId: user._id,
    recordType: "session",
    startAt: {
      $gte: day(from, user.timezone).toJSDate(),
      $lt: day(plusDays(from, 7), user.timezone).toJSDate(),
    },
  }).lean();
  const tasks = await Task.find({ userId: user._id }).lean();
  const report = summariseSessions(sessions, dates, user.timezone);
  const overdueFlexible = tasks.filter(
    (t) =>
      t.placementMode === "flexible" &&
      t.status !== "completed" &&
      t.flexibleDate < today(user.timezone) &&
      t.flexibleDate >= from &&
      t.flexibleDate <= dates.at(-1),
  );
  const missedIds = new Set(
    sessions
      .filter(
        (s) =>
          s.status === "missed" ||
          (s.status === "pending" && +s.endAt < Date.now()),
      )
      .map((s) => String(s.taskId)),
  );
  const unfinished = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      (missedIds.has(String(t._id)) || overdueFlexible.includes(t)),
  );
  const relevant = tasks.filter(
    (t) =>
      sessions.some(
        (s) => s.status !== "cancelled" && String(s.taskId) === String(t._id),
      ) ||
      (t.flexibleDate >= from && t.flexibleDate <= dates.at(-1)),
  );
  const motivation = relevant
    .find((t) => t.motivation?.trim())
    ?.motivation.slice(0, 240);
  return {
    ...report,
    weekStart: from,
    overdueFlexible,
    unfinished,
    completedTasks: tasks.filter(
      (t) =>
        t.status === "completed" &&
        t.completedAt >= day(from, user.timezone).toJSDate() &&
        t.completedAt < day(plusDays(from, 7), user.timezone).toJSDate(),
    ).length,
    coachText:
      (report.plannedSessions
        ? `You completed ${report.completedSessions} of ${report.plannedSessions} planned sessions, representing ${report.completedMinutes} planned minutes of effort. ${report.missedSessions} sessions need review and ${report.upcomingSessions} are upcoming or active. Choose one realistic next step and leave room for rest.`
        : "No sessions have been planned this week. Start with a small goal and choose time that fits your actual week.") +
      (motivation ? ` Remember your reason: ${motivation}` : ""),
  };
}
