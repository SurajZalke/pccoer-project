# Debug Session: backend-not-reachable

Status: [OPEN]

## Symptom
- WhatsApp Automation page shows `Backend not reachable`.
- UI references a backend URL that appears unreachable in the browser console/screenshot.

## Hypotheses
1. Frontend backend base URL is invalid or stale.
2. Backend is down or not bound on the expected host.
3. Frontend fallback logic builds a bad URL when env vars are missing.
4. Health-check endpoint/path does not match backend routes.
5. Request is blocked by CORS or protocol mismatch.

## Plan
1. Inspect frontend env resolution and request paths.
2. Inspect backend startup config and exposed routes.
3. Reproduce locally or via config validation.
4. Add minimal instrumentation only if static inspection is insufficient.
5. Apply the smallest evidence-based fix and verify.

## Evidence
- `netlify.toml` config sets `VITE_WA_BACKEND_URL=https://dhole-sir-coaching-classes-production.up.railway.app`.
- Backend exposes `/health` in `backend/server.js`.
- Direct fetch to `https://dhole-sir-coaching-classes-production.up.railway.app/health` returned `{"ok":true,...}`, so the configured production backend is alive.
- Frontend URL selection in `src/services/whatsappWebService.ts` preferred query/localStorage overrides over env config with no automatic recovery path.
- The user symptom is consistent with a stale runtime override or cached local value forcing requests to a bad backend URL even when the env backend is healthy.

## Fix Applied
- Added debug instrumentation around backend URL resolution and pre-response fetch failures in `src/services/whatsappWebService.ts`.
- Added automatic network-failure fallback from a runtime override to the next healthy configured backend candidate.
- Clear the persisted `WA_BACKEND_URL` override when it is the failing source, so the dashboard does not stay stuck on a bad cached URL.

## Verification
- `npm run build` completed successfully after the fix.
- VS Code diagnostics are clean for the edited WhatsApp frontend files.

## Iteration Notes
- User reported the issue was still reproducible after the first fallback fix.
- Debug log confirmed the runtime selected the env backend URL directly, with no stale runtime override involved.
- PowerShell on this machine also failed to resolve `dhole-sir-coaching-classes-production.up.railway.app`, matching the browser's `Failed to fetch` symptom.
- Added a Netlify reverse-proxy path (`/wa-backend/*`) and switched the production frontend backend URL to `/wa-backend` so browsers no longer need to resolve the Railway hostname directly.

## Current Status
- Waiting for user verification in preview/deployed environment before cleanup.
