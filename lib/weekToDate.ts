// Turns "Week N" (plus an optional weekday) into a real calendar date.
// Week 1 starts on termStart (a Monday at UNSW). Week 0 is O-Week, the week before.

import { addDays } from "./unswWeek";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Checks a string is a real date in YYYY-MM-DD form (rejects things like 2026-02-31).
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, 10) === value;
}

// Returns "YYYY-MM-DD", or null if the inputs can't be turned into a date.
export function weekToDate(termStart: string, week: number, weekday: string | null): string | null {
  // Without a valid term start there is nothing to count from
  if (!isValidIsoDate(termStart)) {
    return null;
  }
  if (!Number.isInteger(week) || week < 0 || week > 20) {
    return null;
  }

  // Start of the requested week
  let daysToAdd = (week - 1) * 7;

  // If a weekday was given, move forward to that day within the week.
  // With no weekday we stay on the first day of the week: it's better
  // to be reminded early than to miss a deadline.
  if (weekday) {
    const targetIndex = WEEKDAYS.indexOf(weekday.trim().toLowerCase());
    if (targetIndex !== -1) {
      const startIndex = (new Date(termStart + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
      daysToAdd = daysToAdd + ((targetIndex - startIndex + 7) % 7);
    }
  }

  return addDays(termStart, daysToAdd);
}
