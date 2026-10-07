// The wall's enhanced behaviour: live arrivals, the shared scene, writing,
// browsing, private bookmarks, the reader and appearance settings. The page
// already works without this file; everything here is layered on top.
import { KIND_META, KINDS, fullTime, motifSvg, relativeTime, renderTraceItem } from "./shared.js";

/** @typedef {import("./shared.js").PublicTrace} PublicTrace */
/** @typedef {import("./shared.js").Kind} Kind */

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const root = document.documentElement;

// ---------------------------------------------------------------- storage
// Either storage can be missing or throw (private modes, blocked cookies).
// Every caller keeps working without it.
/** @param {"localStorage" | "sessionStorage"} which */
function storage(which) {
  /** @type {Storage | null} */
  let s = null;
  try {
    s = window[which];
    const probe = "liuru:probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
  } catch {
    s = null;
  }
  return {
    available: s !== null,
    /** @param {string} k */
    get(k) {
      try {
        return s ? s.getItem(k) : null;
      } catch {
        return null;
      }
    },
    /** @param {string} k @param {string} v */
    set(k, v) {
      try {
        s?.setItem(k, v);
        return s !== null;
      } catch {
        return false;
      }
    },
    /** @param {string} k */
    remove(k) {
      try {
        s?.removeItem(k);
      } catch {
        /* nothing to do */
      }
    },
  };
}
const local = storage("localStorage");
const session = storage("sessionStorage");

// ---------------------------------------------------------------- model
const initial = JSON.parse($("wall-data").textContent ?? "{}");
/** @type {Map<number, PublicTrace>} */
const traces = new Map(initial.traces.map((/** @type {PublicTrace} */ t) => [t.id, t]));
// The highest id received in order from the server (page render or event
// stream). A trace learned from our own POST response doesn't move it, so a
// reconnect still replays anything posted in between.
let streamLastId = initial.lastId;

const wall = /** @type {HTMLOListElement} */ ($("wall"));
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const motionAllowed = () => !reducedMotion.matches && root.dataset.motion !== "off";

/** @param {number} id */
const itemFor = (id) => /** @type {HTMLLIElement | null} */ (document.getElementById(`trace-${id}`));

// ---------------------------------------------------------------- announcer
// Polite, batched: a burst of arrivals is one sentence, never the whole wall.
const announcer = $("announcer");
/** @type {string[]} */
let pending = [];
/** @type {number | undefined} */
let announceTimer;
/** @param {string} message */
function announce(message) {
  pending.push(message);
  clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => {
    announcer.textContent = pending.length === 1 ? pending[0] : `${pending.length} new thoughts arrived on the wall.`;
    pending = [];
  }, 1200);
}

// ---------------------------------------------------------------- bookmarks
const SAVED_KEY = "liuru:saved";
/** @type {Set<number>} */
const saved = new Set();
try {
  for (const id of JSON.parse(local.get(SAVED_KEY) ?? "[]")) if (Number.isInteger(id)) saved.add(id);
} catch {
  /* a corrupt entry is treated as no bookmarks */
}

/** @param {HTMLButtonElement} button @param {boolean} on */
function paintSave(button, on) {
  button.setAttribute("aria-pressed", String(on));
  const label = button.querySelector(".save-label") ?? button;
  label.textContent = on ? "Saved" : "Save";
}

/** @param {number} id */
function toggleSave(id) {
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  const stored = local.set(SAVED_KEY, JSON.stringify([...saved]));
  const on = saved.has(id);
  const button = itemFor(id)?.querySelector("button.save");
  if (button) paintSave(/** @type {HTMLButtonElement} */ (button), on);
  if (readerId === id) paintSave(readerSave, on);
  if (!stored) {
    setText(
      readerOpen() ? "reader-status" : "encounter-status",
      "This browser isn’t keeping bookmarks, so this one lasts until you leave the page.",
    );
  }
  if (state.scope === "saved") applyFilters();
}

// ---------------------------------------------------------------- filters
const state = { kind: "all", scope: "everyone", q: "" };
/** @param {string} s */
const fold = (s) => s.normalize("NFKC").toLocaleLowerCase();

