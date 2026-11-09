# Outliner

Drop your UNSW course outlines and see every assessment on one calendar, styled like iOS Calendar with liquid glass.

## How it works

1. Drag course outline files (PDF, Word, text or HTML) anywhere onto the page, or press **+**. Several at once is fine.
2. Each file goes to `POST /api/extract`. The server reads the text, then asks DeepSeek (JSON mode) for the course code, term and every assessment.
3. The server works out which UNSW term the outline is for, using live dates from [unswweek.com](https://www.unswweek.com). It turns "Week 7 Friday" into a real date, and spreads "during the exam period" across the actual exam period, marked **TBC**.
4. Everything lands on a month calendar, with a colour per course and UNSW week numbers down the side. The calendar is saved in your browser, so it's still there next time.
5. Tap an assessment to edit or delete it. **Calendars** shows or hides courses. The share button exports an `.ics` file for Google, Apple or Outlook Calendar, with a reminder 24 hours before each deadline.

## Run locally

```bash
cp .env.example .env.local   # then paste your DeepSeek key
npm install
npm run dev
```

## Deploy (Vercel)

Import the repo in Vercel and add the `DEEPSEEK_API_KEY` environment variable. The key is only ever read on the server.

## Files

| File | What it does |
| --- | --- |
| `app/page.tsx` | The app: toolbar, drag and drop, month/list views, saving |
| `app/api/extract/route.ts` | File → text → DeepSeek → validated assessments with real dates |
| `app/api/term/route.ts` | UNSW term calendar for week labels |
| `lib/unswTerms.ts` | Scrapes term dates from unswweek.com (cached daily, with a built-in fallback) |
| `lib/unswWeek.ts` | "Which UNSW week is this date?" and "which term is this outline?" |
| `lib/weekToDate.ts` | Turns "Week 7 Friday" into `2026-10-30` |
| `lib/readOutline.ts` | Reads PDF (`unpdf`), Word (`mammoth`), text and HTML files |
| `lib/makeIcs.ts` | Builds the `.ics` file with the `ics` package |
| `components/` | Month grid, day panel, list view, edit and calendars sheets |

## Design notes

- **Week N → date:** the model returns `week` and `weekday` as separate fields, not a date. The server then calculates the date from the term start, because LLMs often miscount weeks. If no weekday is given, the date falls on the first day of that week and is marked TBC.
- **Which term?** The model reads the term from the outline ("Term 3 2026"). If it can't, Outliner uses the term running now, or the next one.
- **unswweek.com has no API.** Its term dates live inside its JavaScript bundle, so `lib/unswTerms.ts` finds that file and reads the dates out. If the site changes, the app falls back to built-in 2026 dates, and the green dot in the toolbar turns grey.
