import { DateTime } from "luxon";
import { fail, dateOnly, parse } from "./validation.js";
export { DateTime };
export const today = (zone) => DateTime.now().setZone(zone).toISODate();
export const day = (date, zone) =>
  DateTime.fromISO(parse(dateOnly, date), { zone }).startOf("day");
export const plusDays = (date, n) =>
  DateTime.fromISO(date).plus({ days: n }).toISODate();
export function dateRange(from, to, max = 31) {
  parse(dateOnly, from);
  parse(dateOnly, to);
  const n = DateTime.fromISO(to).diff(DateTime.fromISO(from), "days").days;
  if (n < 0 || n >= max) fail(`Choose a range of 1–${max} days`);
  return Array.from({ length: n + 1 }, (_, i) => plusDays(from, i));
}
export function atMinute(date, minute, zone) {
  // Wall-clock minutes, not elapsed minutes: maintains recurring times across DST.
  if (minute === 1440) return day(plusDays(date, 1), zone);
  const dt = day(date, zone).set({
    hour: Math.floor(minute / 60),
    minute: minute % 60,
  });
  if (dt.hour !== Math.floor(minute / 60) || dt.minute !== minute % 60)
    fail("This local time does not exist due to a daylight-saving change");
  return dt;
}
export function occurrence(rule, date, zone) {
  const start = atMinute(date, rule.startMinute, zone);
  const end = atMinute(
    rule.endsNextDay ? plusDays(date, 1) : date,
    rule.endMinute,
    zone,
  );
  return {
    start: start.toMillis(),
    end: end.toMillis(),
    title: rule.title,
    id: String(rule._id || rule.id || ""),
  };
}
export function recurringDuration(b) {
  if (b.startMinute === b.endMinute) fail("Start and end cannot be equal");
  const duration = b.endMinute + (b.endsNextDay ? 1440 : 0) - b.startMinute;
  if (duration <= 0 || duration > 1440)
    fail(
      "Choose a later end time, or select overnight for an earlier end time",
    );
  return duration;
}
