"use client";

import { useEffect, useState } from "react";

const DAYS_TO_DEADLINE = 21;

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", o);

/** Today and the demo deadline, both relative to the viewer's clock. Null until mounted so server and client markup match. */
export function useDates() {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  if (!today) return null;

  const deadline = new Date(today);
  deadline.setDate(deadline.getDate() + DAYS_TO_DEADLINE);

  return {
    today: fmt(today, { weekday: "long", day: "numeric", month: "long" }),
    deadlineLong: fmt(deadline, { weekday: "long", day: "numeric", month: "long" }),
    deadlineMed: fmt(deadline, { weekday: "short", day: "numeric", month: "long" }),
    deadlineShort: fmt(deadline, { weekday: "short", day: "numeric", month: "short" }).replace(",", ""),
    daysAhead: DAYS_TO_DEADLINE,
    weeksAhead: DAYS_TO_DEADLINE / 7,
  };
}
