# Debug Session: whatsapp-browser-path

Status: OPEN

## Symptom
- WhatsApp automation fails to start and reports Puppeteer/Chromium path errors.
- User wants local WhatsApp data that may be causing the failure removed if needed.

## Hypotheses
1. A stale runtime env var still points Puppeteer to `/usr/bin/chromium-browser`.
2. Local WhatsApp auth/session data is corrupted and breaks startup.
3. `whatsapp-web.js` resolves Chromium before the app override takes effect.
4. The running environment is not using the expected `nixpacks`/deploy config.
5. The UI is surfacing an old backend init error rather than the latest startup attempt.

## Plan
- Inspect runtime-related WhatsApp code and session paths.
- Add instrumentation only.
- Reproduce and collect evidence.
- Apply the smallest fix supported by logs.
- Verify with post-fix evidence.

## Evidence
- `pre-fix` log shows `sessionDirExists: false`, `legacyAuthExists: false`, and `cacheExists: true`.
- Local startup probe reached QR generation successfully, so local WhatsApp startup works on this machine.
- After deleting `backend/sessions` and `backend/.wwebjs_cache`, the `post-fix` log shows `cacheExists: false` before init and startup still reaches QR generation.

## Hypothesis Status
1. Rejected locally: stale local env did not force `/usr/bin/chromium-browser`; local runtime resolved a valid Windows Chrome path.
2. Rejected locally: corrupt local auth/session data was not the cause of the observed startup error on this machine.
3. Not confirmed locally: startup ordering does not block local launch.
4. Most likely for production: the running server environment is still using stale deploy/env state.
5. Possible secondary effect: the UI may be showing the live backend's current init error from Railway, not a local workspace problem.

## Applied Fix
- Added runtime instrumentation for Chromium/session resolution.
- Expanded session cleanup route to also remove `backend/.wwebjs_cache`.
- Deleted local `backend/sessions` and `backend/.wwebjs_cache`.
- Added Railway build-time compatibility symlinks in both `nixpacks.toml` files so `/usr/bin/chromium-browser` resolves to `/usr/bin/chromium` if stale env/config still references the old path.

## Verification
- Post-cleanup local startup still initializes and generates a QR code.
- Waiting for redeploy verification of the new Chromium compatibility symlink on Railway.
