// On a phone the works list opens on the projects that have a picture to
// show; the rest wait behind one button, which brings them in and leaves. The
// hiding itself is CSS (works.css, phone widths only), so on wider screens the
// list is whole and the button never shows. What follows the works slides
// down off the rows as they come in.

import { motionMs, motionToken } from './motion-tokens.js';
import { projectCards } from './project-card.js';
import { prefersReducedMotion } from './viewport.js';

/**
 * `sheet`, the page after the works, has just been pushed down by the rows
 * let in; it was at `from` on the screen. It slides from there to its new
 * place, uncovering the rows, rather than vanishing. That place is usually
 * far below the screen, so the slide ends at the screen's edge: a run all the
 * way down would be past the edge before it was seen to move.
 */
function lower(sheet, from) {
    const edge = window.innerHeight;
    if (from >= edge || prefersReducedMotion()) return;
    const to = sheet.getBoundingClientRect().top;
    const at = (y) => `translateY(${y - to}px)`;
    sheet.animate(
        { transform: [at(from), at(Math.min(to, edge))] },
        { duration: motionMs('--resize-dur'), easing: motionToken('--resize-ease') }
    );
}

export function initWorksMore() {
    const button = document.querySelector('.works__more');
    const section = button?.closest('.projects');
    const sheet = document.querySelector('.works__sheet');
    if (!section || !sheet) return;

    const cards = Array.from(projectCards());
    const extra = cards
        .filter((card) => !card.dataset.screenshot)
        .map((card) => card.closest('li'));
    if (!extra.length) return;

    // The whole count, the one the heading gives, not how many are waiting.
    button.textContent = `All ${cards.length} projects`;
    button.hidden = false;

    button.addEventListener('click', () => {
        const sheetTop = sheet.getBoundingClientRect().top;
        // The rows cascade in as the list first did, counted from the first of them.
        extra.forEach((row, order) => row.style.setProperty('--i', String(order)));
        section.classList.add('is-whole');
        button.hidden = true;
        // The button is gone: hand the keyboard to the first row it revealed.
        extra[0].querySelector('a')?.focus({ preventScroll: true });
        // Everything below just moved down; the scroll scene measures again,
        // before the slide puts the sheet anywhere but its place.
        window.ScrollTrigger?.refresh();
        lower(sheet, sheetTop);
    });
}
