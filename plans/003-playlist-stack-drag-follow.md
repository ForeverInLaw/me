# 003 — Playlist stack swipe follows the finger

- **Status**: TODO
- **Commit**: 8363d46 (2026-09-23)
- **Severity**: MEDIUM
- **Category**: Interruptibility / gesture seams — direct manipulation that doesn't track the pointer
- **Estimated scope**: 1 file, ~50 lines (`js/modules/playlists.js`, inside `initPlaylistStack`)

## Problem

The mobile playlist stack commits swipes on a distance threshold alone — `js/modules/playlists.js:98-119`:

```js
container.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDeltaX = 0;
    isSwiping = false;
}, { passive: true });

container.addEventListener('touchmove', (e) => {
    touchDeltaX = e.touches[0].clientX - touchStartX;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    if (!isSwiping && Math.abs(touchDeltaX) > 15 && Math.abs(touchDeltaX) > deltaY) {
        isSwiping = true;
    }
}, { passive: true });

container.addEventListener('touchend', () => {
    if (isSwiping && Math.abs(touchDeltaX) > 50) {
        if (touchDeltaX < 0) next();
        else prev();
    }
    isSwiping = false;
}, { passive: true });
```

Two gaps:

1. The card sits frozen while the finger drags it, then the exit class (`css/sections.css:683-699`, `translateX(±110%) rotate(±8deg)` over `var(--stack-exit-dur)`) starts from the card's **rest pose** after `touchend` — every direct-manipulation surface users know follows the finger, and the exit should continue from where the finger left it, not snap back to center first.
2. There is no velocity check: a fast flick over a short distance commits nothing even though the gesture was unambiguous. Dismissal should also commit on `Math.abs(distance)/elapsedMs > ~0.11` px/ms.

There is also a latent hole in the current code: `touchcancel` is not handled at all — a stolen gesture (notification shade, system swipe) leaves `isSwiping` stale.

## Target

- `touchmove` past the 15px intent gate: the active card (`items[current]`) tracks the finger 1:1 with a capped tilt — inline `transform: translateX(Δpx) rotate(clamp(Δ/24, ±6)deg)` and inline `transition: none` (the class-level `transition: transform 0.5s` on the `li` at `css/sections.css:645` would otherwise lag the finger).
- `touchend`:
  - **Commit** (`|Δ| > 50px` or velocity `> 0.11px/ms`): clear the inline styles in the same task, then call `next()`/`prev()` as today. Because the inline styles are removed and the exit class applied within one style-change event, the CSS transition runs **from the dragged position** to `translateX(±110%) rotate(±8deg)` — no snap to center.
  - **No commit**: spring back — inline `transition: transform 300ms var(--transition-bounce)` (`cubic-bezier(0.34, 1.56, 0.64, 1)`), then clear inline styles.
- `touchcancel`: spring back + reset state.
- `prefersReducedMotion()`: no finger-follow at all — today's threshold behavior, unchanged.

New state (beside the existing touch state at `js/modules/playlists.js:21-24`):

```js
let touchStartTime = 0;
```

New helpers + handlers (replacing the three listeners above entirely):

```js
/* Finger-follow: the active card rides the finger (inline transform, no
   transition) so commit/release hands off from the finger's position, not
   from the stack's rest pose. Direct manipulation, not autonomous motion. */
const activeCard = () => items[current];

function dragFollow() {
    const card = activeCard();
    if (!card) return;
    card.style.transition = 'none';
    const rotate = Math.max(-6, Math.min(6, touchDeltaX / 24));
    card.style.transform = `translateX(${touchDeltaX}px) rotate(${rotate}deg)`;
}

// Release without committing: spring back to the class-applied rest pose.
function dragRelease() {
    const card = activeCard();
    if (!card || !card.style.transform) return;
    card.style.transition = 'transform 300ms var(--transition-bounce)';
    card.style.transform = 'none';
    setTimeout(() => {
        card.style.transition = '';
        card.style.transform = '';
    }, 320);
}

container.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDeltaX = 0;
    touchStartTime = e.timeStamp;
    isSwiping = false;
}, { passive: true });

container.addEventListener('touchmove', (e) => {
    touchDeltaX = e.touches[0].clientX - touchStartX;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    if (!isSwiping && Math.abs(touchDeltaX) > 15 && Math.abs(touchDeltaX) > deltaY) {
        isSwiping = true;
    }
    if (isSwiping && !prefersReducedMotion()) dragFollow();
}, { passive: true });

container.addEventListener('touchend', (e) => {
    if (isSwiping) {
        const elapsedMs = Math.max(1, e.timeStamp - touchStartTime);
        const flick = Math.abs(touchDeltaX) / elapsedMs > 0.11; // px/ms
        if (Math.abs(touchDeltaX) > 50 || flick) {
            // Clear inline styles in the same task that applies the exit
            // class, so the class transition starts from the dragged pose
            // instead of snapping to center first.
            const card = activeCard();
            if (card) {
                card.style.transition = '';
                card.style.transform = '';
            }
            if (touchDeltaX < 0) next();
            else prev();
        } else {
            dragRelease();
        }
    }
    isSwiping = false;
}, { passive: true });

// A stolen gesture (notification shade, system swipe) must not strand the
// card half-dragged: spring back like an abandoned release.
container.addEventListener('touchcancel', () => {
    if (isSwiping) dragRelease();
    isSwiping = false;
}, { passive: true });
```

