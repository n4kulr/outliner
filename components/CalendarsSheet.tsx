import { CalendarEvent, Course } from "@/lib/types";
import { Check, Plus, Trash } from "./Icons";
import Sheet, { Group } from "./Sheet";

type Props = {
  courses: Course[];
  events: CalendarEvent[];
  onToggle: (code: string) => void;
  onRemove: (code: string) => void;
  onAdd: () => void;
  onClose: () => void;
};

// The "Calendars" sheet: one calendar per course. Tick to show or hide, bin to remove.
export default function CalendarsSheet({ courses, events, onToggle, onRemove, onAdd, onClose }: Props) {
  return (
    <Sheet
      title="Calendars"
      onClose={onClose}
      rightAction={
        <button type="button" onClick={onClose} className="text-[17px] font-semibold text-accent">
          Done
        </button>
      }
    >
      <p className="mt-2 px-1 text-[13px] uppercase tracking-wide text-label-2">Courses</p>
      <Group>
        {courses.length === 0 && <p className="px-4 py-3 text-[15px] text-label-2">No courses yet.</p>}

        {courses.map((course) => {
          const count = events.filter((event) => event.courseCode === course.code).length;

          // Filled circle when visible, outlined when hidden
          let circleStyle = { backgroundColor: course.color, borderColor: course.color };
          if (!course.visible) {
            circleStyle = { backgroundColor: "transparent", borderColor: course.color };
          }

          return (
            <div key={course.code} className="flex items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                aria-label={`Show ${course.code}`}
                aria-pressed={course.visible}
                onClick={() => onToggle(course.code)}
                className="press flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                style={circleStyle}
              >
                {course.visible && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold text-label">{course.code}</p>
                <p className="truncate text-[13px] text-label-2">
                  {[course.name, course.termLabel, `${count} assessments`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${course.code}`}
                onClick={() => {
                  if (window.confirm(`Remove ${course.code} and all its assessments?`)) {
                    onRemove(course.code);
                  }
                }}
                className="press rounded-full p-2 text-label-3 hover:bg-fill hover:text-accent"
              >
                <Trash className="h-4.5 w-4.5" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-[16px] text-accent hover:bg-fill"
        >
          <Plus className="h-5 w-5" />
          Add course outline…
        </button>
      </Group>
    </Sheet>
  );
}
