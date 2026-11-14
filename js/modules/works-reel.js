import { readProjectCard, screenshotCards } from './project-card.js';
import { isTouchReel } from './viewport.js';
import { paintFill } from './shot-fill.js';

// The desktop stage (project-stage.js) is inert on touch, so the project
// screenshots never reached mobile at all. Here every card that has one carries
// it inline, in a frame that opens as the card scrolls into view. Scroll
// is the only input, so the card can stay a plain <a> and tapping still just
// opens the project.
//
// The reveal is one-way on purpose. Collapsing a card again would change the
// page height above the viewport and yank the view out from under the reader.
//
// Opening one above the viewport would do the same, so no card is left closed
// up there to open on the way back: a card the reader is already past (the
// page came back at the place it was left, or jumped) opens at once, unseen,
// and the page is held where it was.

// A card is reached once its top is above the lower third of the viewport, and
// stays reached however far above the viewport it goes: the margin's top is
// taller than any page. A card that only counted while on screen would be
// missed by a page that lands past it.
const REVEAL_MARGIN = '1000000px 0px -30% 0px';

// Start downloading two screens ahead of the reveal. loading="lazy" cannot do
// this job here: the image sits inside a 0fr grid row, so as far as the browser
// is concerned it has no height and no position worth pre-fetching for.
const FETCH_MARGIN = '200% 0px 200% 0px';

// The inner frame is the single grid item the 0fr -> 1fr reveal collapses.
const FRAME_TEMPLATE = `
    <div class="project-shot__frame">
        <img alt="" decoding="async">
    </div>`;

// Whether the browser keeps what is on screen in place by itself when the page
// grows above it. Where it does not, the page is moved by hand.
const keepsItsPlace = () => CSS.supports('overflow-anchor', 'auto');

// Returns false when the card has no usable screenshot, so the caller can skip
// observing a card that would never have anything to reveal.
function mountShot(card) {
    const { screenshot, title } = readProjectCard(card);
    if (!screenshot) return false;

    const shot = document.createElement('div');
    shot.className = 'project-shot';
    shot.innerHTML = FRAME_TEMPLATE;
    shot.dataset.src = screenshot;

    const image = shot.querySelector('img');
    image.alt = `${title} screenshot`;

    card.appendChild(shot);
    return true;
}

const loads = new WeakMap();

/**
 * Starts the download of `shot`, once. Settles when its pixels are decoded and
 * there is something to open the frame onto; rejects for a shot that will not
 * load.
 */
function loadShot(shot) {
    if (!loads.has(shot)) {
        const image = shot.querySelector('img');
        image.src = shot.dataset.src;
        paintFill(image, shot.dataset.src);
        loads.set(shot, image.decode());
    }
    return loads.get(shot);
}

/**
 * Opens the frame of `card`, whose shot is decoded. On screen or below it, the
 * frame slides open (works.css). Above the screen it is simply open, and the
 * page stays where the reader has it.
 */
function openShot(card) {
    const shot = card.querySelector('.project-shot');
    const { bottom, height } = card.getBoundingClientRect();
    if (bottom > 0) {
        shot.classList.add('is-open');
        return;
    }
    shot.classList.add('is-open', 'is-passed');
    if (!keepsItsPlace()) window.scrollBy(0, card.getBoundingClientRect().height - height);
}

export function initWorksReel() {
    // Same query as the .project-shot styles in works.css: small touch
    // screens only, where the desktop stage never runs.
    if (!isTouchReel()) return;

    const cards = screenshotCards();
    if (!cards.length) return;

    // Two passes over the same cards at different distances: fetch early so the
    // file is decoded by the time the frame opens, reveal late so the opening
    // lands where the reader is looking.
    const fetcher = new IntersectionObserver((entries, self) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            // A shot that will not load is the revealer's to deal with.
            loadShot(entry.target.querySelector('.project-shot')).catch(() => {});
            self.unobserve(entry.target);
        });
    }, { rootMargin: FETCH_MARGIN });

    const revealer = new IntersectionObserver((entries, self) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const card = entry.target;
            // A card reached before its fetch margin fired still needs the
            // shot, and one reached before its shot is decoded opens when it
            // is. A broken shot keeps its frame closed rather than open onto
            // nothing.
            loadShot(card.querySelector('.project-shot')).then(() => openShot(card), () => {});
            self.unobserve(card);
        });
    }, { rootMargin: REVEAL_MARGIN });

    cards.forEach((card) => {
        if (!mountShot(card)) return;
        fetcher.observe(card);
        revealer.observe(card);
    });
}
