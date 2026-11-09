import { NextResponse } from "next/server";
import { ASSESSMENT_TYPES, Assessment, AssessmentType, ExtractResponse } from "@/lib/types";
import { readOutlineFile } from "@/lib/readOutline";
import { getUnswTerms } from "@/lib/unswTerms";
import { UnswTerm, pickTerm, sydneyToday } from "@/lib/unswWeek";
import { isValidIsoDate, weekToDate } from "@/lib/weekToDate";

// DeepSeek can take a while on long outlines, so give the function up to 60 seconds on Vercel.
export const maxDuration = 60;

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel rejects request bodies over ~4.5 MB
const MAX_OUTLINE_CHARACTERS = 120000;

// The instructions we give the model. It must reply with JSON only.
// We ask for "week" + "weekday" separately so our own code does the
// Week N -> date maths, which is far more reliable than letting the model count.
const SYSTEM_PROMPT = `You extract assessments from university course outlines. Return ONLY valid JSON matching the schema. Do not invent assessments. Use null for unknown fields.

Schema:
{
  "courseCode": string | null,     // e.g. "COMP1531"
  "courseName": string | null,     // e.g. "Software Engineering Fundamentals"
  "termNumber": number | null,     // 1, 2 or 3 for UNSW Term 1/2/3 (T1/T2/T3)
  "year": number | null,           // e.g. 2026
  "assessments": [
    {
      "title": string,             // e.g. "Assignment 1"
      "dueDate": string | null,    // "YYYY-MM-DD" ONLY if an actual calendar date is written in the outline
      "week": number | null,       // if the due date is given as "Week N", put N here (O-Week = 0)
      "weekday": string | null,    // e.g. "Friday" if a day is given alongside the week
      "period": "exam_period" | "study_period" | null, // if it's due "in the exam period" etc. with no exact date
      "dueTime": string | null,    // 24-hour "HH:MM", e.g. "17:00" for 5pm
      "weight": number | null,     // percentage as a number, e.g. 20 for 20%
      "type": "assignment" | "quiz" | "exam" | "lab" | "project" | "other"
    }
  ]
}

Rules:
- If a date is given as "Week N", set "week" (and "weekday" if stated) and leave "dueDate" null.
- If a calendar date has no year, use the year of the term.
- If an assessment repeats (e.g. "weekly quizzes in Weeks 2-9"), list each occurrence separately, numbered (e.g. "Quiz 1", "Quiz 2"), and split the weight evenly if only a total is given.
- If something is due "weekly" or "each week" without listing weeks, list one per teaching week that the outline implies; if it doesn't say, use Weeks 1-10 except Week 6.
- Final exams held "in the exam period" with no date: set "period" to "exam_period".
- Only list items that are graded or have a deadline. Skip lectures, readings and tutorials that aren't assessed.
- If there are no assessments, return "assessments": [].`;

// Small helper so every error goes back in the same shape.
function errorResponse(message: string, status: number) {
  const body: ExtractResponse = { error: message };
  return NextResponse.json(body, { status: status });
}

// Turns one raw item from the model into a clean Assessment, or null if it's unusable.
function cleanAssessment(raw: unknown, term: UnswTerm | null): Assessment | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const item = raw as Record<string, unknown>;

  // Title is the only field we insist on
  if (typeof item.title !== "string" || item.title.trim() === "") {
    return null;
  }

  let dueDate: string | null = null;
  let endDate: string | null = null;
  let tentative = false;

  // Due date, in order of preference:
  // 1. a real date written in the outline
  // 2. "Week N" converted with the UNSW term start
  // 3. "during the exam/study period" -> the whole period, marked tentative
  if (typeof item.dueDate === "string" && isValidIsoDate(item.dueDate)) {
    dueDate = item.dueDate;
  } else if (typeof item.week === "number" && term) {
    let weekday: string | null = null;
    if (typeof item.weekday === "string") {
      weekday = item.weekday;
    }
    dueDate = weekToDate(term.start, item.week, weekday);
    if (weekday === null) {
      tentative = true; // we only know the week, not the day
    }
  } else if (typeof item.period === "string" && term) {
    const period = term.events.find((event) => event.type === item.period);
    if (period) {
      dueDate = period.start;
      endDate = period.end;
      tentative = true;
    }
  }

  // Due time must look like HH:MM
  let dueTime: string | null = null;
  if (typeof item.dueTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.dueTime)) {
    dueTime = item.dueTime;
  }

  // Weight must be a sensible percentage
  let weight: number | null = null;
  if (typeof item.weight === "number" && item.weight >= 0 && item.weight <= 100) {
    weight = Math.round(item.weight * 10) / 10;
  }

  // Type must be one we know about
  let type: AssessmentType = "other";
  if (typeof item.type === "string" && ASSESSMENT_TYPES.includes(item.type as AssessmentType)) {
    type = item.type as AssessmentType;
  }

  return { title: item.title.trim(), dueDate, endDate, dueTime, weight, type, tentative };
}

