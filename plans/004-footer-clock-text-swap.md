# 004 — Footer clock swaps text through the site's text-swap utility

- **Status**: TODO
- **Commit**: 8363d46 (2026-09-23)
- **Severity**: LOW
- **Category**: Missed opportunity → teleporting state (tiny, but the site owns the cure already)
- **Estimated scope**: 2 files, ~10 lines (`js/modules/local-time.js`, `index.html`)

## Problem

The footer clock writes new text with no bridge — `js/modules/local-time.js:21-31`:

```js
const tick = () => {
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (timeEl.textContent !== hhmm) {
        timeEl.textContent = hhmm;
        timeEl.setAttribute('datetime', hhmm);
    }
    if (stateEl) {
        const label = stateFor(now.getHours());
        if (stateEl.textContent !== label) stateEl.textContent = label;
    }
};
```

The markup (`index.html:586-587`):

```html
<p>Hand-built at <time class="footer-clock" id="local-time" datetime="">--:--</time>
    <span class="footer-clock__state" id="night-clock-state">after dark</span>
    with Raleway, grain &amp; GSAP.</p>
```

The digits hard-swap once a minute, and the joke status label ("peak hours" → "too early") flips on hour boundaries. This site already owns a three-phase text swap for exactly this class of change — `swapText` (`js/modules/text-swap.js:15-26`) driving the `.t-text-swap` classes (`css/components.css:929-950`), used by the Spotify track title and the show-more button.

## Target

`js/modules/local-time.js` — target `tick()`:

```js
const tick = () => {
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (timeEl.textContent !== hhmm) {
        // datetime is machine-readable metadata, not pixels: it updates
        // immediately, while the visible text goes through the swap.
        timeEl.setAttribute('datetime', hhmm);
        swapText(timeEl, hhmm);
    }
    if (stateEl) {
        const label = stateFor(now.getHours());
        if (stateEl.textContent !== label) swapText(stateEl, label);
    }
};
```

And the new import at the top of the file:

```js
import { swapText } from './text-swap.js';
```

The module's header comment (`js/modules/local-time.js:2-3`) currently claims "No motion beyond a CSS glow; reduced-motion users get a static label" — update it to match reality:

```js
// Live local-time clock in the footer ("Hand-built after dark") - the 2am
// joke becomes real. Runs on a 1s interval, paused when the tab is hidden.
// Minute/hour text changes go through swapText (.t-text-swap); the CSS glow
// stays, and reduced-motion users get instant text changes (no transform).
```

`index.html:586-587` — add the utility class so the swap CSS applies:

```html
<p>Hand-built at <time class="footer-clock t-text-swap" id="local-time" datetime="">--:--</time>
    <span class="footer-clock__state t-text-swap" id="night-clock-state">after dark</span>
    with Raleway, grain &amp; GSAP.</p>
```

Notes on why this is safe:

- `.t-text-swap` sets `display: inline-block` (`css/components.css:930`), which does not shift this centered inline run; the clock already renders tabular numerals for exactly this anti-shift concern (`css/layout.css:68-74`).
- The state label's parentheses are `::before`/`::after` on the same span (`css/layout.css:76-82`), so they travel with the swap.
- `swapText` is a no-op when the text is unchanged (`js/modules/text-swap.js:16`), so firing it from a 1s interval is free; the outer `if` guards stay so `setAttribute('datetime')` only runs on a real minute change.
- Reduced motion needs no JS branch: `css/components.css:952-954` sets `.t-text-swap { transition: none !important; }` under `prefers-reduced-motion`, and `css/base.css:122-127` nukes all transitions globally — the swap degrades to an instant text change.

## Repo conventions to follow

- `swapText` + `.t-text-swap` is the site's vocabulary for text changes — exemplar: `js/modules/spotify.js:100-101`:
  ```js
  swapText(card.querySelector('.np-card__title .t-text-swap'), t.name);
  swapText(card.querySelector('.np-card__artist .t-text-swap'), t.artists);
  ```
- The class pairing always travels together: the element carries `t-text-swap` in markup (exemplar: `js/modules/spotify.js:61-62`), and JS only calls `swapText`.

## Steps

1. `index.html:586-587` — add `t-text-swap` to both elements (target markup above). Keep everything else on those lines byte-identical.
2. `js/modules/local-time.js:1` — add `import { swapText } from './text-swap.js';` above the module comment or directly below it, as the first import.
3. `js/modules/local-time.js` — replace `tick()`'s body with the target version (the `datetime` attribute moves before the swap; the direct `textContent` writes go away).
4. `js/modules/local-time.js:1-3` — update the header comment as shown in Target.

## Boundaries

- Do NOT touch the 1s interval, the `visibilitychange` pause/resume, `stateFor()`'s boundaries, or the `pad()` helper.
- Do NOT add reduced-motion branching in JS — the CSS blocks already handle it.
- Do NOT change the swap tokens (`--text-swap-dur: 200ms`, `--text-swap-translate-y: 8px`, `--text-swap-blur: 2px` in `css/variables.css:25-29`) or any CSS at all.
- If `swapText`'s signature or the cited lines no longer match (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm test` passes; `npm run build` succeeds.
- **Feel check**:
  - Leave the page open across a minute boundary and watch the footer: the old digits exit upward with a 2px blur and the new time rises back in (~200ms per phase, per the `.t-text-swap` tokens) — the clock reads "alive", not "jumping".
  - The sentence around the clock does not shift: tabular numerals + `display: inline-block` keep the line width stable before, during and after the swap.
  - Confirm the state label swap at an hour boundary (temporarily widen `stateFor`'s boundaries in the console, or wait for a real one): parentheses move with the label.
  - DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": digits change instantly, no transform, no blur.
- **Done when**: minute and hour-boundary text changes in the footer go through the same three-phase swap as the Spotify track title, with zero layout shift and an instant fallback under reduced motion.
