"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarEvent, Course, ExtractResponse, TermResponse } from "@/lib/types";
import { UnswTerm, describeWeek } from "@/lib/unswWeek";
import { COURSE_COLORS, cx, eventsByDay, fromIso, toIso } from "@/lib/calendar";
import { loadCalendar, saveCalendar } from "@/lib/storage";
import { makeIcs } from "@/lib/makeIcs";
import MonthView from "@/components/MonthView";
import DayPanel from "@/components/DayPanel";
import ListView from "@/components/ListView";
import EventSheet from "@/components/EventSheet";
import CalendarsSheet from "@/components/CalendarsSheet";
import { ArrowDown, ChevronLeft, ChevronRight, Doc, Plus, Share, Stack } from "@/components/Icons";

// File types you can drop
const ACCEPT = ".pdf,.docx,.txt,.md,.html,.htm";

// One dropped file's progress, shown as a little glass toast
type Upload = {
  id: string;
  fileName: string;
  status: "reading" | "done" | "error";
  message: string;
};

type View = "month" | "list";

export default function Home() {
  // The saved calendar
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  // UNSW term dates from unswweek.com
  const [terms, setTerms] = useState<UnswTerm[]>([]);
  const [termSource, setTermSource] = useState<"live" | "fallback" | "loading">("loading");

  // What's on screen
  const [today, setToday] = useState("");
  const [view, setView] = useState<View>("month");
  const [visibleMonth, setVisibleMonth] = useState({ year: 2026, month: 0 });
  const [selectedDate, setSelectedDate] = useState("");
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [showCalendars, setShowCalendars] = useState(false);

  // File dropping
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0); // dragenter/leave fire for every child element, so we count them

  // ---- Start-up: load the saved calendar, today's date and the UNSW terms ----
  useEffect(() => {
    const saved = loadCalendar();
    setCourses(saved.courses);
    setEvents(saved.events);

    const now = new Date();
    setToday(toIso(now));
    setSelectedDate(toIso(now));
    setVisibleMonth({ year: now.getFullYear(), month: now.getMonth() });
    setHasLoaded(true);

    fetch("/api/term")
      .then((response) => response.json())
      .then((data: TermResponse) => {
        setTerms(data.terms);
        setTermSource(data.source);
      })
      .catch(() => setTermSource("fallback"));
  }, []);

  // ---- Save whenever the calendar changes ----
  useEffect(() => {
    if (hasLoaded) {
      saveCalendar({ courses, events });
    }
  }, [courses, events, hasLoaded]);

  // ---- Drag and drop anywhere on the page ----
  useEffect(() => {
    function hasFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes("Files");
    }
    function onEnter(event: DragEvent) {
      if (hasFiles(event)) {
        event.preventDefault();
        dragDepth.current = dragDepth.current + 1;
        setIsDragging(true);
      }
    }
    function onOver(event: DragEvent) {
      if (hasFiles(event)) {
        event.preventDefault();
      }
    }
    function onLeave() {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) {
        setIsDragging(false);
      }
    }
    function onDrop(event: DragEvent) {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) {
        handleFiles(files);
      }
    }

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  });

  // Updates one upload toast
  function updateUpload(id: string, changes: Partial<Upload>) {
    setUploads((current) => current.map((upload) => {
      if (upload.id === id) {
        return { ...upload, ...changes };
      }
      return upload;
    }));
  }

  // Hides a toast after a few seconds
  function dismissLater(id: string, milliseconds: number) {
    setTimeout(() => {
      setUploads((current) => current.filter((upload) => upload.id !== id));
    }, milliseconds);
  }

  // ---- Send each dropped outline to the AI and add its assessments ----
  function handleFiles(files: File[]) {
    for (const file of files) {
      const uploadId = crypto.randomUUID();
      setUploads((current) => [...current, { id: uploadId, fileName: file.name, status: "reading", message: "Finding deadlines…" }]);

      const form = new FormData();
      form.append("file", file);

      fetch("/api/extract", { method: "POST", body: form })
        .then(async (response) => {
          let data: ExtractResponse = {};
          try {
            data = await response.json();
          } catch {
            data = { error: "The server sent back something unexpected." };
          }

          if (!response.ok || data.error || !data.assessments || !data.courseCode) {
            updateUpload(uploadId, { status: "error", message: data.error ?? "Something went wrong." });
            dismissLater(uploadId, 8000);
            return;
          }

          addCourse(data);
          updateUpload(uploadId, {
            status: "done",
            message: `Added ${data.assessments.length} assessments to ${data.courseCode}`,
          });
          dismissLater(uploadId, 4000);
        })
        .catch(() => {
          updateUpload(uploadId, { status: "error", message: "Couldn't reach the server." });
          dismissLater(uploadId, 8000);
        });
    }
  }

  // Adds a course to the calendar. Dropping the same course again replaces its old assessments.
  function addCourse(data: ExtractResponse) {
    const code = data.courseCode ?? "COURSE";
    const newEvents: CalendarEvent[] = (data.assessments ?? []).map((assessment) => ({
      ...assessment,
      id: crypto.randomUUID(),
      courseCode: code,
    }));

    setCourses((current) => {
      const existing = current.find((course) => course.code === code);
      if (existing) {
        return current.map((course) => {
          if (course.code === code) {
            return { ...course, name: data.courseName ?? course.name, termLabel: data.termLabel ?? course.termLabel, visible: true };
          }
          return course;
        });
      }
      const color = COURSE_COLORS[current.length % COURSE_COLORS.length];
      return [...current, { code, name: data.courseName ?? "", termLabel: data.termLabel ?? "", color, visible: true }];
    });
    setEvents((current) => [...current.filter((event) => event.courseCode !== code), ...newEvents]);
  }

  // ---- Editing ----
  function saveEvent(updated: CalendarEvent) {
    setEvents(events.map((event) => {
      if (event.id === updated.id) {
        return updated;
      }
      return event;
    }));
  }

  function deleteEvent(id: string) {
    setEvents(events.filter((event) => event.id !== id));
  }

  function toggleCourse(code: string) {
    setCourses(courses.map((course) => {
      if (course.code === code) {
        return { ...course, visible: !course.visible };
      }
      return course;
    }));
  }

  function removeCourse(code: string) {
    setCourses(courses.filter((course) => course.code !== code));
    setEvents(events.filter((event) => event.courseCode !== code));
  }

  // ---- Export every visible assessment as an .ics file ----
  function handleExport() {
    const result = makeIcs(visibleEvents);
    if (result.error || !result.value) {
      const id = crypto.randomUUID();
      setUploads((current) => [...current, { id, fileName: "Export", status: "error", message: result.error ?? "Export failed." }]);
      dismissLater(id, 5000);
      return;
    }
    const blob = new Blob([result.value], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "outliner.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  // ---- Month navigation ----
  function changeMonth(step: number) {
    const date = new Date(visibleMonth.year, visibleMonth.month + step, 1);
    setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() });
  }

  function goToToday() {
    const now = fromIso(today);
    setVisibleMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(today);
  }

  function selectDate(iso: string) {
    setSelectedDate(iso);
    // Clicking a greyed-out day from next/last month jumps to that month
    const date = fromIso(iso);
    if (date.getMonth() !== visibleMonth.month) {
      setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() });
    }
  }

  // Wait until we're in the browser and know today's date
  if (!hasLoaded) {
    return <Backdrop />;
  }

  // ---- Values worked out from state ----
  const visibleCodes = new Set(courses.filter((course) => course.visible).map((course) => course.code));
  const visibleEvents = events.filter((event) => visibleCodes.has(event.courseCode));
  const coursesByCode = new Map(courses.map((course) => [course.code, course]));
  const byDay = eventsByDay(visibleEvents);
  const openEvent = events.find((event) => event.id === openEventId);
  const todayWeek = describeWeek(terms, today);
  const monthName = new Date(visibleMonth.year, visibleMonth.month, 1).toLocaleDateString("en-AU", { month: "long" });
  const busy = uploads.some((upload) => upload.status === "reading");

  // Term chip text, e.g. "Term 3 · Week 9"
  let termChip = "Loading UNSW week…";
  if (termSource !== "loading" && todayWeek) {
    termChip = `${todayWeek.termName} · ${todayWeek.label}`;
  } else if (termSource !== "loading") {
    termChip = "UNSW week unavailable";
  }
  let termTitle = "Live from unswweek.com";
  if (termSource === "fallback") {
    termTitle = "unswweek.com unreachable, using saved 2026 dates";
  }

  return (
    <div className="min-h-screen pb-28">
      <Backdrop />

      {/* Hidden file picker, opened by the + buttons */}
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            handleFiles(files);
          }
          event.target.value = "";
        }}
      />

      {/* ---- Floating glass toolbar ---- */}
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex max-w-7xl items-center gap-2 rounded-full py-1.5 pl-2 pr-1.5">
          <AppIcon today={today} />
          <span className="text-[17px] font-semibold tracking-tight text-label">Outliner</span>

          <span
            title={termTitle}
            className="ml-1 hidden items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 text-[12px] font-semibold text-label-2 sm:flex"
          >
            <span className={cx("h-1.5 w-1.5 rounded-full", termSource === "live" && "bg-[#34c759]", termSource !== "live" && "bg-label-3")} />
            {termChip}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <ToolbarButton label="Calendars" onClick={() => setShowCalendars(true)}>
              <Stack className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton label="Export .ics" onClick={handleExport}>
              <Share className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label="Add course outline"
              className="press flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-[0_4px_14px_rgba(255,59,48,0.45)]"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 sm:px-6">
        {/* ---- Month title, view switch and navigation ---- */}
        <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-4 pt-6">
          <div>
            {/* Term chip on phones (the toolbar hides it) */}
            <p className="mb-1 text-[13px] font-semibold text-accent sm:hidden">{termChip}</p>
            <h1 className="text-[34px] font-bold leading-none tracking-tight text-label sm:text-[44px]">
              {monthName} <span className="text-accent">{visibleMonth.year}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Segmented value={view} onChange={setView} />
            <div className="glass flex items-center rounded-full p-1">
              <ToolbarButton label="Previous month" onClick={() => changeMonth(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </ToolbarButton>
              <button type="button" onClick={goToToday} className="press rounded-full px-3 py-1.5 text-[15px] font-semibold text-accent hover:bg-fill">
                Today
              </button>
              <ToolbarButton label="Next month" onClick={() => changeMonth(1)}>
                <ChevronRight className="h-5 w-5" />
              </ToolbarButton>
            </div>
          </div>
        </div>

        {/* ---- Month view: grid + the selected day's list ---- */}
        {view === "month" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <MonthView
              year={visibleMonth.year}
              month={visibleMonth.month}
              today={today}
              selectedDate={selectedDate}
              byDay={byDay}
              coursesByCode={coursesByCode}
              terms={terms}
              onSelectDate={selectDate}
              onOpenEvent={setOpenEventId}
            />
            <div className="lg:sticky lg:top-[84px] lg:self-start">
              <DayPanel
                date={selectedDate}
                today={today}
                dayEvents={byDay.get(selectedDate) ?? []}
                allEvents={visibleEvents}
                coursesByCode={coursesByCode}
                terms={terms}
                onOpenEvent={setOpenEventId}
              />

              {/* Until the first outline is dropped, invite one under the day panel */}
              {courses.length === 0 && <EmptyState onChoose={() => fileInput.current?.click()} />}
            </div>
          </div>
        )}

        {/* ---- List view ---- */}
        {view === "list" && (
          <div>
            {courses.length === 0 && <EmptyState onChoose={() => fileInput.current?.click()} />}
            <ListView today={today} events={visibleEvents} coursesByCode={coursesByCode} terms={terms} onOpenEvent={setOpenEventId} />
          </div>
        )}
      </main>

      {/* ---- Upload progress toasts ---- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-2 px-3">
        {uploads.map((upload) => (
          <div key={upload.id} className="glass glass-strong sheet-in flex max-w-md items-center gap-3 rounded-full py-2 pl-3 pr-4 text-[14px]">
            {upload.status === "reading" && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-fill-2 border-t-accent" />}
            {upload.status === "done" && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#34c759]" />}
            {upload.status === "error" && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-label">{upload.fileName}</span>
              <span className="block truncate text-[12px] text-label-2">{upload.message}</span>
            </span>
          </div>
        ))}
      </div>

      {/* ---- Full-screen drop target while dragging files ---- */}
      {isDragging && (
        <div className="fade-in pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/10 p-6 backdrop-blur-md">
          <div className="glass glass-strong sheet-in flex w-full max-w-lg flex-col items-center rounded-[36px] border-2 border-dashed border-accent/60 px-8 py-14 text-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-accent text-white shadow-[0_10px_30px_rgba(255,59,48,0.45)]">
              <ArrowDown className="h-8 w-8" />
            </span>
            <p className="text-[22px] font-bold text-label">Drop course outlines</p>
            <p className="mt-1 text-[15px] text-label-2">PDF, Word or text. Drop several at once.</p>
          </div>
        </div>
      )}

      {/* ---- Sheets ---- */}
      {openEvent && (
        <EventSheet
          key={openEvent.id}
          event={openEvent}
          course={coursesByCode.get(openEvent.courseCode)}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={() => setOpenEventId(null)}
        />
      )}
      {showCalendars && (
        <CalendarsSheet
          courses={courses}
          events={events}
          onToggle={toggleCourse}
          onRemove={removeCourse}
          onAdd={() => fileInput.current?.click()}
          onClose={() => setShowCalendars(false)}
        />
      )}

      {/* Screen readers hear when outlines are being read */}
      <p className="sr-only" aria-live="polite">
        {busy && "Reading course outline"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small pieces used only on this page
// ---------------------------------------------------------------------------

// Gray-to-black gradient behind the glass, with two soft gray glows so the glass has something to bend
function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <span style={{ background: "var(--glow-1)", width: "50vw", height: "50vw", top: "-15vw", left: "-10vw" }} />
      <span style={{ background: "var(--glow-2)", width: "40vw", height: "40vw", top: "30vh", right: "-12vw", animationDelay: "-12s" }} />
    </div>
  );
}