/** @param {PublicTrace} t */
function matches(t) {
  if (state.kind !== "all" && t.kind !== state.kind) return false;
  if (state.scope === "yours" && !t.mine) return false;
  if (state.scope === "saved" && !saved.has(t.id)) return false;
  if (state.q) {
    const m = KIND_META[t.kind];
    const hay = fold(`${t.text} ${m.name} ${m.hanzi}`);
    if (!hay.includes(state.q)) return false;
  }
  return true;
}

const filtering = () => state.kind !== "all" || state.scope !== "everyone" || state.q !== "";

/** @type {number | undefined} */
let resultsTimer;
function applyFilters() {
  let shown = 0;
  for (const li of wall.querySelectorAll("li.trace")) {
    const t = traces.get(Number(/** @type {HTMLElement} */ (li).dataset.id));
    const visible = t !== undefined && matches(t);
    /** @type {HTMLElement} */ (li).hidden = !visible;
    if (visible) shown++;
  }
  const total = traces.size;
  $("saved-note").hidden = state.scope !== "saved";
  const none = total > 0 && shown === 0;
  $("no-results").hidden = !none;
  if (none) $("no-results-text").textContent = noResultsText();
  $("clear-filters").hidden = !filtering();
  // The count is for orientation while searching, so it's only shown then,
  // and announced after typing settles rather than on every keystroke.
  clearTimeout(resultsTimer);
  resultsTimer = window.setTimeout(() => {
    $("results").textContent = filtering() && total > 0 ? `${shown} of ${total} thoughts match, newest first.` : "";
  }, 350);
}

function noResultsText() {
  const kind = state.kind === "all" ? "thoughts" : `${KIND_META[/** @type {Kind} */ (state.kind)].name.toLowerCase()} thoughts`;
  if (state.scope === "saved" && saved.size === 0) return "You haven’t saved anything in this browser yet. Use Save on any thought to keep it here.";
  if (state.scope === "yours" && ![...traces.values()].some((t) => t.mine)) return "Nothing on the wall is yours yet, at least not from this browser.";
  const where = state.scope === "yours" ? " of yours" : state.scope === "saved" ? " you’ve saved" : "";
  const q = state.q ? ` containing “${/** @type {HTMLInputElement} */ ($("search")).value.trim()}”` : "";
  return `No ${kind}${where}${q}.`;
}

function clearFilters() {
  state.kind = "all";
  state.scope = "everyone";
  state.q = "";
  for (const r of document.querySelectorAll('input[name="show-kind"], input[name="scope"]')) {
    const input = /** @type {HTMLInputElement} */ (r);
    input.checked = input.value === "all" || input.value === "everyone";
  }
  /** @type {HTMLInputElement} */ ($("search")).value = "";
  applyFilters();
}

document.querySelector(".browse")?.addEventListener("change", (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  if (input.name === "show-kind") state.kind = input.value;
  else if (input.name === "scope") state.scope = input.value;
  else return;
  applyFilters();
});
$("search").addEventListener("input", (e) => {
  state.q = fold(/** @type {HTMLInputElement} */ (e.target).value.trim());
  applyFilters();
});
$("clear-filters").addEventListener("click", () => {
  clearFilters();
  /** @type {HTMLInputElement} */ ($("search")).focus();
});
$("no-results-clear").addEventListener("click", () => {
  clearFilters();
  $("wall-heading").focus();
});

// ---------------------------------------------------------------- wall
/** @param {HTMLElement} li */
function prepareItem(li) {
  const id = Number(li.dataset.id);
  const button = li.querySelector("button.save");
  if (button) paintSave(/** @type {HTMLButtonElement} */ (button), saved.has(id));
}

/**
 * Puts a trace into the wall in id order. Returns false if it was already
 * there, so a trace seen through both our POST and the stream lands once.
 * @param {PublicTrace} t @param {boolean} fresh
 */
