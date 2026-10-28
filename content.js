// Queue runner. Lives in the x.com tab; progress is mirrored to storage so the
// popup can show it (and survive being closed).
const STATE_KEY = "state";
let running = false;
let stopRequested = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 1500 + Math.random() * 2500;

async function getState() {
  return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || null;
}
const setState = (s) => chrome.storage.local.set({ [STATE_KEY]: s });

async function run() {
  if (running) return;
  running = true;
  stopRequested = false;

  const platform = globalThis.__blockPlatforms.x;
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
      r = { ok: false, status: 0, retryAfterMs: 30_000 };
    }

    if (r.fatal) {
      st.status = "error";
      st.message = r.fatal;
      break;
    }
    if (r.retryAfterMs) {
      st.status = "waiting";
      st.message = "Limite atteinte, reprise dans " + Math.round(r.retryAfterMs / 60000) + " min.";
      await setState(st);
      await sleep(r.retryAfterMs);
      if (stopRequested) break;
      st.status = "running";
      st.message = "";
      continue; // retry same handle
    }

    st.queue.shift();
    (r.ok ? st.done : st.failed).push(handle);
    await setState(st);
    await sleep(jitter());
  }

  if (st.status === "running") {
    st.status = stopRequested ? "stopped" : "finished";
  }
  await setState(st);
  running = false;
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type === "start") {
    run();
    reply({ ok: true });
  } else if (msg.type === "stop") {
    stopRequested = true;
    reply({ ok: true });
  }
});
