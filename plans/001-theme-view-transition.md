# 001 — Theme switch rides a View Transitions API crossfade

- **Status**: TODO
- **Commit**: 8363d46 (2026-09-23)
- **Severity**: HIGH
- **Category**: Missed opportunity → cohesion (theme change currently animates at three different speeds)
- **Estimated scope**: 3 files, ~40 lines total

## Problem

Toggling the theme swaps `data-theme` and three independent "clocks" race:

- `body` crossfades its colors over 500ms — `css/base.css:58`:
  ```css
  transition: background-color 0.5s var(--transition-smooth), color 0.5s var(--transition-smooth);
  ```
- The hero `<h1>` characters tween over 500ms via GSAP — `js/modules/hero-title.js:117-121`:
  ```js
  export function recolorHeroTitle() {
      paint((char, color) => {
          gsap.to(char, { color, duration: 0.5, ease: 'power2.out' });
      });
  }
  ```
- The WebGL background (`js/grainient-background.js:339-350`, `setTheme` via a `data-theme` MutationObserver) and every card / border / tag / title surface in between snap instantly, because only `body` carries a color transition.

The result is a double-exposed half-transition: background and hero text drift while the entire content layer hard-cuts. One theme change should read as one event.

## Target

Wrap the existing theme application in `document.startViewTransition()` so the *whole page* crossfades in a single compositor-driven pass (~250ms default). Browsers without the API keep today's behavior (graceful fallback), and reduced-motion users skip the transition entirely.

Expected end state of `js/modules/theme.js` (full `attachThemeToggle`):

```js
export function attachThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    function applyTheme(newTheme, immediate) {
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        themeToggle.setAttribute('aria-pressed', String(newTheme === 'dark'));

        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', newTheme === 'dark' ? '#1B1628' : '#D7C9F0');
        }

        syncImageAriaHidden(newTheme);
        recolorHeroTitle(immediate);
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        const root = document.documentElement;

        // Ignore toggles while one crossfade is in flight: a second
        // startViewTransition skips the first, and the class cleanup of the
        // skipped transition would otherwise un-neutralize the body's
        // transition mid-flight.
        if (root.classList.contains('is-theme-vt')) return;

        if (typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
            root.classList.add('is-theme-vt');
            const vt = document.startViewTransition(() => applyTheme(newTheme, true));
            const restore = () => root.classList.remove('is-theme-vt');
            // finished rejects when the transition is skipped; restore either way.
            vt.finished.then(restore, restore);
            return;
        }

        applyTheme(newTheme, false);
    });
}
```

New rule at the end of the "Theme Toggle" block area of `css/base.css` (after the `body` rule at line 58 is fine — keep it near the rule it overrides):

```css
/* The theme toggle rides the View Transitions API crossfade. While it runs,
   the body's own background/color transition is disabled: the API snapshots
   the post-callback state, and a still-tweening body would lag the crossfade
   by its own 500ms. Non-VTA browsers keep the 0.5s fade as their fallback. */
html.is-theme-vt body {
    transition: none;
}
```

Expected end state of `recolorHeroTitle` in `js/modules/hero-title.js`:

```js
/**
 * Re-runs the gradient against the current theme, tweening each character.
 * `immediate` paints the new colors in the same task instead of tweening —
 * used when a View Transition already crossfades the whole page, where a
 * second 500ms tween would double-animate the title. No-op until
 * revealHeroTitle() has run.
 */
export function recolorHeroTitle(immediate = false) {
    paint((char, color) => {
        if (immediate) {
            char.style.color = color;
            return;
        }
        gsap.to(char, { color, duration: 0.5, ease: 'power2.out' });
    });
}
```

## Repo conventions to follow

- Feature tests go through `js/modules/viewport.js` (`matchMedia`, never `innerWidth`): import `prefersReducedMotion` from `./viewport.js` — same pattern as `js/modules/show-more.js:3`.
- Do not invent easing/duration tokens: the crossfade here is the View Transitions API's *default* timing (~250ms `ease-in-out`), which needs no token. Every other theme surface keeps its existing values.
- `js/modules/theme.js:1` already imports `recolorHeroTitle`; add the `viewport.js` import on a sibling line — do not duplicate the existing import.
- Comments explain *why*, citing the constraint (see `js/modules/spotify.js:455` region comment for the house style).

## Steps

1. `js/modules/theme.js` — add the import:
   ```js
   import { prefersReducedMotion } from './viewport.js';
   ```
   (next to the existing `import { recolorHeroTitle } from './hero-title.js';` on line 1).
2. `js/modules/theme.js` — restructure `attachThemeToggle` (lines 24–45) into the `applyTheme(newTheme, immediate)` inner function + guarded `startViewTransition` click handler shown in Target. Keep `initTheme()` (lines 10–22) untouched — it runs before first paint and must stay synchronous.
3. `js/modules/hero-title.js` — replace `recolorHeroTitle()` (lines 117–121) with the `immediate = false` version shown in Target.
4. `css/base.css` — add the `html.is-theme-vt body { transition: none; }` rule with its explanatory comment.

## Boundaries

- Do NOT touch `js/grainient-background.js`. Its `data-theme` MutationObserver fires inside the VTA callback; the canvas snaps to the new uniforms and the API's old/new snapshots crossfade it correctly as a live element.
- Do NOT add a `::view-transition-*` CSS block. The default crossfade is the target; custom transition styles are out of scope.
- Do NOT change `initTheme()`, `syncImageAriaHidden()`, or any markup in `index.html`.
- Do NOT add dependencies (no View Transitions polyfill — the fallback is the current behavior).
- If the code at the cited lines no longer matches the excerpts above (drift since the commit stamp), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` succeeds. No console errors on load.
- **Feel check** (Chrome/Edge 111+, Safari 18+):
  - Click the theme toggle: the entire viewport crossfades as one surface (~250ms), including the WebGL background, cards, borders and hero title. Confirm the body background does NOT lag behind the overlay (that would mean the `html.is-theme-vt body` rule is missing).
  - Double-click the toggle rapidly: the second click is ignored while the first crossfade runs (guard), and afterwards a normal toggle still works.
  - Firefox (or any browser without the API): the body keeps its 500ms fade, everything else hard-cuts — i.e., today's behavior, no regression.
  - DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": toggle swaps instantly, no crossfade.
  - Confirm the theme persists across reload (localStorage path unchanged).
- **Done when**: one toggle reads as one synchronized crossfade on supporting browsers, identical fallback elsewhere, and reduced-motion users see an instant swap.
