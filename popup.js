const $ = (id) => document.getElementById(id);

function parseList(text) {
  let items;
  try {
    const j = JSON.parse(text);
    items = Array.isArray(j) ? j : j.accounts || j.handles || [];
  } catch {
    items = text.split(/\r?\n/);
  }
  const seen = new Set();
  for (const raw of items) {
    const h = String(raw).replace(/#.*/, "").trim().replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "");
    if (/^\w{1,15}$/.test(h)) seen.add(h);
  }
  return [...seen];
}

async function activeXTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && /^https:\/\/(x|twitter)\.com\//.test(tab.url || "") ? tab : null;
}

function render(st) {
  if (!st) return ($("status").textContent = "");
  $("status").textContent =
    `État : ${st.status}\nBloqués : ${st.done.length} · Échecs : ${st.failed.length} · Restants : ${st.queue.length}` +
    (st.message ? `\n${st.message}` : "");
}

$("start").onclick = async () => {
  const tab = await activeXTab();
  if (!tab) return ($("status").textContent = "Ouvrez un onglet x.com d'abord.");

  let text = $("paste").value;
  if ($("url").value.trim()) {
    try {
      text += "\n" + (await (await fetch($("url").value.trim())).text());
    } catch (e) {
      return ($("status").textContent = "Impossible de charger la liste : " + e.message);
    }
  }
  const prev = (await chrome.storage.local.get("state")).state;
  const skip = new Set(prev ? prev.done : []);
  const queue = parseList(text).filter((h) => !skip.has(h));
  if (!queue.length) return ($("status").textContent = "Aucun pseudo valide (ou déjà tous bloqués).");

  const st = { status: "running", queue, done: prev ? prev.done : [], failed: [], message: "" };
  await chrome.storage.local.set({ state: st });
  chrome.tabs.sendMessage(tab.id, { type: "start" });
};

$("stop").onclick = async () => {
  const tab = await activeXTab();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "stop" });
};

chrome.storage.onChanged.addListener((c) => c.state && render(c.state.newValue));
chrome.storage.local.get("state").then((r) => render(r.state));
