import { NextResponse } from "next/server";
import { ASSESSMENT_TYPES, Assessment, AssessmentType, ExtractResponse } from "@/lib/types";
import { isValidIsoDate, weekToDate } from "@/lib/weekToDate";

// DeepSeek can take a while on long outlines, so give the function up to 60 seconds on Vercel.
export const maxDuration = 60;

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_OUTLINE_CHARACTERS = 60000;

// The instructions we give the model. It must reply with JSON only.
// We ask for "week" + "weekday" separately so our own code does the
// Week N -> date maths, which is far more reliable than letting the model count.
const SYSTEM_PROMPT = `You extract assessments from university course outlines. Return ONLY valid JSON matching the schema. Do not invent assessments. Use null for unknown fields.

Schema:
{
  "assessments": [
    {
      "title": string,             // e.g. "Assignment 1"
      "dueDate": string | null,    // "YYYY-MM-DD" ONLY if an actual calendar date is written in the outline
      "week": number | null,       // if the due date is given as "Week N", put N here (Week 0 = O-Week)
      "weekday": string | null,    // e.g. "Friday" if a day is given alongside the week
      "dueTime": string | null,    // 24-hour "HH:MM", e.g. "17:00" for 5pm
      "weight": number | null,     // percentage as a number, e.g. 20 for 20%
      "type": "assignment" | "quiz" | "exam" | "lab" | "project" | "other"
    }
  ]
}

Rules:
- If a date is given as "Week N", set "week" (and "weekday" if stated) and leave "dueDate" null. Week 1 starts on the term start date.
- If a calendar date has no year, use the year of the term start date.
- If an assessment repeats (e.g. "weekly quizzes in Weeks 2-9"), list each occurrence separately and split the weight evenly if a total is given.
- If an assessment has no stated date (e.g. "during the exam period"), still include it with dueDate and week null.
- If there are no assessments, return {"assessments": []}.`;

// Small helper so every error goes back in the same shape.
function errorResponse(message: string, status: number) {
  const body: ExtractResponse = { error: message };
  return NextResponse.json(body, { status: status });
}

// Turns one raw item from the model into a clean Assessment, or null if it's unusable.
function cleanAssessment(raw: unknown, termStart: string): Assessment | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const item = raw as Record<string, unknown>;

  // Title is the only field we insist on
  if (typeof item.title !== "string" || item.title.trim() === "") {
    return null;
  }

  // Due date: prefer a real date, otherwise work it out from "Week N"
  let dueDate: string | null = null;
  if (typeof item.dueDate === "string" && isValidIsoDate(item.dueDate)) {
    dueDate = item.dueDate;
  } else if (typeof item.week === "number") {
    let weekday: string | null = null;
    if (typeof item.weekday === "string") {
      weekday = item.weekday;
    }
    dueDate = weekToDate(termStart, item.week, weekday);
  }

  // Due time must look like HH:MM
  let dueTime: string | null = null;
  if (typeof item.dueTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.dueTime)) {
    dueTime = item.dueTime;
  }

  // Weight must be a sensible percentage
  let weight: number | null = null;
  if (typeof item.weight === "number" && item.weight >= 0 && item.weight <= 100) {
    weight = item.weight;
  }

  // Type must be one we know about
  let type: AssessmentType = "other";
  if (typeof item.type === "string" && ASSESSMENT_TYPES.includes(item.type as AssessmentType)) {
    type = item.type as AssessmentType;
  }

  return { title: item.title.trim(), dueDate, dueTime, weight, type };
}

export async function POST(request: Request) {
  // 1. Make sure the server has an API key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return errorResponse("Server is missing DEEPSEEK_API_KEY.", 500);
  }

  // 2. Read and check the request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be JSON.", 400);
  }

  let outlineText = "";
  if (typeof body.outlineText === "string") {
    outlineText = body.outlineText.trim();
  }
  let courseCode = "";
  if (typeof body.courseCode === "string") {
    courseCode = body.courseCode.trim();
  }
  let termStart = "";
  if (typeof body.termStart === "string" && isValidIsoDate(body.termStart)) {
    termStart = body.termStart;
  }

  if (outlineText === "") {
    return errorResponse("Please paste your course outline first.", 400);
  }
  if (outlineText.length > MAX_OUTLINE_CHARACTERS) {
    return errorResponse("That outline is too long. Try pasting just the assessment section.", 400);
  }

  // 3. Build the user message with the extra context the model needs
  let context = "";
  if (courseCode !== "") {
    context = context + `Course code: ${courseCode}\n`;
  }
  if (termStart !== "") {
    context = context + `Term start date (Week 1 starts here): ${termStart}\n`;
  } else {
    context = context + `Term start date: unknown. Today's date is ${new Date().toISOString().slice(0, 10)}.\n`;
  }
  const userMessage = `${context}\nCourse outline:\n"""\n${outlineText}\n"""`;

  // 4. Call DeepSeek in JSON mode
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
          { role: "user", content: userMessage },
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

  // 5. Parse and validate what the model said before trusting it
  let parsed: unknown;
  try {
    parsed = JSON.parse(modelText);
  } catch {
    return errorResponse("The AI replied with something that wasn't valid JSON. Please try again.", 502);
  }

  const rawList = (parsed as { assessments?: unknown })?.assessments;
  if (!Array.isArray(rawList)) {
    return errorResponse("The AI reply was missing the assessments list. Please try again.", 502);
  }

  const assessments: Assessment[] = [];
  for (const raw of rawList) {
    const cleaned = cleanAssessment(raw, termStart);
    if (cleaned) {
      assessments.push(cleaned);
    }
  }

  // 6. Send the clean list back (it may be empty; the page shows a message for that)
  const responseBody: ExtractResponse = { assessments };
  return NextResponse.json(responseBody);
}
