import { TermEvent, UnswTerm } from "./unswWeek";

// Server-only: loads the UNSW term calendar from unswweek.com.
// The site has no API, but its term dates are written into one of its JavaScript files,
// so we download the page, find that file, and read the dates out of it.

const SITE_URL = "https://www.unswweek.com";
const ONE_DAY_SECONDS = 60 * 60 * 24;

// Used if unswweek.com is down or changes its code. Copied from the site (2026 calendar).
const FALLBACK_TERMS: UnswTerm[] = [
  { id: "start_of_year_holiday", name: "Summer Holiday", type: "holiday", start: "2026-01-01", end: "2026-02-15", events: [
    { name: "T1 O-Week", type: "o_week", start: "2026-02-09", end: "2026-02-13" },
  ] },
  { id: "t1", name: "Term 1", type: "trimester", start: "2026-02-16", end: "2026-05-14", events: [
    { name: "Teaching Period", type: "teaching_period", start: "2026-02-16", end: "2026-04-24" },
    { name: "Flexibility Week", type: "flexibility_week", start: "2026-03-23", end: "2026-03-29" },
    { name: "Study Period", type: "study_period", start: "2026-04-25", end: "2026-04-30" },
    { name: "Exam Period", type: "exam_period", start: "2026-05-01", end: "2026-05-14" },
  ] },
  { id: "t1_holiday", name: "T1 Holiday", type: "holiday", start: "2026-05-15", end: "2026-05-31", events: [
    { name: "T2 O-Week", type: "o_week", start: "2026-05-25", end: "2026-05-29" },
  ] },
  { id: "t2", name: "Term 2", type: "trimester", start: "2026-06-01", end: "2026-08-27", events: [
    { name: "Teaching Period", type: "teaching_period", start: "2026-06-01", end: "2026-08-07" },
    { name: "Flexibility Week", type: "flexibility_week", start: "2026-07-06", end: "2026-07-12" },
    { name: "Study Period", type: "study_period", start: "2026-08-08", end: "2026-08-13" },
    { name: "Exam Period", type: "exam_period", start: "2026-08-14", end: "2026-08-27" },
  ] },
  { id: "t2_holiday", name: "T2 Holiday", type: "holiday", start: "2026-08-28", end: "2026-09-13", events: [
    { name: "T3 O-Week", type: "o_week", start: "2026-09-07", end: "2026-09-11" },
  ] },
  { id: "t3", name: "Term 3", type: "trimester", start: "2026-09-14", end: "2026-12-10", events: [
    { name: "Teaching Period", type: "teaching_period", start: "2026-09-14", end: "2026-11-20" },
    { name: "Flexibility Week", type: "flexibility_week", start: "2026-10-19", end: "2026-10-25" },
    { name: "Study Period", type: "study_period", start: "2026-11-21", end: "2026-11-26" },
    { name: "Exam Period", type: "exam_period", start: "2026-11-27", end: "2026-12-10" },
  ] },
  { id: "end_of_year_holiday", name: "Summer Holiday", type: "holiday", start: "2026-12-11", end: "2026-12-31", events: [] },
];

// Reads term blocks out of the site's JavaScript, which looks like:
// {id:"t3",name:"Term 3",type:"trimester",start:"2026-09-14",end:"2026-12-10",events:[{name:...},...]}
function parseTerms(javascript: string): UnswTerm[] {
  const termPattern =
    /\{id:"([^"]+)",name:"([^"]+)",type:"([^"]+)",start:"(\d{4}-\d{2}-\d{2})",end:"(\d{4}-\d{2}-\d{2})",events:\[([^\]]*)\]\}/g;
  const eventPattern = /\{name:"([^"]+)",type:"([^"]+)",start:"(\d{4}-\d{2}-\d{2})",end:"(\d{4}-\d{2}-\d{2})"/g;

  const terms: UnswTerm[] = [];
  for (const match of javascript.matchAll(termPattern)) {
    const events: TermEvent[] = [];
    for (const eventMatch of match[6].matchAll(eventPattern)) {
      events.push({ name: eventMatch[1], type: eventMatch[2], start: eventMatch[3], end: eventMatch[4] });
    }
    terms.push({ id: match[1], name: match[2], type: match[3], start: match[4], end: match[5], events });
  }
  return terms;
}

// Downloads the term calendar. Next.js caches each fetch for a day, so we hit the site at most daily.
export async function getUnswTerms(): Promise<{ terms: UnswTerm[]; source: "live" | "fallback" }> {
  try {
    // 1. Get the home page and list its JavaScript files
    const pageResponse = await fetch(SITE_URL, { next: { revalidate: ONE_DAY_SECONDS } });
    const html = await pageResponse.text();
    const scriptPaths = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((match) => match[1]);

    // 2. Download them all at once and look for the one that holds the term dates
    const scripts = await Promise.all(
      scriptPaths.map(async (path) => {
        const response = await fetch(SITE_URL + path, { next: { revalidate: ONE_DAY_SECONDS } });
        return response.text();
      })
    );
    for (const script of scripts) {
      if (script.includes('type:"trimester"')) {
        const terms = parseTerms(script);
        if (terms.some((term) => term.type === "trimester")) {
          return { terms, source: "live" };
        }
      }
    }
  } catch (error) {
    console.error("Couldn't load unswweek.com, using built-in dates", error);
  }

  // 3. Anything went wrong: use the dates we shipped with
  return { terms: FALLBACK_TERMS, source: "fallback" };
}
