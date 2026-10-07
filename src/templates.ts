import {
  KIND_META,
  KINDS,
  escapeHtml,
  fullTime,
  kindLabel,
  motifSvg,
  renderTraceItem,
  type PublicTrace,
} from "./public/shared.js";

export { escapeHtml };

// Runs before first paint so a stored appearance choice never flashes the
// wrong theme. Storage can be unavailable (private modes, blocked cookies):
// then the system preference simply stands.
const bootScript = `document.documentElement.classList.replace("no-js","js");try{var t=localStorage.getItem("liuru:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(localStorage.getItem("liuru:motion")==="off")document.documentElement.dataset.motion="off"}catch(e){}`;

const shell = (title: string, body: string, scripts = ""): string => `<!doctype html>
<html lang="en-AU" class="no-js">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="A small shared wall for passing thoughts, each one tagged as a dream, illusion, bubble, shadow, dew or lightning." />
    <script>${bootScript}</script>
    <link rel="stylesheet" href="/static/style.css" />
    ${scripts}
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <header class="masthead">
      <a class="wordmark" href="/" aria-label="六如, Liùrú: home"><span lang="zh-Hant">六如</span><span class="wordmark-latin">Liùrú</span></a>
      <nav class="site-nav" aria-label="Site">
        <a href="/readme/">About</a>
        <button type="button" class="js-only quiet-button" id="open-settings" aria-haspopup="dialog">Appearance</button>
      </nav>
    </header>
    ${body}
    <footer class="site-footer"><p>Every trace stays. Only the light around it passes. <a href="/readme/">What this is for</a></p></footer>
  </body>
</html>`;

function kindRadios(): string {
  return KINDS.map((k) => {
    const m = KIND_META[k];
    return `<label class="kind-option"><input type="radio" name="kind" value="${k}" required data-gloss="${escapeHtml(m.gloss)}" />${motifSvg(k)}<span><span lang="zh-Hant">${m.hanzi}</span> ${m.name}</span></label>`;
  }).join("");
}

function filterRadios(): string {
  const all = `<label class="chip"><input type="radio" name="show-kind" value="all" checked /><span>All</span></label>`;
  return (
    all +
    KINDS.map((k) => {
      const m = KIND_META[k];
      return `<label class="chip"><input type="radio" name="show-kind" value="${k}" />${motifSvg(k)}<span><span lang="zh-Hant">${m.hanzi}</span> ${m.name}</span></label>`;
    }).join("")
  );
}

// The quiet composition the scene rests in when nothing is arriving: the six
// motifs set along one ink line, never animated.
function sceneRest(): string {
  return KINDS.map(
    (k, i) =>
      `<g class="rest" transform="translate(${34 + i * 50} 98) scale(1.15)"><g transform="translate(-12 -12)">${KIND_META[k].motif}</g></g>`,
  ).join("");
}

// JSON inside a <script> block: escape "<" so text can never close the tag.
const safeJson = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c");

export interface WallOptions {
  focus?: PublicTrace;
  missingId?: string;
}

function focusSection(opts: WallOptions): string {
  if (opts.focus) {
    const t = opts.focus;
    return `<section class="focus-static kind-${t.kind}" aria-labelledby="focus-heading" data-focus-id="${t.id}">
      <h2 id="focus-heading" class="visually-hidden">A single trace</h2>
      ${motifSvg(t.kind)}
      <p class="trace-meta">${kindLabel(t)}<time datetime="${new Date(t.createdAt).toISOString()}">${escapeHtml(fullTime(t.createdAt))}</time>${t.mine ? `<span class="owner">yours</span>` : ""}</p>
      <blockquote class="focus-text"><p>${escapeHtml(t.text)}</p></blockquote>
      <p><a href="/">Back to the whole wall</a></p>
    </section>`;
  }
  if (opts.missingId !== undefined) {
    return `<section class="focus-static missing" aria-labelledby="focus-heading" data-missing>
      <h2 id="focus-heading">That trace isn&rsquo;t here</h2>
      <p>Nothing on the wall has the address <code>${escapeHtml(opts.missingId)}</code>. Traces are never deleted, so the link was probably copied incompletely.</p>
      <p><a href="/">Go to the whole wall</a></p>
    </section>`;
  }
  return "";
}

