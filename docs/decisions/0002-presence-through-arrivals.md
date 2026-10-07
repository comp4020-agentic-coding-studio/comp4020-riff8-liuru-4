# 0002: other people are present through what they leave, not who is watching

Status: accepted (crit 9).

## Context

Crit 9 makes the wall real-time and asks how it should behave when several
people use it at once. The question that matters most for this app is how a
visitor experiences other people being here. README defines good as small
and quiet: no accounts, no counts, nothing that chases anyone back. Until
now another visitor's trace appeared only on reload, so the wall was shared
in storage but never felt shared in the moment.

## Options weighed

1. **Reload-only discovery (the crit-8 wall).** Nothing moves unless you
   ask. It's the quietest option, but it hides the one thing that makes a
   shared wall different from a notebook: someone else writing while you're
   here. It also fails the crit's own bar (changes reach everyone within a
   second).
2. **Explicit presence.** A "3 people here" counter, a roster of anonymous
   avatars, or "someone is typing". Familiar from chat. Every one of these is
   attention-seeking or a number to watch. A visitor count is precisely the
   ornamental statistic README rules out, typing indicators expose an
   unfinished thought the writer hasn't chosen to share, and a roster
   implies identities the wall deliberately doesn't keep.
3. **Anonymous co-presence through arrivals (chosen).** Other people are
   felt only through what they actually leave. A committed trace enters
   every open wall at once, in its place in the reverse-chronological list,
   and its kind's motif drifts into the "Passing now" scene for about twenty
   seconds before fading. Nobody is counted, listed or shown typing.

## Decision

Option 3. A thought someone chose to let go is the only presence the wall
reports. The scene accent is the passing moment; the trace itself is
permanent and stays in the wall, so only the decoration expires.

- **Transport.** Server-Sent Events from the existing `node:http` server
  (`GET /events`), as 0001 planned. The wall only needs server-to-client
  pushes; posting stays an ordinary form POST, upgraded to `fetch` when
  JavaScript runs. No new dependency.
- **Ownership.** Each subscriber keeps its own visitor id on the server, and
  every broadcast computes "yours" per receiver. Visitor ids never appear in
  an event.
- **Concurrent posts.** The trace is committed to SQLite before it is
  broadcast. SQLite's autoincrement id is the canonical order, and because
  broadcasting happens synchronously after each insert in one Node process,
  every stream receives traces in id order. Clients also insert by id, so two
  near-simultaneous posts land in the same order everywhere, including in a
  tab opened afterwards.
- **Duplicates.** Clients deduplicate by id (a tab learns its own trace from
  both its POST response and the stream). Each draft carries a submission
  key, so manually resending a POST whose outcome was uncertain returns the
  original trace instead of storing a second one. Nothing retries
  automatically.
- **Reconnection.** Every event carries its trace id as the SSE `id`. On
  reconnect the browser sends `Last-Event-ID`, and the server replays newer
  traces from SQLite, not from an in-memory buffer, so a server restart or
  redeploy loses nothing. The page's first subscription asks for everything
  after the newest trace it rendered, which closes the gap between page load
  and subscribe. Replayed traces are flagged `recovered`: they join the wall
  silently, with one polite "N thoughts arrived while you were away", and
  never set off the scene. If Fly's proxy answers with an error during a
  restart (which permanently closes an `EventSource`), the page reopens the
  stream itself with backoff.

## Costs, and why they're acceptable

- **A silent visitor stays invisible.** Someone reading without writing
  leaves no trace of having been here. That is the point: being seen should
  be a choice made by writing something, not a side effect of opening a tab.
- **A quiet wall can still feel solitary.** With nobody writing, the scene
  rests in a static composition and nothing invents activity. The wall is
  honest about being empty rather than simulating a crowd; README's
  home-cooked-meal argument already accepts a small, sometimes quiet
  audience.
- **Motion needs an alternative.** The arrival motifs are decoration, so
  `prefers-reduced-motion` and an Appearance setting both draw them in
  their final state at once. Delivery never depends on motion: the list, the
  polite live-region announcement and the text status carry the content.
- **"live" means the connection, not people.** The status text reports
  whether this tab is connected ("live", "reconnecting…", "offline"), never
  how many others are. A visitor may read "live" as "others are here". The
  wording stays small and plain so it doesn't promise company.
- **The whole wall ships with every page.** Search and filtering cover
  stored history without pagination by sending every trace. At the wall's
  current size that's about 11 KB compressed. It would need paging (and a
  server-side search) somewhere in the thousands of traces.
