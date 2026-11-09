/* global gsap -- loaded as a classic script before the modules (index.html). */
// Hover window for the playlist row. The hovered cover lifts out of its tile
// and opens into a card above the row: the first frame is the tile itself,
// then the frame widens around the cover into the card while the name,
// description and size settle in. Leaving folds it back into the tile. Moving
// along the row keeps the card open: it slides over, the next cover wipes in
// from the side the pointer came from (shot-stack.js), the old text blurs out,
// the new one comes into focus and the card eases to its new height. Pointer and keyboard only; on touch the tiles
// stay plain links.

import { canHoverPreview, prefersReducedMotion } from './viewport.js';
import { safeUrl } from './remote.js';
import { createShotStack } from './shot-stack.js';

const WIDTH = 248;        // css/playlist-peek.css sets the same width
const INSET = 8;          // card padding around the cover
const COVER = WIDTH - INSET * 2;
const CARD_RADIUS = 16;   // --radius-lg
const GAP = 12;           // between the card and the row
const EDGE = 12;          // keep-out from the viewport edges
const FULL_CLIP = `inset(0px 0px 0px 0px round ${CARD_RADIUS}px)`;
const SLIDE = { duration: 0.45, ease: 'expo.out' };
const TEXT_BLUR = 'blur(4px)'; // the text passes through this as it changes

const el = (tag, className) => Object.assign(document.createElement(tag), { className });

// Spotify sends descriptions HTML-encoded ("&#x27;", the odd <a>); DOMParser
// reads them without running anything, and textContent keeps only the words.
const plainText = (html) => new DOMParser().parseFromString(html, 'text/html').documentElement.textContent.trim();

/**
 * Clips the card down to its cover. Corners are given in screen pixels and
 * divided by `scale`, so at the tile's size they match the tile's own.
 */
const coverClip = (height, scale, radius) =>
    `inset(${INSET}px ${INSET}px ${height - INSET - COVER}px ${INSET}px round ${radius / scale}px)`;

// The outer element moves and carries the shadow; the inner card is clipped,
// since a clip on the shadow's own element would cut the shadow off with it.
function createPeek() {
    const peek = el('div', 'playlist-peek');
    peek.setAttribute('aria-hidden', 'true');
    const card = el('div', 'playlist-peek__card');
    const cover = el('div', 'playlist-peek__cover');
    const body = el('div', 'playlist-peek__body');
    const name = el('p', 'playlist-peek__name');
    const desc = el('p', 'playlist-peek__desc');
    const meta = el('p', 'playlist-peek__meta');
    body.append(name, desc, meta);
    card.append(cover, body);
    peek.append(card);
    document.body.append(peek);
    return { peek, card, body, cover, name, desc, meta };
}

/**
 * Where the card rests for `tile`: centred over it but kept within the row's
 * edges, above the row, or below it when there is no room above.
 */
function restFor(tile, row, peek) {
    const height = peek.offsetHeight;
    const left = Math.max(EDGE, row.left);
    const right = Math.min(window.innerWidth - EDGE, row.right);
    const x = gsap.utils.clamp(left, Math.max(left, right - WIDTH), tile.left + tile.width / 2 - WIDTH / 2);
    const above = tile.top - GAP - height;
    return { x, y: above >= EDGE ? above : tile.bottom + GAP };
}

/** The transform that lays the card's cover exactly over `tile`. */
function overTile(tile) {
    const scale = tile.width / COVER;
    return { x: tile.left - INSET * scale, y: tile.top - INSET * scale, scale };
}

/** Reduced motion: the card just fades in and out where it rests. */
function createCalmMotion({ peek, card, body }) {
    const stop = () => gsap.killTweensOf(peek);
    return {
        grow(tile, rest) {
            stop();
            gsap.set(peek, { ...rest, scale: 1 });
            gsap.set(card, { clipPath: FULL_CLIP });
            gsap.set(body, { autoAlpha: 1, y: 0 });
            gsap.to(peek, { autoAlpha: 1, duration: 0.15 });
        },
        slide(x, apply) {
            stop();
            gsap.set(peek, { ...apply(), autoAlpha: 1 });
        },
        shrink(tile, radius, done) {
            stop();
            gsap.to(peek, { autoAlpha: 0, duration: 0.12, onComplete: done });
        }
    };
}

/**
 * The three moves: open out of a tile, slide to another, fold back into one.
 * `slide` gets the card's new left edge, which the content does not change,
 * and an `apply` callback that swaps the content in and returns where the card
 * now rests, so the heights before and after the text change can be measured.
 */
