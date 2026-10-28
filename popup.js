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
    const h = String(raw).replace(/#.*/, "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter|instagram)\.com\//, "").replace(/\/$/, "");
    if (/^[\w.]{1,30}$/.test(h)) seen.add(h);
  }
  return [...seen];
}

const NETWORKS = { "instagram.com": "Instagram", "x.com": "X", "twitter.com": "X" };

function networkOf(url) {
  try {
    return NETWORKS[new URL(url).hostname.replace(/^www\./, "")] || null;
  } catch {
    return null;
  }
}

async function activeXTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && /^https:\/\/(www\.)?(x|twitter|instagram)\.com\//.test(tab.url || "") ? tab : null;
}

function render(st) {
  if (!st) return ($("status").textContent = "");
  $("status").textContent =
    `État : ${st.status}\nBloqués : ${st.done.length} · Échecs : ${st.failed.length} · Restants : ${st.queue.length}` +
    (st.queue.length && st.status === "running" ? `\nEn cours : @${st.queue[0]}` : "") +
    (st.message ? `\n${st.message}` : "");
}

$("start").onclick = async () => {
  const tab = await activeXTab();
  if (!tab) return ($("status").textContent = "Ouvrez un réseau social compatible dans l'onglet actif.");

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
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "start" });
  } catch {
    // Tab was opened before the extension was loaded/updated: no content script in it.
    st.status = "error";
    st.message = "Script absent de cet onglet : rechargez la page (F5) puis relancez.";
    await chrome.storage.local.set({ state: st });
  }
};

$("stop").onclick = async () => {
  const tab = await activeXTab();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: "stop" });
};

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const net = tab && networkOf(tab.url);
  $("hint").textContent = net
    ? `Réseau détecté : ${net}. \rLes blocages sont faits depuis votre compte connecté, lentement, pour éviter les limites.`
    : "\rOuvrez un réseau social compatible, connecté à votre compte, puis lancez.";
})();

chrome.storage.onChanged.addListener((c) => c.state && render(c.state.newValue));
chrome.storage.local.get("state").then((r) => render(r.state));
