// The kinds of assessment we recognise. Anything else becomes "other".
export const ASSESSMENT_TYPES = [
  "assignment",
  "quiz",
  "exam",
  "lab",
  "project",
  "other",
] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

// One assessment, exactly as the API sends it back to the browser.
export type Assessment = {
  title: string;
  dueDate: string | null; // "YYYY-MM-DD", or null if it really can't be worked out
  endDate: string | null; // set when it spans several days, e.g. "sometime in the exam period"
  dueTime: string | null; // "HH:MM" (24-hour), or null if not stated
  weight: number | null; // percentage, e.g. 20 for 20%
  type: AssessmentType;
  tentative: boolean; // true when the exact day hasn't been announced yet
};

// An assessment once it's saved in the browser's calendar.
export type CalendarEvent = Assessment & {
  id: string;
  courseCode: string;
};

// One course (one dropped outline) and its calendar colour.
export type Course = {
  code: string;
  name: string;
  termLabel: string; // e.g. "Term 3 2026"
  color: string; // hex colour
  visible: boolean;
};

// What POST /api/extract sends back. Either `error` or the other fields are set.
export type ExtractResponse = {
  error?: string;
  courseCode?: string;
  courseName?: string;
  termLabel?: string;
  assessments?: Assessment[];
};

// What GET /api/term sends back.
export type TermResponse = {
  terms: import("./unswWeek").UnswTerm[];
  source: "live" | "fallback";
  today: string;
};