function createMotion({ peek, card, body }) {
    const OPEN = { duration: 0.6, ease: 'expo.out' };
    const FOLD = { duration: 0.34, ease: 'power3.inOut' };
    const stop = () => gsap.killTweensOf([peek, card, body]);
    return {
        grow(tile, rest, radius) {
            stop();
            const from = overTile(tile);
            gsap.set(peek, { autoAlpha: 1 });
            gsap.fromTo(peek, from, { ...rest, scale: 1, ...OPEN });
            gsap.fromTo(card, { clipPath: coverClip(card.offsetHeight, from.scale, radius) }, { clipPath: FULL_CLIP, ...OPEN });
            gsap.fromTo(body, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, delay: 0.16, ease: 'power2.out' });
        },
        slide(x, apply) {
            stop();
            // Caught halfway into its fold, the card is still small and low
            // over the tile: it rises as it grows back, on the slide's curve,
            // or it would swell down over the row first.
            const folding = gsap.getProperty(peek, 'scale') < 0.999;
            gsap.set(peek, { autoAlpha: 1 });
            gsap.to(peek, { x, scale: 1, ...SLIDE });
            gsap.to(card, { clipPath: FULL_CLIP, duration: 0.3, ease: 'power2.out' });

            // Runs once the old text has blurred out: the new text goes in,
            // the card's top and height ease together on one curve (so its
            // bottom edge stays put over the row), and the text comes into
            // focus where it stands.
            const swap = () => {
                const before = card.offsetHeight;
                gsap.set(card, { clearProps: 'height' });
                const { y } = apply();
                const after = card.offsetHeight;
                const RESIZE = folding ? SLIDE : { duration: 0.3, ease: 'power2.inOut' };
                gsap.to(peek, { y, ...RESIZE });
                gsap.fromTo(card, { height: before }, { height: after, ...RESIZE, clearProps: 'height' });
                gsap.fromTo(body, { autoAlpha: 0, filter: TEXT_BLUR, y: 0 },
                    { autoAlpha: 1, filter: 'blur(0px)', duration: 0.35, ease: 'sine.out', clearProps: 'filter' });
            };
            // The fold has already faded the text; otherwise it leaves first.
            if (folding) swap();
            else gsap.to(body, { autoAlpha: 0, filter: TEXT_BLUR, duration: 0.15, ease: 'power1.in', onComplete: swap });
        },
        shrink(tile, radius, done) {
            stop();
            const to = overTile(tile);
            gsap.to(body, { autoAlpha: 0, duration: 0.12 });
            gsap.to(card, { clipPath: coverClip(card.offsetHeight, to.scale, radius), ...FOLD });
            gsap.to(peek, {
                ...to,
                ...FOLD,
                onComplete: () => {
                    gsap.set(peek, { autoAlpha: 0 });
                    done();
                }
            });
        }
    };
}

/**
 * Marks which tile's cover is out in the card; that tile shows an empty
 * socket. `snap` swaps instantly, for when the card itself sits over the tile
 * (opening out of it, folding back in); otherwise the covers cross-fade.
 */
function createSockets(container, links) {
    let lifted = null;
    return {
        get index() {
            return lifted;
        },
        lift(index, snap) {
            if (snap) container.classList.add('is-snapping');
            links[lifted]?.classList.remove('is-lifted');
            lifted = index;
            links[index]?.classList.add('is-lifted');
            if (!snap) return;
            void container.offsetWidth; // apply the change with transitions off
            container.classList.remove('is-snapping');
        }
    };
}

/** Wires the window to the `.playlist` links rendered from `playlists`. */
export function attachPlaylistPeek(container, playlists) {
    if (!canHoverPreview()) return;

    const calm = prefersReducedMotion();
    const parts = createPeek();
    const motion = calm ? createCalmMotion(parts) : createMotion(parts);
    const shots = createShotStack(parts.cover, {
        calm,
        axis: 'x',
        zoom: 1,
        onState: (state) => { parts.peek.dataset.state = state; }
    });
    const links = Array.from(container.querySelectorAll('.playlist'));
    const sockets = createSockets(container, links);
    const tileRect = (index) => links[index].closest('li').getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(links[0].querySelector('img')).borderTopLeftRadius) || 0;
    let current = null;

    gsap.set(parts.peek, { transformOrigin: '0 0', autoAlpha: 0 });

    const fill = (playlist) => {
        parts.name.textContent = playlist.name.trim();
        parts.desc.textContent = plainText(playlist.description || '');
        parts.meta.textContent = `${playlist.tracks} tracks`;
    };

    const show = (index) => {
        if (index === current) return;
        // Still on screen, even halfway folded, counts as open: slide, don't regrow.
        const open = gsap.getProperty(parts.peek, 'opacity') > 0;
        const direction = index >= (current ?? sockets.index ?? index) ? 1 : -1;
        current = index;
        const playlist = playlists[index];
        const tile = tileRect(index);
        const place = () => restFor(tile, container.getBoundingClientRect(), parts.peek);

        if (open) {
            motion.slide(place().x, () => {
                fill(playlist);
                return place();
            });
            shots.wipeTo(safeUrl(playlist.image), '', direction);
        } else {
            gsap.set(parts.card, { clearProps: 'height' });
            fill(playlist);
            motion.grow(tile, place(), radius);
            shots.reveal(safeUrl(playlist.image), '');
        }
        if (!calm) sockets.lift(index, !open);
    };

    const hide = () => {
        if (current === null) return;
        const index = current;
        current = null;
        motion.shrink(tileRect(index), radius, () => {
            sockets.lift(null, true);
            shots.reset();
        });
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
