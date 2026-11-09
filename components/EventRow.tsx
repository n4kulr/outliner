import { CalendarEvent, Course } from "@/lib/types";
import { cx, formatTime, weightClass } from "@/lib/calendar";

type Props = {
  event: CalendarEvent;
  course: Course | undefined;
  isPast: boolean;
  onOpen: (id: string) => void;
};

// One event in a list, styled like an iOS Calendar day list:
// time on the left, a coloured bar, then title and details.
export default function EventRow({ event, course, isPast, onOpen }: Props) {
  const color = course?.color ?? "#8e8e93";

  // Left column: the due time, or "all-day"
  let timeLabel = "all-day";
  if (event.dueTime) {
    timeLabel = formatTime(event.dueTime);
  }

  // Second line: course, type
  let details = event.courseCode;
  if (event.type !== "other") {
    details = `${details} · ${event.type}`;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      className={cx(
        "press flex w-full items-stretch gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-fill",
        isPast && "opacity-45"
      )}
    >
      <span className="w-14 shrink-0 pt-0.5 text-right text-[12px] font-medium tabular-nums text-label-2">
        {timeLabel}
      </span>
      <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-label">{event.title}</span>
        <span className="block truncate text-[12px] capitalize text-label-2">{details}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end justify-center gap-1">
        {event.weight !== null && (
          <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", weightClass(event.weight))}>
            {event.weight}%
          </span>
        )}
        {event.tentative && (
          <span className="rounded-full bg-fill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-label-2">
            TBC
          </span>
        )}
      </span>
    </button>
  );
}
