# CLAUDE.md

Chrome MV3 extension: imports a list of handles (URL or pasted) and blocks them from the user's logged-in X/Twitter or Instagram session. No build step, no dependencies.

## Layout
- `manifest.json` — MV3; content scripts run on x.com / twitter.com.
- `platforms/<name>.js` — platform adapter. Registers `globalThis.__blockPlatforms.<name> = { id, block(handle) }`. `block` returns `{ok, status, retryAfterMs?, fatal?}`.
- `content.js` — queue runner in the page. Rate-limits (1.5–4 s jitter), pauses on 429, stops on 401/403, mirrors state to `chrome.storage.local` under `state`.
- `popup.html` / `popup.js` — list parsing (text or JSON), start/stop, progress display.

## Conventions
- Plain JS, no bundler, no frameworks. Keep it small.
- Network calls to the platform must run in the content script (same-origin, session cookies); the service worker/popup origin gets rejected.
- State shape: `{status, queue[], done[], failed[], message}`. Re-runs skip handles in `done`.
- UI strings are in French.

- "Bloquer ce profil" (popup message `blockCurrent`) blocks the profile shown in the tab via `platform.currentHandle()`.


## Constraints
- Uses X's unofficial internal endpoint (`1.1/blocks/create.json`) with the public web bearer token; it may change or break. Don't add features that evade rate limits or bot detection.
- Only blocks (never follows, reports or posts). Never log or transmit cookies/tokens.

## Adding a platform
New adapter in `platforms/`, add to `content_scripts.js` and `host_permissions` in the manifest, and extend the hostname check in `content.js` that selects the adapter. An adapter may export `delay()` to override the default pacing (Instagram: 8–16 s).

- Instagram is driven through the UI (profile page → "…" → Block → confirm), not the internal API, which 429'd. Selectors are text/aria-label based with en/fr/es/de/it/pt wording; extend the word lists in `platforms/instagram.js` for other languages. Visiting another profile uses `{ navigate: url }`: `content.js` sets a per-tab `sessionStorage` resume flag and the content script on the new page continues the run. A "try again later" dialog aborts the run.

## Testing
Load unpacked at `chrome://extensions`, open x.com logged in, run with a test account's handle. `node --check` on JS files for syntax.