function insertTrace(t, fresh) {
  if (itemFor(t.id)) return false;
  traces.set(t.id, t);
  wall.querySelector("li.empty")?.remove();

  const tpl = document.createElement("template");
  tpl.innerHTML = renderTraceItem(t);
  const li = /** @type {HTMLLIElement} */ (tpl.content.firstElementChild);
  prepareItem(li);
  li.hidden = !matches(t);

  // Hold the reader's place: if they've scrolled into the list, keep the item
  // they're looking at where it is rather than pushing it down the screen.
  const scrolledIn = wall.getBoundingClientRect().top < 0;
  const anchor = scrolledIn
    ? [...wall.querySelectorAll("li.trace:not([hidden])")].find((el) => el.getBoundingClientRect().bottom > 0)
    : undefined;
  const before = anchor?.getBoundingClientRect().top;

  const next = [...wall.querySelectorAll("li.trace")].find((el) => Number(/** @type {HTMLElement} */ (el).dataset.id) < t.id);
  wall.insertBefore(li, next ?? null);

  if (anchor && before !== undefined) {
    const delta = anchor.getBoundingClientRect().top - before;
    if (delta) window.scrollBy(0, delta);
  }
  if (fresh && motionAllowed() && !li.hidden) {
    li.classList.add("arrived");
    window.setTimeout(() => li.classList.remove("arrived"), 1600);
  }
  applyFilters();
  return true;
}

for (const li of wall.querySelectorAll("li.trace")) prepareItem(/** @type {HTMLElement} */ (li));

wall.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  const save = target.closest("button.save");
  if (save) {
    toggleSave(Number(/** @type {HTMLElement} */ (save).dataset.save));
    return;
  }
  const read = target.closest("a.read");
  const me = /** @type {MouseEvent} */ (e);
  if (read && !me.metaKey && !me.ctrlKey && !me.shiftKey && !me.altKey) {
    e.preventDefault();
    const li = /** @type {HTMLElement} */ (read.closest("li.trace"));
    openReader(Number(li.dataset.id), false);
  }
});

// Passing time is a presentation matter: labels refresh, nothing expires.
window.setInterval(() => {
  const now = Date.now();
  for (const time of document.querySelectorAll("time[data-ts]")) {
    time.textContent = relativeTime(Number(/** @type {HTMLElement} */ (time).dataset.ts), now);
  }
}, 60_000);

// ---------------------------------------------------------------- scene
// Each genuinely new trace leaves its motif in the "Passing now" field for
// about twenty seconds. Placement comes from the trace id, so every open tab
// puts the same mark in the same spot.
const SVG_NS = "http://www.w3.org/2000/svg";
const ACCENT_LIFE_MS = 20_000;
const MAX_ACCENTS = 8;
const accents = /** @type {SVGGElement} */ (/** @type {unknown} */ (document.querySelector(".scene-accents")));
const scene = /** @type {HTMLElement} */ (document.querySelector(".scene"));

