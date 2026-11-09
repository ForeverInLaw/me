/* global gsap -- loaded as a classic script before the modules (index.html). */
// Hover window for the playlist row: the hovered cover grows out of its tile
// into a card above the row with the playlist's name, description and size.
// Moving along the row slides the open card to the next tile. Pointer and
// keyboard only; on touch the tiles stay plain links.

import { canHoverPreview, prefersReducedMotion } from './viewport.js';
import { safeUrl } from './remote.js';

const WIDTH = 248;  // css/playlist-peek.css sets the same width
const INSET = 8;    // card padding around the cover
const GAP = 12;     // between the card and the row
const EDGE = 12;    // keep-out from the viewport edges

const el = (tag, className) => Object.assign(document.createElement(tag), { className });

// Spotify sends descriptions HTML-encoded ("&#x27;", the odd <a>); DOMParser
// reads them without running anything, and textContent keeps only the words.
const plainText = (html) => new DOMParser().parseFromString(html, 'text/html').documentElement.textContent.trim();

function createCard() {
    const card = el('div', 'playlist-peek');
    card.setAttribute('aria-hidden', 'true');
    const cover = el('img', 'playlist-peek__cover');
    cover.alt = '';
    cover.decoding = 'async';
    const name = el('p', 'playlist-peek__name');
    const desc = el('p', 'playlist-peek__desc');
    const meta = el('p', 'playlist-peek__meta');
    card.append(cover, name, desc, meta);
    document.body.append(card);
    return { card, cover, name, desc, meta };
}

/**
 * Where the card rests for `tile`: centred over it but kept within the row's
 * edges, above the row, or below it when there is no room above.
 */
function restFor(tile, row, card) {
    const height = card.offsetHeight;
    const left = Math.max(EDGE, row.left);
    const right = Math.min(window.innerWidth - EDGE, row.right);
    const x = gsap.utils.clamp(left, Math.max(left, right - WIDTH), tile.left + tile.width / 2 - WIDTH / 2);
    const above = tile.top - GAP - height;
    return { x, y: above >= EDGE ? above : tile.bottom + GAP };
}

/** The transform that lays the card's cover exactly over `tile`. */
function overTile(tile) {
    const scale = tile.width / (WIDTH - INSET * 2);
    return { x: tile.left - INSET * scale, y: tile.top - INSET * scale, scale };
}

/** Wires the window to the `.playlist` links rendered from `playlists`. */
export function attachPlaylistPeek(container, playlists) {
    if (!canHoverPreview()) return;

    const calm = prefersReducedMotion();
    const parts = createCard();
    const { card } = parts;
    const links = Array.from(container.querySelectorAll('.playlist'));
    const tileRect = (index) => links[index].closest('li').getBoundingClientRect();
    let current = null;

    gsap.set(card, { transformOrigin: '0 0', autoAlpha: 0 });

    const fill = (playlist) => {
        parts.cover.src = safeUrl(playlist.image);
        parts.name.textContent = playlist.name.trim();
        parts.desc.textContent = plainText(playlist.description || '');
        parts.meta.textContent = `${playlist.tracks} tracks`;
    };

    const show = (index) => {
        if (index === current) return;
        // Still on screen, even halfway out, counts as open: slide, don't regrow.
        const open = gsap.getProperty(card, 'opacity') > 0;
        current = index;
        fill(playlists[index]);
        const tile = tileRect(index);
        const rest = restFor(tile, container.getBoundingClientRect(), card);

        gsap.killTweensOf(card);
        if (calm) {
            gsap.set(card, { ...rest, scale: 1 });
            gsap.to(card, { autoAlpha: 1, duration: 0.15 });
        } else if (open) {
            gsap.to(card, { ...rest, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'expo.out' });
        } else {
            gsap.fromTo(card, overTile(tile), { ...rest, scale: 1, duration: 0.55, ease: 'expo.out' });
            gsap.fromTo(card, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ease: 'none' });
        }
    };

    // Shrinks back into the tile it came from.
    const hide = () => {
        if (current === null) return;
        const tile = tileRect(current);
        current = null;
        gsap.killTweensOf(card);
        if (calm) {
            gsap.to(card, { autoAlpha: 0, duration: 0.12 });
            return;
        }
        gsap.to(card, { ...overTile(tile), duration: 0.3, ease: 'power3.in' });
        gsap.to(card, { autoAlpha: 0, duration: 0.12, delay: 0.18, ease: 'none' });
    };

    links.forEach((link, index) => {
        link.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'mouse') show(index);
        });
        link.addEventListener('focus', () => show(index));
    });
    container.addEventListener('pointerleave', hide);
    container.addEventListener('focusout', (event) => {
        if (!container.contains(event.relatedTarget)) hide();
    });
    // The card is pinned to the viewport; any scroll would leave it behind.
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('blur', hide);
    container.classList.add('has-peek');
}
