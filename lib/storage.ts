import { CalendarEvent, Course } from "./types";

// Saves the calendar in this browser so it's still there next time you open Outliner.

const STORAGE_KEY = "outliner:v1";

export type SavedCalendar = {
  courses: Course[];
  events: CalendarEvent[];
};

export function loadCalendar(): SavedCalendar {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (text) {
      const saved = JSON.parse(text) as SavedCalendar;
      if (Array.isArray(saved.courses) && Array.isArray(saved.events)) {
        return saved;
      }
    }
  } catch {
    // Storage blocked or corrupted: start fresh
  }
  return { courses: [], events: [] };
}

export function saveCalendar(calendar: SavedCalendar) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(calendar));
  } catch {
    // Storage full or blocked: the calendar still works, it just won't be remembered
  }
}
