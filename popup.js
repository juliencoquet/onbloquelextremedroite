const $ = (id) => document.getElementById(id);

const HANDLE_RE = { instagram: /^[\w.]{1,30}$/, x: /^\w{1,15}$/ };

// Accepts {"instagram": [...], "x": [...]}, a bare array, {"accounts": [...]}, or plain text
// (one per line). Only the list for `network` is kept; flat formats apply to the current network.
function parseList(text, network) {
  let items;
  try {
    const j = JSON.parse(text);
    items = Array.isArray(j) ? j : j[network] || j.accounts || j.handles || [];
  } catch {
    items = text.split(/\r?\n/);
  }
  const out = [];
  for (const raw of items) {
    const h = String(raw).replace(/#.*/, "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter|instagram)\.com\//, "").replace(/\/$/, "");
    if (HANDLE_RE[network].test(h)) out.push(h);
  }
  return out;
}

const NETWORKS = { "instagram.com": "instagram", "x.com": "x", "twitter.com": "x" };
const LABELS = { instagram: "Instagram", x: "X" };

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

  const network = networkOf(tab.url);
  const sources = [$("paste").value];
  if ($("url").value.trim()) {
    try {
      sources.push(await (await fetch($("url").value.trim())).text());
    } catch (e) {
      return ($("status").textContent = "Impossible de charger la liste : " + e.message);
    }
  }
  const prev = (await chrome.storage.local.get("state")).state;
  const prevDone = prev && prev.network === network ? prev.done : [];
  const skip = new Set(prevDone);
  const queue = [...new Set(sources.flatMap((t) => parseList(t, network)))].filter((h) => !skip.has(h));
  if (!queue.length) return ($("status").textContent = `Aucun pseudo ${LABELS[network]} valide (ou déjà tous bloqués).`);

  const st = { status: "running", network, queue, done: prevDone, failed: [], message: "" };
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

$("current").onclick = async () => {
  const tab = await activeXTab();
  if (!tab) return ($("status").textContent = "Ouvrez un réseau social compatible dans l'onglet actif.");
  $("status").textContent = "Blocage du profil affiché…";
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: "blockCurrent" });
    $("status").textContent = r.message;
  } catch {
    $("status").textContent = "Script absent de cet onglet : rechargez la page (F5) puis réessayez.";
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
    ? `Réseau détecté : ${LABELS[net]}. \rLes blocages sont faits depuis votre compte connecté, lentement, pour éviter les limites.`
    : "\rOuvrez un réseau social compatible, connecté à votre compte, puis lancez.";
})();

chrome.storage.onChanged.addListener((c) => c.state && render(c.state.newValue));
chrome.storage.local.get("state").then((r) => render(r.state));
