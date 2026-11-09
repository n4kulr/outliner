// Turns "Week N" (plus an optional weekday) into a real calendar date.
// Week 1 starts on termStart, so Week 1 Monday = termStart if the term starts on a Monday.

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

  // Start of the requested week. Week 0 (O-Week) is the week before Week 1.
  // We use UTC maths so daylight-saving changes can't shift the day.
  const start = new Date(termStart + "T00:00:00Z");
  let daysToAdd = (week - 1) * 7;

  // If a weekday was given, move forward to that day within the week.
  // Days are counted relative to the weekday the term starts on.
  // With no weekday we stay on the first day of the week: it's better
  // to be reminded early than to miss a deadline.
  if (weekday) {
    const targetIndex = WEEKDAYS.indexOf(weekday.trim().toLowerCase());
    if (targetIndex !== -1) {
      const startIndex = (start.getUTCDay() + 6) % 7; // convert Sunday=0 to Monday=0
      daysToAdd = daysToAdd + ((targetIndex - startIndex + 7) % 7);
    }
  }

  start.setUTCDate(start.getUTCDate() + daysToAdd);
  return start.toISOString().slice(0, 10);
}
