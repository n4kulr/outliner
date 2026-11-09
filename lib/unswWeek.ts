// Pure helpers for UNSW term dates. No fetching here, so both the server and the browser can use them.

// A dated event inside a term, e.g. "Exam Period" or "T3 O-Week".
export type TermEvent = {
  name: string;
  type: string; // "teaching_period", "flexibility_week", "study_period", "exam_period", "o_week", ...
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD"
};

// One block of the UNSW year: a trimester ("t1", "t2", "t3") or a holiday.
export type UnswTerm = {
  id: string;
  name: string;
  type: string; // "trimester" or "holiday"
  start: string;
  end: string;
  events: TermEvent[];
};

// What we show for a given day, e.g. { termName: "Term 3", label: "Week 9", shortLabel: "9" }
export type WeekInfo = {
  termName: string;
  label: string;
  shortLabel: string;
  week: number | null;
};

// Whole days from one ISO date to another (can be negative). UTC maths avoids daylight-saving surprises.
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso + "T00:00:00Z");
  const to = Date.parse(toIso + "T00:00:00Z");
  return Math.round((to - from) / 86400000);
}

// Adds whole days to an ISO date.
export function addDays(iso: string, days: number): string {
  const date = new Date(iso + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Finds the term event of a given type that covers a date, if any.
function eventOnDate(term: UnswTerm, iso: string, type: string): TermEvent | undefined {
  return term.events.find((event) => event.type === type && event.start <= iso && iso <= event.end);
}

// Describes where a date falls in the UNSW year: "Week 7", "Exam period", "O-Week", "Holiday".
export function describeWeek(terms: UnswTerm[], iso: string): WeekInfo | null {
  const term = terms.find((candidate) => candidate.start <= iso && iso <= candidate.end);
  if (!term) {
    return null;
  }

  // Holidays: the only interesting thing is O-Week for the next term
  if (term.type !== "trimester") {
    const oWeek = eventOnDate(term, iso, "o_week");
    if (oWeek) {
      return { termName: oWeek.name.replace(" O-Week", ""), label: "O-Week", shortLabel: "O", week: 0 };
    }
    return { termName: term.name, label: "Holiday", shortLabel: "", week: null };
  }

  // Inside a trimester: exam and study periods get their own labels
  if (eventOnDate(term, iso, "exam_period")) {
    return { termName: term.name, label: "Exam period", shortLabel: "E", week: null };
  }
  if (eventOnDate(term, iso, "study_period")) {
    return { termName: term.name, label: "Study period", shortLabel: "S", week: null };
  }

  // Teaching weeks are counted from the first day of the term (Week 1 starts on term.start)
  const week = Math.floor(daysBetween(term.start, iso) / 7) + 1;
  let label = `Week ${week}`;
  if (eventOnDate(term, iso, "flexibility_week")) {
    label = `Week ${week} · Flexibility`;
  }
  return { termName: term.name, label, shortLabel: String(week), week };
}

// Picks which trimester an outline belongs to.
// Uses the term the outline names if we can match it, otherwise the term happening now,
// otherwise the next one coming up, otherwise the most recent one.
export function pickTerm(
  terms: UnswTerm[],
  todayIso: string,
  termNumber: number | null,
  year: number | null
): UnswTerm | null {
  const trimesters = terms.filter((term) => term.type === "trimester");
  if (trimesters.length === 0) {
    return null;
  }

  // 1. The term the outline names, e.g. "Term 3 2026"
  if (termNumber !== null) {
    const named = trimesters.find((term) => {
      const sameNumber = term.id === `t${termNumber}`;
      let sameYear = true;
      if (year !== null) {
        sameYear = term.start.startsWith(String(year));
      }
      return sameNumber && sameYear;
    });
    if (named) {
      return named;
    }
  }

  // 2. The term running today
  const current = trimesters.find((term) => term.start <= todayIso && todayIso <= term.end);
  if (current) {
    return current;
  }

  // 3. The next term to start
  const upcoming = trimesters.filter((term) => term.start > todayIso);
  if (upcoming.length > 0) {
    return upcoming[0];
  }

  // 4. The last term we know about
  return trimesters[trimesters.length - 1];
}

// Today's date in Sydney as "YYYY-MM-DD" (UNSW weeks follow Sydney time, wherever the server runs).
export function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}
