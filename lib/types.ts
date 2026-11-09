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
  dueDate: string | null; // "YYYY-MM-DD", or null if the outline gives no date (e.g. "exam period")
  dueTime: string | null; // "HH:MM" (24-hour), or null if not stated
  weight: number | null; // percentage, e.g. 20 for 20%
  type: AssessmentType;
};

// What POST /api/extract expects in the request body.
export type ExtractRequest = {
  outlineText: string;
  courseCode: string;
  termStart: string; // "YYYY-MM-DD", or "" if the user left it blank
};

// What POST /api/extract sends back. Exactly one of the two fields is set.
export type ExtractResponse = {
  assessments?: Assessment[];
  error?: string;
};
