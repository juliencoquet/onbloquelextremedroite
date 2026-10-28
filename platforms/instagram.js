// Adapter for Instagram web. Instead of calling Instagram's internal API directly (which got
// throttled with 429s), it drives the page like a person would: open the profile, "..." menu,
// Block, confirm. The site's own code then sends the requests with its own tokens.
//
// A profile that isn't open yet is reached by returning { navigate: url }: content.js stores
// a resume flag, loads the URL, and the content script on the new page carries on.
(function () {
  const NAV_KEY = "onbloque_nav";

  // Button / aria-label wording by UI language (en, fr, es, de, it, pt).
  const OPTIONS = ["options", "opciones", "optionen", "opzioni", "opções", "opcoes"];
  const BLOCK = ["block", "bloquer", "bloquear", "blockieren", "blocca"];
  const UNBLOCK = ["unblock", "débloquer", "debloquer", "desbloquear", "entsperren", "sblocca"];
  const CANCEL = ["cancel", "annuler", "cancelar", "abbrechen", "annulla"];
  // Acknowledgement buttons on the dialog Instagram may show after a block.
  const DISMISS = [
    "dismiss", "ok", "close", "got it", "fermer", "ignorer", "rejeter", "compris", "cerrar",
    "entendido", "schließen", "schliessen", "chiudi", "fechar",
  ];
  const THROTTLED = [
    "try again later", "action blocked", "réessayer plus tard", "action bloquée",
    "vuelve a intentarlo más tarde", "später erneut versuchen",
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pause = () => sleep(400 + Math.random() * 500);
  const norm = (t) => (t || "").trim().toLowerCase().replace(/\s+/g, " ");

  async function waitFor(fn, timeout = 10_000) {
    const end = Date.now() + timeout;
    while (Date.now() < end && !globalThis.__onbloqueCancel) {
      const v = fn();
      if (v) return v;
      await sleep(250);
    }
    return null;
  }

  const buttons = (root) => [...root.querySelectorAll('button, [role="button"]')];
  const hasWord = (b, words, handle) => {
    const t = norm(b.textContent);
    return words.includes(t) || (handle && words.some((w) => t === w + " " + handle || t === w + " @" + handle));
  };

  function optionsButton() {
    for (const svg of document.querySelectorAll("header svg[aria-label]")) {
      if (OPTIONS.includes(norm(svg.getAttribute("aria-label")))) {
        return svg.closest('button, [role="button"]') || svg.parentElement;
      }
    }
    return null;
  }

  const unblockButton = () => buttons(document).find((b) => UNBLOCK.includes(norm(b.textContent)));

  const dialogs = () => [...document.querySelectorAll('[role="dialog"]')];
  const throttled = () => dialogs().some((d) => THROTTLED.some((w) => norm(d.textContent).includes(w)));

  const RESERVED = new Set(["explore", "reels", "reel", "p", "direct", "accounts", "stories", "about", "legal", "web", "tv", "challenge"]);
  function currentHandle() {
    const seg = location.pathname.split("/")[1];
    return seg && !RESERVED.has(seg.toLowerCase()) && /^[\w.]{1,30}$/.test(seg) ? seg : null;
  }

  // Click a post-block acknowledgement ("Dismiss", "OK", ...) if one is showing.
  // Dialogs that still offer Block/Unblock/Cancel are left alone.
  function dismissDialog() {
    for (const d of dialogs()) {
      const bs = buttons(d);
      if (bs.some((b) => hasWord(b, [...BLOCK, ...UNBLOCK, ...CANCEL]))) continue;
      const ok = bs.find((b) => DISMISS.includes(norm(b.textContent)));
      if (ok) {
        ok.click();
        return true;
      }
    }
    return false;
  }

  // Dismiss an open menu without choosing anything.
  async function closeMenu() {
    const cancel = dialogs().flatMap(buttons).find((b) => CANCEL.includes(norm(b.textContent)));
    if (cancel) cancel.click();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await pause();
  }

  async function block(handle) {
    if (!document.cookie.includes("ds_user_id=")) {
      return { ok: false, status: 401, fatal: "Non connecté à Instagram." };
    }

    // Reach the profile first. If we were already sent there and still aren't on it
    // (renamed, removed, redirected to login), skip rather than loop.
    if ((currentHandle() || "").toLowerCase() !== handle.toLowerCase()) {
      if (sessionStorage.getItem(NAV_KEY) === handle) {
        sessionStorage.removeItem(NAV_KEY);
        return { ok: false, status: 404 };
      }
      sessionStorage.setItem(NAV_KEY, handle);
      return { navigate: "https://www.instagram.com/" + encodeURIComponent(handle) + "/" };
    }
    sessionStorage.removeItem(NAV_KEY);

    // Wait for the profile to render: either the "..." menu, or an Unblock button (already blocked).
    const opts = await waitFor(() => optionsButton() || unblockButton(), 15_000);
    if (!opts) return { ok: false, status: 404 }; // page unavailable / no profile header
    if (unblockButton()) return { ok: true, status: 200, already: true };

    await pause();
    opts.click();

    // Menu dialog -> "Block". An already-blocked profile offers "Unblock" here instead:
    // report that as "already blocked" rather than waiting for a button that won't come.
    const menuButtons = () => dialogs().flatMap(buttons);
    const menuChoice = await waitFor(
      () =>
        menuButtons().find((b) => hasWord(b, BLOCK, handle.toLowerCase())) ||
        menuButtons().find((b) => hasWord(b, UNBLOCK, handle.toLowerCase())),
      8_000
    );
    if (!menuChoice) return { ok: false, status: 0 };
    if (hasWord(menuChoice, UNBLOCK, handle.toLowerCase())) {
      await closeMenu();
      return { ok: true, status: 200, already: true };
    }
    await pause();
    menuChoice.click();

    // Confirmation dialog ("Block <handle>?") -> "Block". It mentions the handle, which tells it
    // apart from the menu it replaces.
    const confirm = await waitFor(() => {
      if (throttled()) return "throttled";
      return dialogs()
        .filter((d) => norm(d.textContent).includes(handle.toLowerCase()))
        .flatMap(buttons)
        .find((b) => hasWord(b, BLOCK, handle.toLowerCase()));
    }, 8_000);
    if (confirm === "throttled") {
      return { ok: false, status: 429, fatal: "Instagram limite temporairement les actions : arrêt. Réessayez plus tard." };
    }
    if (!confirm) return { ok: false, status: 0 };
    await pause();
    confirm.click();

    // Success = the profile now offers "Unblock". A "Dismiss"-style dialog may pop up first:
    // click it away so it doesn't hold the page.
    const done = await waitFor(() => {
      if (throttled()) return "throttled";
      dismissDialog();
      return unblockButton();
    }, 10_000);
    if (done === "throttled") {
      return { ok: false, status: 429, fatal: "Instagram limite temporairement les actions : arrêt. Réessayez plus tard." };
    }
    // Clear any acknowledgement that appeared after the Unblock button did.
    await sleep(500);
    for (let i = 0; i < 3 && dismissDialog(); i++) await sleep(500);
    return done ? { ok: true, status: 200 } : { ok: false, status: 0 };
  }

  // Page loads and menu clicks are slow anyway; keep a human-ish gap between profiles.
  const delay = () => 8000 + Math.random() * 8000;

  (globalThis.__blockPlatforms ||= {}).instagram = { id: "instagram", block, delay, currentHandle };
})();