export function renderWall(traces: PublicTrace[], opts: WallOptions = {}): string {
  const items = traces.length
    ? traces.map(renderTraceItem).join("\n")
    : `<li class="empty">Nothing has passed through yet. The first thought could be yours.</li>`;
  const lastId = traces.length ? traces[0].id : 0;
  const data = safeJson({ traces, lastId, serverNow: Date.now() });

  const body = `
    <main id="main">
      <section class="intro" aria-labelledby="intro-heading">
        <div class="intro-text">
          <h1 id="intro-heading">Leave a thought. <span class="nowrap">Let it pass.</span></h1>
          <p class="lede">One shared wall where anyone can leave a passing thought as a dream, illusion, bubble, shadow, dew or lightning. Thoughts left by others arrive here as they happen.</p>
        </div>
        <figure class="scene" aria-hidden="true">
          <svg viewBox="0 0 320 140" class="scene-svg" preserveAspectRatio="xMidYMid meet">
            <line class="scene-line" x1="8" y1="118" x2="312" y2="118" />
            <g class="scene-rest">${sceneRest()}</g>
            <g class="scene-accents"></g>
          </svg>
          <figcaption>Passing now</figcaption>
        </figure>
      </section>
      ${focusSection(opts)}
      <div class="layout">
        <section class="composer" aria-labelledby="compose-heading">
          <h2 id="compose-heading">Leave a trace</h2>
          <form class="trace-form" method="post" action="/trace">
            <fieldset class="kinds">
              <legend>This feels like&hellip;</legend>
              <div class="kind-grid">${kindRadios()}</div>
              <p class="kind-gloss" id="kind-gloss">Choose the one it feels closest to.</p>
            </fieldset>
            <label class="text-label" for="trace-text">What passed through?</label>
            <p class="cue" id="text-cue">A fragment, not an essay. Once it&rsquo;s on the wall it stays there: it can&rsquo;t be edited or taken back.</p>
            <textarea id="trace-text" name="text" rows="4" maxlength="240" required aria-describedby="text-cue char-count"></textarea>
            <p class="form-foot">
              <span class="char-count js-only" id="char-count">0 of 240 characters</span>
              <span class="draft-status js-only" id="draft-status"></span>
            </p>
            <p class="form-status js-only" id="form-status" role="status"></p>
            <div class="form-actions">
              <button type="submit" class="primary" id="submit">Let it go</button>
              <button type="button" class="quiet-button js-only" id="discard" hidden>Discard draft</button>
            </div>
          </form>
        </section>
        <section class="stream" aria-labelledby="wall-heading">
          <div class="stream-head">
            <h2 id="wall-heading" tabindex="-1">The wall</h2>
            <p class="connection js-only" id="connection" data-state="connecting"><span class="dot" aria-hidden="true"></span><span class="connection-text">connecting</span></p>
          </div>
          <div class="browse js-only" role="search" aria-label="Find thoughts">
            <fieldset class="filter-kinds">
              <legend>Show</legend>
              <div class="chips">${filterRadios()}</div>
            </fieldset>
            <div class="browse-row">
              <fieldset class="filter-scope">
                <legend>From</legend>
                <div class="chips">
                  <label class="chip"><input type="radio" name="scope" value="everyone" checked /><span>Everyone</span></label>
                  <label class="chip"><input type="radio" name="scope" value="yours" /><span>Yours</span></label>
                  <label class="chip"><input type="radio" name="scope" value="saved" /><span>Saved</span></label>
                </div>
              </fieldset>
              <div class="search-field">
                <label for="search" class="search-label">Search</label>
                <div class="search-row">
                  <input type="search" id="search" autocomplete="off" spellcheck="false" />
                  <button type="button" class="quiet-button" id="clear-filters">Clear</button>
                </div>
              </div>
            </div>
            <p class="saved-note" id="saved-note" hidden>Saved thoughts are kept in this browser only. They aren&rsquo;t shared, synced, or shown to anyone, including the person who wrote them.</p>
            <div class="browse-foot">
              <p class="results" id="results" aria-live="polite"></p>
              <button type="button" class="quiet-button encounter" id="encounter">Encounter a thought</button>
            </div>
            <p class="encounter-status" id="encounter-status" role="status"></p>
          </div>
          <ol class="wall" id="wall">
            ${items}
          </ol>
          <div class="no-results" id="no-results" hidden>
            <p id="no-results-text">No thoughts match.</p>
            <button type="button" class="quiet-button" id="no-results-clear">Show everything</button>
          </div>
        </section>
      </div>
    </main>
    <dialog class="reader" id="reader" aria-labelledby="reader-title">
      <div class="reader-inner">
        <div class="reader-top">
          <h2 id="reader-title" class="reader-kind"></h2>
          <button type="button" class="quiet-button close" id="reader-close">Close</button>
        </div>
        <div class="reader-motif" aria-hidden="true"></div>
        <blockquote class="reader-text"><p id="reader-text"></p></blockquote>
        <p class="reader-meta" id="reader-meta"></p>
        <div class="reader-actions">
          <button type="button" class="quiet-button" id="reader-save" aria-pressed="false">Save</button>
          <button type="button" class="quiet-button" id="reader-copy">Copy link</button>
          <button type="button" class="quiet-button" id="reader-another" hidden>Encounter another</button>
        </div>
        <p class="reader-status" id="reader-status" role="status"></p>
        <div class="copy-fallback" id="copy-fallback" hidden>
          <label for="copy-field">Copy this link by hand</label>
          <input type="text" id="copy-field" readonly />
        </div>
      </div>
    </dialog>
    <dialog class="settings" id="settings" aria-labelledby="settings-title">
      <form method="dialog" class="settings-inner">
        <div class="reader-top">
          <h2 id="settings-title">Appearance</h2>
          <button type="submit" class="quiet-button close">Close</button>
        </div>
        <fieldset>
          <legend>Colours</legend>
          <div class="chips">
            <label class="chip"><input type="radio" name="theme" value="system" checked /><span>System</span></label>
            <label class="chip"><input type="radio" name="theme" value="light" /><span>Light</span></label>
            <label class="chip"><input type="radio" name="theme" value="dark" /><span>Dark</span></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Motion</legend>
          <label class="check"><input type="checkbox" id="motion-off" /> Turn off decorative motion</label>
          <p class="cue">New thoughts still arrive live; only the drifting marks stop. If your device asks for reduced motion, that is followed already.</p>
        </fieldset>
        <p class="cue" id="settings-storage">These choices are remembered in this browser.</p>
      </form>
    </dialog>
    <div class="visually-hidden" id="announcer" aria-live="polite"></div>
    <script type="application/json" id="wall-data">${data}</script>
  `;
  return shell(
    "六如 Liùrú — leave a thought, let it pass",
    body,
    `<script type="module" src="/static/app.js"></script>`,
  );
}

export function renderReadme(bodyHtml: string): string {
  const body = `<main id="main" class="readme"><article class="prose">${bodyHtml}</article></main>`;
  return shell("About — 六如 Liùrú", body);
}
