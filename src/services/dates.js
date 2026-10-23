import { DateTime } from "luxon";
export { DateTime };
export const browserZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export const localToday = (zone) => DateTime.now().setZone(zone).toISODate();
export const weekStart = (zone) =>
  DateTime.now().setZone(zone).startOf("week").toISODate();
export const addDays = (date, n) =>
  DateTime.fromISO(date).plus({ days: n }).toISODate();
export const clock = (minute) =>
  minute === 1440
    ? "24:00"
    : `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export const minutes = (text) =>
  Number(text.split(":")[0]) * 60 + Number(text.split(":")[1]);
export const formatInstant = (date, zone) =>
  DateTime.fromISO(date, { zone }).toFormat("ccc d LLL, HH:mm");
export const dateLabel = (date, zone) =>
  date === localToday(zone)
    ? "Today"
    : date === addDays(localToday(zone), 1)
      ? "Tomorrow"
      : date || "Held";
export function localInputToUTC(input, zone) {
  const value = DateTime.fromISO(input, { zone });
  if (!value.isValid || value.toFormat("yyyy-MM-dd'T'HH:mm") !== input)
    throw new Error("Choose a valid local date and time");
  return value.toUTC().toISO();
}
export const inputFromUTC = (date, zone) =>
  DateTime.fromISO(date, { zone }).toFormat("yyyy-MM-dd'T'HH:mm");
export function calendarSegments(blocks, date, zone) {
  const start = DateTime.fromISO(date, { zone }).startOf("day"),
    end = start.plus({ days: 1 });
  const pieces = [];
  for (const b of blocks) {
    const intervals = [];
    if (b.recordType === "recurring")
      for (const d of [start.minus({ days: 1 }), start]) {
        if (d.weekday !== b.weekday) continue;
        const at = (day, m) =>
          m === 1440
            ? day.plus({ days: 1 }).startOf("day")
            : day.set({ hour: Math.floor(m / 60), minute: m % 60 });
        intervals.push([
          at(d, b.startMinute),
          at(b.endsNextDay ? d.plus({ days: 1 }) : d, b.endMinute),
        ]);
      }
    else
      intervals.push([
        DateTime.fromISO(b.startAt, { zone }),
        DateTime.fromISO(b.endAt, { zone }),
      ]);
    for (const [s, e] of intervals)
      if (s < end && e > start) {
        const a = s < start ? start : s,
          z = e > end ? end : e;
        pieces.push({
          ...b,
          displayStart: a.hour * 60 + a.minute,
          displayEnd:
            z.toMillis() === end.toMillis() ? 1440 : z.hour * 60 + z.minute,
        });
      }
  }
  return pieces;
}

// Labels mirror saved session facts, never the parent's active-task filter.
export function sessionPresentation(session) {
  if (session.status === "completed")
    return { tone: "session-completed", label: "Completed session" };
  if (session.rescheduledToSessionId || session.cancelReason === "rescheduled")
    return {
      tone: "session-retired",
      label:
        session.status === "missed"
          ? "Rescheduled — missed occurrence"
          : "Rescheduled — started occurrence",
    };
  if (session.status === "cancelled" || session.cancelReason)
    return {
      tone: "session-retired",
      label:
        session.cancelReason === "task_completed_early"
          ? "Cancelled — task completed early."
          : session.cancelReason === "placement_changed"
            ? "Cancelled — placement changed"
            : "Cancelled — placement removed",
    };
  return {
    tone: "session-unfinished",
    label:
      session.status === "missed" || +new Date(session.endAt) < Date.now()
        ? "Unfinished — missed"
        : +new Date(session.startAt) <= Date.now()
          ? "Unfinished — ongoing"
          : "Unfinished — upcoming",
  };
}
