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

  // The profile page embeds the numeric id; reading it is an ordinary page load, not an API call.
  async function idFromProfilePage(handle) {
    const onPage = location.pathname.split("/")[1]?.toLowerCase() === handle.toLowerCase();
    const html = onPage
      ? document.documentElement.innerHTML
      : await (await tfetch("https://www.instagram.com/" + encodeURIComponent(handle) + "/", { credentials: "include" })).text();
    return idBoundToHandle(html, handle);
  }

  // Accept an id only if the requested username appears right beside it; a bare first
  // match could be another account (suggestions, mentions) and we'd block the wrong person.
  function idBoundToHandle(html, handle) {
    const needle = '"username":"' + handle.toLowerCase() + '"';
    for (const m of html.matchAll(/"profile_id":"(\d+)"/g)) {
      const near = html.slice(Math.max(0, m.index - 800), m.index + 800).toLowerCase();
      if (near.includes(needle)) return m[1];
    }
    return null;
  }

  const RESERVED = new Set(["explore", "reels", "reel", "p", "direct", "accounts", "stories", "about", "legal", "web", "tv", "challenge"]);
  function currentHandle() {
    const seg = location.pathname.split("/")[1];
    return seg && !RESERVED.has(seg.toLowerCase()) && /^[\w.]{1,30}$/.test(seg) ? seg : null;
  }

  async function block(handle) {
    const token = cookie("csrftoken");
    if (!token || !cookie("ds_user_id")) {
      return { ok: false, status: 401, fatal: "Non connecté à Instagram." };
    }

    // 1. username -> numeric id (page HTML first, API only as fallback: the API lookup is throttled hard)
    let id;
    try {
      id = await idFromProfilePage(handle);
      if (!id) {
        const info = await tfetch(
          "https://www.instagram.com/api/v1/users/web_profile_info/?username=" + encodeURIComponent(handle),
          { credentials: "include", headers: headers(token) }
        );
        if (info.status === 404) return { ok: false, status: 404 }; // gone / renamed
        if (info.status === 429) return { ok: false, status: 429, retryAfterMs: 30 * 60_000 };
        if (info.status === 401 || info.status === 403) {
          return { ok: false, status: info.status, fatal: "Session refusée (" + info.status + ")." };
        }
        const user = (await info.json()).data.user;
        if (user.username.toLowerCase() !== handle.toLowerCase()) return { ok: false, status: 0 };
        id = user.id;
      }
    } catch (e) {
      if (e.name === "TimeoutError") throw e;
      return { ok: false, status: 0 };
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

  (globalThis.__blockPlatforms ||= {}).instagram = { id: "instagram", block, delay, currentHandle, idBoundToHandle };
})();
