// Browser-side helpers for drawing the calendar.

import { CalendarEvent } from "./types";

// Joins class names, skipping any that are false/empty. Lets us write `isToday && "bg-accent"`.
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// iOS Calendar's colour palette, handed out to courses in order.
export const COURSE_COLORS = ["#ff3b30", "#007aff", "#34c759", "#af52de", "#ff9500", "#5ac8fa", "#ff2d55", "#a2845e"];

// A local Date -> "YYYY-MM-DD" (in the viewer's own timezone)
export function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// "YYYY-MM-DD" -> a local Date at midnight
export function fromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// The weeks to draw for a month. Weeks start on Monday, like UNSW weeks.
export function monthWeeks(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // how many days back to the Monday
  const cursor = new Date(year, month, 1 - offset);

  const weeks: string[][] = [];
  // Keep adding weeks until we've passed the end of the month
  while (weeks.length === 0 || cursor.getMonth() === month) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(toIso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// Groups events by every day they cover (multi-day events appear on each day).
export function eventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (!event.dueDate) {
      continue;
    }
    let lastDay = event.dueDate;
    if (event.endDate && event.endDate > event.dueDate) {
      lastDay = event.endDate;
    }
    const cursor = fromIso(event.dueDate);
    let iso = event.dueDate;
    while (iso <= lastDay) {
      const list = map.get(iso) ?? [];
      list.push(event);
      map.set(iso, list);
      cursor.setDate(cursor.getDate() + 1);
      iso = toIso(cursor);
    }
  }
  // Within each day: all-day first, then by time
  for (const list of map.values()) {
    list.sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? ""));
  }
  return map;
}

// Sorts events by date then time; events with no date go last.
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const dateA = a.dueDate ?? "9999";
    const dateB = b.dueDate ?? "9999";
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    return (a.dueTime ?? "").localeCompare(b.dueTime ?? "");
  });
}

// "17:00" -> "5:00 pm"
export function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}

// "2026-11-09" -> "Monday 9 November"
export function formatLongDate(iso: string): string {
  return fromIso(iso).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
}

// "2026-11-09" -> "Mon 9 Nov"
export function formatShortDate(iso: string): string {
  return fromIso(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

// How far away a day is, in words: "Today", "Tomorrow", "in 5 days", "3 days ago"
export function relativeDay(iso: string, todayIso: string): string {
  const days = Math.round((fromIso(iso).getTime() - fromIso(todayIso).getTime()) / 86400000);
  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "Tomorrow";
  }
  if (days === -1) {
    return "Yesterday";
  }
  if (days > 0) {
    return `in ${days} days`;
  }
  return `${-days} days ago`;
}

// Colour for a weight badge: heavy assessments stand out.
export function weightClass(weight: number | null): string {
  if (weight === null) {
    return "bg-fill text-label-2";
  }
  if (weight > 30) {
    return "bg-red-500/15 text-red-600 dark:text-red-400";
  }
  if (weight >= 15) {
    return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
  }
  return "bg-green-500/15 text-green-700 dark:text-green-400";
}
