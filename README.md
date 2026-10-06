# ZenState (Cadence)

Next.js frontend for a planning coach that checks whether a plan fits the hours you actually have, and won't quietly compress it to make it fit. Built from the Cadence design screens.

Stack: Next.js (App Router), React, TypeScript, Tailwind CSS v4, Phosphor icons. Frontend only: demo data lives in `src/lib/data.ts`, and state persists in browser localStorage. No backend or AI service.

## Run locally

```bash
npm install
npm run dev
```

## Routes

| Route | Screen |
| --- | --- |
| `/setup` | Baseline week setup (toggle commitments, usable hours) |
| `/today` | Dashboard |
| `/plan` | Planning chat, goal captured |
| `/plan/fit?needed=14\|17\|27` | Feasibility: fits, tight, doesn't fit |
| `/plan/review` | Proposed week, commit |
| `/tasks` | Committed tasks |

Dates are relative to today; the demo deadline is three weeks out.
