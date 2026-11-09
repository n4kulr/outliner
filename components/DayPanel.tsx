import { CalendarEvent, Course } from "@/lib/types";
import { UnswTerm, describeWeek } from "@/lib/unswWeek";
import { formatLongDate, relativeDay, sortEvents } from "@/lib/calendar";
import EventRow from "./EventRow";

type Props = {
  date: string;
  today: string;
  dayEvents: CalendarEvent[];
  allEvents: CalendarEvent[];
  coursesByCode: Map<string, Course>;
  terms: UnswTerm[];
  onOpenEvent: (id: string) => void;
};

// The list under (or beside) the month: everything due on the selected day.
export default function DayPanel(props: Props) {
  const weekInfo = describeWeek(props.terms, props.date);

  // Subtitle, e.g. "Today · Term 3 · Week 9"
  let subtitle = relativeDay(props.date, props.today);
  if (weekInfo) {
    subtitle = `${subtitle} · ${weekInfo.termName} · ${weekInfo.label}`;
  }

  // If nothing's due, point to what's coming next
  let nextUp: CalendarEvent | undefined;
  if (props.dayEvents.length === 0) {
    nextUp = sortEvents(props.allEvents).find((event) => event.dueDate && event.dueDate > props.date);
  }

  return (
    <div className="glass rounded-[28px] p-2">
      {/* Date heading */}
      <div className="px-3 pb-2 pt-3">
        <h2 className="text-[20px] font-bold tracking-tight text-label">{formatLongDate(props.date)}</h2>
        <p className="text-[13px] text-label-2">{subtitle}</p>
      </div>

      {/* Events */}
      {props.dayEvents.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          course={props.coursesByCode.get(event.courseCode)}
          isPast={(event.endDate ?? event.dueDate ?? "") < props.today}
          onOpen={props.onOpenEvent}
        />
      ))}

      {/* Nothing due */}
      {props.dayEvents.length === 0 && (
        <div className="px-3 pb-3 pt-1 text-[14px] text-label-2">
          <p>Nothing due.</p>
          {nextUp && nextUp.dueDate && (
            <p className="mt-1">
              Next up:{" "}
              <button
                type="button"
                onClick={() => {
                  if (nextUp) {
                    props.onOpenEvent(nextUp.id);
                  }
                }}
                className="font-semibold text-accent"
              >
                {nextUp.courseCode} {nextUp.title}
              </button>{" "}
              {relativeDay(nextUp.dueDate, props.date)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
