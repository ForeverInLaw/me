// On a phone the works list opens on the projects that have a picture to
// show; the rest wait behind one button, which brings them in and leaves. The
// hiding itself is CSS (works.css, phone widths only), so on wider screens the
// list is whole and the button never shows.

import { projectCards } from './project-card.js';

export function initWorksMore() {
    const button = document.querySelector('.works__more');
    const section = button?.closest('.projects');
    if (!section) return;

    const extra = Array.from(projectCards())
        .filter((card) => !card.dataset.screenshot)
        .map((card) => card.closest('li'));
    if (!extra.length) return;

    button.textContent = `${extra.length} more works`;
    button.hidden = false;

    button.addEventListener('click', () => {
        // The rows cascade in as the list first did, counted from the first of them.
        extra.forEach((row, order) => row.style.setProperty('--i', String(order)));
        section.classList.add('is-whole');
        button.hidden = true;
        // The button is gone: hand the keyboard to the first row it revealed.
        extra[0].querySelector('a')?.focus({ preventScroll: true });
        // Everything below just moved down; the scroll scene measures again.
        window.ScrollTrigger?.refresh();
    });
}
