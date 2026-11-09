import { useState } from "react";
import { CalendarEvent, Course } from "@/lib/types";
import { UnswTerm, describeWeek } from "@/lib/unswWeek";
import { cx, formatShortDate, relativeDay, sortEvents } from "@/lib/calendar";
import EventRow from "./EventRow";

type Props = {
  today: string;
  events: CalendarEvent[];
  coursesByCode: Map<string, Course>;
  terms: UnswTerm[];
  onOpenEvent: (id: string) => void;
};

// Groups sorted events into one section per due date.
function groupByDate(events: CalendarEvent[]): { date: string; events: CalendarEvent[] }[] {
  const groups: { date: string; events: CalendarEvent[] }[] = [];
  for (const event of events) {
    const date = event.dueDate ?? "";
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.events.push(event);
    } else {
      groups.push({ date, events: [event] });
    }
  }
  return groups;
}

// The "List" view: every deadline from today onwards, like iOS Calendar's list mode.
export default function ListView(props: Props) {
  const [showPast, setShowPast] = useState(false);

  // Split into what's still coming and what's done
  const sorted = sortEvents(props.events);
  const upcoming = sorted.filter((event) => (event.endDate ?? event.dueDate ?? "9999") >= props.today);
  const past = sorted.filter((event) => (event.endDate ?? event.dueDate ?? "9999") < props.today);

  let shown = upcoming;
  if (showPast) {
    shown = [...past, ...upcoming];
  }
  const groups = groupByDate(shown);

  let pastButtonLabel = `Show ${past.length} past`;
  if (showPast) {
    pastButtonLabel = "Hide past";
  }

  return (
    <div className="glass rounded-[28px] p-2">
      {past.length > 0 && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setShowPast(!showPast)}
            className="press rounded-full px-3 py-1 text-[13px] font-semibold text-accent hover:bg-fill"
          >
            {pastButtonLabel}
          </button>
        </div>
      )}

      {groups.length === 0 && <p className="px-4 py-10 text-center text-[15px] text-label-2">No upcoming deadlines.</p>}

      {groups.map((group) => {
        const weekInfo = describeWeek(props.terms, group.date);
        let heading = "No date";
        let rightLabel = "";
        if (group.date) {
          heading = formatShortDate(group.date);
          rightLabel = relativeDay(group.date, props.today);
          if (weekInfo && weekInfo.week !== null) {
            rightLabel = `${weekInfo.label} · ${rightLabel}`;
          }
        }
        const isToday = group.date === props.today;

        return (
          <section key={group.date} className="mt-1">
            {/* Sticky date header */}
            <div className="sticky top-[76px] z-10 flex items-baseline justify-between rounded-xl px-3 py-1.5 backdrop-blur-xl">
              <h3 className={cx("text-[15px] font-bold", isToday && "text-accent", !isToday && "text-label")}>{heading}</h3>
              <span className="text-[12px] text-label-2">{rightLabel}</span>
            </div>
            {group.events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                course={props.coursesByCode.get(event.courseCode)}
                isPast={(event.endDate ?? event.dueDate ?? "9999") < props.today}
                onOpen={props.onOpenEvent}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
