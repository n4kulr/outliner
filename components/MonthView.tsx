import { CalendarEvent, Course } from "@/lib/types";
import { UnswTerm, describeWeek } from "@/lib/unswWeek";
import { cx, formatTime, fromIso, monthWeeks } from "@/lib/calendar";

type Props = {
  year: number;
  month: number; // 0 = January
  today: string;
  selectedDate: string;
  byDay: Map<string, CalendarEvent[]>;
  coursesByCode: Map<string, Course>;
  terms: UnswTerm[];
  onSelectDate: (iso: string) => void;
  onOpenEvent: (id: string) => void;
};

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PILLS = 3;

// The month grid, like the iPad Calendar app: UNSW week numbers down the left,
// event pills in each day on wide screens and coloured dots on phones.
export default function MonthView(props: Props) {
  const weeks = monthWeeks(props.year, props.month);

  return (
    <div className="glass overflow-hidden rounded-[28px]">
      {/* Weekday names */}
      <div className="grid grid-cols-[28px_repeat(7,1fr)] border-b border-separator px-1 sm:grid-cols-[40px_repeat(7,1fr)]">
        <div className="py-2 text-center text-[10px] font-semibold uppercase text-label-3" title="UNSW week">
          Wk
        </div>
        {WEEKDAY_NAMES.map((name, index) => (
          <div
            key={name}
            className={cx(
              "py-2 text-center text-[11px] font-semibold uppercase tracking-wide",
              index < 5 && "text-label-2",
              index >= 5 && "text-label-3"
            )}
          >
            <span className="sm:hidden">{name[0]}</span>
            <span className="hidden sm:inline">{name}</span>
          </div>
        ))}
      </div>

      {/* One row per week */}
      {weeks.map((week) => {
        const weekInfo = describeWeek(props.terms, week[0]);
        const isThisWeek = week.includes(props.today);
        let weekLabel = "";
        let weekTitle = "";
        if (weekInfo) {
          weekLabel = weekInfo.shortLabel;
          weekTitle = `${weekInfo.termName} · ${weekInfo.label}`;
        }

        return (
          <div
            key={week[0]}
            className="grid grid-cols-[28px_repeat(7,1fr)] border-b border-separator px-1 last:border-b-0 sm:grid-cols-[40px_repeat(7,1fr)]"
          >
            {/* UNSW week number */}
            <div
              title={weekTitle}
              className={cx(
                "pt-2.5 text-center text-[11px] font-semibold tabular-nums",
                isThisWeek && "text-accent",
                !isThisWeek && "text-label-3"
              )}
            >
              {weekLabel}
            </div>

            {/* The seven days */}
            {week.map((iso) => {
              const dayEvents = props.byDay.get(iso) ?? [];
              const inMonth = fromIso(iso).getMonth() === props.month;
              const isToday = iso === props.today;
              const isSelected = iso === props.selectedDate;
              const extraCount = dayEvents.length - MAX_PILLS;

              return (
                <div
                  key={iso}
                  role="button"
                  tabIndex={0}
                  onClick={() => props.onSelectDate(iso)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      props.onSelectDate(iso);
                    }
                  }}
                  className={cx(
                    "group flex min-h-[64px] cursor-pointer flex-col items-center gap-1 px-0.5 py-1.5 outline-none transition-colors hover:bg-fill/60 sm:min-h-[104px] sm:items-stretch sm:px-1",
                    isSelected && "bg-fill/70"
                  )}
                >
                  {/* Day number: red circle for today, filled for the selected day */}
                  <div className="flex justify-center sm:justify-end">
                    <span
                      className={cx(
                        "flex h-7 w-7 items-center justify-center rounded-full text-[15px] tabular-nums transition-colors",
                        isToday && "bg-accent font-semibold text-white",
                        !isToday && isSelected && "bg-label font-semibold text-[var(--bg)]",
                        !isToday && !isSelected && inMonth && "text-label",
                        !isToday && !isSelected && !inMonth && "text-label-3"
                      )}
                    >
                      {fromIso(iso).getDate()}
                    </span>
                  </div>

                  {/* Phones: one dot per event */}
                  <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {dayEvents.slice(0, 4).map((event) => (
                      <span
                        key={event.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: props.coursesByCode.get(event.courseCode)?.color }}
                      />
                    ))}
                  </div>

                  {/* Wider screens: event pills */}
                  <div className="hidden flex-col gap-0.5 sm:flex">
                    {dayEvents.slice(0, MAX_PILLS).map((event) => {
                      const color = props.coursesByCode.get(event.courseCode)?.color ?? "#8e8e93";
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={(click) => {
                            click.stopPropagation();
                            props.onOpenEvent(event.id);
                          }}
                          className={cx(
                            "press flex items-center gap-1 truncate rounded-md px-1.5 py-[3px] text-left text-[11px] font-medium leading-tight",
                            !inMonth && "opacity-50"
                          )}
                          style={{ backgroundColor: color + "26", color: color }}
                          title={`${event.courseCode}: ${event.title}`}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate text-label">{event.title}</span>
                          {event.dueTime && (
                            <span className="ml-auto hidden shrink-0 text-[10px] text-label-2 xl:inline">
                              {formatTime(event.dueTime)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {extraCount > 0 && (
                      <span className="px-1.5 text-[10px] font-medium text-label-2">{extraCount} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
