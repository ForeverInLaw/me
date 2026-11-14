// The places to find me: a row of icon tiles in the bio column. The tiles are
// too small to carry their names, so the line under them reads the one being
// hovered or focused - its name and the handle to look for there. One reading
// blurs into the next where it stands (softSwap).
//
// The row is also something to play with. It leans toward the tile in hand,
// which lifts while the ones beside it follow by less and less, and the icon
// on that tile makes a small move of its own (bio.css draws both).

import { softSwap } from './text-swap.js';
import { motionToken } from './motion-tokens.js';

/** The address of the email tile, kept in pieces in the markup away from scrapers. */
const addressOf = ({ user, host, tld }) => (user && host && tld ? `${user}@${host}.${tld}` : '');

const handleOf = (link) => link.dataset.handle || addressOf(link.dataset);

/** What the caption says about `link`: its name, then its handle when it has one. */
function describe(link) {
    const name = Object.assign(document.createElement('b'), { textContent: link.ariaLabel });
    const handle = handleOf(link);
    return handle ? [name, ` ${handle}`] : [name];
}

/** The moves the icon on `link` is making right now. */
const moves = (link) => link.getAnimations({ subtree: true }).filter((animation) => animation instanceof CSSAnimation);

/**
 * Has the icon on `link` make its move, once and to the end. An icon already
 * moving is left to it, so running back and forth over a tile cannot restart
 * the move halfway.
 */
function wake(link) {
    if (moves(link).length) return;
    link.classList.add('is-waking');
    Promise.allSettled(moves(link).map((move) => move.finished))
        .then(() => link.classList.remove('is-waking'));
}

export function initSocials() {
    const row = document.querySelector('.socials__row');
    const caption = document.getElementById('socials-caption');
    if (!row || !caption) return;

    const links = Array.from(row.querySelectorAll('.social'));
    const falloff = parseFloat(motionToken('--lean-falloff'));

    /** Leans the row toward `link`; toward none, it settles back. */
    const lean = (toward) => {
        const at = links.indexOf(toward);
        links.forEach((link, index) => {
            link.style.setProperty('--lean', at < 0 ? 0 : falloff ** Math.abs(index - at));
        });
    };

    const rest = () => {
        softSwap(caption, `${links.length} places to find me`);
        lean(null);
    };
    const attend = (link) => {
        softSwap(caption, ...describe(link));
        lean(link);
        wake(link);
    };

    links.forEach((link) => {
        // A finger has no hover: its tap goes straight through and reads nothing.
        link.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'mouse') attend(link);
        });
        link.addEventListener('focus', () => {
            if (link.matches(':focus-visible')) attend(link);
        });
        link.addEventListener('blur', rest);
    });
    // On the row, not each tile: crossing the gap between two keeps the line
    // still and the row leaning.
    row.addEventListener('pointerleave', rest);
    rest();

    const email = row.querySelector('.social--email');
    const address = email && addressOf(email.dataset);
    if (!address) return;
    email.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = `mailto:${address}`;
    });
}
