// Rendering shared by the server (first paint, no-JS) and the browser (live
// arrivals), so a trace looks the same whichever path drew it.

/** @typedef {"dream" | "illusion" | "bubble" | "shadow" | "dew" | "lightning"} Kind */
/** @typedef {{ id: number, kind: Kind, text: string, createdAt: number, mine: boolean }} PublicTrace */

/** @type {Record<Kind, { hanzi: string, name: string, gloss: string, motif: string }>} */
export const KIND_META = {
  dream: {
    hanzi: "夢",
    name: "Dream",
    gloss: "Vivid while it lasts, gone on waking.",
    motif: '<circle class="m-a" cx="9.5" cy="13" r="5"/><circle class="m-b" cx="15" cy="9.5" r="4"/>',
  },
  illusion: {
    hanzi: "幻",
    name: "Illusion",
    gloss: "Looks solid from here, and isn't quite what it seems.",
    motif:
      '<rect class="m-a" x="4.5" y="5.5" width="11" height="11" rx="3"/><rect class="m-b" x="8.5" y="8.5" width="11" height="11" rx="3"/>',
  },
  bubble: {
    hanzi: "泡",
    name: "Bubble",
    gloss: "Bright, round and already about to burst.",
    motif: '<path class="m-a" d="M17.7 6.3A8 8 0 1 1 13 4.1"/><circle class="m-ring" cx="12" cy="12" r="8"/>',
  },
  shadow: {
    hanzi: "影",
    name: "Shadow",
    gloss: "Cast by something else, with no weight of its own.",
    motif:
      '<circle class="m-b m-fill" cx="14.5" cy="14" r="5.5"/><circle class="m-a" cx="10" cy="10" r="5.5"/>',
  },
  dew: {
    hanzi: "露",
    name: "Dew",
    gloss: "Here this morning, gone by noon.",
    motif:
      '<path class="m-a" d="M12 3.5c3.2 4.6 5.5 7.6 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.9 2.3-5.9 5.5-10.5z"/><path class="m-b" d="M9.6 14.6a2.6 2.6 0 0 0 2.4 2.4"/>',
  },
  lightning: {
    hanzi: "電",
    name: "Lightning",
    gloss: "Sudden, bright, and over before you've looked.",
    motif: '<path class="m-a" pathLength="1" d="M14.5 3 8.5 12.5h6L9.5 21"/>',
  },
};

export const KINDS = /** @type {Kind[]} */ (Object.keys(KIND_META));

/** @param {string} s */
export function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** @param {Kind} kind */
export function motifSvg(kind) {
  return `<svg class="motif motif-${kind}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${KIND_META[kind].motif}</svg>`;
}

/** @param {number} ms @param {number} [now] */
export function relativeTime(ms, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** @param {number} ms */
export function fullTime(ms) {
  return new Date(ms).toLocaleString("en-AU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });
}

/** @param {PublicTrace} t */
export function kindLabel(t) {
  const m = KIND_META[t.kind];
  return `<span class="kind-name"><span lang="zh-Hant">${m.hanzi}</span> ${m.name}</span>`;
}

/**
 * One wall item. The "Read" link works without JavaScript (it's a real page
 * at /t/<id>); the save control only appears once the script is running.
 * @param {PublicTrace} t
 */
export function renderTraceItem(t) {
  const owner = t.mine ? `<span class="owner">yours</span>` : "";
  return `<li class="trace kind-${t.kind}${t.mine ? " mine" : ""}" id="trace-${t.id}" data-id="${t.id}">
  ${motifSvg(t.kind)}
  <div class="trace-body">
    <p class="trace-meta">${kindLabel(t)}<time datetime="${new Date(t.createdAt).toISOString()}" title="${escapeHtml(fullTime(t.createdAt))}" data-ts="${t.createdAt}">${relativeTime(t.createdAt)}</time>${owner}</p>
    <p class="trace-text">${escapeHtml(t.text)}</p>
    <p class="trace-actions"><a class="read" href="/t/${t.id}">Read<span class="visually-hidden"> this ${KIND_META[t.kind].name.toLowerCase()} trace</span></a><button type="button" class="save js-only" data-save="${t.id}" aria-pressed="false"><span class="save-label">Save</span><span class="visually-hidden"> this trace</span></button></p>
  </div>
</li>`;
}
