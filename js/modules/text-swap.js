// Three-phase text swap: old text exits up, content changes while invisible,
// new text rises back. Duration is read from --text-swap-dur so it cannot
// drift from the CSS.

import { prefersReducedMotion } from './viewport.js';

const FALLBACK_DUR = 150;

const swapDuration = () => parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur')
) || FALLBACK_DUR;

/**
 * Replaces `el`'s text with `next`, animating the change. A no-op when the text
 * is already correct, so callers can fire it on every poll.
 */
export function swapText(el, next) {
    if (!el || el.textContent === next) return;

    // With motion reduced the phases have no length (base.css), and waiting
    // one out would only leave the text blank for that long.
    if (prefersReducedMotion()) {
        el.textContent = next;
        return;
    }

    el.classList.add('is-exit');

    setTimeout(() => {
        el.textContent = next;
        el.classList.remove('is-exit');
        el.classList.add('is-enter-start');
        void el.offsetHeight; // force reflow so removing the class transitions
        el.classList.remove('is-enter-start');
    }, swapDuration());
}
