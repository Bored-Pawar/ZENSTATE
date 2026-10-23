# Zenstate development handoff

Updated: 23 October 2026, Asia/Calcutta. Repository: `C:\Users\Aditya Pramod Pawar\zenstate`.

**Current setup: ordinary Mongoose operations against the existing standalone LOCAL MongoDB, `mongodb://127.0.0.1:27017/zenstate_dev`.** The latest user instruction supersedes replica-set, transaction and schedule-lock requirements. Existing MongoDB service/configuration/ports/storage and unrelated databases were left unchanged. No additional mongod was launched.

Ignored application environment files now exist; a JWT secret was generated privately. Working AI credentials were left unchanged during the stability pass. No real passwords, signing secrets, keys or tokens appear here. Earlier replica-set evidence and the documentation-only setup proposal are historical, superseded by the implementation and fresh standalone verification below.


### Multi-day goals (23 October 2026)

This focused feature supersedes the earlier complex recurrence proposal. No weekly targets, repeating goal patterns, or automatic future reservations were added. Existing records remain one-off tasks; no task or session migration/deletion is required.

- `Task.taskType`: `one_off` (Mongoose default for old records) or `multi_day`. `goalStartDate` / `goalEndDate` store the inclusive local goal period separately from `durationMinutes`, which means preferred daily session minutes for a multi-day goal and total planned effort for a one-off task.
- Planning chat accepts these fields plus draft-only `goalDays` / `goalMonths`. The server calculates the inclusive end date using calendar arithmetic from the chosen start or current local date. Six months and 60 session minutes stay separate. Review exposes both period dates and session minutes. Explicit confirmation may save the goal held with zero sessions.
- Task Detail's **Schedule a day** reuses PlacementForm and `POST /api/tasks/:id/placement`. For multi-day goals this adds exactly one dated session, preserving all earlier days. Availability includes this goal's existing sessions; save rechecks period bounds, sleep/commitments/session overlaps and capacity. Only selected dates reserve time. Each session stays within one local calendar day; normal one-off overnight behavior is unchanged.
- The browser supplies a stable `placementRequestId` for one placement attempt. `ScheduleBlock.dayPlacementKey` has a partial unique index, limited to new placement receipts, to prevent duplicate saves/retries. Clients without an ID get an interval-based receipt. A fresh browser placement gets a new ID, so a slot freed by a move can be scheduled again. This is ordinary standalone Mongoose, not a transaction or a cross-request overlap lock. If the session saves but the parent save fails, `DAY_PLACEMENT_SAVED` tells the client to retry; the saved session is reused.
- Completing a multi-day session records only that session and sets the unfinished goal to `in_progress`, even when completed minutes exceed one preferred session. Only **Complete goal** ends the goal and cancels unfinished sessions. Completed history is retained. Individual moves/splits use the existing service with a goal-period check; removing a daily session cancels that occurrence without holding/cancelling other days. Goal-period edits must retain saved history; task types cannot be changed on existing records.
- Reminders and prepared motivational messages use existing session IDs, each session's own start, and the latest task context. Context now includes the goal period and preferred session length. Report calculations are unchanged. Task Detail shows completed-session count and completed planned minutes, without claiming actual tracked time or a percentage of a six-month goal. Existing timetable colours and truthful status labels remain.

Verified for this feature: frontend build, 14 focused backend tests, 28 standalone integration scenarios, and all 12 browser journeys (across the demo, report, stability and multi-day suites). The final multi-day journey was rerun after adding placement request IDs. It verifies real persisted UI placement and refresh; only a disposable fixture start time is advanced to exercise the real completion endpoint without waiting for tomorrow. API reminder tests advance the test clock; audible delivery was not claimed.

Feature files: models/index.js, utils/validation.js, placementService, plannerService, scheduleService, taskContextService, apiController; existing TaskForm, PlacementForm, TaskDetail, TaskRow, SessionEditor and planner pages. Standalone test coverage is in the `MULTI-DAY` scenario in server/tests/integration/api.test.js; the browser journey is tests/browser/multi-day.spec.js. AI responses in the feature test are simulated Groq-compatible JSON; a live Groq response and audible TTS were not verified in this pass.

Demonstration: start the existing MongoDB normally, run `npm --prefix server run dev` and `npm run dev`, then ask Zen: ?Prepare DSA for six months, one hour per day. I want interview confidence.? Review the period and 60-minute preference, save held, and open the saved goal. Use **Schedule a day** twice for two dates/times; inspect each day's availability. Reload to show both sessions persisted. Complete a session after its start to show completed planned effort while the goal remains active and the other session remains unfinished. End only with **Complete goal**. Without AI, the same goal can be created with Add task / Multi-day goal and explicit period dates.


### Stability pass — 23 October 2026

This is the current implementation record; older verification counts below are historical where explicitly labelled. The larger commitment-list, recurring-goal and longer-coach enhancements remain paused. The standalone database/service, credentials, StrictMode, normal refresh and existing UI are preserved.

**Actual causes reproduced:** after a focus/background refresh, one task editor became four. TaskForm and NotesEditor were sibling elements with the identical key (task.id); React reconciliation lost the conditional editor's identity. There was no recursive component and the task was not deleted. Distinct details-/notes- keys fix the cause. TaskForm now guards synchronous repeat submits; detail polling ignores superseded responses and stops in a stable Task not found state. Input stays local during refresh/error; duration changes remain restricted to held work and the field explains that restriction.

Successful confirmation previously restored the confirmed conversation and kept the per-user pointer, so the next planner visit showed the old draft. Confirmation now keeps its success snapshot locally, clears only active planner state/pointer/query, and invalidates old requests. Saved MongoDB chat remains task-linked and explicitly reopenable. Failed/lost responses preserve the draft and retry the existing server confirmation receipt. Server lifecycle/ownership checks remain authoritative.

The calendar explicitly filtered cancelled records out; early completion cancelled future sessions, explaining why those disappeared while actually completed sessions stayed. Calendar rendering now uses saved session facts, independently of parent active-task lists. Completed=green, unfinished=red, retired/cancelled=grey; legend, visible status text, accessible labels and hover labels explain the state. No deleted historical times are invented. Legacy cancelled rows without a stored cause retain a generic cancellation label.

Session editing previously rejected every started/missed occurrence and left End independent of Start. One shared SessionEditor now preserves duration automatically and isolates Split against the saved interval, with a midpoint default. Upcoming moves retain their session ID; splitting retains the first half's ID. Started/missed reschedules save a uniquely linked replacement before retiring the original reminder. Same-request retries recover that replacement. Completed work is not moved; held/flexible work uses the task placement form. Existing supersedesSessionId links are recognised on reads, including across calendar/report weeks, without migrating old documents.

The reminder checker previously cancelled global speech in an effect cleanup on every tasks/blocks refresh. Its lifetime now follows the signed-in owner; cached/API revalidation still closes stale reminders on completion, movement, conversion or logout. Ordinary refresh leaves playback alone. Metadata no-ops and priority/category/journal-only edits no longer regenerate AI context; meaningful context edits keep prepared text available while refreshing. Notes/progress/planning generation remains intact.

Changed frontend files: TaskDetail, TaskForm, new SessionEditor, AppContext, usePlanning, Planner/Review/Availability/Confirmation, Timetable, Today, DisciplineReport, AppLayout, dates and the small calendar CSS additions. Changed backend files: apiController, models, schedule/placement/availability/reminder/report/taskContext services, and new utils/sessions.js. Added browser/stability.spec.js coverage and extended focused/integration tests. No environment, credentials, dependencies or MongoDB service configuration changed.

## 1. Project overview and current readiness

Zenstate is a student MERN assessment: protect sleep and commitments, plan goals through brief AI chat, explicitly confirm sessions/flexible/held work, store reflections, and hear prepared motivation at reminders. Explainable JavaScript and the existing visual interface take priority over infrastructure.

React/Vite calls Express/Node.js JSON APIs; Mongoose persists six owner-scoped models in LOCAL MongoDB. JWT/bcrypt handle accounts, a backend-only helper accesses hosted Groq, and native browser speech handles TTS. There is no demo persistence fallback.

Implemented flow: register/login → resumable seven-day sleep setup → timetable/tasks → planning/review/availability/confirmation → notes/latest context → prepared motivation → due popup/snooze/TTS → completion and calculated reports. Existing styling/navigation/pages are preserved.

| Area                       | Current result                                                                                  | Remaining check                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Persistence                | Existing standalone connected; normal startup/health ready; isolated API/browser writes pass    | Retained project account across app/OS restart; OS restart not performed |
| Auth/setup/timetable/tasks | Verified with real standalone persistence                                                       | Human lab rehearsal in chosen timezone                                   |
| Planning/context           | Persistence, validation/version guards, explicit confirmation verified with absent/simulated AI | Earlier live Groq smoke check passed; this pass uses absent/simulated AI |
| Partial writes             | Replacement cleanup and retryable confirmation/completion/deletion tested                       | Process crashes/outages can still require inspection                     |
| Reminders/reports          | Due queue, saved snooze/delivery and browser UI pass                                            | Audible native TTS, autoplay, speakers                                   |

No transaction-level atomicity or cross-request schedule serialization is claimed. Avoid simultaneous timetable edits in the demonstration.

## 2. Repository structure and entry points

### 2.1 Source tree

Dependency directories, caches, screenshots/test output, `.git`, build output and real environment files are excluded here. Empty/static asset directories may contain no tracked files.