/** @param {number} id */
function placement(id) {
  let h = (id * 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return { x: 26 + (h % 268), y: 26 + ((h >>> 11) % 88), r: ((h >>> 5) % 30) - 15 };
}

/** @param {PublicTrace} t */
function addAccent(t) {
  if (document.hidden) return;
  const { x, y, r } = placement(t.id);
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", `accent accent-${t.kind}${motionAllowed() ? "" : " still"}`);
  g.setAttribute("transform", `translate(${x} ${y}) rotate(${r})`);
  g.innerHTML = `<g class="accent-motif" transform="scale(1.7) translate(-12 -12)">${KIND_META[t.kind].motif}</g>`;
  accents.append(g);
  while (accents.childElementCount > MAX_ACCENTS) accents.firstElementChild?.remove();
  scene.classList.add("has-accents");
  window.setTimeout(() => {
    g.remove();
    if (!accents.childElementCount) scene.classList.remove("has-accents");
  }, ACCENT_LIFE_MS);
}

const syncHidden = () => root.classList.toggle("page-hidden", document.hidden);
document.addEventListener("visibilitychange", syncHidden);
syncHidden();

// ---------------------------------------------------------------- live
const connection = $("connection");
/** @param {"connecting" | "live" | "reconnecting" | "offline"} s */
function setConnection(s) {
  connection.dataset.state = s;
  const text = {
    connecting: "connecting…",
    live: "live",
    reconnecting: "reconnecting…",
    offline: "offline · will catch up",
  }[s];
  /** @type {HTMLElement} */ (connection.querySelector(".connection-text")).textContent = text;
}

/** @type {EventSource | undefined} */
let source;
let backoff = 1000;
/** @type {number | undefined} */
let retryTimer;
let everLive = false;
let recoveredCount = 0;

/** @param {PublicTrace & { recovered: boolean }} t */
function receive(t) {
  streamLastId = Math.max(streamLastId, t.id);
  const fresh = !t.recovered;
  if (!insertTrace(t, fresh)) return;
  if (!fresh) {
    recoveredCount++;
    return;
  }
  addAccent(t);
  if (!t.mine) {
    const m = KIND_META[t.kind];
    announce(
      matches(t)
        ? `New ${m.name.toLowerCase()}: ${t.text.length > 90 ? `${t.text.slice(0, 90)}…` : t.text}`
        : `A new ${m.name.toLowerCase()} arrived, outside your current filter.`,
    );
  }
}

function connect() {
  clearTimeout(retryTimer);
  source?.close();
  setConnection(everLive ? "reconnecting" : "connecting");
  const es = new EventSource(`/events?after=${streamLastId}`);
  source = es;
  es.addEventListener("trace", (e) => receive(JSON.parse(/** @type {MessageEvent} */ (e).data)));
  es.addEventListener("ready", () => {
    backoff = 1000;
    if (everLive && recoveredCount > 0) {
      announce(`${recoveredCount} ${recoveredCount === 1 ? "thought" : "thoughts"} arrived while you were away.`);
    }
    recoveredCount = 0;
    everLive = true;
    setConnection("live");
  });
  es.addEventListener("error", () => {
    setConnection(navigator.onLine ? "reconnecting" : "offline");
    // The browser retries by itself unless the server answered with an
    // error (Fly's proxy does while the app restarts); then we start over.
    if (es.readyState === EventSource.CLOSED) {
      retryTimer = window.setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    }
  });
}
window.addEventListener("offline", () => setConnection("offline"));
window.addEventListener("online", () => {
  if (source?.readyState === EventSource.OPEN) setConnection("live");
  else connect();
});
connect();

// ---------------------------------------------------------------- composer
const form = /** @type {HTMLFormElement} */ (document.querySelector("form.trace-form"));
const textarea = /** @type {HTMLTextAreaElement} */ ($("trace-text"));
const submit = /** @type {HTMLButtonElement} */ ($("submit"));
const discard = /** @type {HTMLButtonElement} */ ($("discard"));
const DRAFT_KEY = "liuru:draft";
const MAX = 240;
// Inline messages replace the browser's validation bubbles once JS runs.
form.noValidate = true;
let sending = false;
let submissionKey = newKey();

function newKey() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** @param {string} id @param {string} text @param {string} [tone] */
function setText(id, text, tone) {
  const el = $(id);
  el.textContent = text;
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

const chosenKind = () => /** @type {HTMLInputElement | null} */ (form.querySelector('input[name="kind"]:checked'))?.value ?? "";

function paintGloss() {
  const kind = /** @type {Kind | ""} */ (chosenKind());
  $("kind-gloss").textContent = kind ? `${KIND_META[kind].hanzi} ${KIND_META[kind].name}: ${KIND_META[kind].gloss}` : "Choose the one it feels closest to.";
}

function paintCount() {
  // The server trims, then keeps 240 UTF-16 units; maxlength counts the same
  // units, so this is the number it will actually store.
  const n = textarea.value.trim().length;
  const el = $("char-count");
  el.textContent = `${n} of ${MAX} characters`;
  el.dataset.tone = n >= MAX ? "limit" : n >= MAX - 20 ? "near" : "";
}

function hasDraft() {
  return textarea.value.trim() !== "" || chosenKind() !== "";
}

function saveDraft() {
  discard.hidden = !hasDraft();
  if (!hasDraft()) {
    session.remove(DRAFT_KEY);
    setText("draft-status", "");
    return;
  }
  const ok = session.set(DRAFT_KEY, JSON.stringify({ kind: chosenKind(), text: textarea.value, key: submissionKey }));
  setText("draft-status", ok ? "Draft kept in this tab" : "Drafts can’t be kept in this browser");
}

function restoreDraft() {
  try {
    const draft = JSON.parse(session.get(DRAFT_KEY) ?? "null");
    if (!draft) return;
    if (typeof draft.text === "string") textarea.value = draft.text.slice(0, MAX);
    if (KINDS.includes(draft.kind)) {
      /** @type {HTMLInputElement} */ (form.querySelector(`input[name="kind"][value="${draft.kind}"]`)).checked = true;
    }
    if (typeof draft.key === "string") submissionKey = draft.key;
    if (hasDraft()) setText("draft-status", "Draft restored in this tab");
    discard.hidden = !hasDraft();
  } catch {
    session.remove(DRAFT_KEY);
  }
}

function clearDraft() {
  form.reset();
  session.remove(DRAFT_KEY);
  submissionKey = newKey();
  discard.hidden = true;
  setText("draft-status", "");
  paintCount();
  paintGloss();
}

form.addEventListener("change", (e) => {
  if (/** @type {HTMLInputElement} */ (e.target).name === "kind") {
    paintGloss();
    saveDraft();
  }
});
textarea.addEventListener("input", () => {
  paintCount();
  saveDraft();
});
discard.addEventListener("click", () => {
  clearDraft();
  setText("form-status", "Draft discarded.");
  textarea.focus();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (sending) return;
  const kind = chosenKind();
  const text = textarea.value.trim();
  if (!kind) {
    setText("form-status", "Choose one of the six kinds first.", "error");
    /** @type {HTMLInputElement} */ (form.querySelector('input[name="kind"]')).focus();
    return;
  }
  if (!text) {
    setText("form-status", "Write something first: even a few words.", "error");
    textarea.focus();
    return;
  }

  sending = true;
  submit.setAttribute("aria-disabled", "true");
  submit.textContent = "Letting go…";
  setText("form-status", "Sending…", "pending");
  try {
    const res = await fetch("/trace", {
      method: "POST",
      headers: { accept: "application/json" },
      body: new URLSearchParams({ kind, text, submissionKey }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.trace) {
      insertTrace(body.trace, true) && addAccent(body.trace);
      clearDraft();
      setText("form-status", "It’s on the wall now.", "ok");
    } else if (res.status === 400) {
      setText("form-status", `${body.error ?? "That couldn’t be saved."} Your draft is still here.`, "error");
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    // We can't tell whether it was stored. The draft keeps its submission
    // key, so sending again can't make a second copy.
    setText(
      "form-status",
      "Couldn’t confirm that it reached the wall. Your draft is still here; sending it again won’t make a duplicate.",
      "error",
    );
  } finally {
    sending = false;
    submit.removeAttribute("aria-disabled");
    submit.textContent = "Let it go";
  }
});

restoreDraft();
paintGloss();
paintCount();

// ---------------------------------------------------------------- reader
const reader = /** @type {HTMLDialogElement} */ ($("reader"));
const readerSave = /** @type {HTMLButtonElement} */ ($("reader-save"));
/** @type {number | null} */
let readerId = null;
/** @type {Element | null} */
let returnFocus = null;
let lastEncounter = -1;
const readerOpen = () => reader.open;

/** @param {number} id @param {boolean} encounter */
function openReader(id, encounter) {
  const t = traces.get(id);
  if (!t) return;
  readerId = id;
  const m = KIND_META[t.kind];
  reader.className = `reader kind-${t.kind}`;
  $("reader-title").innerHTML = `<span lang="zh-Hant">${m.hanzi}</span> ${m.name}`;
  /** @type {HTMLElement} */ (reader.querySelector(".reader-motif")).innerHTML = motifSvg(t.kind);
  $("reader-text").textContent = t.text;
  $("reader-meta").textContent = `${fullTime(t.createdAt)}${t.mine ? " · yours" : ""}`;
  paintSave(readerSave, saved.has(id));
  $("reader-another").hidden = !encounter || eligibleForEncounter().length < 2;
  $("copy-fallback").hidden = true;
  setText("reader-status", "");
  if (!reader.open) {
    returnFocus = document.activeElement;
    reader.showModal();
  }
  $("reader-close").focus();
}

reader.addEventListener("close", () => {
  readerId = null;
  if (location.pathname.startsWith("/t/")) history.replaceState(null, "", "/");
  const target =
    returnFocus instanceof HTMLElement && returnFocus.isConnected && returnFocus !== document.body
      ? returnFocus
      : $("wall-heading");
  target.focus();
});
reader.addEventListener("click", (e) => {
  if (e.target === reader) reader.close();
});
$("reader-close").addEventListener("click", () => reader.close());
readerSave.addEventListener("click", () => {
  if (readerId !== null) toggleSave(readerId);
});
$("reader-copy").addEventListener("click", async () => {
  if (readerId === null) return;
  const link = `${location.origin}/t/${readerId}`;
  try {
    if (!navigator.clipboard) throw new Error("no clipboard");
    await navigator.clipboard.writeText(link);
    setText("reader-status", "Link copied.", "ok");
    $("copy-fallback").hidden = true;
  } catch {
    const field = /** @type {HTMLInputElement} */ ($("copy-field"));
    field.value = link;
    $("copy-fallback").hidden = false;
    setText("reader-status", "Couldn’t copy automatically. The link is selected below.", "error");
    field.focus();
    field.select();
  }
});

// ---------------------------------------------------------------- encounter
function eligibleForEncounter() {
  return [...traces.values()].filter((t) => state.kind === "all" || t.kind === state.kind);
}

function encounter() {
  const pool = eligibleForEncounter();
  if (!pool.length) {
    const kind = state.kind === "all" ? "" : ` ${KIND_META[/** @type {Kind} */ (state.kind)].name.toLowerCase()}`;
    setText("encounter-status", `There are no${kind} thoughts to encounter yet.`);
    return;
  }
  setText("encounter-status", "");
  const choices = pool.length > 1 ? pool.filter((t) => t.id !== lastEncounter) : pool;
  const pick = choices[Math.floor(Math.random() * choices.length)];
  lastEncounter = pick.id;
  openReader(pick.id, true);
}
$("encounter").addEventListener("click", encounter);
$("reader-another").addEventListener("click", encounter);

// ---------------------------------------------------------------- settings
const settings = /** @type {HTMLDialogElement} */ ($("settings"));
const motionOff = /** @type {HTMLInputElement} */ ($("motion-off"));
$("open-settings").addEventListener("click", () => {
  const theme = root.dataset.theme ?? "system";
  for (const r of settings.querySelectorAll('input[name="theme"]')) {
    /** @type {HTMLInputElement} */ (r).checked = /** @type {HTMLInputElement} */ (r).value === theme;
  }
  motionOff.checked = root.dataset.motion === "off";
  if (!local.available) $("settings-storage").textContent = "This browser isn’t storing preferences, so these reset when you leave.";
  settings.showModal();
});
settings.addEventListener("close", () => $("open-settings").focus());
settings.addEventListener("click", (e) => {
  if (e.target === settings) settings.close();
});
settings.addEventListener("change", (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  if (input.name === "theme") {
    if (input.value === "system") {
      delete root.dataset.theme;
      local.remove("liuru:theme");
    } else {
      root.dataset.theme = input.value;
      local.set("liuru:theme", input.value);
    }
  } else if (input === motionOff) {
    if (motionOff.checked) {
      root.dataset.motion = "off";
      local.set("liuru:motion", "off");
    } else {
      delete root.dataset.motion;
      local.remove("liuru:motion");
    }
  }
});

// ---------------------------------------------------------------- direct links
const focusStatic = /** @type {HTMLElement | null} */ (document.querySelector(".focus-static[data-focus-id]"));
if (focusStatic) {
  const id = Number(focusStatic.dataset.focusId);
  focusStatic.remove();
  openReader(id, false);
}

applyFilters();
