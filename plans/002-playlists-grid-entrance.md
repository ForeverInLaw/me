# 002 — Playlists grid gets an entrance (scroll-reveal vocabulary)

- **Status**: TODO
- **Commit**: 8363d46 (2026-09-23)
- **Severity**: MEDIUM
- **Category**: Missed opportunity → teleporting state (network content pops in fully formed)
- **Estimated scope**: 1 file, ~30 lines (`js/modules/playlists.js`)

## Problem

`#playlists-container` is empty in `index.html:526-528` and is filled in one shot when the fetch resolves — `js/modules/playlists.js:140,165`:

```js
container.innerHTML = playlists.map(playlist => {
    ...
}).join('');
```

No entrance, no bridge. Whoever has already scrolled to the section (slow network, long LCP) sees a full grid of vinyl cards pop into existence mid-scroll. The projects grid already owns the solution for this exact moment: a `ScrollTrigger.batch` reveal in `js/modules/scroll-reveal.js:36-59`.

## Target

Desktop (non-compact): the injected cards are set hidden and revealed by `ScrollTrigger.batch`, using the **same values as the projects grid** so both card grids behave identically (`js/modules/scroll-reveal.js:18-48`): `start: 'top 90%'`, `once: true`, `autoAlpha 0 → 1`, `y: 26 → 0`, `filter: blur(8px) → blur(0px)`, `duration: 0.6`, `stagger: 0.08`, `ease: 'power3.out'`.

Compact (mobile): the stack owns a transform on every `li`, so a per-card entrance would fight it. Fade the container instead: `autoAlpha: 0 → 1`, `y: 12 → 0`, `duration: 0.3`, `ease: 'power2.out'` — a bridge, not a second showpiece.

Both paths skip entirely under `prefers-reduced-motion()`: cards are simply visible (never `gsap.set` a hidden state without animating it away).

New code — inserted inside `initPlaylists()`, on the success path, after the `if (isCompact()) { ... } else { ... }` branch and **before** the existing `ScrollTrigger.refresh()` guard (`js/modules/playlists.js:193-195`):

```js
// The cards arrive over the network after the page has settled - without
// an entrance the whole grid pops in mid-scroll. Reuse the projects grid's
// reveal vocabulary so both card grids read as one system.
if (typeof ScrollTrigger !== 'undefined' && !prefersReducedMotion()) {
    if (isCompact()) {
        gsap.fromTo(container, { autoAlpha: 0, y: 12 }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.3,
            ease: 'power2.out'
        });
    } else {
        const cards = container.querySelectorAll('.playlist-card');
        gsap.set(cards, { autoAlpha: 0, y: 26, filter: 'blur(8px)' });
        ScrollTrigger.batch(cards, {
            start: 'top 90%',
            once: true,
            onEnter: (batch) => gsap.to(batch, {
                duration: 0.6,
                autoAlpha: 1,
                y: 0,
                filter: 'blur(0px)',
                stagger: 0.08,
                ease: 'power3.out',
                overwrite: 'auto'
            }).then(() => {
                // Same marker scroll-reveal.js writes, so a grep for
                // already-entered cards finds both grids.
                batch.forEach(el => { el.dataset.revealed = 'true'; });
                gsap.set(batch, { clearProps: 'transform,opacity,visibility,filter' });
            })
        });
    }
}
```

## Repo conventions to follow

- Group entrances use `ScrollTrigger.batch` + `once: true` + `clearProps` — exemplar: `js/modules/scroll-reveal.js:36-59`.
- Motion guards come from `js/modules/viewport.js` — exemplar import: `js/modules/scroll-reveal.js:2`:
  ```js
  import { isCompact, prefersReducedMotion } from './viewport.js';
  ```
  `js/modules/playlists.js:2` currently reads `import { isCompact } from './viewport.js';` — extend it to the form above.
- GSAP/ScrollTrigger are script globals; declare them at the top of the file — exemplar: `js/modules/masonry.js:1`:
  ```js
  /* global ScrollTrigger -- loaded as a global by libs/gsap/gsap-bundle.min.js */
  ```
  For this file use: `/* global gsap, ScrollTrigger -- loaded as a global by libs/gsap/gsap-bundle.min.js */`

## Steps

1. `js/modules/playlists.js:1` — add the file-level global comment above the import block.
2. `js/modules/playlists.js:2` — extend the viewport import to `import { isCompact, prefersReducedMotion } from './viewport.js';`.
3. In `initPlaylists()` (currently lines 133–199), insert the new entrance block from Target after the `if (isCompact()) { initPlaylistStack(container); } else { ... }` block and before the `if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();` guard.
4. Leave the existing `ScrollTrigger.refresh()` call in place — it must run after the batch is created so triggers already in view fire on the first refresh.

## Boundaries

- Do NOT touch `initPlaylistStack()`, `goTo`, `next`, `prev`, the dots, or the touch handlers — plan 003 owns that region; execute 002 and 003 sequentially, never in parallel on the same checkout.
- Do NOT change durations/staggers/curves — copy the `scroll-reveal.js` values verbatim so the two grids match.
- Do NOT add a hidden state under `prefers-reduced-motion()` or when ScrollTrigger is unavailable — cards stay plainly visible.
- Do NOT modify `index.html` or any CSS file.
- If the code at the cited lines no longer matches the excerpts above (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` succeeds; `npm test` passes.
- **Feel check**:
  - DevTools → Network → "Slow 4G", reload, scroll down and park where the playlists section is: as the fetch resolves, cards do NOT pop in — each rises with a fade+blur as it crosses the top 90% of the viewport, 30–80ms staggered (the batch fires immediately for cards already in view).
  - Compare with the projects grid above it: identical timing, curve, and blur — one system, not two.
  - Narrow the window below the compact breakpoint (≤768px): the stack fades in as one block; the per-card batch never runs.
  - DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": cards are simply visible the moment the fetch resolves — nothing hidden, nothing moving.
  - Error path: block the playlists request in DevTools → Network — the muted error message appears as today, no animation attempts, no console errors.
- **Done when**: the desktop playlists reveal is indistinguishable in timing/curve from the projects grid, mobile gets a single container fade, and reduced-motion users see plain, instant content.
