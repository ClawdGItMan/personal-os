# Stride

A responsive, local-first marathon training workspace in the existing Next.js app.

Open **http://localhost:3100/stride** after running `pnpm dev --hostname 127.0.0.1 --port 3100`.

## What works

- Responsive overview with today’s session, race countdown, weekly distance, consistency, readiness, recent runs, and weekly distance chart.
- Starter training calendar with 3–5 running days, an easy/tempo/long-run structure, strength, recovery weeks, and a pre-race taper. Weekly distance starts from a user-entered comfortable baseline. There are no automatic mileage increases; long runs are capped at 32 km. Profiles below 25 km/week receive easy running instead of a speed session.
- Manual run logging and editing, perceived effort, pain and notes, search and filters, CSV export, activity details, and duplicate protection on imports.
- Recovery check-ins. High effort, poor sleep, soreness, low energy, or elevated workload can suggest a lighter next session. Pain can supersede a pending fatigue suggestion. The runner reviews and applies changes; chat cannot silently change the plan.
- Nutrition and hydration logging, plus an adjustable long-run carbohydrate calculator.
- A short strength routine with exercise instructions and completion tracking.
- Browser-local coaching preview, with explicit labeling, and an optional live OpenAI coach behind consent.
- Apple Health XML workout import, including modern WorkoutStatistics and legacy totalDistance formats; unit conversion, malformed XML handling, and a 100 MB file limit.
- Strava OAuth connection, encrypted HttpOnly tokens, refresh, sync of up to 500 activities from the last 90 days, and disconnect from the current browser.
- Profile and goal editing, browser persistence, full JSON backup export/validated restore, and a separate confirmation for clearing training data.

The initial workspace contains labeled example data. Saving/importing the first real run clears example data and starts a personal log. The user can also explicitly start a blank log in Settings. Personal OS routes and its existing authentication are preserved.

## Live AI setup

The secure OpenAI Platform key picker is used through Codex; keys must never be pasted into chat or committed to the repository. The ignored project `.env.local` is the recommended destination for `OPENAI_API_KEY`, subject to the user’s confirmation in the setup flow. No key is required for the local coaching preview.

Optional server setting: `STRIDE_AI_MODEL` (defaults to `gpt-4.1-mini`). The route uses the Responses API with `store: false`, timeouts, request validation, an origin check, and a local request limit.

Live AI is intentionally enabled only in development. A public deployment needs authenticated user access and a shared rate limiter before paid API access is exposed. A production build is supported; it displays the local coach.

Sharing is off by default. When enabled in the app, messages, profile, check-ins, meals, and recent manual/Apple Health runs are sent to OpenAI. Strava activities and local preview assistant responses are excluded from automatically supplied AI context. Restoring a backup resets sharing to off. `store: false` does not mean that provider processing or retention policies cease to apply.

## Strava setup

Add server-side credentials to the ignored environment file:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY` (the existing AES-256-GCM utility requires 32 random bytes, base64 encoded)
- Optional `STRIDE_STRAVA_REDIRECT_URI`, e.g. `http://localhost:3100/api/stride/strava/callback`

Register the corresponding callback domain in the Strava developer application. Connect using the in-app control and grant `activity:read_all`. The application verifies OAuth state and granted scope, encrypts token cookies, stores refreshed tokens before fetching activities, and never sends provider tokens to client JavaScript. Disconnect here clears the browser’s connection; complete revocation is available in Strava’s authorized-app settings.

The live account round trip cannot be verified until Strava credentials and an athlete’s authorization are available. Sync is user-triggered; there are no background webhooks or scheduled sync jobs in this version.

## Apple Health

On an iPhone: Health → profile → Export All Health Data. Unzip the export and choose `export.xml` in Connections. Parsing happens in the browser. Direct background HealthKit synchronization is a separate native iPhone companion milestone, not an available browser connection. Large exports above 100 MB need to be reduced before using this importer.

## Data and boundaries

- Workspace key: `stride.workspace.v1` in localStorage. There is no cross-device database sync in this version.
- Backups contain personal health/training data. Restore validates their shape and limits before replacing the current workspace.
- Imported activities are sorted by their actual timestamp. Week assignment and calendar display use the device’s local timezone.
- Repeated provider IDs update a run without discarding its effort/reflection. Near-matching cross-provider records within three minutes, 0.2 km, and three minutes’ duration are treated as duplicates; separate same-day runs are retained.
- Readiness is a transparent heuristic based on self-reported energy, sleep, soreness, and pain. It is not a physiological measurement or medical clearance.
- Goal pace is a conversion of the chosen finish time, not a race prediction.
- Training logic is conservative starter guidance, not a validated individualized coaching model or injury-prevention guarantee.

## Verification

`pnpm exec tsc --noEmit`, targeted ESLint, `pnpm test`, and `pnpm build`.

The Stride unit tests cover plan frequency/taper/race boundaries, review-only adjustments, pain escalation, duplicate preservation, local date grouping, malformed backup rejection, pace formatting, and urgent-symptom local-coach behavior.

Browser QA artifacts are under `output/playwright/`. Tests use an isolated browser profile and sample data, never the user’s real activity account.

## Implementation sources

- [Strava OAuth documentation](https://developers.strava.com/docs/authentication/)
- [Strava activity reference](https://developers.strava.com/docs/reference/)
- [Apple HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [OpenAI text generation](https://developers.openai.com/api/docs/guides/text)
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [Sports Dietitians Australia: eating and drinking during exercise](https://www.sportsdietitians.com.au/wp-content/uploads/2015/04/Eating-Drinking-During-Exercise.pdf)
- [Hospital for Special Surgery: running health](https://www.hss.edu/patient-care/athletes/running)

The race-card photo is a bundled Unsplash running image. No live image service is needed to render the app.
