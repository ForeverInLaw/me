// Text changing in place, two ways (the rules are in base.css). swapText is a
// step from one state to the next: the old text exits up, the content changes
// while invisible, the new text rises back. softSwap is a reading changing
// under the reader: old and new cross-blur where they stand, nothing moves.

import { motionMs } from './motion-tokens.js';
import { prefersReducedMotion } from './viewport.js';

// A little past the cross-blur, so tidying up never cuts its last frame.
const SETTLE_MS = 40;

const settling = new WeakMap(); // an element mid soft swap -> its tidy-up timer

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
    }, motionMs('--text-swap-dur'));
}

const layer = (className, nodes) => {
    const span = Object.assign(document.createElement('span'), { className });
    span.append(...nodes);
    return span;
};

/**
 * Changes what `el` (a .t-text-soft) says to `next`, strings and nodes alike,
 * cross-blurring the two. A no-op when it already reads the same. A change
 * that arrives mid-swap starts from the content that was on its way in.
 */
export function softSwap(el, ...next) {
    const text = next.map((part) => part.textContent ?? part).join('');
    if (!el || (el.dataset.text ?? el.textContent) === text) return;
    // The source of truth while the two layers are both in the element.
    el.dataset.text = text;
    clearTimeout(settling.get(el));

    if (prefersReducedMotion()) {
        el.replaceChildren(...next);
        return;
    }

    const arriving = el.querySelector(':scope > .t-text-soft-new');
    const old = layer('t-text-soft-old', (arriving ?? el).childNodes);
    const fresh = layer('t-text-soft-new', next);
    el.classList.remove('is-swapping');
    el.replaceChildren(old, fresh);
    void el.offsetWidth; // force reflow so adding the class transitions
    el.classList.add('is-swapping');

    settling.set(el, setTimeout(() => {
        el.classList.remove('is-swapping');
        el.replaceChildren(...fresh.childNodes);
    }, motionMs('--text-soft-dur') + SETTLE_MS));
}
