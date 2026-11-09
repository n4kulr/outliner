"use client";

import { useState } from "react";
import { ASSESSMENT_TYPES, Assessment, AssessmentType, ExtractResponse } from "@/lib/types";
import { makeIcs } from "@/lib/makeIcs";
import { SAMPLE_COURSE_CODE, SAMPLE_OUTLINE, SAMPLE_TERM_START } from "@/lib/sampleOutline";

// A row in the table: an assessment plus a stable id so React can track edits and deletes.
type Row = Assessment & { id: number };

let nextRowId = 1;
function makeRow(assessment: Assessment): Row {
  const row = { ...assessment, id: nextRowId };
  nextRowId = nextRowId + 1;
  return row;
}

// Sorts rows by date (then time). Rows with no date go to the bottom.
function sortRows(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    if (a.dueDate === b.dueDate) {
      return (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99");
    }
    if (!a.dueDate) {
      return 1;
    }
    if (!b.dueDate) {
      return -1;
    }
    return a.dueDate.localeCompare(b.dueDate);
  });
}

// Picks a colour for the weight badge: heavy assessments stand out.
function weightColour(weight: number | null): string {
  if (weight === null) {
    return "bg-slate-100 text-slate-500 border-slate-200";
  }
  if (weight > 30) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (weight >= 15) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

export default function Home() {
  // Form inputs
  const [outlineText, setOutlineText] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [termStart, setTermStart] = useState("");

  // Results and status
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasExtracted, setHasExtracted] = useState(false);

  // Fills the form with a demo outline
  function loadSample() {
    setOutlineText(SAMPLE_OUTLINE);
    setCourseCode(SAMPLE_COURSE_CODE);
    setTermStart(SAMPLE_TERM_START);
    setErrorMessage("");
  }

  // Sends the outline to our API route and shows the results
  async function handleExtract() {
    if (outlineText.trim() === "") {
      setErrorMessage("Please paste your course outline first.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlineText, courseCode, termStart }),
      });
      const data: ExtractResponse = await response.json();

      if (!response.ok || data.error) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      const assessments = data.assessments ?? [];
      setRows(sortRows(assessments.map(makeRow)));
      setHasExtracted(true);

      if (assessments.length === 0) {
        setErrorMessage("No assessments found. Make sure you pasted the assessment section of the outline.");
      }
    } catch {
      setErrorMessage("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Changes one field of one row
  function updateRow(id: number, changes: Partial<Assessment>) {
    const updated = rows.map((row) => {
      if (row.id === id) {
        return { ...row, ...changes };
      }
      return row;
    });
    setRows(updated);
  }

  // Removes a row
  function deleteRow(id: number) {
    setRows(rows.filter((row) => row.id !== id));
  }

  // Adds an empty row the user can fill in (for anything the AI missed)
  function addRow() {
    const blank = makeRow({ title: "New assessment", dueDate: null, dueTime: null, weight: null, type: "other" });
    setRows([...rows, blank]);
  }

  // Builds the .ics file and makes the browser download it
  function handleExport() {
    const result = makeIcs(rows, courseCode.trim());
    if (result.error || !result.value) {
      setErrorMessage(result.error ?? "Couldn't build the calendar file.");
      return;
    }
    setErrorMessage("");

    const blob = new Blob([result.value], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${courseCode.trim() || "assessments"}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Shown in the table, always in date order
  const sortedRows = sortRows(rows);
  const undatedCount = rows.filter((row) => !row.dueDate).length;

  let extractLabel = "Extract assessments";
  if (isLoading) {
    extractLabel = "Extracting…";
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Outline → Calendar</h1>
        <p className="mt-2 text-slate-600">
          Paste a course outline. Get every deadline in your calendar in one click.
        </p>
      </header>

      {/* Input form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <label htmlFor="outline" className="text-sm font-medium text-slate-700">
            Course outline
          </label>
          <button
            type="button"
            onClick={loadSample}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Load sample outline
          </button>
        </div>
        <textarea
          id="outline"
          value={outlineText}
          onChange={(event) => setOutlineText(event.target.value)}
          placeholder="Paste the whole outline, or just the assessment section…"
          rows={12}
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="courseCode" className="text-sm font-medium text-slate-700">
              Course code <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="courseCode"
              value={courseCode}
              onChange={(event) => setCourseCode(event.target.value)}
              placeholder="COMP1511"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label htmlFor="termStart" className="text-sm font-medium text-slate-700">
              Term start (Week 1 Monday) <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="termStart"
              type="date"
              value={termStart}
              onChange={(event) => setTermStart(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <button
            type="button"
            onClick={handleExtract}
            disabled={isLoading}
            className="flex h-[42px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70"
          >
            {isLoading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {extractLabel}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Add the term start so dates like &quot;Week 7&quot; can be turned into real dates.
        </p>
      </section>

      {/* Error message */}
      {errorMessage && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Results */}
      {hasExtracted && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Assessments <span className="font-normal text-slate-400">({rows.length})</span>
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addRow}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                + Add row
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={rows.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
              >
                Export .ics
              </button>
            </div>
          </div>

          {undatedCount > 0 && (
            <p className="mb-3 text-sm text-amber-700">
              {undatedCount} row(s) have no date and won&apos;t be exported until you add one.
            </p>
          )}

          {/* Column headings (hidden on phones, where each row becomes a card) */}
          <div className="hidden grid-cols-[2fr_1fr_0.7fr_0.6fr_0.9fr_auto] gap-2 px-3 pb-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
            <span>Title</span>
            <span>Due date</span>
            <span>Time</span>
            <span>Weight %</span>
            <span>Type</span>
            <span className="w-8" />
          </div>

          <ul className="space-y-2">
            {sortedRows.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[2fr_1fr_0.7fr_0.6fr_0.9fr_auto] md:items-center"
              >
                {/* Title */}
                <input
                  aria-label="Title"
                  value={row.title}
                  onChange={(event) => updateRow(row.id, { title: event.target.value })}
                  className="col-span-2 rounded-md border border-transparent px-2 py-1 font-medium text-slate-900 hover:border-slate-200 focus:border-indigo-400 focus:outline-none md:col-span-1"
                />

                {/* Due date */}
                <input
                  aria-label="Due date"
                  type="date"
                  value={row.dueDate ?? ""}
                  onChange={(event) => updateRow(row.id, { dueDate: event.target.value || null })}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none"
                />

                {/* Due time */}
                <input
                  aria-label="Due time"
                  type="time"
                  value={row.dueTime ?? ""}
                  onChange={(event) => updateRow(row.id, { dueTime: event.target.value || null })}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none"
                />

                {/* Weight, colour-coded */}
                <input
                  aria-label="Weight percent"
                  type="number"
                  min={0}
                  max={100}
                  value={row.weight ?? ""}
                  onChange={(event) => {
                    let weight: number | null = null;
                    if (event.target.value !== "") {
                      weight = Number(event.target.value);
                    }
                    updateRow(row.id, { weight });
                  }}
                  className={`rounded-md border px-2 py-1 text-sm font-semibold focus:outline-none ${weightColour(row.weight)}`}
                />

                {/* Type */}
                <select
                  aria-label="Type"
                  value={row.type}
                  onChange={(event) => updateRow(row.id, { type: event.target.value as AssessmentType })}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm capitalize text-slate-800 focus:border-indigo-400 focus:outline-none"
                >
                  {ASSESSMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => deleteRow(row.id)}
                  aria-label={`Delete ${row.title}`}
                  className="col-span-2 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600 md:col-span-1 md:w-8"
                >
                  <span className="md:hidden">Delete</span>
                  <span className="hidden md:inline">✕</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 text-center text-xs text-slate-400">
        Always double-check dates against the official outline.
      </footer>
    </main>
  );
}
