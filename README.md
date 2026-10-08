# ZenState

## Run the project

```bash
npm install
npm run dev
```

Open `/login` to start. The Plan with Zen demonstration moves through chat, review, time analysis, and confirmation before adding a task to the timetable.

## Mock API

The app works with prepared local demo replies by default. To connect MockAPI later, copy `.env.example` to `.env` and set `VITE_MOCK_API_URL`. All demo endpoint calls are kept in `src/services/apiConfig.js`.

ZenState is a Vite + React frontend for a calm, AI-assisted personal planning app. It includes login, an editable weekly timetable, planning chat, tasks with individual notes, journal, today dashboard, and a discipline report.

## Run locally

```bash
npm install
npm run dev
```

Demo data is stored in browser localStorage. No backend or external AI service is required for this review build.

## Routes

`/login`, `/today`, `/timetable`, `/planner`, `/tasks`, `/tasks/:taskId`, `/journal`, `/discipline-report`
