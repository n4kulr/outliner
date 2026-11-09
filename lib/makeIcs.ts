import { createEvents, EventAttributes } from "ics";
import { addDays } from "./unswWeek";
import { CalendarEvent } from "./types";

// Turns "2026-10-03" into [2026, 10, 3], the format the ics package wants.
function toDateArray(iso: string): [number, number, number] {
  const [year, month, day] = iso.split("-").map(Number);
  return [year, month, day];
}

// Builds the text of an .ics calendar file from a list of events.
// Events without a due date are skipped (there's nothing to put on a calendar).
export function makeIcs(events: CalendarEvent[]): { value?: string; error?: string } {
  const icsEvents: EventAttributes[] = [];

  for (const event of events) {
    if (!event.dueDate) {
      continue;
    }

    // Event title, e.g. "COMP1531: Assignment 1 (20%)"
    let title = `${event.courseCode}: ${event.title}`;
    if (event.weight !== null) {
      title = `${title} (${event.weight}%)`;
    }
    if (event.tentative) {
      title = `${title} – date TBC`;
    }

    // Extra details shown when you open the event
    let description = `Type: ${event.type}`;
    if (event.weight !== null) {
      description = description + `\nWeight: ${event.weight}%`;
    }
    description = description + "\nAdded by Outliner";

    // A reminder one day before every deadline
    const alarms: EventAttributes["alarms"] = [
      { action: "display", description: `Due tomorrow: ${title}`, trigger: { hours: 24, before: true } },
    ];

    if (event.dueTime && !event.endDate) {
      // Timed deadline: a 30-minute event starting at the due time.
      // "local" in and out means the time stays as written, in the viewer's timezone.
      const [hour, minute] = event.dueTime.split(":").map(Number);
      icsEvents.push({
        title,
        description,
        alarms,
        start: [...toDateArray(event.dueDate), hour, minute],
        startInputType: "local",
        startOutputType: "local",
        duration: { minutes: 30 },
      });
    } else {
      // All-day event (or several days, e.g. the exam period). Calendar end dates are exclusive.
      let lastDay = event.dueDate;
      if (event.endDate) {
        lastDay = event.endDate;
      }
      icsEvents.push({
        title,
        description,
        alarms,
        start: toDateArray(event.dueDate),
        end: toDateArray(addDays(lastDay, 1)),
      });
    }
  }

  if (icsEvents.length === 0) {
    return { error: "Nothing to export yet. Drop a course outline first." };
  }

  const result = createEvents(icsEvents);
  if (result.error || !result.value) {
    console.error(result.error);
    return { error: "Couldn't build the calendar file. Check the dates and times are valid." };
  }
  return { value: result.value };
}
