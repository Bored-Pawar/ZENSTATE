# Zenstate implementation and acceptance checklist

Assessment date: 23 October 2026. **I** = implemented; **V** = verified by the evidence below; **B** = requires supplied credentials or manual audible testing. A simulated provider response verifies adapter/application behavior, not a live Groq model.

## Phase record

| Phase                         | Result                                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Inspect / preserve          | V — read the complete brief, existing source and ancestor instruction locations. No AGENTS.md found. Existing working-tree edits were preserved. Kept the frontend location, styling, sidebar, calendar and four planner screens.                                   |
| 1 Foundation / authentication | I + V — Express, real Mongoose records, standalone Mongoose startup, JWT, bcrypt, validation, ownership and user-scoped cache. Local real database/API and browser checks passed. Normal local startup/health also verified.                                        |
| 2 Setup / timetable           | I + V — resumable setup, editable sleep, all day presets, overnight spillover, group scopes, dated sessions, exact-duration move/split, overlap/capacity validation, week navigation.                                                                               |
| 3 Tasks / notes               | I + V — manual creation, scheduled/flexible/held placement, actual dates, session/task completion, saved editable/deletable task notes and separate daily journals.                                                                                                 |
| 4 Availability / planner      | I + V application rules — real availability, saved versioned conversations, bounded/paginated history, explicit idempotent confirmation. Simulated valid/malformed provider and missing-key paths verified. Live Groq semantics remain B.                           |
| 5 Context / motivation        | I + V — current-source recomputation, write-time invalidation, coalescing, durable pending/failed state, templates, progress and linked-chat updates, compare-and-set version guard including out-of-order AI results. Live extraction quality remains B.           |
| 6 Reminders / TTS / reports   | I + V — due checks, typed IDs, queue, atomic claims, saved snooze/delivery, latest-state cancellation, accurate weekly records and review-tomorrow actions. Speech callbacks/unavailable state verified with browser simulation; audible native playback remains B. |
| 7 Verification / handoff      | V — production build, 13 focused tests, 20 real standalone API scenarios, 3 browser walkthroughs, desktop/mobile screenshot inspection, lockfiles, environment examples and README. Full live-AI/voice lab rehearsal remains B.                                     |

## Verification evidence

- `npm run build`: passes using Vite 8.3.5. React Router emits non-fatal client-directive bundler warnings.
- `npm test`: 13/13 pass (dates, DST/overnight, adjacency, union capacity, patch validation, provider JSON/timeout, reminder eligibility/snooze, templates, report counts).
- `npm --prefix server run test:local`: 20/20 pass against the existing real standalone MongoDB 8.3 service with an isolated test database using Mongoose 8.24.6. Tests exercise ordered ordinary writes, indexes, HTTP ownership checks and injected partial-write recovery. This is not a mocked database or an application persistence fallback.
- `npm run test:browser`: 3/3 pass in installed headless Chrome against the isolated database-backed server. Includes registration, setup/reload, task/note saving and simulated save failure, manual correction after an actual missing-key response, fixed-slot confirmation, reports, logout/login, late-response isolation, real due popups, saved snooze/delivery, refresh deduplication and simulated speech callbacks/unavailability/preview.
- Browser walkthroughs pass with the existing design. Desktop/mobile screenshots were inspected in the previous implementation session; no new visual redesign was made.
- Previous implementation-session dependency audits reported zero known vulnerabilities; no fresh dependency audit was performed for this scoped change.

## Acceptance matrix

