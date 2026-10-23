# Project handoff

Short orientation for anyone (person or automated assistant) picking this repo up cold. Reflects `main` at `a124afe` (23 Oct 2026). The authoritative detail is in [DEVELOPMENT_HANDOFF.md](../DEVELOPMENT_HANDOFF.md) (schemas, API contract, AI pipeline, verification evidence); this file is the map.

## What it is

ZenState: a student MERN planner. Users protect sleep and fixed commitments, plan a goal through a short AI chat, confirm the placement explicitly, keep notes per task, and hear a prepared motivational message at reminder time.

- **Frontend:** Vite + React 19 + react-router-dom 7 (JavaScript). Root `src/`.
- **Backend:** Express + Mongoose on a **local standalone MongoDB** (`zenstate_dev`). `server/`.
- **Auth:** JWT in a bearer header, bcrypt passwords. No demo accounts, no localStorage fallback.
- **AI:** Groq (`openai/gpt-oss-20b`) via `server/src/services/aiClient.js`, backend only. JSON-object output validated with Zod, one correction retry. A missing key returns a readable error; it never invents a planner answer.
- **Speech:** native browser speech synthesis for the coach/reminders.

## Run

Needs Node 22.14+ and a MongoDB already running on `127.0.0.1:27017`.

```bash
npm ci && npm --prefix server ci
# No .env.example is tracked; create both files by hand (they are git-ignored):
#   .env         VITE_API_BASE_URL=http://localhost:5000/api
#   server/.env  MONGODB_URI, PORT=5000, CLIENT_ORIGIN=http://localhost:5173,
#                JWT_SECRET (32+ chars), AI_PROVIDER, AI_BASE_URL, AI_MODEL, AI_API_KEY
npm --prefix server run dev             # API on :5000
npm run dev                             # app on http://localhost:5173
```

Both `.env` files are git-ignored. Never put the AI key in a `VITE_` variable. The README gives the same steps in PowerShell for the original Windows machine.

## Tests

```bash
npm test                          # 13 focused server tests
npm --prefix server run test:local   # real-Mongo API scenarios, disposable zenstate_test_* DB
npm run test:browser              # Playwright; needs the test servers described in README.md
npm --prefix server run test:groq    # opt-in live Groq check; needs AI_API_KEY
```

Live Groq and audible TTS have not been verified (no key was available).

## Layout

```
src/
  App.jsx                 login route, auth gate, onboarding gate, page routes
  context/AppContext.jsx  server-backed cache: login restore, mutations, refresh
  services/               apiConfig (fetch + token), dates (timezone helpers), usePlanning
  components/             AppLayout (shell, reminder queue), PlacementForm, NotesEditor,
                          NotificationPopup, CoachButton, TaskForm, TaskRow, AsyncButton, StatCard
  pages/                  Login, Today, Timetable, Tasks, TaskDetail, Journal,
                          Planner, PlannerReview, PlannerAvailability, PlannerConfirmation, DisciplineReport
server/src/
  server.js, app.js       boot (connect DB first) and Express setup
  routes/api.js           every endpoint; everything after /auth/register|login is behind auth
  controllers/apiController.js   request schemas, owner lookup, orchestration
  models/index.js         User, Task, ScheduleBlock, Note, Conversation, Message
  services/               availability, placement, schedule, planner, taskContext, reminder, report, blockWrites, aiClient
  utils/                  dates, validation (Zod)
server/tests/             aiClient, scheduling, context-reminders, integration/api
tests/browser/            three Playwright walkthroughs
```

## API surface (all under `/api`)

- **Auth/user:** `POST auth/register`, `POST auth/login`, `GET auth/me`, `PATCH users/me`, `POST onboarding/complete`
- **Tasks:** `GET/POST tasks`, `GET/PATCH/DELETE tasks/:id`, `POST tasks/:id/{placement,complete,reopen,reschedule,context/refresh}`
- **Schedule:** `GET schedule`, `POST schedule/blocks`, `PATCH/DELETE schedule/blocks/:id`, `POST schedule/blocks/:id/split`, `POST schedule/sessions/:id/complete`, `GET availability`
- **Notes:** `GET/POST notes`, `PATCH/DELETE notes/:id`
- **Planner:** `POST planner/conversations`, `GET planner/conversations/:id`, `POST .../messages`, `PATCH .../draft`, `POST .../confirm`
- **Reminders/reports:** `GET reminders/due`, `GET reminders/:id`, `POST reminders/:id/{delivered,snooze}`, `GET reports/weekly`, `POST coach`

## Behaviour worth knowing before editing

- **Writes are ordered, not transactional.** Replacements are saved before originals are removed, with small cleanup on failure. Errors such as `PARTIAL_WRITE`, `COMPLETION_SAVED`, `PARTIAL_DELETE` say what saved and what to retry. Do not add generic rollback or locking machinery; it was deliberately removed.
- **Plan confirmation is idempotent** through a unique source-conversation index. An overlapping confirmation can return 409.
- **Timetable** is 24h x 7 days with sleep set per weekday during onboarding; overlaps are rejected on save, and availability suggestions are advisory and re-checked.
- **Flexible and held tasks** reserve time without a fixed block; flexible ones show as "Today" in Tasks.
- **Context and reminder text** are generated from notes. Only `messageStatus=ready` / `contextProcessingStatus=ready` means AI wrote it; otherwise a labelled template is used.
- **Never reset or drop `zenstate_dev`** for testing; tests use generated `zenstate_test_*` databases.

## Open items (from the project's own docs)

1. Add a real `AI_API_KEY` and run `test:groq` once.
2. Rehearse audible voice reminders in a real browser.
3. Known races: concurrent timetable edits, and a crash mid-confirmation can leave a pending task to inspect.

## Other branch: Next.js rewrite

`origin/nextjs-frontend` (commit `4287595`, not merged) is a separate Next.js + TypeScript + Tailwind frontend built from the "Cadence" design: six static screens with local demo data and live dates. It has no backend wiring and shares no code with this app. Treat it as a design prototype unless it is deliberately rebuilt on top of the API above.

## Other docs in the repo

`README.md` (setup, ops, lab walkthrough), `DEVELOPMENT_HANDOFF.md` and `.docx` (detailed), `IMPLEMENTATION_CHECKLIST.md` (evidence), `Zenstate_Codex_Implementation_Brief.md` (original brief).
