// Adapter for Instagram web. Runs on instagram.com so requests are same-origin
// and carry the user's session cookies. Instagram is strict: slow pace, and any
// sign of a challenge stops the run.
(function () {
  const IG_APP_ID = "936619743392459"; // public web-client app id

  function cookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
    return m ? m[1] : null;
  }

  const headers = (token) => ({
    "x-csrftoken": token,
    "x-ig-app-id": IG_APP_ID,
    "x-requested-with": "XMLHttpRequest",
    "x-asbd-id": "129477",
  });

  // fetch with a timeout so a stalled request can't freeze the queue.
  const tfetch = (url, opts) =>
    fetch(url, { ...opts, signal: AbortSignal.timeout(20_000) });

  async function block(handle) {
    const token = cookie("csrftoken");
    if (!token || !cookie("ds_user_id")) {
      return { ok: false, status: 401, fatal: "Non connecté à Instagram." };
    }

    // 1. username -> numeric id
    const info = await tfetch(
      "https://www.instagram.com/api/v1/users/web_profile_info/?username=" + encodeURIComponent(handle),
      { credentials: "include", headers: headers(token) }
    );
    if (info.status === 404) return { ok: false, status: 404 }; // gone / renamed
    if (info.status === 429) return { ok: false, status: 429, retryAfterMs: 30 * 60_000 };
    if (info.status === 401 || info.status === 403) {
      return { ok: false, status: info.status, fatal: "Session refusée (" + info.status + ")." };
    }
    let id;
    try {
      id = (await info.json()).data.user.id;
    } catch {
      return { ok: false, status: info.status };
    }
    if (id === cookie("ds_user_id")) return { ok: false, status: 400 }; // never block self

    // 2. block
    const res = await tfetch("https://www.instagram.com/api/v1/web/friendships/" + id + "/block/", {
      method: "POST",
      credentials: "include",
      headers: { ...headers(token), "content-type": "application/x-www-form-urlencoded" },
      body: "",
    });
    if (res.status === 429) return { ok: false, status: 429, retryAfterMs: 30 * 60_000 };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, fatal: "Session refusée (" + res.status + ")." };
    }
    if (!res.ok) {
      // 400 with feedback_required / challenge_required = Instagram flagged the activity.
      const body = await res.text();
      if (/feedback_required|challenge_required|checkpoint/.test(body)) {
        return { ok: false, status: res.status, fatal: "Instagram a demandé une vérification : arrêt. Réessayez plus tard." };
      }
    }
    return { ok: res.ok, status: res.status };
  }

  // Much slower than X: 8–16 s between blocks.
  const delay = () => 8000 + Math.random() * 8000;

  (globalThis.__blockPlatforms ||= {}).instagram = { id: "instagram", block, delay };
})();
