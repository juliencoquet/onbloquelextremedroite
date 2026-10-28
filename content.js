// Queue runner. Lives in the x.com tab; progress is mirrored to storage so the
// popup can show it (and survive being closed).
const STATE_KEY = "state";
let running = false;
let stopRequested = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const defaultDelay = () => 1500 + Math.random() * 2500;

async function getState() {
  return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || null;
}
const setState = (s) => chrome.storage.local.set({ [STATE_KEY]: s });

function currentPlatform() {
  return /instagram\.com$/.test(location.hostname)
    ? globalThis.__blockPlatforms.instagram
    : globalThis.__blockPlatforms.x;
}

async function blockCurrent() {
  const platform = currentPlatform();
  const handle = platform.currentHandle();
  if (!handle) return { ok: false, message: "Aucun profil affiché dans cet onglet." };
  try {
    const r = await platform.block(handle);
    if (r.fatal) return { ok: false, message: r.fatal };
    if (r.status === 429) return { ok: false, message: "Limite atteinte, réessayez plus tard." };
    return r.ok
      ? { ok: true, message: "@" + handle + " bloqué. Rechargez la page (F5) pour voir l'effet." }
      : { ok: false, message: "Échec pour @" + handle + " (statut " + r.status + ")." };
  } catch (e) {
    console.error("[onbloque] blockCurrent failed", e);
    return { ok: false, message: "Erreur : " + e };
  }
}

async function run() {
  if (running) return;
  running = true;
  stopRequested = false;

  const platform = currentPlatform();
  let st = await getState();
  if (!st) return (running = false);

  st.status = "running";
  st.message = "";
  await setState(st);

  while (st.queue.length && !stopRequested) {
    const handle = st.queue[0];
    let r;
    try {
      r = await platform.block(handle);
    } catch (e) {
      console.error("[onbloque] block failed for", handle, e);
      st.errors = (st.errors || 0) + 1;
      if (st.errors >= 3) {
        // Give up on this handle instead of retrying forever.
        st.errors = 0;
        r = { ok: false, status: 0, error: String(e) };
        st.message = "Erreur réseau sur @" + handle + " : " + e;
      } else {
        st.message = "Erreur (" + e + "), nouvel essai…";
        r = { ok: false, status: 0, retryAfterMs: 10_000 };
      }
      await setState(st);
    }

    if (r.fatal) {
      st.status = "error";
      st.message = r.fatal;
      break;
    }
    if (r.retryAfterMs) {
      st.status = "waiting";
      if (r.status === 429) {
        st.message = "Limite atteinte, reprise dans " + Math.round(r.retryAfterMs / 60000) + " min.";
      }
      await setState(st);
      await sleep(r.retryAfterMs);
      if (stopRequested) break;
      st.status = "running";
      continue; // retry same handle
    }

    st.errors = 0;
    st.queue.shift();
    (r.ok ? st.done : st.failed).push(handle);
    await setState(st);
    await sleep((platform.delay || defaultDelay)());
  }

  if (st.status === "running") {
    st.status = stopRequested ? "Arrêté" : "Terminé";
  }
  await setState(st);
  running = false;
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type === "start") {
    run();
    reply({ ok: true });
  } else if (msg.type === "blockCurrent") {
    blockCurrent().then(reply);
    return true; // async reply
  } else if (msg.type === "stop") {
    stopRequested = true;
    reply({ ok: true });
  }
});
