// The places to find me: a row of icon tiles in the bio column. The tiles are
// too small to carry their names, so the line under them reads the one being
// hovered or focused - its name and the handle to look for there. One reading
// blurs into the next where it stands (softSwap).

import { softSwap } from './text-swap.js';

/** The address of the email tile, kept in pieces in the markup away from scrapers. */
const addressOf = ({ user, host, tld }) => (user && host && tld ? `${user}@${host}.${tld}` : '');

const handleOf = (link) => link.dataset.handle || addressOf(link.dataset);

/** What the caption says about `link`: its name, then its handle when it has one. */
function describe(link) {
    const name = Object.assign(document.createElement('b'), { textContent: link.ariaLabel });
    const handle = handleOf(link);
    return handle ? [name, ` ${handle}`] : [name];
}

export function initSocials() {
    const row = document.querySelector('.socials__row');
    const caption = document.getElementById('socials-caption');
    if (!row || !caption) return;

    const links = Array.from(row.querySelectorAll('.social'));
    const rest = () => softSwap(caption, `${links.length} places to find me`);
    const read = (link) => softSwap(caption, ...describe(link));

    links.forEach((link) => {
        // A finger has no hover: its tap goes straight through and reads nothing.
        link.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'mouse') read(link);
        });
        link.addEventListener('focus', () => {
            if (link.matches(':focus-visible')) read(link);
        });
        link.addEventListener('blur', rest);
    });
    // On the row, not each tile: crossing the gap between two keeps the line still.
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
