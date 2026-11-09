import { createEvents, EventAttributes } from "ics";
import { Assessment } from "./types";

// Builds the text of an .ics calendar file from a list of assessments.
// Rows without a due date are skipped (there's nothing to put on a calendar).
export function makeIcs(assessments: Assessment[], courseCode: string): { value?: string; error?: string } {
  const events: EventAttributes[] = [];

  for (const assessment of assessments) {
    // Skip anything we can't place on a day
    if (!assessment.dueDate) {
      continue;
    }

    // Break "2026-10-03" into numbers the ics package understands
    const [year, month, day] = assessment.dueDate.split("-").map(Number);

    // Event title, e.g. "COMP1511: Assignment 1 (20%)"
    let title = assessment.title;
    if (courseCode) {
      title = `${courseCode}: ${title}`;
    }
    if (assessment.weight !== null) {
      title = `${title} (${assessment.weight}%)`;
    }

    // Extra details shown when you open the event
    let description = `Type: ${assessment.type}`;
    if (assessment.weight !== null) {
      description = description + `\nWeight: ${assessment.weight}%`;
    }
    description = description + "\nCreated by Outline → Calendar";

    // A reminder one day before every deadline
    const alarms: EventAttributes["alarms"] = [
      { action: "display", description: `Due tomorrow: ${title}`, trigger: { hours: 24, before: true } },
    ];

    if (assessment.dueTime) {
      // Timed deadline: a 30-minute event starting at the due time.
      // "local" in and out means the time stays as written, in the viewer's timezone.
      const [hour, minute] = assessment.dueTime.split(":").map(Number);
      events.push({
        title,
        description,
        alarms,
        start: [year, month, day, hour, minute],
        startInputType: "local",
        startOutputType: "local",
        duration: { minutes: 30 },
      });
    } else {
      // No time given: make it an all-day event that ends at the start of the next day
      const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
      events.push({
        title,
        description,
        alarms,
        start: [year, month, day],
        end: [nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate()],
      });
    }
  }

  if (events.length === 0) {
    return { error: "None of the rows have a due date, so there's nothing to export." };
  }

  const result = createEvents(events);
  if (result.error || !result.value) {
    console.error(result.error);
    return { error: "Couldn't build the calendar file. Check the dates and times are valid." };
  }
  return { value: result.value };
}