```text
zenstate/
  .env.example
  .gitignore
  index.html
  package.json
  package-lock.json
  README.md
  IMPLEMENTATION_CHECKLIST.md
  Zenstate_Codex_Implementation_Brief.md
  DEVELOPMENT_HANDOFF.md
  DEVELOPMENT_HANDOFF.docx
  playwright.config.js
  public/
  src/
    main.jsx
    App.jsx
    context/AppContext.jsx
    services/
      apiConfig.js
      dates.js
      usePlanning.js
    styles/index.css
    components/
      AppLayout.jsx
      AsyncButton.jsx
      CoachButton.jsx
      NotesEditor.jsx
      NotificationPopup.jsx
      PlacementForm.jsx
      SessionEditor.jsx
      StatCard.jsx
      TaskForm.jsx
      TaskRow.jsx
    pages/
      Login.jsx
      Today.jsx
      Timetable.jsx
      Tasks.jsx
      TaskDetail.jsx
      Journal.jsx
      Planner.jsx
      PlannerReview.jsx
      PlannerAvailability.jsx
      PlannerConfirmation.jsx
      DisciplineReport.jsx
  server/
    .env.example
    package.json
    package-lock.json
    scripts/
      test-local.js
      verify-groq.js
    src/
      server.js
      app.js
      config/db.js
      controllers/apiController.js
      middleware/auth.js
      middleware/errorHandler.js
      models/index.js
      routes/api.js
      utils/dates.js
      utils/validation.js
      utils/sessions.js
      services/
        aiClient.js
        availabilityService.js
        placementService.js
        plannerService.js
        reminderService.js
        reportService.js
        scheduleService.js
        taskContextService.js
        blockWrites.js
    tests/
      aiClient.test.js
      context-reminders.test.js
      scheduling.test.js
      integration/api.test.js
  tests/browser/demo.spec.js
  tests/browser/stability.spec.js
```

`src/data/demoData.js` is deleted in the current working tree. No current component imports it. The legacy `zenstate-demo` localStorage dataset is not imported into accounts. There were already numerous implementation changes and untracked implementation files at the start of this handoff; do not reset or discard them. No applicable `AGENTS.md` was found in the repository or checked ancestor locations.

### 2.2 Important files

