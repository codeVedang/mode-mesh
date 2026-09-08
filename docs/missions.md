# ModeMesh Missions

Missions adds one bounded workflow: **research → sourced comparison → PDF report → five-slide deck**.
Open **Try a Mission** on the home screen or **Missions** from text/voice mode. Use the example or dictate a brief, specify the audience, review the four-step plan, and approve it.

## User behavior

- Drafts are free. A research mission costs **26 credits**; a revision costs **21 credits**, shown before approval. Credits are charged on start, not refunded on cancellation. Retrying the same mission never charges again.
- Progress is real saved step state, polled every 2.5 seconds while running. It is not token streaming or a simulated animation.
- Sources appear once research finishes. Comparison rows and recommendations link to retrieved source IDs. Validation checks citation IDs and output structure, not factual truth; users must review the claims and limitations.
- PDF and PowerPoint are generated from the same comparison. The deck contains one cover and four content slides. Download URLs are freshly signed after checking mission ownership.
- Cancel prevents further checkpoint writes and downstream steps. An in-flight external request may continue briefly until its cancellation signal is observed.
- Retry skips successful steps. Revisions create a separate draft, copy the original research, and regenerate comparison/files. Original outputs remain available in Recent Missions. Revisions are for audience/emphasis changes; create a new research mission for a new topic or fresh evidence.
- The URL contains the mission ID, so refreshing restores it. The ID is not a public sharing link: each request checks the signed-in owner.

## Architecture and recovery

The existing chat graph is unchanged. A separate LangGraph workflow defines the four mission dependencies. The runner stores step outputs and completion checkpoints in the agent service's MongoDB `missions` collection. It uses an atomic lease claim, a 10-second heartbeat, and owner-fenced writes so duplicate starts or old workers cannot overwrite a cancelled/reclaimed mission.

A recovery scan runs every 30 seconds while the agent service is alive; expired leases become eligible after three minutes. It resumes at the first unfinished step. A Render instance that is asleep cannot run the scanner until it wakes. This is not a dedicated always-on queue worker. Provider calls can repeat if a process dies before saving their result; file keys are deterministic and confirmed mission charges are idempotent.

The auth service atomically decrements credits and records a mission-specific receipt on the user document. Receipt keys include mission/version/kind and are not returned in normal user queries. Existing credit deductions and top-ups use atomic increments to avoid losing concurrent mission debits. Receipts currently grow with mission count; migrate them to a transactional ledger before high-volume use approaches MongoDB document limits.

## API (through the authenticated gateway)

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/agent/missions` | Latest 30 owned missions |
| POST | `/api/agent/missions` | Create draft with `objective`, `audience`, `requestId` |
| GET | `/api/agent/missions/:id` | Owned status, sources and results |
| PATCH | `/api/agent/missions/:id` | Edit a draft brief or revision |
| POST | `/api/agent/missions/:id/start` | Approve or resume unfinished steps |
| POST | `/api/agent/missions/:id/cancel` | Cancel execution |
| POST | `/api/agent/missions/:id/revise` | New draft with `revision`, `requestId` |
| GET | `/api/agent/missions/:id/files/pdf` | Fresh PDF download URL |
| GET | `/api/agent/missions/:id/files/ppt` | Fresh slide download URL |

Internal billing uses `/mission-credits` on auth. Its gateway route also requires a valid session. Costs are defined centrally in `backend/shared/missionCosts.js`.

## Deployment

No new provider keys or paid service subscriptions are introduced. Missions uses existing MongoDB, Redis, Groq, Tavily, S3, and internal auth credentials. Provider quotas still apply.

Deploy **auth and gateway first**, then **agent**, then **frontend**, because the agent needs the new billing endpoint. MongoDB must permit creating the `missions` collection and its indexes. Ensure the unique `(userId, requestId)` index exists; Mongoose creates it when automatic indexes are enabled. For production deployments with automatic indexes disabled, create it as a deployment migration before enabling Missions.

After deployment, run a real signed-in smoke test: create the sample mission, approve, verify citations, open both files, reload, and create a revision. Local tests use mocked providers and persistence; they do not establish production provider availability.

## Checks

```sh
cd backend/services/agent
npm ci
npm test

cd ../../../frontend
npm ci
npm run build
npx eslint src/components/MissionRoom.jsx src/components/ModeGateway.jsx src/components/VoiceRoom.jsx src/components/SideBar.jsx src/pages/Home.jsx
```

Browser smoke test: start Vite on `127.0.0.1:5173`, make Playwright available (or set `PLAYWRIGHT_MODULE` to an installed Playwright module path), and run `node frontend/tests/missions.browser.cjs` from the repository root. The test uses Chrome, mocks network services, and exercises approval, editing, refresh, cancellation, resume, citations, downloads, revisions, and mobile overflow. Screenshots are written to the OS temporary folder. No live credentials or credits are used.
