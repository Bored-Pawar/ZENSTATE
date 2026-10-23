# Zenstate

Student MERN planner: the existing React UI, Express/Node.js, Mongoose with standalone LOCAL MongoDB, Groq planning, and browser TTS. Accounts, timetables, tasks, conversations, notes, prepared messages and reminder state are persisted in MongoDB. No demo persistence fallback is used.

## Everyday startup

The existing Windows MongoDB service must already be running on `127.0.0.1:27017`. Leave its configuration and other databases unchanged. No replica set, second mongod, transaction service or schedule lock is needed.

From PowerShell terminal A:

```powershell
Set-Location 'C:\Users\Aditya Pramod Pawar\zenstate'
npm --prefix server run dev
```

From terminal B:

```powershell
Set-Location 'C:\Users\Aditya Pramod Pawar\zenstate'
npm run dev
```

Open **http://localhost:5173**. Use Ctrl+C to stop each app terminal. Restart either application by running the same command. Do not stop/restart MongoDB for ordinary app restarts.

## Installation and configuration

Use Node.js 22.14+ and npm. Dependencies are separate:

```powershell
npm ci
npm --prefix server ci
```

This workspace now has ignored `.env` and `server/.env` files. Do not overwrite them when adding your key. On a fresh checkout only, copy the examples if the destinations are absent:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

- Root `.env`: `VITE_API_BASE_URL=http://localhost:5000/api`.
- `server/.env`: `MONGODB_URI=mongodb://127.0.0.1:27017/zenstate_dev`, `PORT=5000`, `CLIENT_ORIGIN=http://localhost:5173`.
- Backend `JWT_SECRET`: at least 32 random characters; generated locally in this workspace. Preserve it across restarts to keep logins valid. For a fresh copy of the example, generate privately using the command below.
- Backend `AI_PROVIDER=groq`, `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=openai/gpt-oss-20b`. **Add your replacement key to `AI_API_KEY` in `server/.env`.** Never put it in a `VITE_` variable.
- Optional defaults: `JWT_EXPIRES_IN=7d`, `AI_TIMEOUT_MS=20000`, `AI_INPUT_CHAR_BUDGET=24000`, `AI_MAX_OUTPUT_TOKENS=1000`.

For a new installation only, this writes a signing secret without displaying it and preserves an existing valid one:

```powershell
Set-Location server
node --input-type=module -e "import fs from 'node:fs'; import crypto from 'node:crypto'; import dotenv from 'dotenv'; let s=fs.readFileSync('.env','utf8'); const e=dotenv.parse(s); if(!e.JWT_SECRET || e.JWT_SECRET.includes('<') || e.JWT_SECRET.length<32){ const line='JWT_SECRET='+crypto.randomBytes(48).toString('hex'); s=/^JWT_SECRET=.*$/m.test(s)?s.replace(/^JWT_SECRET=.*$/m,line):s+'\n'+line+'\n';fs.writeFileSync('.env',s); }"
Set-Location ..
```

Both real environment files are ignored by Git. Existing passwords/keys are never needed in documentation. MongoDB connection failure produces a startup error; it does not switch to sample data.

## Database operations in plain language

Each request checks the signed-in owner and validates the proposed change first. Recurring groups, moves and splits save their replacement records before removing originals. Placement saves new sessions and the new task placement first, then retires old sessions. A caught failure attempts small, operation-specific cleanup using the original records and only the new IDs.

Plan confirmation uses the existing unique source-conversation index to prevent duplicate tasks. Two optional task fields (`planConfirmationReady`, `planDraftVersion`) record when placement has saved: a retry can finish linking that same task after a link-write failure. An overlapping in-progress confirmation may return 409; reload/retry. Existing confirmed records need no migration. The unused legacy `User.scheduleVersion` value is retained but no longer incremented or used for locking.

Completion records the completed session first, then recalculates task progress from saved sessions; retrying does not count it twice. Whole-task completion saves the fact before cancelling remaining sessions. If cleanup fails, the response explains completion was saved and asks you to retry. Deletion removes related notes/chat/sessions before deleting the task; interrupted deletion can already have removed some children and must be retried. Recurring group deletion is likewise ordinary multi-record deletion.

**These are ordinary multi-step writes, not atomic transactions.** A process crash, unavailable database during cleanup, or simultaneous edits can leave partial records. Parallel requests are not guaranteed to prevent every overlap. Reload and inspect before retrying `PARTIAL_WRITE`; retry the named completion/deletion after its specific error. Avoid parallel schedule edits during the lab demonstration. No generic rollback engine, schedule lock, queue or replica-set machinery remains.

## Groq and verification

