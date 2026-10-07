# Pod 4 riff: 六如 — a living garden of passing thoughts

Develop this pod's existing wall into a visually distinctive, useful response to **Crit 9: All at once**. Create a small digital garden where people leave thoughts, see each other's contributions arrive, explore the six kinds, and keep thoughts privately for later. Deliver the working features and the finished visual design in this brief. The central experience should remain immediate: I leave a passing thought, and someone already looking at the wall sees it arrive without refreshing.

## Context and scope

Work in `comp4020-agentic-coding-studio/comp4020-riff8-liuru-4`. Its live app is <https://comp4020-riff8-liuru-4.fly.dev/>. Read the root `CLAUDE.md`, `README.md`, `PROCESS.md`, the existing decision record in `docs/decisions/`, the application source, and the tests before changing anything. Use them to understand the current behaviour and deployment setup.

The starting README describes a persistent, reverse-chronological wall that updates only on reload. It identifies real-time co-presence as the next missing feature. Build on that working interaction instead of replacing the app.

This is the pod riff, governed by the top block of `CLAUDE.md`: there is no graded reflection or required `PROCESS.md` entry. Leave that block intact. Work only in this pod's repository and deploy only its app; the original `comp4020-final-liuru` repository and deployment are out of scope. This prompt is written for one unattended run: make reasonable implementation decisions and record material trade-offs without waiting for answers.

## What good means

The existing README describes good software here as small, quiet, and free of engagement pressure. Make that quality visible through live arrivals: another person's thought appears while I am here, without demanding a reply or announcing how many people are watching.

Keep the six existing kinds: dream, illusion, bubble, shadow, dew, and lightning. Preserve the current text validation, the 240-character cap, persistent storage, reverse-chronological ordering, and the distinction between my traces and other people's traces. Existing traces must survive the change. The sense of passing time should come from the presentation; it must not silently introduce expiry or deletion of stored traces.

Evolve the visual design substantially while preserving that quiet character. Private bookmarks, search, focused reading, and a live shared visual field are in scope. Do not add accounts, public profiles, public reaction counts, replies, popularity sorting, presence counts, typing indicators, notifications, or unread badges. Preserve the small Node/SQLite architecture unless inspection reveals a concrete need to change it. Moderation and rate limiting remain documented future work.

## Design references and original art direction

Use these verified award entries as references. The adaptation column is our design interpretation for this app, not a claim that the reference implements our features. Inspect the award-page screenshots and interaction examples; a reference's current live site may have changed since its award. If a reference is unavailable, use the concrete direction below and continue.

