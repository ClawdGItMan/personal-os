# Stride verification — September 5, 2026

## Automated checks

- `pnpm exec tsc --noEmit` — passed.
- ESLint on Stride components, libraries, API routes, page and middleware — passed with no warnings.
- `pnpm test` — 59 tests passed across 8 files, including 14 Stride tests.
- `pnpm build` — passed; `/stride` prerendered successfully and all six Stride API routes compiled.
- `git diff --check` — passed.

## Browser checks

An isolated Playwright browser used sample activities and synthetic fixtures.

- Logged a 10 km, 60 minute run at 9/10 effort. The sample history was replaced with the personal log and a recovery adjustment appeared.
- Applied the suggestion and moved to the next week; the calendar displayed the updated 6.5 km recovery run.
- Sent a recovery question and received a clearly labeled local coaching reply.
- Recorded hydration and changed the fuel calculator to 120 minutes at 60 g/hour; the result was 120 g.
- Imported an Apple Health XML fixture containing a running and cycling workout. Only the run appeared, with miles converted to 5.00 km and duration/heart rate retained. Imported again and verified no duplicate was added.
- Reloaded the page and verified persisted runs were retained.
- Exported a full backup through the browser download control, selected that same file, reviewed and restored it successfully.
- Checked all five strength exercises, completed the session, and verified the completed state.
- On a 390 px viewport, recorded poor sleep, soreness, and pain. Readiness changed to “Pause & assess” and the plan presented a rest recommendation.
- Verified mobile navigation opens, changes views, and closes.
- Visited all eight views at 390 × 844 and 1440 × 1080. No document-level horizontal overflow was detected in any of the 16 view/viewport combinations. Activity tables can scroll inside their own container on narrow screens.
- Captured all views and inspected the overview and nutrition layouts, including mobile stacking, typography, hero imagery, calendar, coach card, and primary actions. Screenshots disable entrance animations to capture their settled state.
- Verified the coach API rejects a foreign origin, and Strava sync rejects a request with no connection.
- Browser console showed normal Next.js development messages; no application runtime errors were observed in the completed flow.

## Not live-verified

- OpenAI generation awaits completion of secure API-key setup, then an API smoke test and opt-in activation.
- Strava OAuth/token refresh/sync awaits developer credentials and an athlete’s authorization. The missing-configuration and disconnected states work.
- Apple Health is a browser XML import, not a native background HealthKit connection.
- Cross-device persistence, production user authentication for the paid AI endpoint, durable cloud rate limiting, and scheduled Strava sync are outside this local-first release.

Screenshots: `output/playwright/stride-{overview,plan,activities,coach,nutrition,recovery,connections,settings}-{390,1440}.png`.
