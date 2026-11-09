# Outline → Calendar

Paste a uni course outline, and AI pulls out every assessment and deadline, then exports them to your calendar in one click.

## How it works

1. Paste the outline text (optionally add the course code and term start date).
2. **Extract** sends it to `POST /api/extract`, which asks DeepSeek (JSON mode) for every assessment.
3. The server validates the reply and converts any "Week N" dates into real dates using the term start.
4. Edit, delete or add rows in the table, which stays sorted by due date.
5. **Export .ics** downloads a file that imports into Google, Apple or Outlook Calendar. Each event has a reminder 24 hours before it's due.

## Run locally

```bash
cp .env.example .env.local   # then paste your DeepSeek key
npm install
npm run dev
```

Open http://localhost:3000 and click **Load sample outline** to try it.

## Deploy (Vercel)

Import the repo in Vercel and add the `DEEPSEEK_API_KEY` environment variable. The key is only ever read on the server.

## Files

| File | What it does |
| --- | --- |
| `app/page.tsx` | The single-page UI: form, results table, export |
| `app/api/extract/route.ts` | Calls DeepSeek, validates the JSON, returns clean assessments |
| `lib/weekToDate.ts` | Turns "Week 7 Friday" into `2026-10-30` |
| `lib/makeIcs.ts` | Builds the `.ics` file with the `ics` package |
| `lib/types.ts` | Shared types for the API contract |
| `lib/sampleOutline.ts` | Demo outline for the "Load sample" button |

## API

`POST /api/extract`

```json
{ "outlineText": "...", "courseCode": "COMP1531", "termStart": "2026-09-14" }
```

returns

```json
{ "assessments": [{ "title": "Assignment 1", "dueDate": "2026-10-03", "dueTime": "17:00", "weight": 20, "type": "assignment" }] }
```

`type` is one of `assignment`, `quiz`, `exam`, `lab`, `project`, `other`. `dueTime` and `weight` are `null` if the outline doesn't state them. `dueDate` is `null` when there's no date at all (e.g. "during the exam period"). Those rows appear in the table but aren't exported until you add a date.

## Design notes

- **Week N → date:** the model returns `week` and `weekday` as separate fields, not a date. The server then calculates the date from the term start, because LLMs often miscount weeks. If no weekday is given, the date falls on the first day of that week, so you get the reminder early rather than late.
- **Validation:** every field from the model is checked (real calendar date, `HH:MM` time, weight 0–100, known type) before it reaches the browser. Rows without a title are dropped.