| Reference | Verified recognition and reference qualities | Our adaptation for 六如 |
| --- | --- | --- |
| [Lusion v3](https://www.awwwards.com/sites/lusion-v3) | Awwwards Site of the Day, 2 October 2023. The entry highlights reactive cursor interaction and scroll animation. | Make motion respond to an actual action or incoming trace. Give the wall one memorable interactive scene, implemented with lightweight CSS/SVG or Canvas rather than copying its 3D production. |
| [Frans Hals Museum](https://www.cssdesignawards.com/sites/frans-hals-museum/32702/) | CSS Design Awards Website of the Day, 16 April 2018. Its award entry identifies typography, flat design, animation, and the meeting of classic and contemporary culture. | Use confident typography, deliberate spacing, strong alignment, and clear navigation. Pair the Chinese identity with contemporary, legible interface controls. |
| [Fukuoka Prefectural Virtual Museum](https://www.cssdesignawards.com/sites/fukuoka-prefectural-virtual-museum/41925/) | CSS Design Awards Website of the Day, 11 September 2022. Its concept is a distinctive virtual viewing experience; the entry highlights animation, fullscreen composition, and scrolling. | Give the six similes a coherent visual language and let visitors open a thought for focused viewing, as an exhibit. Keep ordinary reading and navigation immediately available. |

Create original layouts, copy, motifs, and motion. Do not copy these sites' branding, images, code, or proprietary assets, and do not imply that our app has won an award.

### Visual system: paper, ink, and passing light

- **Identity:** Use `六如 / LIÙRÚ` as a compact wordmark. The main introduction is “Leave a thought. Let it pass.” with one short sentence explaining the shared wall. Retain the six Chinese characters alongside readable English names throughout.
- **Palette:** Start with warm paper `#F4F0E7`, dark ink `#242A26`, muted moss `#526357`, and a restrained vermilion `#A94232` for the main action. Use a genuine dark palette around `#18201D` with warm pale text. Verify contrast on final surfaces; decorative tints must not determine text colour.
- **Typography:** Pair a literary serif for the headline and trace text with a clear system sans-serif for controls and metadata. Use a suitable CJK serif fallback. Aim for a 48–72 px desktop headline, 32–42 px mobile headline, and 17–20 px trace text; adapt to fit rather than clip. Limit font families and loading cost.
- **Composition:** Use an airy editorial layout, thin rules, subtle surface differences, and a consistent spacing scale. Desktop: a compact introduction and shared scene above a wide trace stream with a narrower writing panel beside it. Mobile: introduction, composer, browsing controls, then a single-column stream. Keep the primary writing action discoverable in the first viewport without a full-screen intro.
- **Trace presentation:** Use a semantic ordered list in newest-first order. Each item has a small kind motif, readable thought text, a timestamp, ownership text where relevant, and quiet actions. Let actual content determine height. Avoid masonry, arbitrary feature placement, or visual sorting that contradicts reading order.
- **Craft:** Make selection, hover, focus, empty, loading, submission, failure, offline, and reconnecting states deliberate. Avoid generic dashboard panels, ornamental statistics, indiscriminate rounded cards, stock photography, custom cursors, forced scroll effects, and loading screens that block reading.

### Six related motifs

Use the same restrained stroke weight and geometry so these feel like one family. Pair every motif with a text label; keep body text still and readable.

| Kind | Motif | Brief arrival behaviour |
| --- | --- | --- |
| 夢 · Dream | Soft, offset circles | A small upward drift, then settle |
| 幻 · Illusion | Two overlapping contours | A gentle alignment of the contours |
| 泡 · Bubble | An open circular ring | A single expanding ring |
| 影 · Shadow | An offset silhouette | A soft lateral reveal |
| 露 · Dew | A droplet or small lens | A restrained highlight that fades |
| 電 · Lightning | A short angular line | One stroke reveal, never a flashing effect |

These are original presentation ideas, not promised Buddhist symbolism beyond the existing six labels. Use roughly 180–400 ms for interface transitions and up to 1.5 seconds for a scene accent. Reduced motion should show a static state immediately.

## Additional product features

### A. A shared scene that reflects real arrivals

Create a compact “Passing now” field beside the introduction. A successfully committed incoming trace briefly contributes its kind's motif to this field in every connected session. The underlying event, kind, and deterministic placement should agree across sessions; exact animation-frame synchronisation is unnecessary.

Keep at most eight recent accents visible and let them fade within about 20 seconds. Only the decorative accent expires: the trace remains in the wall. Initial history and reconnection replay should populate the wall without replaying a storm of old animations. Use the server timestamp and identifier to distinguish fresh events from recovered history. When nothing is arriving, show a quiet static composition rather than inventing activity. This field does not display who is watching or how many visitors are present. Provide a motion-off setting that leaves live data delivery running.

### B. A considered writing experience

Replace the bare kind dropdown with an accessible six-option native radio group, styled with the motifs and bilingual labels. Add a one-line explanation of the selected kind, a visible character counter matching the server's counting rule, and a clearly labelled “Let it go” action. Keep optional writing cues outside the textarea so they are not accidentally submitted.

Preserve the text and kind in this tab's `sessionStorage`, with clear feedback that the draft is saved for this tab. Restore after a reload in that tab; clear only after confirmed success or an explicit discard action. If browser storage is unavailable, keep writing usable. Show pending, saved, and error feedback inline. Prevent accidental repeated clicks while a request is pending. Preserve the draft on failure and never automatically retry an uncertain POST in a way that creates duplicates.

### C. Find and filter thoughts

Provide an “All” control, the six kind filters, a “Yours” scope, and text search. Keep filtering and writing-kind selection independent. Combine kind, scope, and search predictably; preserve newest-first ordering. Search text safely, including Chinese text, and provide an explicit clear action and helpful empty results.

New live traces must enter the underlying wall immediately and appear in the current results if they match. A filter must not silently switch when a new trace arrives. On narrow screens, wrap the six choices or use an accessible compact control; do not depend on horizontally clipped labels. If history is paginated, search and filtering must cover stored history, not just the loaded page.

### D. Private bookmarks

Let a visitor save or unsave a trace with a labelled bookmark control and open a “Saved” scope. Keep the saved identifiers in browser-local storage. Explain that bookmarks stay in this browser and are not shared or synced. They must not create public counts, notify an author, change the shared ordering, or become a popularity signal. Handle disabled storage and missing traces gracefully. Unsave removes only the bookmark, never the public trace.

### E. Focused reading and direct links

Let a visitor open a trace in an accessible reading dialog with larger type, its kind, full timestamp, bookmark action, and a “Copy link” action. Support Escape, a visible close control, correct modal focus handling, and focus restoration. Live arrivals continue behind the dialog without replacing the thought being read.

Use a durable trace identifier in the link. Opening it in a fresh session must find the trace even if it is old or excluded by the current filters. Give a useful not-found state for invalid identifiers. Copying a link must be an explicit action with success/failure feedback; offer selectable text if clipboard access is unavailable.

### F. Day, night, and quiet motion

Provide System / Light / Dark appearance settings, defaulting to the system, plus an option to turn off decorative motion. Store these preferences locally where available. Follow `prefers-reduced-motion` even if the visitor has not opened settings. Theme changes must cover all controls, dialogs, empty states, and the shared scene.

### G. A small act of discovery

Add a secondary “Encounter a thought” action that opens one random stored trace in the reading dialog, respecting the selected kind when one is active. Make it an explicit, finite action with a clear empty state. Avoid selecting the same trace consecutively when alternatives exist. This must not reorder the wall, personalise a feed, auto-advance, or require visitors to keep clicking.

## Required behaviour

### 1. Live arrivals

When a visitor successfully submits a trace, show that persisted trace in every other connected, active session within about one second, with no manual reload or whole-page refresh. Update the submitting session too. Each trace should appear once per session, with its correct kind, text, and ownership label.

Prefer Server-Sent Events from the existing Node server, with the existing HTTP submission flow, as anticipated by the original stack decision. Use a different transport only if inspecting the app reveals a concrete reason, and explain the trade-off. Keep the solution appropriate to the existing small Fly deployment and SQLite volume.

Persist before broadcasting. Use a stable server-issued trace identifier to deduplicate live events and to give simultaneous posts a consistent order. Derive ownership for the receiving visitor: do not broadcast one visitor's personalised “yours” markup to everyone, or expose identity-cookie values in events. Escape user text in the live rendering path just as in the initial page.

### 2. Concurrent use and recovery

Two people posting at nearly the same time should produce two distinct stored traces. Both must appear in the same order in all connected sessions. As the wall is append-only, one visitor's submission must not overwrite another's.

After a temporary network interruption, reconnect automatically and bring the wall up to date without a reload. Recover missed traces from durable state using replay or reconciliation, merge them by identifier, and avoid gaps between the initial page load and the live subscription. Handle a server restart, where an in-memory event history may have disappeared. A returning visitor should still see stored traces and recognise their own using the existing identity mechanism.

If a submission fails, keep the visitor's draft and give clear feedback. Do not display an unconfirmed trace as successfully saved. Live updates must preserve the selected kind, unsent text, keyboard focus, and reading position. Keep new traces in their canonical order while avoiding forced scrolling.

### 3. Quiet, accessible feedback

Implement the arrival behaviour and scene above while honouring `prefers-reduced-motion`. Add a small text connection status, such as “live” or “reconnecting”, so an interrupted connection is understandable. This indicates connection health, not the number of visitors. A paused decorative scene must never pause delivery to the wall.

Keep keyboard operation, readable mobile layout, light and dark mode contrast, and accessible kind/ownership labels. Make main touch targets at least 44 px. Announce additions politely to assistive technology without repeatedly reading out the whole wall or stealing focus. Mark the purely decorative scene as hidden from assistive technology; the semantic stream carries the content. Preserve the existing server-rendered read-and-submit flow when JavaScript is unavailable; enhanced browsing and real-time behaviour can require JavaScript.

Prefer CSS and small JavaScript modules over a large animation framework. Avoid video backgrounds and mandatory WebGL. Keep new compressed application JavaScript below roughly 100 KB if practical, excluding any pre-existing code, and report the measured result. Stop decorative animation when the document is hidden. Bound retained animation objects and remove event listeners and timers when their components are disposed.

## Record one meaningful multi-user decision

Add a short decision record in `docs/decisions/`, using the next available number and the repository's existing format. Its main question should be **how visitors experience other people being present**, rather than merely which transport library to use.

Choose anonymous co-presence through live traces and their temporary shared motifs, with no presence roster, visitor count, or typing activity. Compare it with both explicit presence indicators and retaining reload-only discovery. Explain why this makes the shared experience visible while fitting the README's quiet, low-pressure aim. Name the costs: a silent visitor remains invisible; an inactive wall can still feel solitary; animation needs a reduced-motion alternative; connection status indicates connectivity rather than human presence. Explain why these costs are acceptable. Also describe concurrent-post ordering, reconnection behaviour, and the transport choice briefly.

Update `README.md`, still served at `/readme/`, to describe the behaviour actually shipped, link the decision record, and replace the outdated statement that live updates are deferred. Explain the distinction between permanent public traces, temporary decorative motifs, per-tab drafts, and private browser-local bookmarks. Keep the original design argument, add the award references with the specific design lessons adopted, and distinguish implementation from limitations. If a new design choice requires revising a project-specific rule below the protected riff block of `CLAUDE.md`, first explain the reason in README and keep the resulting rules consistent.

## Acceptance checks

Run the existing project checks and add focused tests for live delivery and recovery where practical. Keep `spec/invariants.test.ts` passing, and retain the existing trace validation and persistence guarantees. Do not weaken tests just to obtain a pass.

Verify the following with separate browser sessions or devices, including at least two distinct visitor identities:

1. **Live delivery:** With A and B already viewing the wall, A posts a uniquely identifiable trace. It appears exactly once in both sessions in about one second, without B reloading. A sees it as theirs; B does not. Repeat in the opposite direction and record observed timing.
2. **Concurrent posts:** A and B submit different traces nearly simultaneously. Both survive, appear once, and have the same order in both sessions and a newly opened session C.
3. **Recovery:** Disconnect B while A posts several traces. Reconnect B and confirm the missing traces arrive once, without reload. On a local or disposable instance, also verify recovery across a server restart and persistence on the same data directory.
4. **Undisturbed writing and reading:** While B has an unfinished draft and is reading farther down the wall, A posts. B's draft, kind selection, focus, and reading position remain usable.
5. **Regression and accessibility:** Check invalid submissions against the existing contract, safe rendering of text containing HTML characters, returning-visitor ownership, keyboard use, mobile layout, both colour schemes, and reduced motion. Check that `/` and `/readme/` still work.
6. **Shared scene:** A genuine new trace produces the appropriate motif in A and B. Recovered old events do not replay as a burst of new activity. Turning motion off stops decoration but leaves the wall live. Expired motifs never delete traces.
7. **Discovery:** Test each kind, combined search and Yours/Saved scopes, Chinese search text, no-results states, clearing filters, matching and non-matching live arrivals, and random encounter with zero, one, and several eligible traces.
8. **Local state:** Reload a draft in the same tab, fail a submission, submit successfully, save/unsave a bookmark, and reload the page. Check that a different browser has no access to those bookmarks and that unavailable local storage does not break the app.
9. **Reading and links:** Open and close the reading dialog using only the keyboard. Open a copied link in a fresh session, including an old trace outside the current filter. Test an invalid identifier and clipboard fallback.
10. **Visual finish:** Inspect real screenshots at 390 px, 768 px, and 1440 px widths in light and dark mode. Also check 320 px layout, 200% zoom, long Chinese/English text, a long unbroken word, no traces, and many traces. Correct clipping, cramped controls, low contrast, and accidental layout jumps. Verify that every visible action works and that reading never depends on motion.

Record what you actually tested and any limitations in the final run summary. Do not claim a multi-device or live-deployment test that was not performed.

## Finish

Make small, coherent commits as the implementation develops, keep `main` deployable, and use the repository's established workflow to deploy the Pod 4 app. Verify live delivery on its deployed URL; a local pass alone is insufficient. If deployment or an essential check is blocked, report the specific blocker and completed work accurately.

Implement in three passes: (1) reliable real-time delivery and recovery; (2) the complete visual system, writing, search/filtering, and shared scene; (3) bookmarks, reading links, appearance controls, and the encounter action. All specified features belong to the intended result; do not leave decorative controls, stubbed endpoints, or fabricated activity in their place. Use synthetic traces only in local/disposable testing, never to make the live wall appear popular.

Once the acceptance checks pass, stop adding features. Follow `CLAUDE.md` by deleting `prompt.md` in your last commit. Finish with a concise account of the shipped changes, decision-record path, checks and observed results, representative desktop/mobile screenshots, measured asset cost, remaining limitations, and the Pod 4 live URL. Report incomplete items plainly if an external blocker prevents completion.

## Course references

- [Liùrú runsheet — the riff instructions](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/08-its-alive/liuru/#riff)
- [Crit 9: All at once — next brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/09-all-at-once/)
- [Pod 4 repository and riff-specific instructions](https://github.com/comp4020-agentic-coding-studio/comp4020-riff8-liuru-4/blob/main/CLAUDE.md)