| File                                                 | Responsibility                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/main.jsx`                                       | React root, StrictMode, BrowserRouter and AppProvider                                                              |
| `src/App.jsx`                                        | Login route, authentication gate, onboarding gate and page routing                                                 |
| `src/context/AppContext.jsx`                         | Server-backed React cache, account restoration, mutations, refresh and late-response generation guards             |
| `src/services/apiConfig.js`                          | API base URL, bearer-token storage, fetch errors, 401 event and ID normalization                                   |
| `src/services/dates.js`                              | Browser timezone, local dates, UTC conversions, date labels and calendar display segments                          |
| `src/services/usePlanning.js`                        | Restore last per-user conversation and carry its ID through planner URLs                                           |
| `src/components/PlacementForm.jsx`                   | Shared fixed/flexible/held selection; real availability and exact-session construction                             |
| `src/components/NotesEditor.jsx`                     | Explicit note Save/Edit/Delete; preserves unsaved text after request failure                                       |
| `src/components/AppLayout.jsx`                       | Existing shell/sidebar, logout, voice preference, one reminder checker/queue                                       |
| `src/components/CoachButton.jsx`                     | Actual speech API controls, callbacks, unavailable/blocked states and cleanup                                      |
| `server/src/server.js`                               | Loads environment, checks signing-secret configuration, connects DB before importing/listening with app            |
| `server/src/config/db.js`                            | Mongoose connection and index initialization; standalone supported                                                 |
| `server/src/app.js`                                  | Express/CORS/JSON limit/health/router/error handler                                                                |
| `server/src/routes/api.js`                           | Actual endpoint declarations and authentication boundary                                                           |
| `server/src/controllers/apiController.js`            | Request schemas, owner lookup, HTTP responses and CRUD orchestration                                               |
| `server/src/models/index.js`                         | All six Mongoose schemas, serialization and declared indexes                                                       |
| `server/src/utils/validation.js`                     | Zod schemas and error helpers; strips creation defaults from patch schemas                                         |
| `server/src/services/blockWrites.js`                 | Narrow timetable replacement routine: save replacements before deleting originals, with operation-specific cleanup |
| Other `server/src/services/*`                        | Availability, placement, recurring rules, planner, context, reminder and report business rules                     |
| `server/scripts/test-local.js`                       | Test-only connection to existing 27017; isolated generated database and cleanup; never launches MongoDB            |
| `playwright.config.js`, `tests/browser/demo.spec.js` | Test-only Chrome configuration and three browser workflows                                                         |

### 2.3 Exact package versions

Root package: `zenstate` 0.1.0, private, ES modules. Backend: `zenstate-server` 1.0.0, private, ES modules. Both have committed-to-source lockfiles in the current working tree; use `npm ci` for reproducibility.

| Root runtime/build dependency | Version | Backend dependency     | Version |
| ----------------------------- | ------- | ---------------------- | ------- |
| react                         | 19.3.0  | bcryptjs               | 3.0.2   |
| react-dom                     | 19.3.0  | cors                   | 2.8.5   |
| react-router-dom              | 7.18.4  | dotenv                 | 16.6.1  |
| vite                          | 8.3.5   | express                | 5.1.0   |
| @vitejs/plugin-react          | 6.1.2   | jsonwebtoken           | 9.0.2   |
| luxon                         | 3.7.2   | luxon                  | 3.7.2   |
| Root dev: @playwright/test    | 1.56.1  | mongoose               | 8.24.6  |
| Root dev: prettier            | 3.6.2   | zod                    | 4.1.12  |
|                               |         | Backend dev: supertest | 7.1.4   |

Installed tools observed: Node.js v22.14.0, npm 10.9.2, MongoDB server executable v8.3.7, Python 3.12. `mongosh`, Pandoc and LibreOffice were not found on PATH. Python document libraries were not installed; the DOCX companion can be generated with standard-library OOXML packaging without changing application dependencies.

| Working directory | Script                     | Actual command / effect                                                                              |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| root              | `npm run dev`              | `vite`                                                                                               |
| root              | `npm run build`            | `vite build`                                                                                         |
| root              | `npm run preview`          | `vite preview`; origin/port may differ from development                                              |
| root              | `npm run server`           | `npm --prefix server run dev`                                                                        |
| root              | `npm test`                 | `npm --prefix server test`; focused tests only                                                       |
| root              | `npm run test:browser`     | `playwright test`; test servers must already be running                                              |
| root              | `npm run format`           | Prettier writes frontend/backend/test files; do not run during a documentation-only review           |
| server            | `npm run dev`              | `node --watch src/server.js`                                                                         |
| server            | `npm start`                | `node src/server.js`                                                                                 |
| server            | `npm test`                 | `node --test --experimental-test-isolation=none tests/*.test.js`                                     |
| server            | `npm run test:integration` | Same test runner on `tests/integration/*.test.js`; requires an explicitly exported test URI or skips |
| server            | `npm run test:local`       | `node scripts/test-local.js`; creates/drops only a generated test database on the existing server    |

Additional file: `server/scripts/verify-groq.js`; `npm --prefix server run test:groq` is an opt-in live-provider check using a separate generated `zenstate_test_groq_*` database. Without AI_API_KEY it exits blocked before any provider call/database creation. Both test scripts leave mongod running unchanged.

## 3. Architecture and event flows

React pages → AppContext/apiConfig (JWT bearer) → Express routes/controllers → validation/services → Mongoose → local standalone MongoDB. Planner/context services call aiClient → hosted Groq. Prepared text goes through AppLayout/NotificationPopup/CoachButton to browser speech.

All routes below use /api prefix and owner-scoped IDs. Section6 gives detailed contracts.

| Flow                    | Frontend                                  | Endpoints                                                         | Services/models and behavior                                                                                                                                      |
| ----------------------- | ----------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register/login/restore  | Login, AppContext, apiConfig              | POST auth/register, auth/login; GET auth/me                       | apiController/auth middleware; User; bcrypt/JWT, no demo accounts                                                                                                 |
| Onboarding              | App gate, Timetable setup                 | POST schedule/blocks; onboarding/complete                         | scheduleService/availabilityService; ScheduleBlock/User; each edit saves, require seven sleep start weekdays                                                      |
| Timetable               | Timetable                                 | GET schedule; POST/PATCH/DELETE schedule/blocks; POST block split | scheduleService/blockWrites/date/availability helpers; whole/weekdays/weekends/custom/selected shortcuts, overnight spill, one/group scope, overlap/capacity      |
| Task creation/placement | Tasks, TaskForm, PlacementForm            | POST/PATCH tasks; POST task placement/reschedule                  | apiController/placementService; Task and dated ScheduleBlock; held default, exact remaining effort, future/deadline checks                                        |
| Planning/history        | Planner, usePlanning                      | POST planner/conversations; GET conversation; POST messages       | plannerService/aiClient; Conversation/Message/linked Task; input saved before AI, bounded prompt, paginated history                                               |
| Review/confirmation     | PlannerReview/Availability/Confirmation   | PATCH draft; GET availability; POST confirm                       | plannerService/placementService/availabilityService; explicit reviewed version, unique source-conversation guard, confirmation receipt                            |
| Notes/context           | TaskDetail, Journal, NotesEditor          | GET/POST/PATCH/DELETE notes; POST task context/refresh            | apiController/taskContextService; original Note + current derived Task context; daily notes excluded; metadata/notes/chat/progress invalidate version             |
| Motivation              | TaskDetail, CoachButton                   | GET task; POST coach/context refresh                              | taskContextService/aiClient; prepared text/status/version on Task, labelled template on failure                                                                   |
| Reminder/snooze/TTS     | AppLayout, NotificationPopup, CoachButton | GET reminders/due and typed ID; POST delivered/snooze             | reminderService; Task/ScheduleBlock delivered/snoozed state, conditional single-document claim, queue, five-minute catch-up, ten-minute snooze; no AI at delivery |
| Completion/reopen       | TaskDetail, TaskRow, Today                | POST task complete/reopen; POST schedule/sessions/:id/complete    | apiController/placementService/taskContextService; save session, recalculate progress on retry; early completion cancels remaining work; reopen into held         |
| Reports                 | DisciplineReport, Today                   | GET reports/weekly; POST coach                                    | reportService; dated ScheduleBlock + Task; real session/task counts, planned minutes, missed/upcoming/overdue and factual deterministic coach                     |

### Ordered writes and failure behavior

- **Recurring create/edit/split:** validate the entire proposed schedule/capacity and each replacement document first. blockWrites.replaceBlocks saves all replacements before deleting any original. On caught failure restore missing original IDs with insert-only upserts, then delete only the known new IDs. Failed cleanup returns PARTIAL_WRITE: reload/inspect. Successful edit/split may change IDs; group links and effort remain.
- **Placement/conversion/removing dated work:** validate mode, exact remaining minutes, future/deadline/collision/capacity. Snapshot affected old pending/missed sessions, save all new sessions and Task mode/flexible fields first, then retire only captured old IDs/reminders. On failure restore this operation's captured Task/session values and remove replacements. Completed/missed history stays; rescheduled work links to missed records. Timetable Remove holds all remaining work for that task. Manual creation uses an unsaved Task during validation; failed creation cleans only that new task's records.
- **Confirmation:** validate draft version and placement before writes. Task's existing unique sourceConversationId index prevents duplicate results. Save task/placement, then optional planConfirmationReady=true and planDraftVersion receipt, finally link Conversation. A concurrent duplicate can return 409 CONFIRMATION_PENDING; retry returns the same result. Failed placement removes the new task/sessions. A ready task survives failed conversation linking and is linked on retry. A process crash before the ready marker can leave a pending task requiring inspection; no automatic crash-recovery engine exists.
- **Planning reply:** check captured task context version; update Conversation with draftVersion compare-and-set, save assistant reply, mark user responded last. Assistant-save failure restores only this unchanged draft version. If final status update fails, retry finds the saved reply without another AI call. The task context check and reply save are separate operations, not atomic.
- **Completion:** save the session's completed fact, then calculate task progress from completed sessions even on retry. A failed task save returns SESSION_COMPLETION_SAVED; retry that session. Whole-task completion saves the fact before cancelling remaining sessions; failed cancellation returns COMPLETION_SAVED; retry task completion. Reports/capacity can reflect partial state until repair. Completed task status suppresses reminders meanwhile.
- **Metadata/setup/profile:** changed metadata saves before copied block labels; no-op/non-context edits preserve the prepared message and avoid AI, while meaningful context changes keep prepared text available during refresh; TASK_SAVED asks to retry the same edit to finish labels. Timezone changes validate saved rules/capacity before a single User save; setup verifies sleep coverage before marking User complete.
- **Deletion:** check owner, remove notes/source-chat/sessions, delete Task last. PARTIAL_DELETE says some children may already be removed and asks to retry deletion. Intentional deletion is not restored. Recurring one/group deleteMany is ordinary deletion too: if interrupted inspect remaining selected rules and finish removing those intended.

There are no MongoDB sessions/transactions, per-user lock increments or distributed locks in application code. Multi-step changes can be observed between writes; concurrent validations can race and cleanup snapshots can conflict with another edit. A database outage can prevent cleanup as well. These are accepted lab-scale limits, not transactional guarantees.

## 4. Database design as implemented

### 4.1 Common schema conventions

All six models are in `server/src/models/index.js`. MongoDB generates `_id`; Mongoose adds `createdAt`, `updatedAt` and its usual `__v`. Document JSON transforms expose `id` and remove `_id`, `__v` and any `passwordHash`. Some lean responses retain MongoDB-style keys until `apiConfig.normalise()` recursively maps `_id` to `id` in React; not every raw API lean response has identical serialization.

Every private model except User has `userId: ObjectId`, required, indexed, declared `ref: User`. This is the authenticated owner, not a client-settable field. Every collection has MongoDB's `_id` index. References are logical links, not database-enforced foreign keys or automatic cascades; services implement deletion and ownership checks.

**Validation distinction:** many Mongoose fields are plain optional String/Number paths. Required text lengths, date validity, positive effort and placement shape mostly come from Zod/controllers/services, not schema validators. Do not infer that Compass/direct MongoDB writes get the same protections as REST requests.

### 4.2 User -> `users`

| Field                 | Type / Mongoose default         | Validation / use                                                                           |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| name                  | required String; no default     | Controller trims, 1-80 characters                                                          |
| email                 | required String; unique index   | Controller validates email, max 254, lowercases; does not explicitly trim                  |
| passwordHash          | required String; `select:false` | Controller hashes password (8-72 characters at API) with bcrypt cost 12; JSON removes hash |
| timezone              | required String                 | Controller validates IANA zone; browser default on registration                            |
| onboardingCompleted   | Boolean, false                  | Setup completion after all seven sleep start weekdays                                      |
| voiceRemindersEnabled | Boolean, false                  | Browser preference; does not bypass browser autoplay rules                                 |
| scheduleVersion       | optional Number, no new default | Unused legacy counter; existing values retained; no increment or lock                      |

Indexes beyond `_id`: unique `{email:1}`. Application accounts are documents here, not MongoDB server users.

### 4.3 Task -> `tasks`

| Field                   | Type / Mongoose default                               | REST/service meaning                                                       |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| userId                  | required indexed ObjectId -> User                     | Owner                                                                      |
| title                   | String, no schema default                             | Required trimmed 1-160 characters at creation                              |
| goal                    | String                                                | API default empty, max 2000; longer planning goal                          |
| motivation              | String                                                | API default empty, max 2000                                                |
| durationMinutes         | Number                                                | API positive integer 1-10080, default 30                                   |
| priority                | String enum low/medium/high                           | API default medium                                                         |
| category                | String                                                | API default Personal, max 80                                               |
| deadlineDate            | String                                                | Optional/null valid local YYYY-MM-DD, end-of-day deadline                  |
| placementMode           | enum scheduled/flexible/held, default held            | Authoritative task placement mode                                          |
| flexibleDate            | String                                                | Required by service for flexible mode; otherwise cleared/null              |
| flexibleReminderAt      | Date                                                  | Optional future UTC instant on that flexible local date                    |
| status                  | enum pending/in_progress/completed/held, default held | Explicit task-level state                                                  |
| completedAt             | Date                                                  | Task completion timestamp; cleared on reopen                               |
| journalEnabled          | Boolean                                               | API default true; active journal list preference                           |
| planningPreferences     | String                                                | API default empty, max 2000                                                |
| importantContext        | String                                                | Current compact derived context or pending/fallback description            |
| contextVersion          | Number, 0                                             | Incremented for relevant writes                                            |
| contextProcessedVersion | Number, 0                                             | Last saved processing version                                              |
| contextProcessingStatus | String, pending                                       | Service writes pending/ready/failed; not a schema enum                     |
| motivationalMessage     | String                                                | Prepared text, not audio                                                   |
| messageContextVersion   | Number                                                | Source version for saved message                                           |
| messageGeneratedAt      | Date                                                  | Template/generated text timestamp                                          |
| messageStatus           | String                                                | Service pending/template/ready; no schema enum/default                     |
| sourceConversationId    | ObjectId                                              | Unique optional plan-confirmation link; no declared Mongoose `ref`         |
| planConfirmationReady   | optional Boolean, no default                          | New confirmation false before placement, true after success; retry receipt |
| planDraftVersion        | optional Number, no default                           | Reviewed draft version for that confirmation receipt                       |
| reminderStatus          | String, pending                                       | Flexible reminder pending/delivered/snoozed/cancelled; no schema enum      |
| reminderDeliveredAt     | Date                                                  | Flexible occurrence delivery timestamp                                     |
| snoozedUntil            | Date                                                  | Flexible reminder's saved next due instant                                 |

Indexes beyond `_id`: owner single-field index; unique `{sourceConversationId:1}` only when its BSON type is objectId. No independently editable `scheduledSlots` array exists on Task. `sessionDates` and `completedPlannedMinutes` in list responses are derived, not persisted paths.

### 4.4 ScheduleBlock -> `scheduleblocks`

| Field               | Type / default                                      | Meaning                                               |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| userId              | required indexed ObjectId -> User                   | Owner                                                 |
| recordType          | required enum recurring/session                     | Determines applicable fields                          |
| title               | String                                              | Commitment title or copied task title                 |
| kind                | enum sleep/fixed/focus/task                         | Recurring kinds are restricted to first three by REST |
| weekday             | Number                                              | Recurring ISO weekday: Monday=1, Sunday=7             |
| startMinute         | Number                                              | Recurring local minute 0-1439                         |
| endMinute           | Number                                              | Recurring local minute 0-1440; 1440 is end of day     |
| endsNextDay         | Boolean; no schema default                          | Recurring overnight flag; API default false           |
| groupId             | String                                              | UUID linking recurring start-day records              |
| taskId              | ObjectId, `ref: Task`                               | Dated session's owning task                           |
| startAt, endAt      | Date, no defaults                                   | Dated session UTC instants                            |
| status              | enum pending/completed/missed/cancelled; no default | Session completion/history state                      |
| completedAt         | Date                                                | Session completion timestamp                          |
| supersedesSessionId | ObjectId                                            | Optional link to original missed occurrence           |
| reminderStatus      | String, pending                                     | Prepared occurrence's delivery/snooze/cancel state    |
| reminderDeliveredAt | Date                                                | Saved delivery claim time                             |
| snoozedUntil        | Date                                                | Saved ten-minute reminder delay                       |

Additional optional ScheduleBlock fields: rescheduledToSessionId points from a retained original to its replacement; rescheduleSourceId uniquely identifies the original for new per-session reschedule retries; cancelReason distinguishes task_completed_early, placement_changed and rescheduled. A unique partial rescheduleSourceId index applies only to ObjectId-valued new receipts. Existing documents need no migration. withRescheduleHistory recognises existing supersedesSessionId backlinks on reads; no historical timestamps are guessed or rewritten.

Mongoose pre-validation for recurring records checks weekday, integer minute ranges, unequal start/end and duration in (0,1440]. For sessions it requires taskId, both dates and end > start. More detailed checks (ownership, future time, exact remaining total, deadlines, overlaps and capacity) occur in services. The common reminder default also exists on recurring documents, although recurring rules do not get session-completion status through REST.

Indexes beyond `_id`: owner single-field; `{userId:1,weekday:1}`; `{userId:1,startAt:1}`. TaskId has a reference but no separate declared index.

Recurring rules repeat in the user's timezone; a Sunday 23:00-07:00 occurrence occupies Monday morning too. Sessions are actual calendar occurrences: next week's view does not repeat them. Rendering spillover does not create a second stored commitment.

### 4.5 Note -> `notes`

| Field   | Type / default                    | Validation / meaning                                                    |
| ------- | --------------------------------- | ----------------------------------------------------------------------- |
| userId  | required indexed ObjectId -> User | Owner                                                                   |
| taskId  | ObjectId -> Task, default null    | Explicit task association; null means daily/general                     |
| type    | enum task/daily                   | Controller derives from taskId; not user-selected independently         |
| text    | String                            | REST trimmed 1-12000 characters; original saved content, not AI summary |
| mood    | String                            | REST optional trimmed max 40; UI offers Calm/Focused/Tired/Hopeful      |
| version | Number, 1                         | Incremented on edit                                                     |

Indexes beyond `_id`: owner only. Notes are not copied into Task. Ordinary daily notes never enter other tasks' context automatically. Updating a note cannot change taskId through the current PATCH API.

### 4.6 Conversation -> `conversations`

| Field           | Type / default                               | Meaning                                                    |
| --------------- | -------------------------------------------- | ---------------------------------------------------------- |
| userId          | required indexed ObjectId -> User            | Owner                                                      |
| taskId          | ObjectId                                     | Set at confirmation; absent while planning new task        |
| status          | enum draft/confirmed/archived, default draft | Lifecycle; archive has no dedicated UI/route               |
| draft           | Schema.Types.Mixed, default empty object     | Validated at API boundary, not by nested Mongoose schema   |
| draftVersion    | Number, 0                                    | Optimistic version for corrections, turns and confirmation |
| confirmedTaskId | ObjectId                                     | Idempotent confirmation result                             |

Draft API allows goal, motivation, durationMinutes, durationEstimated, deadlineDate, planningPreferences, priority, category, journalEnabled and placement fields. Messages are not an embedded growing array. Index beyond `_id`: owner. TaskId/confirmedTaskId are logical IDs without declared `ref` or unique index; the unique Task source-conversation index enforces the confirmation relationship.

### 4.7 Message -> `messages`

| Field           | Type / default                            | Meaning                                                                        |
| --------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| userId          | required indexed ObjectId -> User         | Owner                                                                          |
| conversationId  | required indexed ObjectId -> Conversation | Parent conversation                                                            |
| role            | enum user/assistant                       | Message author                                                                 |
| content         | String                                    | User input max 4000 via endpoint; validated assistant reply max 3000           |
| clientMessageId | String                                    | Optional stable retry key; required by user-message endpoint, 8-100 characters |
| status          | String                                    | User saved/responded/failed; assistant saved; no schema enum                   |
| replyTo         | ObjectId                                  | Assistant's logical link to user message                                       |

Indexes beyond `_id`: owner; conversationId; unique `{conversationId:1,clientMessageId:1}` only for string clientMessageId; `{userId:1,conversationId:1,createdAt:1,_id:1}` for ordered history. Raw messages remain saved; API retrieves latest 60 with an owner-checked timestamp/ID cursor for earlier pages.

### 4.8 Placement, deletion and history summary

- Scheduled task: Task placementMode=scheduled; authoritative dated ScheduleBlock records point to it. Planned effort may be split across dates.
- Flexible task: Task placementMode=flexible and flexibleDate set; no fixed rectangle. Capacity uses duration minus completed session history. Its optional reminder state lives on Task.
- Held task: Task placementMode/status=held, no daily reservation or automatic reminder. Normal placement service cancels unfinished future sessions; history remains.
- Completing a session records planned effort. Task completion and session completion are separate measures.
- Task DELETE removes the task, **all** its sessions (including history), linked notes, and its source conversation/messages. This is a full explicit cascade, not a history-preserving archive.
- Recurring one/group deletion removes matching rules. Recurring edit/split saves replacements first, with specific cleanup on caught failure; IDs may change while intended group links remain.
- Upcoming moves update the same session document. Split saves the second half before shortening the first, preserving the first ID and incoming history links. Other sessions remain.
- Timetable session deletion is explicitly **Remove and hold remaining work**: cancels all unfinished future sessions for that task, retains task/notes/completed/missed records, sets held. It is not only deletion of one rectangle; see ordered-write behavior.
- Rescheduling preserves missed records, cancels their reminders, creates replacements, and links new sessions to missed records by their sorted position. That basic link is not a complete many-to-many effort ledger.

Schema adjustment is additive; no migration is required. Existing confirmed records still use Conversation.confirmedTaskId and do not need receipt fields. Existing scheduleVersion values are retained unused, with no new default. No stored data or index was dropped/rewritten as a migration.

## 5. LOCAL MongoDB: actual configuration and everyday operation

| Item                       | Observed/configured state                                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal URI                 | `mongodb://127.0.0.1:27017/zenstate_dev`, in ignored server/.env, loaded by dotenv during npm backend startup                                                                                                  |
| Installed executable       | `C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe`; prior executable inspection reported 8.3.7                                                                                                               |
| Existing service           | Get-Service MongoDB reports Running in this session                                                                                                                                                            |
| Actual topology            | Mongoose read-only hello succeeds, no setName: standalone. Real standalone API tests pass; normal API health ready                                                                                             |
| Previous config inspection | Installed mongod.cfg used existing Program Files MongoDB 8.3 data/log locations, bind 127.0.0.1, port 27017, replication commented. This session did not edit/reconfigure/re-read that service file            |
| Compass                    | Previously found `%LOCALAPPDATA%\MongoDBCompass\MongoDBCompass.exe`; app versions 1.49.14/1.51.0 were present                                                                                                  |
| Transactions               | Not required. connectDB connects and initializes indexes; no topology gate remains                                                                                                                             |
| Old replica-set tests      | Historical temporary processes/storage were test-only. Previous inspection found no remaining replica-test directories/listener. Current runner no longer creates any instance or replica set                  |
| Current tests              | Existing 27017, generated `zenstate_test_standalone_<timestamp>_<pid>`; runner drops only that exact DB. Browser fixture gets another generated DB/API 5001. Optional live checker uses `zenstate_test_groq_*` |

**Project database zenstate_dev is persistent; test databases are disposable.** Startup initializes collections/indexes without populating demonstration accounts. No project/unrelated database was cleared. Test accounts are not the student's retained lab data.

Configuration steps: leave the existing Windows service unchanged; do not initialize replication, edit service/storage, launch another mongod or change ports. server/.env now specifies the URI above, PORT=5000 and CLIENT_ORIGIN=http://localhost:5173. Missing JWT secret was generated locally without display. Root .env selects VITE_API_BASE_URL=http://localhost:5000/api. Add only the replacement Groq key to AI_API_KEY. Never copy examples over real environment files.

### Verification, startup, shutdown and restart

```powershell
Get-Service MongoDB
Test-NetConnection 127.0.0.1 -Port 27017
Invoke-RestMethod http://localhost:5000/api/health
```

Expected: Running, TcpTestSucceeded true, data.status ready. TCP alone checks reachability; hello and real writes establish database access. Health does not verify Groq.

Read-only ping/topology from project root:

```powershell
node --input-type=module -e "const {default:m}=await import('./server/node_modules/mongoose/index.js'); await m.connect('mongodb://127.0.0.1:27017/zenstate_dev',{serverSelectionTimeoutMS:5000}); const h=await m.connection.db.admin().command({hello:1}); console.log({database:m.connection.name,standalone:!h.setName,ping:(await m.connection.db.command({ping:1})).ok}); await m.disconnect();"
```

Start backend then frontend with section 10 commands. Existing MongoDB is already running; no database launch is necessary. Stop each app with Ctrl+C; rerun its npm command to restart. Do not stop/restart MongoDB for application restarts. Windows service lifecycle remains the administrator's existing responsibility; if unexpectedly stopped, report the dependency failure and follow the service owner's existing procedure. This project does not provide service-reconfiguration/restart commands. Its storage survives app restarts; keep JWT_SECRET unchanged to retain token validity.

### Compass and missing configuration

Open Compass → connection `mongodb://127.0.0.1:27017` → Connect → zenstate*dev → refresh after registration. Collections: users/tasks/scheduleblocks/notes/conversations/messages. Filter by account userId; avoid exposing passwordHash on screen. zenstate_test*\* names are separate fixtures; never drop zenstate_dev for tests. If a killed test leaves a DB, verify its exact printed generated name before removing only that test database.

Working AI configuration was provided later and is unchanged in this pass; replace a key privately only when needed. MongoDB/JWT/API-origin setup is present. Connection failure produces a startup error, never in-memory/demo persistence. No second database instance, service changes, replication or storage directory setup is needed.

## 6. API reference: implemented contract

### 6.1 Common conventions, payload types and errors

Base URL for normal development: `http://localhost:5000/api`. Only GET /health and POST /auth/register and /auth/login are public. **Every other endpoint below requires `Authorization: Bearer <your-private-login-token>`.** The placeholder is not a real token. There is no logout endpoint; logout removes the browser's token/cache.

Successful responses wrap `data`; normal GET/PATCH/action POST/DELETE use 200, newly created registration/task/note/conversation/recurring group uses 201. Reopening an existing task conversation returns 200. Confirm uses 200, including first confirmation. Database errors are never replaced with sample success data.

```json
{ "data": { "id": "<record-id>", "title": "Example" } }
```

Errors use `{error:{code,message,details?}}`. Most endpoint body schemas are strict and reject unknown properties; action endpoints that do not inspect their body do not apply that same strictness. JSON body limit is 64 KB. Owner-scoped missing or inaccessible records generally produce 404 rather than revealing another account's content.

| Status / code                              | Typical meaning                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 400 INVALID_REQUEST                        | Zod/service validation, invalid date/time/duration/split, missing required fields                         |
| 401 UNAUTHENTICATED or action default code | Missing/expired/bad token or incorrect login; login input that fails length/email validation is 400 first |
| 404 NOT_FOUND or action default code       | Unknown/inaccessible record, invalid ObjectId cast, bad endpoint/history cursor                           |
| 409 DUPLICATE                              | Unique email/submission index collision                                                                   |
| 409 SCHEDULE_CONFLICT                      | Overlap; recurring conflicts can include conflicting weekday/date/title details                           |
| 409 CAPACITY_CONFLICT / NO_CAPACITY        | Combined daily effort does not fit, or no contiguous slot for review-tomorrow                             |
| 409 STALE_DRAFT / STALE_CONTEXT            | Optimistic version changed while review/AI response was in progress                                       |
| 409 REMINDER_EXPIRED / ALREADY_DELIVERED   | No longer due or another claim already won                                                                |
| 502 AI_RETRY / AI_CONTEXT_LIMIT            | Timeout, malformed/rejected AI output or oversized context                                                |
| 503 AI_UNAVAILABLE                         | Missing/unsupported provider/key/model configuration                                                      |
| 500 SERVER_ERROR                           | Unexpected persistence/server failure; user receives generic save error                                   |

Some service/controller `fail()` calls use the default INVALID_REQUEST code even with 401/404/409; use the HTTP status plus message rather than assuming every error has a specialized code. `/health` uses its own readiness response; a server that fails startup has no listening HTTP endpoint.

Reusable payload definitions used in the endpoint tables:

- **Task metadata (TM):** title required on create, trimmed 1-160; goal/motivation/planningPreferences each max 2000 and default empty on create; durationMinutes integer 1-10080 default 30; priority low/medium/high default medium; category max 80 default Personal; optional/null deadlineDate as real YYYY-MM-DD; journalEnabled boolean default true. Metadata PATCH is partial and strips creation defaults, so editing title does not reset other fields.
- **Placement (PL):** placementMode scheduled/flexible/held; optional/null flexibleDate; optional/null flexibleReminderAt ISO datetime with offset; optional sessions array up to 60 objects containing startAt/endAt ISO datetimes with offsets. Scheduling service enforces mode-specific requirements. durationMinutes is **not** accepted by the placement-only endpoint: hold/change metadata separately when changing effort.
- **Recurring block (RB):** title 1-160; kind sleep/fixed/focus; startMinute integer 0-1439; endMinute integer 0-1440; endsNextDay boolean default false; daysPreset selected/weekdays/weekends/whole/custom default selected; weekday 1-7 default 1; optional days array of 1-7 values, max seven. Custom requires a nonempty selected set in service. There is no accepted recordType property in this request; the service derives recurring.
- **Draft updates (DU):** partial goal/motivation/durationMinutes/priority/category/deadlineDate/journalEnabled/planningPreferences plus durationEstimated boolean and PL fields. No title/userId/IDs/completion-history/context fields. AI-returned updates are narrower: no placement fields; the user selects placement in the later screen.
- **Note (NT):** nonempty trimmed text up to 12000; optional taskId as 24-hex ObjectId or null; optional mood max 40. Controller derives type and owner.

### 6.2 Health, authentication, user and setup

| Method | Endpoint             | Request                                                                          | `data` response / important rules                                                                          |
| ------ | -------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET    | /health              | None; public                                                                     | `{status:ready}` with 200 when connected; `{status:database unavailable}` with 503 after lost/not-ready DB |
| POST   | /auth/register       | name 1-80, valid email max 254, password 8-72 characters, valid timezone; public | `{token,user}`, 201; bcrypt hash never returned; duplicate email 409                                       |
| POST   | /auth/login          | email/password with same format/length checks; public                            | `{token,user}`, 200; wrong credentials 401                                                                 |
| GET    | /auth/me             | Auth only                                                                        | Current safe User                                                                                          |
| PATCH  | /users/me            | Partial name, timezone, voiceRemindersEnabled                                    | Saved User; timezone change first revalidates real commitments, sessions and flexible capacity             |
| POST   | /onboarding/complete | Empty body is sufficient                                                         | Saved User with onboardingCompleted=true; rejects fewer than seven sleep start weekdays                    |

### 6.3 Tasks and placement

| Method | Endpoint                   | Request                                                                                 | `data` response / important rules                                                                                                                                                                                                                                   |
| ------ | -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /tasks                     | No implemented server filters                                                           | Task array, newest created first; derives sessionDates/completedPlannedMinutes; marks ended pending sessions missed. Date/group filtering is in React                                                                                                               |
| POST   | /tasks                     | TM + optional PL; omitted placement means held                                          | Saved Task, 201; ordered task/session saves; failed creation cleans its own new records                                                                                                                                                                             |
| GET    | /tasks/:id                 | Owner task ID                                                                           | Task with all ordered `sessions`, including completed/missed/cancelled history                                                                                                                                                                                      |
| PATCH  | /tasks/:id                 | Partial TM                                                                              | Saved Task; duration change requires held mode and cannot be below completed effort; tighter deadline must fit existing active placement; title propagates to sessions; only meaningful context changes invalidate context, preserving prepared text during refresh |
| DELETE | /tasks/:id                 | Owner task ID; no body needed                                                           | `{deleted:true}`; full cascade removes notes, all task sessions/history and source chat/messages                                                                                                                                                                    |
| POST   | /tasks/:id/placement       | PL only                                                                                 | Saved Task; shared rules; cannot place a completed task until reopened; preserves completed/missed history                                                                                                                                                          |
| POST   | /tasks/:id/complete        | No fields needed                                                                        | Saved completed Task; markMissed first; cancels pending sessions/reminders; no credit for cancelled planned minutes                                                                                                                                                 |
| POST   | /tasks/:id/reopen          | No fields needed                                                                        | Task set held, clears flexible date/time and completion timestamp. Only completed tasks may be reopened; pending-session cleanup is finished before the mode changes                                                                                                |
| POST   | /tasks/:id/reschedule      | mode scheduled/flexible/held; optional date YYYY-MM-DD, default tomorrow in user's zone | Saved Task; scheduled finds first contiguous exact remaining-duration slot; no slot -> 409 NO_CAPACITY; flexible still validates capacity/deadline                                                                                                                  |
| POST   | /tasks/:id/context/refresh | No fields needed                                                                        | Current Task with new pending context version/current template; processing continues asynchronously                                                                                                                                                                 |

### 6.4 Schedule and availability

| Method | Endpoint                        | Request                                                                                                                     | `data` response / important rules                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /schedule                       | Required query weekStart YYYY-MM-DD                                                                                         | All recurring rules and sessions intersecting seven local dates; includes cancelled session history; frontend keeps completed, cancelled and rescheduled history visible with explicit status styling                                                                                                      |
| POST   | /schedule/blocks                | RB                                                                                                                          | Array of created recurring records, 201; all days validated before ordered saves; operation-specific cleanup on caught failure. This route does not create arbitrary task-independent dated blocks                                                                                                         |
| PATCH  | /schedule/blocks/:id            | Recurring: full RB plus scope one/group default one. Session: startAt,endAt only                                            | Array of replacement records; one-day edit should explicitly supply weekday, otherwise RB default is Monday; group keeps original selected weekdays. Session move preserves duration; upcoming work keeps its ID, started/missed work gets a linked future replacement; completed/retired work is rejected |
| DELETE | /schedule/blocks/:id            | Query scope one/group default one                                                                                           | `{deleted:true}`; recurring removes indicated rules; session action cancels all unfinished future work for that task and holds remaining work, retaining history                                                                                                                                           |
| POST   | /schedule/blocks/:id/split      | Recurring: splitMinute integer 0-1440 and scope one/group. Session: splitAt ISO timestamp                                   | Replacement records array; point strictly inside every selected interval; preserves duration/association; session splits only that future record                                                                                                                                                           |
| POST   | /schedule/sessions/:id/complete | Session ID; no fields needed                                                                                                | Updated Task; future starts rejected; cancelled/retired/non-session records rejected; existing completed session is idempotent                                                                                                                                                                             |
| GET    | /availability                   | from,to YYYY-MM-DD; optional durationMinutes integer 1-10080 default 30; optional owned taskId to exclude current placement | Day array with date, intervals[{startAt,endAt,minutes}], freeMinutes, reservedMinutes, remainingMinutes, suggestions[{startAt,endAt}]. Range 1-31 dates; suggestions do not automatically know a task deadline unless later placement validates it                                                         |

### 6.5 Notes and planning

| Method | Endpoint                            | Request                                                                                 | `data` response / important rules                                                                                                                                                      |
| ------ | ----------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /notes                              | Optional query taskId                                                                   | Task notes when owned taskId supplied; otherwise only null-task daily notes; newest first                                                                                              |
| POST   | /notes                              | NT                                                                                      | Saved Note, 201; verifies linked task ownership; invalidates only that task context                                                                                                    |
| PATCH  | /notes/:id                          | Partial text/mood only                                                                  | Saved Note with version increment; taskId cannot be changed; recomputes linked context                                                                                                 |
| DELETE | /notes/:id                          | Owner note ID                                                                           | `{deleted:true}`; recomputes linked task context from remaining sources                                                                                                                |
| POST   | /planner/conversations              | Empty object for new task; optional owned taskId to reopen existing source conversation | New `{conversation,planningTask:null,messages:[],hasMore:false,nextBefore:null}`, 201; existing source chat bundle 200; manual task with no source chat returns 400                    |
| GET    | /planner/conversations/:id          | Optional before message-ID cursor                                                       | `{conversation,planningTask,messages,hasMore,nextBefore}`; latest 60 ascending after page query; cursor must belong to same owner and conversation                                     |
| POST   | /planner/conversations/:id/messages | content 1-4000; clientMessageId 8-100                                                   | Saved chat bundle; raw input saved before AI; same key/different text 409; answered retry returns current saved state; archived conversation 409                                       |
| PATCH  | /planner/conversations/:id/draft    | draftVersion nonnegative integer; updates DU                                            | `{conversation,messages}`; only draft status; version mismatch 409; omitted updates preserve fields. This response does not include all pagination/task-bundle keys                    |
| POST   | /planner/conversations/:id/confirm  | draftVersion nonnegative integer                                                        | Created/existing Task, 200; requires goal, motivation, duration; validates placement before ordered writes; already-confirmed relationship returns same task even on old-version retry |

### 6.6 Reminders and coaching/reports

| Method | Endpoint                 | Request                       | `data` response / important rules                                                                                                                                                                                                                                                                                                                  |
| ------ | ------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /reminders/due           | No query needed               | Ordered `{id,taskId,title,message,startAt}` occurrences; typed IDs; current saved text; no AI call                                                                                                                                                                                                                                                 |
| GET    | /reminders/:id           | Typed session:ID or task:ID   | `{active:boolean}` from latest owner task/record state; unknown record 404                                                                                                                                                                                                                                                                         |
| POST   | /reminders/:id/delivered | Typed ID; empty body          | Claimed occurrence object; conditional persisted delivery state; already claimed/no longer due 409                                                                                                                                                                                                                                                 |
| POST   | /reminders/:id/snooze    | Typed ID; empty body          | Saved underlying Task or ScheduleBlock; snooze exactly now+10 minutes; only active delivered/snoozed occurrence allowed                                                                                                                                                                                                                            |
| GET    | /reports/weekly          | Required weekStart YYYY-MM-DD | Counts/minutes/completionPercent, seven daily records, overdueFlexible, unfinished, completedTasks, coachText, rescheduledSessions and historicalMissedSessions. Retired history is excluded from current planned/missed effort; previously missed rescheduled history is reported separately. API accepts any valid start date; UI selects Monday |
| POST   | /coach                   | Optional taskId or weekStart  | Task ID -> `{text,status}` from prepared message. Otherwise `{text}` from calculated week summary. This endpoint reads/derives text; task regeneration is `/context/refresh`                                                                                                                                                                       |

### 6.7 Representative requests (placeholders only)

These are payload examples, not a request log. Replace dates with future times before running them. Keep actual login output and credentials in private local tools; never paste them into the handoff.

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Lab Student",
  "email": "student@example.invalid",
  "password": "<choose-a-private-password-locally>",
  "timezone": "Asia/Calcutta"
}
```

```http
POST /api/schedule/blocks
Authorization: Bearer <your-private-login-token>
Content-Type: application/json

{
  "title": "Sleep",
  "kind": "sleep",
  "daysPreset": "whole",
  "startMinute": 1380,
  "endMinute": 420,
  "endsNextDay": true
}
```

```json
{
  "title": "Practise React hooks",
  "motivation": "Build confidence for my lab",
  "durationMinutes": 45,
  "priority": "high",
  "placementMode": "held",
  "journalEnabled": true
}
```

The preceding object is a POST /tasks body. A later POST /tasks/<task-id>/placement can use:

```json
{
  "placementMode": "scheduled",
  "sessions": [
    { "startAt": "2026-10-23T12:30:00Z", "endAt": "2026-10-23T13:15:00Z" }
  ]
}
```

Or reserve a flexible day, clearing unfinished fixed work only after validation:

```json
{ "placementMode": "flexible", "flexibleDate": "2026-10-23" }
```

Planning turn, note and confirmation examples:

```json
{
  "content": "I need 45 minutes to practise hooks for lab confidence. Evenings work best.",
  "clientMessageId": "lab-plan-message-001"
}
```

```json
{
  "taskId": "<owned-task-id>",
  "text": "Cleanup is difficult; begin with one small example.",
  "mood": "Focused"
}
```

```json
{ "draftVersion": 2 }
```

Use the actual saved draft version; example 2 is not universally correct. IDs are placeholders, not accepted literal ObjectIds. A conflict response may look like:

```json
{
  "error": {
    "code": "SCHEDULE_CONFLICT",
    "message": "Selected time overlaps an existing commitment",
    "details": [{ "date": "2026-10-23", "title": "College" }]
  }
}
```

Standalone failure codes: 503 PARTIAL_WRITE (cleanup failed; reload/inspect), COMPLETION_SAVED (retry task completion), SESSION_COMPLETION_SAVED (retry session completion), TASK_SAVED (retry same metadata edit), PARTIAL_DELETE (retry task deletion; some children may already be gone). Confirmation may return 409 CONFIRMATION_PENDING. Ready-task linking failures can be retried without creating another task. No endpoint promises multi-document atomicity.

## 7. AI integration and freshness guarantees

### 7.1 Provider boundary and configuration

Only `server/src/services/aiClient.js` performs provider HTTP access. It exports `callAI({messages,temperature,maxOutputTokens}, fetcher=fetch)`. It accepts provider names groq and openai-compatible, sends an OpenAI-compatible chat-completions request to configured base URL plus `/chat/completions`, and asks for `response_format:{type:json_object}`. No frontend Groq SDK or key exists. A future local compatible endpoint may use the adapter; a provider with a different API requires changing this helper, and local models/JSON support have not been tested.

The helper requires a key and model even in the openai-compatible branch. For a later unauthenticated local endpoint, that configuration assumption may need a deliberate adapter change rather than claiming local support already works.

| Variable             | Current behavior                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| AI_PROVIDER          | Default groq; unsupported names -> 503                                                                      |
| AI_BASE_URL          | Default https://api.groq.com/openai/v1                                                                      |
| AI_API_KEY           | Required, backend-only, placeholder rejected                                                                |
| AI_MODEL             | Configured openai/gpt-oss-20b; remains environment-selectable                                               |
| AI_TIMEOUT_MS        | Per-call AbortSignal timeout, default 20000 ms                                                              |
| AI_INPUT_CHAR_BUDGET | Default 24000 characters, implementation minimum 6000; counts message content characters, not exact tokens  |
| AI_MAX_OUTPUT_TOKENS | Default cap 1000, implementation minimum cap 100; request uses lesser of service request and configured cap |

Planner normally asks for 800 output tokens; extraction batches 350, summary reduction 250, final context/message 1000. Raw provider body above 100000 characters or content above 30000 is rejected after reading; malformed/missing JSON becomes a readable 502. Non-OK provider status is logged server-side. Check the chosen model's current context/output limits and JSON-mode support during live setup; conservative character budgets do not prove token-limit compliance. See [Groq API reference](https://console.groq.com/docs/api-reference).

### 7.2 Planning prompt and structured output

Business prompts live in `plannerService.js`, not in the adapter. They ask a brief planning assistant to request only missing essentials, interpret hours/minutes carefully, label estimates, use the real local date, and never claim a schedule was changed before confirmation. Required output:

```json
{
  "reply": "A short reply or missing-essential question",
  "draftUpdates": { "goal": "Example goal", "durationMinutes": 45 },
  "readyForReview": false
}
```

Zod validates reply length, allowed fields and types/real dates/positive durations. Unknown owner IDs, task IDs, history or direct AI placement fields are rejected. Invalid structure retries once with a correction instruction; after two failures the saved message remains retryable. A missing configuration 503 is not retried. Two 20-second failed calls can therefore make a planner request take about 40 seconds. Concurrent turns must match the captured conversation version before the conditional draft write; a linked task also checks the captured context version.

Fresh prompt construction includes system rules; current draft or linked task fields plus important context; local date; at most 12 recent messages (about six exchanges), further bounded by at most 10000 history characters and the total configured budget; then the current input exactly once. It does not send all saved messages or all raw notes on every turn. All history stays in MongoDB and can be paged in the UI. Actual availability is requested by the later frontend availability screen; chat is explicitly told not to assert free slots it has not checked.

### 7.3 Context and prepared speech pipeline

Relevant events include confirmed planning, task metadata/preferences changes, task-linked note add/edit/delete, session progress, task completion/reopen, explicit refresh, placement changes and later linked-chat turns. Daily notes do not participate.

Source save precedes context extraction. Invalidation persists a new version and a fresh non-stale template immediately, then coalesces rapid changes. Extraction re-reads current sources, builds bounded note excerpts and batches rather than treating note text as system instructions. Current notes/progress are preferred over older reflections in the final prompt. AI returns `{context,message}`: context max 3000 and message 10-1500 characters by schema; 30-60 words is a prompt goal, not a hard word-count validator.

The final conditional Task update requires the same owner and contextVersion captured at processing start, and records contextProcessedVersion/messageContextVersion. Tests deliberately hold an older simulated AI response until after the newer result saves; older output cannot overwrite it. Completed state overrides reminder text with completion-aware wording. A crash between raw note persistence and context update, or a failure re-reading notes after successful saving, still deserves failure-path review; see section 11.

### 7.4 Missing key and failures: exact limits of verification

The initial implementation tests lacked a key; a later configuration check successfully verified genuine Groq planning, saved conversation and note-derived motivation. This stability pass deliberately uses absent or simulated AI and leaves working credentials unchanged; no additional live calls were made. With a real database but no key, chat input is saved first and the UI exposes the actual 503 plus a retry button; it does not invent a successful assistant answer. Manual review/correction can continue to real scheduling.

For context failure, notes/tasks remain usable: current deterministic context and motivational text are saved with contextProcessingStatus=failed and messageStatus=template, and a manual retry is available. Fallback context uses up to the latest eight note excerpts and latest three responded planning reflections; it explicitly states limited note coverage when there are more. Original note documents remain intact.

Tests used an injected fetch function for JSON/timeout failures and a local fake chat-completions HTTP server for valid/malformed planning, reopened-chat context and controlled out-of-order context results. These verify adapter/validation/persistence/version logic, not Groq availability, model quality, actual estimation/clarification behavior or latency. No AI call is triggered just because a reminder is due; saved text is reused.

### 7.5 Current model choice and live checker

Official docs checked 23 October 2026: [Groq model list](https://console.groq.com/docs/models) lists openai/gpt-oss-20b as production at $0.075 input/$0.30 output per million tokens. Llama3.1/3.3 are currently labelled Enterprise there, so old price assumptions were not reused. [JSON object mode](https://console.groq.com/docs/structured-outputs#json-object-mode) supports all models, without application schema enforcement. Keep explicit prompts/Zod validation. The helper sets reasoning_effort=low for GPT OSS models; [reasoning parameters](https://console.groq.com/docs/reasoning) document low support. Output/character budgets still need real account rehearsal; configuration does not prove model access or valid replies.

npm --prefix server run test:groq reads the key privately. Missing key exits blocked before calls/DB creation. Otherwise it lists account models once, registers a disposable account, makes one planning turn, reloads saved conversation, explicitly confirms held work, saves a difficulty note, and waits for current context/motivation. It asserts ready statuses/current version and note difficulty in context; templates do not count. Minimal typical flow is one planning call plus note extraction/final motivation (initial context may also run if timing crosses debounce). Its separate `zenstate_test_groq_*` DB is dropped afterward. A prior configuration session successfully ran this live smoke script; this stability pass did not repeat live calls; it prints pass/fail, never credentials or provider bodies.

## 8. Frontend state and browser behavior

### 8.1 Storage, restoration and server-confirmed updates

Browser localStorage contains `zenstate-token` and per-user `zenstate-plan:<user.id>` active-draft identifiers. Successful confirmation removes the active pointer and planner query/state, while explicit task-linked URLs can still reopen saved reflection/history. It does not serve as task/note persistence. Logging out removes the token and clears React data; last-conversation IDs can remain under their user-specific keys. The token is a simple lab bearer token in localStorage, not an HttpOnly-cookie/refresh-token subsystem.

AppContext caches user/tasks/current-week blocks/daily journal and current planning bundle. `refresh()` uses concurrent API reads, committing a single new cache only when all succeed. It refreshes every 30 seconds while signed in and on focus; mutations call `act()` and then refresh. A successful mutation followed by failed general refresh reports "Change saved, but the view could not refresh" rather than pretending the save failed. An epoch/generation guard and request sequence prevent late responses from an old login or superseded refresh replacing newer account data. Requests are generally ignored on completion rather than all being actively aborted.

`api()` centralizes network failures and errors, normalizes IDs, and emits an unauthorized event for a current-token 401 outside auth paths. The context clears data and returns to login. Startup authentication failure and disconnected backend show errors; no demo-data fallback exists.

### 8.2 How each page obtains data

| Page / component                     | Data path                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login                                | authenticate action -> auth endpoints -> initial cache; no prefilled demonstration account                                                                       |
| Setup / Timetable                    | Own `/schedule` fetch for selected week; refreshes when cache blocks change; persists every block action; independent week navigation                            |
| Today                                | Cached tasks/current-week blocks, filters using user's real local date; separately fetches weekly report; sums actual planned sessions/flexible remaining effort |
| Tasks                                | Cached all tasks; filters by flexibleDate, derived sessionDates or deadlineDate; renders scheduled/flexible/held/completed groups                                |
| Task Detail                          | Fetches `/tasks/:id` with full session history and polls at 4 seconds; cached-task changes prompt a reload without deliberately clearing same-task editor state  |
| TaskForm / PlacementForm             | Local unsaved fields; mutation through act; placement queries availability as date/duration changes; server remains final authority                              |
| Journal / NotesEditor                | NotesEditor directly queries daily or selected task notes; active task journal links filter journalEnabled and non-completed status                              |
| Planner                              | AppContext conversation bundle + URL query/last per-user conversation ID; API paginated older history stored locally in component                                |
| Review / Availability / Confirmation | Saved shared conversation draft; explicit save/versioned API steps; confirmation result refreshed into task cache                                                |
| Discipline report                    | Direct `/reports/weekly` query for chosen start week; refreshes when tasks/blocks change; review actions use act                                                 |
| Notification popup                   | Claimed due occurrence from application-level checker, not a hardcoded task                                                                                      |

### 8.3 Saving and failure semantics

There is **no note autosave on keystrokes**. NotesEditor uses explicit Save and only sets Saved after the save and note-list reload succeed. Request failure preserves typed content and displays a retryable error. Draft review, placement and task metadata also use explicit submits. Unsaved text is component-local and can be lost by navigating away; it is not a separate persisted draft editor. A 200 ms context-processing timer is not an editor autosave feature.

AsyncButton and forms disable duplicate submission while busy. Placement changes wait for server confirmation. There are no fabricated progress bars/statistics/audio-duration labels. Detail progress derives completed planned session minutes, and completion of a task early does not imply all planned minutes were actually completed.

### 8.4 Reminder/speech cleanup and limits

The checker is in AppLayout, not each page/task. It also runs during setup while the shell is mounted, usually against an empty account. Delivered/snoozed state lives in MongoDB; the queue and current popup live in memory. It claims just the occurrence to be shown, queues additional eligible occurrences, rechecks latest task/session state and stops on logout/unmount. Reminders older than the catch-up window are not replayed indefinitely. A refresh after a delivery claim treats that occurrence as delivered even if browser speech never sounded; exactly-once audible delivery is not guaranteed.

The voice header button saves the preference and requests available voices, but browsers may still require direct interaction to speak. Task Detail's Preview reminder, the popup's manual Play/Hear button and text are available as backup. No generated audio is stored or streamed. Only one popup owns automatic speech at a time and starting a new playback cancels global current speech. Cross-tab server claims prevent duplicate normal occurrences, while cross-device exact audio is outside scope.

### 8.5 Browser testing is test-only

`playwright.config.js` uses one worker, 60-second test timeout, headless Chrome, 1440x1000 default viewport, and `.test-artifacts/browser` output. Default browser executable is installed Chrome under Program Files on Windows; BROWSER_BINARY can override it. Default UI URL is 127.0.0.1:5173; BROWSER_BASE_URL overrides UI navigation but fixture API calls in the test file are hardcoded to 127.0.0.1:5001/api.

`tests/browser/demo.spec.js` creates isolated test accounts, tests real local API/database flows, deliberately simulates one note-save HTTP failure, and replaces speech APIs during callback/unavailability assertions. Those replacements exist only in the test browser context, not application source. They do not prove audible speech. Screenshot outputs include desktop-report.png and mobile-block-form.png. Tests expect missing AI configuration for their manual-review path; do not point them at the persistent user's real project database or a production account.

## 9. Verification evidence and limits

Stability-pass results: npm test **14/14**, npm --prefix server run test:local **26/26** using real standalone MongoDB, npm run test:browser **10/10** with the exact disposable fixture URI set, and npm run build passed. The browser run retains StrictMode and normal refresh. Initial repro tests failed on editor duplication (four title inputs) and the uncleared planner pointer; both now pass. Build retains non-fatal React Router client-directive warnings.

| Journey               | Implementing files                                                                      | Evidence                                                                   | Dependencies                                                          | Verified result / remaining limit                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Edit stability      | TaskDetail, TaskForm, apiController, taskContextService                                 | browser stability edit/missing/refresh tests; API21                        | Real DB/browser, one injected HTTP save failure                       | Repeated open/cancel, refresh during typing, one successful PATCH, duplicate submits guarded, same ID/state, complete/reopen/edit; missing task stable; irrelevant edits preserve context/message |
| B Planner lifecycle   | AppContext/usePlanning/PlannerConfirmation and planner screens; existing server receipt | browser lost-response/pointer and late-owner tests; API25                  | Real DB, deliberately lost confirmation response; simulated/absent AI | Retry returns saved task; draft/pointer/query clear only on success; saved chat remains; confirmed draft read-only; late other-owner response ignored                                             |
| C Rescheduling        | SessionEditor, scheduleService, placementService, sessions utility                      | API22–24/26; browser move/started tests                                    | Real DB, historical fixtures, injected link write failure             | Upcoming ID preserved; started/missed original retained and replacement unique; completed effort/notes/context unchanged; retry repairs; old reminder retired; legacy backlinks read across weeks |
| D Calendar completion | dates/calendarSegments, Timetable, Today/report services                                | browser calendar logout/login test; focused history accounting             | Real DB/browser, test-only saved historical records                   | Completed green, unfinished red, early-cancelled grey with reason after reload/login; retired rows exclude availability/effort; separate historical missed counts                                 |
| E Move/split          | shared SessionEditor + scheduleService                                                  | browser move/split and API22/26; existing partial-save cases               | Real DB/browser and selected write faults                             | Start carries End; saved midpoint split independent of unsaved move; exact total/link preserved; invalid duration/past/overlap/deadline/split leave original data                                 |
| F Regressions         | Existing planner/notes/Today/Reports/notification/snooze/CoachButton                    | original browser/demo.spec.js three journeys + prior focused/API scenarios | Real DB/HTTP/browser, fake provider and speech callbacks              | Planning/confirmation, saved notes, user separation, popup queue, snooze/delivery, controls and refresh playback pass; audible native playback not reverified by tools                            |

Focused files: scheduling.test.js9, context-reminders.test.js4, aiClient.test.js1. The additional context/reminder test checks real fixture expectations for visible cancelled/rescheduled history and single-count effort/reminder eligibility. Integration file has26 top-level scenarios: previous20 plus metadata preservation, upcoming move errors/retries, started/missed linked replacements, interrupted-link/early-completion history, confirmed lifecycle, and legacy cross-week read compatibility/splitting. One existing fake-provider assertion now selects its specific user request instead of whichever background context request last arrived; its substantive context check remains intact.

tests/browser/demo.spec.js retains3 existing journeys. tests/browser/stability.spec.js adds7: edit/error/duplicate-save/complete/reopen; lost confirmation response/reset; move/split independence; green/red/grey history across logout/login; started-session reschedule; missing-state/preview speech lifetime; delayed cross-user conversation. Historical browser fixtures require TEST_BROWSER_MONGODB_URI set to the exact generated standalone test DB printed by test-local --serve. Guard rejects project DB names and nonlocal hosts. Two fixture-dependent tests explicitly skip without it; the full10/10 run supplied it. Test databases are separate, disposable and cleaned by exact name; never clear zenstate_dev.

All AI in this stability suite is absent or a simulated provider. A prior session's live smoke check passed, but no new live call was made here. The user reports working audible reminders; automated speech checks simulate browser callbacks and do not verify speakers/native audio. No MongoDB service or OS restart occurred. Ordinary multi-step writes retain documented crash/concurrency limits; no transaction-level guarantee is claimed.

## 10. Running the project

Prerequisites: Node 22.14+/npm, existing running MongoDB 27017, supported browser, replacement Groq key for live AI. From root install npm ci and npm --prefix server ci (two packages/lockfiles). See README for safe example copying and private JWT generation on a fresh checkout. Actual root/server .env files now exist; do not overwrite them.

Root .env: VITE_API_BASE_URL=http://localhost:5000/api. Server .env: MONGODB_URI=mongodb://127.0.0.1:27017/zenstate_dev; PORT=5000; CLIENT_ORIGIN=http://localhost:5173; private JWT_SECRET; AI_PROVIDER=groq; AI_BASE_URL=https://api.groq.com/openai/v1; AI_MODEL=openai/gpt-oss-20b; add AI_API_KEY. Optional limits: JWT_EXPIRES_IN7d, AI_TIMEOUT_MS20000, AI_INPUT_CHAR_BUDGET24000, AI_MAX_OUTPUT_TOKENS1000. Secrets stay backend-only/ignored.

Terminal A:

```powershell
Set-Location 'C:\Users\Aditya Pramod Pawar\zenstate'
npm --prefix server run dev
```

Terminal B:

```powershell
Set-Location 'C:\Users\Aditya Pramod Pawar\zenstate'
npm run dev
```

Open http://localhost:5173. Existing MongoDB is already running: no database-launch command. Start backend before frontend. Health http://localhost:5000/api/health should return data.status ready. Ctrl+C stops each application; rerun to restart. Do not stop/restart the MongoDB service. Restart backend after AI key changes and Vite after frontend env changes; changing JWT secret invalidates logins.

Verification: npm test; npm --prefix server run test:local; npm run build. After adding key: npm --prefix server run test:groq. Missing key is blocked, not pass. For browser tests use the full separate test-server commands in README: node scripts/test-local.js --serve from server, separate Vite with API5001/127.0.0.1 origin, then npm run test:browser. Direct node commands avoid Windows npm flag-forwarding differences. Test API never replaces normal app config; close the temporary frontend terminal afterward.

Demo: register → whole-week overnight sleep and weekday/weekend/custom commitments → reload/edit/finish → exact45-minute task, split/conversion/overlap rejection → live chat/saved review/real availability/explicit confirmation → difficulty note/current prepared message → upcoming reminder/snooze/Preview with speakers → complete session/task/report → logout/login and user separation. Keep the page open. Do not label missing-key/template behavior as live AI.

Troubleshooting: DB timeout means existing service/connectivity failure, never fake data. CORS means exact origin mismatch or unexpected Vite port; use localhost5173 normally. AI_UNAVAILABLE means missing backend config; AI_RETRY/template may mean model permissions/quota/network/output limits. PARTIAL_WRITE requires inspect/reload; saved-completion/rename/deletion errors specify what to retry. Do not assume every error rolled back. Full commands and explanations are in README.

## 11. Prioritized next work

**Configuration:** current local MongoDB and AI credentials are retained. Restart only the app backend/frontend to load these source changes; do not change the service or keys for this pass. Rehearse a small natural-language plan and note-derived message; inspect permissions/token budgets if fallback occurs. Local DB/JWT/origin are configured; do not add replication/storage infrastructure.

**Remaining checks:** retain a real project account in zenstate_dev and demonstrate app restart/login; OS restart not tested. Check native audible voice, autoplay/speakers and actual local reminder time. Documentation of model availability does not establish real account permissions.

**Known limits/bugs for separate reproduction:** ordinary writes are not crash-atomic; concurrent overlap checks/cleanup can race. A confirmation crash before receipt can leave a pending task for inspection/deletion before retry. Partial cascade deletion can already remove children; retry deletion. Failed completion cleanup can leave occupied sessions until retry. Retained history whose old records were physically deleted cannot be reconstructed; legacy cancellation causes not saved remain generic. Context uses an in-process coalesced timer with durable pending status/manual retry, not a restart worker; raw note save and invalidation are separate writes. The prior refresh-effect speech cancellation bug is fixed: checker lifetime is owner-scoped and current occurrence/time/status is revalidated without cancelling ordinary refresh playback. Reports use planned session minutes, not measured elapsed work; rescheduling links are positional rather than a full effort ledger.

**Unfinished edges:** arbitrary commitment POST supports recurring blocks; dated work is task-linked sessions. Clarify assessment expectations before adding independent dated commitments. This stability pass did not repeat a live-AI/audible-native-TTS rehearsal; only the earlier live smoke check and user-reported audible behavior are established. Scoped standalone simplification itself is implemented and verified as section 9 describes.

**Optional future work:** local compatible AI, closed-tab push, external audio, queues, account recovery/refresh tokens, embeddings/cross-task memory, deployment/redesign remain deferred. Do not introduce generic rollback/locking infrastructure for routine lab development.

## 12. Reviewer package and safe sharing

Share this Markdown/updated DOCX, README, IMPLEMENTATION_CHECKLIST and original brief. Companion files: root/server manifests and lockfiles; both .env.example files; server/src/{config/db.js,server.js,models/index.js,controllers/apiController.js}; services/{blockWrites,placementService,scheduleService,plannerService,taskContextService,aiClient}.js; scripts/{test-local,verify-groq}.js; tests/integration/api.test.js. For UI review add frontend AppContext/apiConfig and pages. transaction.js was removed.

Never share real .env files, node_modules, MongoDB storage, caches, private screenshots, credentials or tokens. No service configuration package is needed; the existing standalone service is used unchanged.
