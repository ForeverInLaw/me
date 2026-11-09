// The year's records (year-records.js) as a second sentence under the heatmap.
// Each record points at its days: hovered or tapped, it leaves them lit and
// dims the rest of the year.

import { yearRecords } from './year-records.js';
import { prefersReducedMotion } from './viewport.js';

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayName = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** Leaves only the days `covers(index)` accepts lit on the heatmap; with no `covers`, all of them. */
function markDays(grid, covers) {
    grid.classList.toggle('is-marking', Boolean(covers));
    grid.querySelectorAll('.heatmap__cell[data-i]').forEach((cell) => {
        cell.classList.toggle('is-marked', Boolean(covers?.(Number(cell.dataset.i))));
    });
}

/**
 * The sentence as [text, covers] pairs: a pair with `covers` is a record, and
 * `covers(index)` tells which days of the year it is about.
 */
function recordParts({ streak, peak, weekday }, dayAt) {
    const date = (i) => dayMonth.format(dayAt(i));
    const streakEnd = streak.start + streak.length - 1;
    const isLoudest = (i) => dayAt(i).getUTCDay() === weekday.day;
    // Its first occurrence in the year, to take the name from.
    const loudest = weekdayName.format(dayAt((weekday.day - dayAt(0).getUTCDay() + 7) % 7));

    return [
        ['The longest streak ran '],
        [`${streak.length} days`, (i) => i >= streak.start && i <= streakEnd],
        [`, from ${date(streak.start)} to ${date(streakEnd)}. The loudest day was `],
        [`${date(peak.index)} with ${peak.count.toLocaleString('en')} contributions`, (i) => i === peak.index],
        [', and '],
        [`${loudest}s`, isLoudest],
        [' carry the most.'],
    ];
}

/**
 * Writes the records of `counts` into `target`. `grid` is the rendered
 * heatmap and `dayAt(index)` the date of a day of the year.
 */
export function renderRecords(target, grid, counts, dayAt) {
    const records = yearRecords(counts, dayAt(0).getUTCDay());
    if (!records) return;

    const pointers = new Map(); // each record's element -> its `covers`
    target.replaceChildren(...recordParts(records, dayAt).map(([text, covers]) => {
        if (!covers) return text;
        const record = Object.assign(document.createElement('strong'), { textContent: text });
        pointers.set(record, covers);
        return record;
    }));
    watchRecords(target, grid, pointers);
}

/**
 * Lets each record in `pointers` point at its days. A mouse points by
 * hovering. A finger points by tapping: the heatmap, which scrolls sideways
 * on a phone, comes round to the days, and a tap on the record again or on
 * anything but the heatmap lets go.
 */
function watchRecords(target, grid, pointers) {
    let pointed = null;
    let byTouch = false; // the press in progress came from a finger or pen

    const point = (record) => {
        pointed?.classList.remove('is-pointed');
        pointed = record;
        record?.classList.add('is-pointed');
        markDays(grid, pointers.get(record));
    };

    /** Brings the latest of the marked days into view, sideways and on the page. */
    const reveal = () => {
        const marked = grid.querySelectorAll('.is-marked');
        marked[marked.length - 1]?.scrollIntoView({
            block: 'nearest', inline: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
    };

    pointers.forEach((covers, record) => {
        record.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'mouse') point(record);
        });
        record.addEventListener('pointerleave', (event) => {
            if (event.pointerType === 'mouse') point(null);
        });
        record.addEventListener('pointerdown', (event) => {
            byTouch = event.pointerType !== 'mouse';
        });
        record.addEventListener('click', () => {
            if (!byTouch) return;
            point(pointed === record ? null : record);
            if (pointed) reveal();
        });
    });

    // A click, not a press: scrolling the page to look at the year keeps the mark.
    const keeps = (node) => target.contains(node) || grid.closest('.heatmap').contains(node);
    document.addEventListener('click', (event) => {
        if (pointed && !keeps(event.target)) point(null);
    });
}