## Repo conventions to follow

- `prefersReducedMotion()` is imported from `./viewport.js` — exemplar: `js/modules/show-more.js:3` and its early-return use at `js/modules/show-more.js:54,72`. `js/modules/playlists.js:2` becomes `import { isCompact, prefersReducedMotion } from './viewport.js';`.
- Easings/durations that JS shares with CSS are read from custom properties or referenced by their token inline — exemplar: `js/modules/playlists.js:12-14` (`exitDuration()` reads `--stack-exit-dur`). The spring-back uses `var(--transition-bounce)` inside the inline style string, so the token stays the single source (`css/variables.css:13`).
- Exit transforms stay percentage-based (`translateX(±110%)`) — already the case in the exit classes; the finger-follow stage is the only place that ever uses raw pixel offsets, and it is 1:1 with the finger (direct manipulation, not a tween).
- Keep `{ passive: true }` on every touch listener — `touch-action: pan-y` on `.playlists-row` (`css/sections.css:632`) already hands the horizontal axis to the page; no `preventDefault` is needed or allowed here.

## Steps

1. `js/modules/playlists.js:2` — extend the viewport import to `import { isCompact, prefersReducedMotion } from './viewport.js';`.
2. Inside `initPlaylistStack`, beside the existing touch state (currently lines 21-24), add `let touchStartTime = 0;`.
3. Directly above the current touch listeners (line 98), add the `activeCard()`, `dragFollow()` and `dragRelease()` helpers from Target.
4. Replace the three `touchstart`/`touchmove`/`touchend` listeners with the Target versions, and add the `touchcancel` listener.
5. Leave `goTo`, `next`, `prev`, `applyStack`, the dots, and the exit CSS untouched — the commit path still flows through them; only the dragged card's starting pose changed.

## Boundaries

- Do NOT animate the `stack-next`/`stack-after` cards during the drag (active card only) — that is the existing exit system's job on commit.
- Do NOT change the 50px threshold, the exit classes, `--stack-exit-dur`, or `goTo`'s cleanup timing.
- Do NOT switch the listeners to non-passive or call `preventDefault()`.
- Do NOT add rubber-band damping to the follow (there is no drag boundary here — it is a dismissal gesture, and the commit threshold is 50px, well inside a 1:1 follow).
- Execute after plan 002 if both run — same file, disjoint regions; verify the excerpts still match first.
- If the code at the cited lines no longer matches the excerpts above (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` succeeds; `npm test` passes.
- **Feel check** (real device or DevTools touch emulation, viewport ≤768px):
  - Drag slowly ~30px and release: the card springs back over ~300ms with a subtle overshoot (`--transition-bounce`), no exit.
  - Drag past ~50px and release: the card flies out **from the finger's position** — no snap back to center first — and the next card takes its place exactly as today.
  - A short, fast flick commits below 50px (velocity > 0.11 px/ms).
  - Grab the card mid-spring-back and drag again: it follows the finger immediately (inline `transition: none` re-applied), no double-easing.
  - Fire a `touchcancel` (e.g. via `element.dispatchEvent(new TouchEvent('touchcancel'))` in the console while dragging): the card springs back, no stranded transforms.
  - Swipe through the whole stack quickly: dots, heights, and `goTo`'s cleanup all behave as today — only the active card's motion changed.
  - DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": no finger-follow; threshold commits still advance the stack (today's behavior).
- **Done when**: the card never detaches from the finger during a drag, exits never start from center, and reduced-motion behavior is byte-for-byte today's.
