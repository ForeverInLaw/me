# Animation improvement plans

Written by `improve-animations` on 2026-09-23, stamped at commit `8363d46`.
Source code is not touched by the planning pass — each plan below is a
self-contained spec for any executor.

## Audit context

The site's motion is already disciplined (transitions.dev tokens in
`css/variables.css`, reduced-motion handled, hover gated via `matchMedia`
in `js/modules/viewport.js`). These plans only close the remaining seams:
one half-broken theme change and three places that still teleport. Two
smaller audit findings were logged and deliberately not planned:

- `css/base.css:90-91` + `js/modules/cursor.js:24-28` — the cursor dot
  positions via `left/top` custom properties (layout per frame; a
  transform + `scale`-property split would fix it). LOW, cosmetic.
- `css/base.css:21` — the skip link animates `top` on keyboard focus
  (focus-initiated motion should be instant). LOW.

## Plans

| # | Plan | Severity | Status | Files touched |
| --- | --- | --- | --- | --- |
| 001 | [Theme switch rides a View Transitions API crossfade](001-theme-view-transition.md) | HIGH | DONE — `62cccbc` | `theme.js`, `hero-title.js`, `base.css` |
| 002 | [Playlists grid gets an entrance (scroll-reveal vocabulary)](002-playlists-grid-entrance.md) | MEDIUM | DONE — `482b25d` | `playlists.js` |
| 003 | [Playlist stack swipe follows the finger](003-playlist-stack-drag-follow.md) | MEDIUM | DONE — `5473e9e` | `playlists.js` |
| 004 | [Footer clock swaps text through the site's text-swap utility](004-footer-clock-text-swap.md) | LOW | DONE — `a22fd6c` | `local-time.js`, `index.html` |

All four plans were executed (workers, batch 001∥002∥004 then 003), reviewed
against the review-animations bar (verdict: Approve on all four), and landed
atomically. Mechanical verification (`npm test` 8/8, `npm run build`) green at
every step. Browser feel checks from each plan's Verification section remain
with a human: theme crossfade + reduced-motion emulation in Chrome/Edge/Safari,
playlist entrance on Slow 4G, and the drag-follow on a real touch device.

## Recommended execution order

1. **001** — highest leverage, fully independent (3 files, no overlap with the others).
2. **004** — trivial warm-up, fully independent.
3. **002** — then **003**, strictly sequential: both edit
   `js/modules/playlists.js` (002 edits `initPlaylists`, 003 edits
   `initPlaylistStack`). 003's excerpts were written against the same
   commit; after 002 lands, 003's executor must re-check its cited lines
   before editing (its Boundaries section says the same).

No plan depends on another's output; the order above only avoids two
agents editing one file concurrently.

## After execution

Run each plan's Verification section, then ask for
`improve-animations execute` review (or `review-animations`) on the diffs.
Mark plans DONE in this table as they land.