export async function POST(request: Request) {
  // 1. Make sure the server has an API key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return errorResponse("Server is missing DEEPSEEK_API_KEY.", 500);
  }

  // 2. Get the uploaded file
  let file: File;
  try {
    const form = await request.formData();
    const upload = form.get("file");
    if (!(upload instanceof File)) {
      return errorResponse("No file was uploaded.", 400);
    }
    file = upload;
  } catch {
    return errorResponse("Upload a course outline file.", 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return errorResponse(`${file.name} is over 4 MB. Try a smaller PDF.`, 413);
  }

  // 3. Turn the file into text
  let outlineText: string;
  try {
    outlineText = (await readOutlineFile(file)).trim();
  } catch (error) {
    let message = `Couldn't read ${file.name}.`;
    if (error instanceof Error && error.message.includes("supported")) {
      message = error.message;
    }
    return errorResponse(message, 400);
  }
  if (outlineText.length < 50) {
    return errorResponse(`${file.name} has no readable text. Is it a scanned image?`, 422);
  }
  outlineText = outlineText.slice(0, MAX_OUTLINE_CHARACTERS);

  // 4. Load UNSW term dates (cached) at the same time as we ask the AI
  const today = sydneyToday();
  const termsPromise = getUnswTerms();

  // 5. Call DeepSeek in JSON mode
  let modelText: string;
  try {
    const aiResponse = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Today is ${today}. File name: ${file.name}\n\nCourse outline:\n"""\n${outlineText}\n"""` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("DeepSeek error", aiResponse.status, detail);
      return errorResponse("The AI service returned an error. Please try again.", 502);
    }

    const aiJson = await aiResponse.json();
    modelText = aiJson?.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error("DeepSeek request failed", error);
    return errorResponse("Couldn't reach the AI service. Please try again.", 502);
  }

  // 6. Parse and validate what the model said before trusting it
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(modelText);
  } catch {
    return errorResponse("The AI replied with something that wasn't valid JSON. Please try again.", 502);
  }
  if (!Array.isArray(parsed.assessments)) {
    return errorResponse("The AI reply was missing the assessments list. Please try again.", 502);
  }

  // 7. Work out which UNSW term this outline is for
  let termNumber: number | null = null;
  if (typeof parsed.termNumber === "number") {
    termNumber = parsed.termNumber;
  }
  let year: number | null = null;
  if (typeof parsed.year === "number") {
    year = parsed.year;
  }
  const { terms } = await termsPromise;
  const term = pickTerm(terms, today, termNumber, year);

  // 8. Clean every assessment
  const assessments: Assessment[] = [];
  for (const raw of parsed.assessments) {
    const cleaned = cleanAssessment(raw, term);
    if (cleaned) {
      assessments.push(cleaned);
    }
  }
  if (assessments.length === 0) {
    return errorResponse(`No assessments found in ${file.name}.`, 422);
  }

  // 9. Course details, falling back to the file name
  let courseCode = file.name.replace(/\.[^.]+$/, "").slice(0, 12).toUpperCase();
  if (typeof parsed.courseCode === "string" && parsed.courseCode.trim() !== "") {
    courseCode = parsed.courseCode.trim().toUpperCase();
  }
  let courseName = "";
  if (typeof parsed.courseName === "string") {
    courseName = parsed.courseName.trim();
  }
  let termLabel = "";
  if (term) {
    termLabel = `${term.name} ${term.start.slice(0, 4)}`;
  }

  const responseBody: ExtractResponse = { courseCode, courseName, termLabel, assessments };
  return NextResponse.json(responseBody);
}