Groq's official [model list](https://console.groq.com/docs/models) lists GPT OSS 20B at $0.075 input / $0.30 output per million tokens at inspection (23 October 2026). The existing helper requests `json_object`, with Zod validation and one planning correction attempt. [JSON object mode](https://console.groq.com/docs/structured-outputs#json-object-mode) supports the chosen model but does not enforce the application's schema. GPT OSS requests use low reasoning effort; response budgets remain conservative and need a live account rehearsal.

Chat saves the user's input before requesting AI. A missing key returns a readable error with retry; it never fabricates a successful planner answer. Task notes still save, and context generation may supply a labelled deterministic template. Only `messageStatus=ready` / `contextProcessingStatus=ready` indicates successful AI generation. Reminder delivery reuses prepared text without another AI request.

```powershell
npm test
npm --prefix server run test:local
npm run build
# After adding AI_API_KEY:
npm --prefix server run test:groq
```

Verified: **13 focused tests**, **20 real standalone MongoDB/API scenarios**, **3 browser walkthroughs**, frontend build, normal backend startup and health. AI in automated API/browser tests is absent or simulated. **Live Groq and audible native TTS are not verified.** The live checker currently reports blocked because the key is absent. Build has non-fatal React Router client-directive warnings.

`test:local` connects to the existing server at port 27017, creates only its generated `zenstate_test_standalone_<timestamp>_<pid>` database and drops only that database. It never starts/stops mongod, clears `zenstate_dev`, or changes server settings. `test:groq` is opt-in, checks model access and uses a separate `zenstate_test_groq_*` database; it makes a small planning/context smoke test, rejects template fallbacks as success, and cleans its test database.

For browser tests, run these in separate terminals from the project root (the `node` commands also avoid Windows npm argument forwarding differences):

```powershell
Set-Location server
node scripts/test-local.js --serve
```

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:5001/api'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --strictPort
```

```powershell
npm run test:browser
```

Stop the test servers with Ctrl+C. Exit the browser-test frontend terminal afterward so its temporary API override does not affect everyday startup. The browser fixture uses disposable data, a test signing secret, API 5001 and simulated speech; it is not the project launcher. On abrupt termination, inspect/remove only the exact printed test database in Compass, if necessary.

## Health, Compass and troubleshooting

```powershell
Get-Service MongoDB
Test-NetConnection 127.0.0.1 -Port 27017
Invoke-RestMethod http://localhost:5000/api/health
```

Expected: service Running, TCP succeeded, API `data.status` = `ready`. In MongoDB Compass connect to `mongodb://127.0.0.1:27017`, then choose **zenstate_dev** and refresh collections after registration. Never drop it for testing. `users`, `tasks`, `scheduleblocks`, `notes`, `conversations`, `messages` belong to this app; `zenstate_test_*` databases are separate disposable fixtures. No MongoDB service/storage configuration is necessary here.

- Startup selection timeout: verify the existing service and port; no demo data will appear. If the service is stopped, follow its existing owner/admin procedure; do not create a second server.
- JWT setup error: configure the backend secret privately. Changing it invalidates existing tokens; log in again.
- CORS/404: open localhost:5173 for normal startup; match CLIENT_ORIGIN exactly. Restart Vite after `.env` edits. If 5173 is occupied, stop the app terminal using it instead of silently accepting a different port.
- AI_UNAVAILABLE: add backend AI_API_KEY and restart backend. AI_RETRY/template: check Groq model permissions, quota, connectivity and output budget; no key is sent to React. Use `test:groq` once to check.
- 409 schedule conflict: choose a genuinely free slot/day or hold; suggestions are advisory and checked again on save.
- `PARTIAL_WRITE`, `COMPLETION_SAVED`, `SESSION_COMPLETION_SAVED`, `TASK_SAVED`, `PARTIAL_DELETE`: read the response; it states what saved and whether to inspect or retry the specific operation. These are not all-or-nothing failures.
- Text without speech: interact with Preview/Play, check browser voice support and speakers. Closed-tab/background reminders are outside scope.

## Short lab walkthrough

1. Register, save whole-week overnight sleep, add weekday/weekend/custom-day commitments, edit one/group and finish setup. Reload to show persistence.
2. Create a 45-minute task; schedule an exact session, split it, then demonstrate flexible/held conversion. Show an overlap rejection.
3. With the key configured, chat: ?Practise React hooks for 45 minutes for lab confidence; evenings work best.? Review/correct the draft, choose placement, explicitly confirm once and reload the saved conversation.
4. Add a note about a specific difficulty. Show the refreshed context and prepared motivational text, distinguishing AI-ready text from a template.
5. Set a reminder a minute ahead, keep the page open, enable voice with interaction, demonstrate popup/snooze and Preview. Mark work complete and inspect the weekly report.
6. Log out/in and show retained data; sign in as another user to show separation. App restarts retain the same database; never reset the project DB for a demonstration.

See [DEVELOPMENT_HANDOFF.md](DEVELOPMENT_HANDOFF.md) for model/API details and [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) for evidence and remaining checks.
