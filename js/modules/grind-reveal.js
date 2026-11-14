// How "The grind" arrives: its two charts draw themselves as they come up the
// screen. The heatmap plays the year week by week and the day's hours go round
// the dial; the words and the lists around them are simply there.
//
// A part is "the first N of these are lit". How much of it has crossed a line
// near the bottom of the screen says how many should be, and the part gets
// there one piece at a time: flicked past, it still plays out in order, and
// scrolling back undoes it. Each part goes by its own place on the screen, so
// one a few screens down a phone waits to be seen. The easing is CSS
// (works-scroll.css).

import { motionMs } from './motion-tokens.js';

// The line sits this share of the screen's height above its bottom edge.
const LINE_MARGIN = 0.15;
// Between two weeks of the year. Faster than any token: all 53 of them are to
// pass in about two thirds of a second.
const WEEK_GAP_MS = 12;
const DAYS_PER_WEEK = 7;

/** How much of a box `height` tall, with its top at `top`, lies above `line`: 0..1. */
export function shareAbove(top, height, line) {
    if (height <= 0) return 0;
    return Math.min(1, Math.max(0, (line - top) / height));
}

/**
 * Returns `light(share)`: sets the leading `share` (0..1) of `groups`, each a
 * list of elements, as how many are to be lit. They follow one group every
 * `gap` ms, the first at once.
 */
function createLighter(groups, gap) {
    let lit = 0;
    let aim = 0;
    let waiting = 0;

    const step = () => {
        waiting = 0;
        if (lit === aim) return;
        const lighting = aim > lit;
        groups[lighting ? lit : lit - 1].forEach((el) => el.classList.toggle('is-lit', lighting));
        lit += lighting ? 1 : -1;
        if (lit !== aim) waiting = setTimeout(step, gap);
    };

    return (share) => {
        aim = Math.round(share * groups.length);
        if (!waiting) step();
    };
}

/**
 * Unlights the section's charts and lights them back as they come up the
 * screen. Call it once the section has its data.
 */
export function stageGrind(section) {
    // The grid fills column by column, so every seven cells are one week.
    const cells = Array.from(section.querySelectorAll('.heatmap__cell'));
    const weeks = [];
    cells.forEach((cell, i) => {
        cell.style.setProperty('--row', String(i % DAYS_PER_WEEK));
        (weeks[Math.floor(i / DAYS_PER_WEEK)] ??= []).push(cell);
    });
    const hours = Array.from(section.querySelectorAll('.dial__bar'), (bar) => [bar]);

    // Each part: the box whose passage up the screen lights it, its pieces in
    // order, and the beat between two of them.
    const parts = [
        ['.heatmap', weeks, WEEK_GAP_MS],
        ['.dial__face', hours, motionMs('--stagger-stagger')],
    ]
        .filter(([, groups]) => groups.length)
        .map(([over, groups, gap]) => ({ over: section.querySelector(over), light: createLighter(groups, gap) }));
    section.classList.add('is-staged');

    const watch = () => {
        const screen = window.innerHeight;
        // At the end of the page nothing can come any higher: the line drops
        // to the bottom edge with what is left to scroll, so the last parts
        // light too.
        const left = document.documentElement.scrollHeight - screen - window.scrollY;
        const mark = screen - Math.min(screen * LINE_MARGIN, Math.max(0, left));
        // Every box is read before anything is lit, so no part is measured
        // against styles another has just changed.
        const shares = parts.map(({ over }) => {
            const box = over.getBoundingClientRect();
            return shareAbove(box.top, box.height, mark);
        });
        // The transitions come on with the first step of the arrival, never
        // with the staging itself (works-scroll.css).
        if (shares.some((share) => share > 0)) section.classList.add('is-arriving');
        parts.forEach(({ light }, i) => light(shares[i]));
    };

    window.addEventListener('scroll', watch, { passive: true });
    window.addEventListener('resize', watch);
    watch();
}