| IDs                | Status / evidence                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01            | V — real registration, hashed stored password, setup route; API + browser                                                                                                                                                        |
| AUTH-02            | V — duplicate email 409; wrong password 401; API                                                                                                                                                                                 |
| AUTH-03            | V — saved note/setup survive reload and authenticated login; browser + API                                                                                                                                                       |
| AUTH-04            | V — cross-user task reads/updates/placement, note writes/edits, chat/history cursor denied; all private routes authenticate and owner-filter                                                                                     |
| AUTH-05            | V — browser holds old-account request through logout and verifies cache/token stay clear                                                                                                                                         |
| SETUP-01, SETUP-02 | V — saved sleep survives reload; completed setup survives logout/login; browser                                                                                                                                                  |
| TIME-01, TIME-02   | V — preset selected-day counts + custom day validation in focused tests and real recurring writes                                                                                                                                |
| TIME-03            | V — conflicting group rejected; database count unchanged; real pre-write validation                                                                                                                                              |
| TIME-04            | V — one-day and whole-group edit/delete, with exact record counts; API                                                                                                                                                           |
| TIME-05            | V — Sunday/Monday availability spillover, overnight split links and visible saved sleep segments; focused/API/browser                                                                                                            |
| TIME-06            | V — half-open adjacency, rejected overlaps, occupied interval merging; focused/API                                                                                                                                               |
| TIME-07, TIME-08   | V — exact session move/split, invalid split retains original, reversed/equal recurring intervals rejected; focused/API                                                                                                           |
| TIME-09            | V — next-week API returns same recurring IDs and excludes previous week's dated sessions                                                                                                                                         |
| TASK-01            | V — manual task saves, held group and detail restore; browser/API                                                                                                                                                                |
| TASK-02            | V — future flexible date persisted and consumes that day's capacity; API; Today filters actual local date                                                                                                                        |
| TASK-03            | V — conversions cancel unfinished future sessions, clear flexible reservation, preserve history and cancel old reminders; API                                                                                                    |
| TASK-04            | V — one session completes planned effort while task remains in_progress; API                                                                                                                                                     |
| TASK-05            | V — explicit early task completion cancels pending sessions and makes reminder inactive; API                                                                                                                                     |
| NOTE-01            | V — linked original note survives reload; browser/API                                                                                                                                                                            |
| NOTE-02            | V — unrelated daily journal excluded from task context; API                                                                                                                                                                      |
| NOTE-03            | V — simulated HTTP save failure visibly preserves typed note, then successful retry; browser                                                                                                                                     |
| PLAN-01, PLAN-02   | I + V simulated — structured 90-minute extraction, no first-number regex/fixed questionnaire, estimate flag/editable review. **B live Groq answer quality**                                                                      |
| PLAN-03            | V rules — capacity/overlap/deadline validation failures happen before writes; multi-step writes are not atomic; real availability supplies suggestions only if capacity fits. UI provides other dates, flexible and held choices |
| PLAN-04            | V — saved conversation API, owner-checked paginated history, restored failed chat and reopened linked-task context                                                                                                               |
| PLAN-05            | V — confirmation retries return the same task; a concurrent in-progress request may return 409; unique source relationship; repeated failed-message retry stores one user message                                                |
| PLAN-06            | V — stale draft version and newly occupied selected slot rejected without orphan task; API                                                                                                                                       |
| PLAN-07            | V — timeout/invalid JSON adapter tests, malformed upstream/API and missing-key retries preserve input; **B live Groq happy path**                                                                                                |
| CTX-01             | V current template reflects saved difficulty; simulated context pipeline works. **B live AI extraction quality**                                                                                                                 |
| CTX-02             | V — note edit/delete removes unsupported old details from current template/context; real database                                                                                                                                |
| CTX-03             | V — deliberately held older AI response completes after newer response; cannot overwrite version 2; real database + simulated provider                                                                                           |
| CTX-04             | V — completed task template acknowledges finish; task/session status persists and unfinished reminders cancel                                                                                                                    |
| CTX-05             | V — absent AI key preserves notes, sets usable current template/retry state                                                                                                                                                      |
| REM-01             | V — real timed flexible popup in Chrome and actual session due eligibility/claim via API                                                                                                                                         |
| REM-02             | V — refresh after delivery does not replay; browser + API                                                                                                                                                                        |
| REM-03             | V — ten-minute snooze saved in browser flow; due re-fire verified using controlled saved timestamp and focused catch-up test                                                                                                     |
| REM-04             | V — two simultaneous due tasks displayed sequentially in browser; speech belongs to the active popup                                                                                                                             |
| REM-05             | V API — completing/moving/holding cancels old eligibility, including missed reminders. Checker revalidates active/queued state; browser logout stops timers/speech                                                               |
| REM-06             | V simulated browser — play/pause/resume/stop follow callbacks, interrupted speech is not falsely blocked, unavailable speech leaves text usable. **B actual audible native voice/automatic playback on lab machine**             |
| REM-07             | V — Preview reminder invokes speech controls without a delivery request; browser                                                                                                                                                 |
| REPORT-01          | V — empty calculated summary has 0%, no NaN; new browser account has honest empty Today                                                                                                                                          |
| REPORT-02          | V — future pending counted upcoming; browser report shows one upcoming and zero missed                                                                                                                                           |
| REPORT-03          | V — original missed occurrence retained, replacement linked and counted; API                                                                                                                                                     |
| REPORT-04          | V — known completed/missed/upcoming/cancelled fixtures produce exact counts/minutes/daily series; focused/API                                                                                                                    |
| DEMO-01            | V database-backed browser flow with manual review after missing-key failure; **B full live Groq + audible TTS rehearsal**                                                                                                        |

