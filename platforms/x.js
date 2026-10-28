// Adapter for X / Twitter. Runs in the page context of x.com so requests are
// same-origin and carry the user's session cookies.
// Each adapter exposes: id, block(handle) -> {ok, status, retryAfterMs?}
(function () {
  // Public bearer token embedded in X's own web client.
  const BEARER =
    "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

  function csrf() {
    const m = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/);
    return m ? m[1] : null;
  }

  async function block(handle) {
    const token = csrf();
    if (!token) return { ok: false, status: 401, fatal: "Non connecté à X." };

    const res = await fetch("https://x.com/i/api/1.1/blocks/create.json", {
      method: "POST",
      credentials: "include",
      headers: {
        authorization: "Bearer " + BEARER,
        "x-csrf-token": token,
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ screen_name: handle }).toString(),
    });

    if (res.status === 429) {
      const reset = Number(res.headers.get("x-rate-limit-reset"));
      const wait = reset ? Math.max(reset * 1000 - Date.now(), 60_000) : 15 * 60_000;
      return { ok: false, status: 429, retryAfterMs: wait };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, fatal: "Session refusée (" + res.status + ")." };
    }
    // 404 / 34: account doesn't exist or is suspended — skip.
    return { ok: res.ok, status: res.status };
  }

  (globalThis.__blockPlatforms ||= {}).x = { id: "x", block };
})();
