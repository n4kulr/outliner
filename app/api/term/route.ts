import { NextResponse } from "next/server";
import { TermResponse } from "@/lib/types";
import { getUnswTerms } from "@/lib/unswTerms";
import { sydneyToday } from "@/lib/unswWeek";

// GET /api/term -> the UNSW term calendar (from unswweek.com) so the page can label weeks.
export async function GET() {
  const { terms, source } = await getUnswTerms();
  const body: TermResponse = { terms, source, today: sydneyToday() };
  return NextResponse.json(body);
}