## Current standalone simplification: completed work

- [x] Read the handoff and actual write paths; preserve frontend and existing data.
- [x] Replace grouped creates/edits, recurring/dated splits, session moves, task conversions, confirmation/replies, completion, deletion and profile/setup transaction dependencies.
- [x] Remove transaction helper, topology requirement and schedule-lock increments; do not start/configure/stop MongoDB.
- [x] Validate proposed changes first; save replacements before retiring originals; test narrow cleanup and retry behavior.
- [x] Use mongodb://127.0.0.1:27017/zenstate_dev in ignored server/.env; generate missing signing secret privately; configure matching API/origin.
- [x] Keep unique sourceConversationId; add optional planConfirmationReady/planDraftVersion receipt fields. Existing records require no migration; legacy scheduleVersion retained unused.
- [x] Check official Groq model/JSON docs, configure openai/gpt-oss-20b and backend-only helper; add opt-in test:groq script.
- [x] Verify 13 focused tests, 20 standalone API scenarios, 3 browser walkthroughs, frontend build, normal startup/ready health.
- [x] Update README/environment examples/handoff; replace old replica-set guidance.
- [ ] BLOCKED: live Groq planning/context generation. AI_API_KEY absent; test:groq reports blocked before a call or test DB is created.
- [ ] MANUAL: audible native TTS/autoplay and retained project account app/OS restart rehearsal.

Five new API scenarios cover grouped save/delete/split partial failures, placement/conversion/split cleanup, confirmation link recovery, retryable completion/partial deletion, and assistant-save/status recovery. Selected I/O failures are simulated while persistence is real standalone MongoDB. Earlier 15-scenario replica-set evidence is superseded. Scenario12 now tests sequential overlap rejection; no concurrency/transaction-level guarantee remains.

Ordinary writes can leave partial records after a crash/outage or concurrent edits. PARTIAL_WRITE requires inspection; saved completion/session/metadata errors ask to retry their named action; PARTIAL_DELETE can already have removed children. This is documented behavior, not atomic rollback. Browser speech callbacks are simulated, not audible verification. No unrelated database or service configuration was changed.

## Configuration still required

Add replacement AI_API_KEY privately in server/.env, restart backend, run npm --prefix server run test:groq once. All independent local DB/JWT/frontend-origin configuration is complete. Keep the browser open and verify speakers with Preview reminder. Do not overwrite real environment files or change MongoDB services/replication/storage.

## Documented defaults / scope choices

- Existing interface retained; exact integer minutes, half-hour suggested starts, IANA timezone and UTC dated sessions.
- Missing AI produces a labelled current template and retry state, never a fake successful planner reply.
- Removing a dated session explicitly offers to hold remaining work; completed/missed history and notes remain, and task placement can then be reassigned.
- Weekly coach text is a factual deterministic summary of calculated data. Task messages and planning use the provider helper when configured.
- Context uses deterministic per-note excerpts, bounded batches, retained original note associations, durable pending state and manual retry after restart. Fallback explicitly labels latest-eight coverage for large note histories.
- Character budgets are conservative configuration, not exact tokenizer counts. Model-specific input/output capacity must be checked during Groq setup.

## Deferred by the brief

Closed-tab push/background delivery, local model hosting, external TTS audio, embeddings/vector/graph memory, cross-task memory, recurring task optimisation, automatic displacement, external job queues, account recovery/social login/refresh tokens, and deployment/redesign remain deliberately outside scope.