// A mini iOS Calendar app icon showing today's date
function AppIcon({ today }: { today: string }) {
  const date = fromIso(today);
  const weekday = date.toLocaleDateString("en-AU", { weekday: "short" }).toUpperCase();
  return (
    <span className="flex h-8 w-8 flex-col items-center justify-center rounded-[9px] bg-white shadow-sm ring-1 ring-black/5">
      <span className="text-[7px] font-bold leading-none text-[#ff3b30]">{weekday}</span>
      <span className="text-[16px] font-light leading-none text-black">{date.getDate()}</span>
    </span>
  );
}

// A round icon button for the toolbar
function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="press flex h-9 w-9 items-center justify-center rounded-full text-accent hover:bg-fill"
    >
      {children}
    </button>
  );
}

// The iOS segmented control: Month | List
function Segmented({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  const options: { id: View; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "list", label: "List" },
  ];

  // The sliding white "thumb" sits under whichever option is chosen
  let thumbPosition = "translate-x-0";
  if (value === "list") {
    thumbPosition = "translate-x-full";
  }

  return (
    <div className="glass relative grid grid-cols-2 rounded-full p-1">
      <span
        className={cx(
          "absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-white/20 shadow-sm transition-transform duration-300",
          thumbPosition
        )}
      />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cx(
            "relative z-10 rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors",
            value === option.id && "text-label",
            value !== option.id && "text-label-2"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Shown under the day panel until the first outline is dropped
function EmptyState({ onChoose }: { onChoose: () => void }) {
  return (
    <div className="glass sheet-in mt-4 flex flex-col items-center rounded-[28px] px-6 py-8 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-fill text-accent">
        <Doc className="h-8 w-8" />
      </span>
      <p className="text-[20px] font-bold text-label">Drop your course outlines</p>
      <p className="mt-1.5 text-[14px] leading-snug text-label-2">
        Drag PDFs anywhere on this page. Outliner reads them and puts every assessment on this calendar, with Week numbers worked out from the current UNSW term.
      </p>
      <button
        type="button"
        onClick={onChoose}
        className="press mt-5 rounded-full bg-accent px-6 py-2.5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(255,59,48,0.4)]"
      >
        Choose files
      </button>
    </div>
  );
}
