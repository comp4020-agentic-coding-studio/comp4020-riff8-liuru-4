# 六如 — a wall for passing things

This is a shared wall. Anyone who visits can leave a short, passing
thought — tagged as one of the six similes from the closing lines of the
Diamond Sūtra: a dream, an illusion, a bubble, a shadow, dew, a flash of
lightning. Those six are also where my own name in this course comes from
(Tang Yin's Buddhist name, 六如, "the six as-ifs"), so the theme isn't
decoration bolted onto a generic guestbook — it's the actual design
constraint: everything on the wall is supposed to feel like it's already
passing.

## What good means here

Good, for this app, is small and quiet rather than sticky. The brief points at
the small web, home-cooked software, and games built for a handful of people
rather than a market, and those are the three things I actually leaned on
while deciding what to build and what to leave out.

Robin Sloan's [*An App Can Be a Home-Cooked Meal*](https://www.robinsloan.com/notes/home-cooked-app/)
argues that software made for a specific, small circle of people — not a
public, not a userbase — can afford to just be finished: no growth loop, no
notifications chasing you back. The wall has no accounts, no follower count,
no read receipts. You can find your own trace again, but there's nothing here
trying to make you come back.

The [Small Technology Foundation](https://small-tech.org/)'s case for a small
web — public spaces people can actually understand the whole of, without
tracking or an algorithmic feed — is why the wall shows everything in one
plain reverse-chronological list, oldest at the bottom, nothing curated or
ranked. What you see is what's actually there.

And the design point the final-project brief makes explicitly — build
something that's *better* because other people are using it right now, the
way small local-multiplayer games (like [*Pico Park*](https://store.steampowered.com/app/1509960/PICO_PARK/))
only work because everyone is present at once — is now what the wall does.
While you're here, someone else's thought arrives in the list as they let it
go, without a reload, and without the wall telling you how many people are
watching.

## How other people are present

The decision, with the options I rejected, is in
[`docs/decisions/0002-presence-through-arrivals.md`](docs/decisions/0002-presence-through-arrivals.md).
In short: other people show up only through what they leave. A committed
trace reaches every open wall within a second over Server-Sent Events, in
its place in the newest-first list, and its kind's motif drifts into the
small "Passing now" field for about twenty seconds. There's no visitor count,
no roster and no typing indicator. The small "live" label reports this tab's
connection, not company. If the connection drops, or the server restarts, the
page reconnects by itself and fills in whatever it missed from the database,
quietly, without replaying a burst of animation.

## What lasts and what passes

Four kinds of thing live here, and only one of them is public:

- **Traces are permanent and public.** Once posted, a trace is stored in
  SQLite and stays on the wall. It can't be edited or removed. The relative
  timestamps age; the trace doesn't.
- **Motifs in the "Passing now" field are temporary decoration.** They fade
  after about twenty seconds and are never stored. Their fading deletes
  nothing.
- **Drafts belong to one tab.** Unsent text and the chosen kind are kept in
  that tab's `sessionStorage`, so a reload doesn't lose them. They are
  cleared when the trace is confirmed saved or when you discard them.
- **Bookmarks are private to one browser.** "Save" keeps a trace's id in
  this browser's `localStorage`. They aren't sent to the server, synced,
  counted or shown to the trace's author, and they don't change the wall's
  order.

Each trace also has its own address (`/t/<id>`), which opens it in a reading
view. "Encounter a thought" opens one stored trace at random, once per
click, respecting the kind you're filtering by.

## Design references

The redesign takes specific lessons from three award entries, adapted rather
than copied (the wall itself has won nothing):

| Reference | What I took from it |
| --- | --- |
| [Lusion v3](https://www.awwwards.com/sites/lusion-v3) (Awwwards Site of the Day, 2 October 2023) | Motion that answers something real. Here the only animation is a trace arriving: the "Passing now" field and a brief per-kind gesture on the list item's motif, all in SVG and CSS, not 3D. |
| [Frans Hals Museum](https://www.cssdesignawards.com/sites/frans-hals-museum/32702/) (CSS Design Awards Website of the Day, 16 April 2018) | A classic and contemporary pairing carried by typography: a literary serif for the headline and the traces, a plain system sans for every control, thin rules and strict alignment. |
| [Fukuoka Prefectural Virtual Museum](https://www.cssdesignawards.com/sites/fukuoka-prefectural-virtual-museum/41925/) (CSS Design Awards Website of the Day, 11 September 2022) | Treating a single piece as an exhibit: any trace opens into a focused reading view, while the ordinary list stays one keypress away. |

The palette is warm paper, dark ink, muted moss and one vermilion for the
main action, with a genuine dark version. No web fonts are loaded.

## What's enforced vs. what's judged

Enforced, in `spec/`: a trace needs a real kind (one of the six) and non-empty
text capped at 240 characters, or the server drops it rather than storing
garbage. Traces persist in SQLite on the app's own volume, so they survive a
restart or a redeploy. `spec/live.test.ts` adds the real-time promises: a
committed trace reaches every open stream within a second, marked "yours"
only for its author; near-simultaneous posts get distinct ids in the same
order everywhere; a reconnecting stream is replayed what it missed; a resent
submission doesn't duplicate; and user text is escaped on every page.

Judged, by me now and by a reader later: whether the wall actually feels like
the six similes it's named after, not a message board with a select box on
it, and whether the arrivals feel like company rather than a feed.

## What's still missing

- No moderation, rate limiting or way to remove a trace. Live delivery makes
  spam more visible, not less, so this matters more than it did; it still
  waits for a real reason and its own argument here first.
- The whole wall ships with every page so search covers all of it. That's
  fine at hundreds of traces and would need paging in the thousands.
- No server-side logging beyond what Fly captures by default (crit 11).
- Tested with separate browser sessions on one machine, not yet with
  several people on several devices: that's the crit itself.
