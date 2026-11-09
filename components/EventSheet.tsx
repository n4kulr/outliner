import { useState } from "react";
import { ASSESSMENT_TYPES, AssessmentType, CalendarEvent, Course } from "@/lib/types";
import Sheet, { Group, Row, Toggle } from "./Sheet";

type Props = {
  event: CalendarEvent;
  course: Course | undefined;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

const fieldClass = "bg-transparent text-right text-[16px] text-label-2 outline-none focus:text-label";

// Edit one assessment, laid out like the iOS "Edit Event" screen.
export default function EventSheet({ event, course, onSave, onDelete, onClose }: Props) {
  // Edits go into a draft and only apply when you press Done
  const [draft, setDraft] = useState<CalendarEvent>(event);

  function change(changes: Partial<CalendarEvent>) {
    setDraft({ ...draft, ...changes });
  }

  // Turning all-day off gives a sensible default time
  function setAllDay(allDay: boolean) {
    if (allDay) {
      change({ dueTime: null });
    } else {
      change({ dueTime: "17:00", endDate: null });
    }
  }

  // Multi-day events (like "sometime in the exam period") have a start and an end
  let dateLabel = "Due";
  if (draft.endDate !== null) {
    dateLabel = "Starts";
  }

  return (
    <Sheet
      title="Edit Assessment"
      onClose={onClose}
      leftAction={
        <button type="button" onClick={onClose} className="text-[17px] text-accent">
          Cancel
        </button>
      }
      rightAction={
        <button
          type="button"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
          className="text-[17px] font-semibold text-accent"
        >
          Done
        </button>
      }
    >
      {/* Title and course */}
      <Group>
        <input
          aria-label="Title"
          value={draft.title}
          onChange={(input) => change({ title: input.target.value })}
          className="w-full bg-transparent px-4 py-3 text-[17px] font-semibold text-label outline-none"
        />
        <div className="flex items-center gap-2 px-4 py-3 text-[15px] text-label-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: course?.color }} />
          <span className="font-medium text-label">{draft.courseCode}</span>
          {course && course.name && <span className="truncate">{course.name}</span>}
        </div>
      </Group>

      {/* When */}
      <Group>
        <Row label="All-day">
          <Toggle label="All-day" checked={draft.dueTime === null} onChange={setAllDay} />
        </Row>
        <Row label={dateLabel}>
          <input
            type="date"
            value={draft.dueDate ?? ""}
            onChange={(input) => change({ dueDate: input.target.value || null })}
            className={fieldClass}
          />
        </Row>
        {draft.endDate !== null && (
          <Row label="Ends">
            <input
              type="date"
              value={draft.endDate}
              onChange={(input) => change({ endDate: input.target.value || null })}
              className={fieldClass}
            />
          </Row>
        )}
        {draft.dueTime !== null && (
          <Row label="Time">
            <input
              type="time"
              value={draft.dueTime}
              onChange={(input) => change({ dueTime: input.target.value || null })}
              className={fieldClass}
            />
          </Row>
        )}
        <Row label="Date TBC">
          <Toggle label="Date TBC" checked={draft.tentative} onChange={(value) => change({ tentative: value })} />
        </Row>
      </Group>

      {/* What */}
      <Group>
        <Row label="Weight">
          <span className="flex items-center gap-1 text-label-2">
            <input
              type="number"
              min={0}
              max={100}
              placeholder="—"
              value={draft.weight ?? ""}
              onChange={(input) => {
                let weight: number | null = null;
                if (input.target.value !== "") {
                  weight = Number(input.target.value);
                }
                change({ weight });
              }}
              className={`w-16 ${fieldClass}`}
            />
            %
          </span>
        </Row>
        <Row label="Type">
          <select
            value={draft.type}
            onChange={(input) => change({ type: input.target.value as AssessmentType })}
            className={`capitalize ${fieldClass}`}
          >
            {ASSESSMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Row>
      </Group>

      {/* Delete */}
      <Group>
        <button
          type="button"
          onClick={() => {
            onDelete(event.id);
            onClose();
          }}
          className="w-full px-4 py-3 text-center text-[17px] text-accent hover:bg-fill"
        >
          Delete Assessment
        </button>
      </Group>
    </Sheet>
  );
}
