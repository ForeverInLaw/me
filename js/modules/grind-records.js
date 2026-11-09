// The year's records (year-records.js) as a second sentence under the heatmap.
// With a hovering pointer each record points at its days: the rest of the
// year dims while the pointer is on it.

import { yearRecords } from './year-records.js';
import { canHoverPreview } from './viewport.js';

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
    const pointing = canHoverPreview();

    target.replaceChildren(...recordParts(records, dayAt).map(([text, covers]) => {
        if (!covers) return text;
        const record = Object.assign(document.createElement('strong'), { textContent: text });
        if (pointing) {
            record.addEventListener('pointerenter', () => markDays(grid, covers));
            record.addEventListener('pointerleave', () => markDays(grid));
        }
        return record;
    }));
}
