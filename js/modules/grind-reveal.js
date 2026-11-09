// How "The grind" arrives: its figures brighten one by one, the heatmap plays
// the year week by week, then the latest pushes, the year's records and the
// latest commits step in while the day's hours go round the dial. Each part
// is "the first N of these are lit", so one progress value drives them all
// and running it backwards undoes them. The easing is CSS (works-scroll.css).

// Each part's share of the arrival, as [from, to] of the overall progress.
// They overlap so the eye is handed down the section: sentence, year, pushes,
// records, then the hours and the commits side by side.
const FIGURES = [0.12, 0.5];
const WEEKS = [0.3, 0.95];
const PUSHES = [0.7, 0.95];
const RECORDS = [0.8, 0.9];
const HOURS = [0.7, 1];
const COMMITS = [0.85, 1];

const DAYS_PER_WEEK = 7;

/**
 * Returns `light(share)`: lights the leading `share` (0..1) of `groups`, each
 * a list of elements, touching only the groups whose state changes.
 */
function createLighter(groups) {
    let lit = 0;
    return (share) => {
        const next = Math.round(share * groups.length);
        for (let i = Math.min(lit, next); i < Math.max(lit, next); i += 1) {
            groups[i].forEach((el) => el.classList.toggle('is-lit', i < next));
        }
        lit = next;
    };
}

/** Where `progress` falls inside `[from, to]`, as 0..1. */
const within = (progress, [from, to]) => Math.min(1, Math.max(0, (progress - from) / (to - from)));

/**
 * Unlights the rendered section and returns `arrive(progress)`, which lights
 * it back up to `progress` (0..1). Call it once the section has its data.
 */
export function stageGrind(section) {
    // The grid fills column by column, so every seven cells are one week.
    const cells = Array.from(section.querySelectorAll('.heatmap__cell'));
    const weeks = [];
    cells.forEach((cell, i) => {
        cell.style.setProperty('--row', String(i % DAYS_PER_WEEK));
        (weeks[Math.floor(i / DAYS_PER_WEEK)] ??= []).push(cell);
    });
    const singly = (selector) => Array.from(section.querySelectorAll(selector), (el) => [el]);

    const parts = [
        [createLighter(singly('.grind__sentence strong')), FIGURES],
        [createLighter(weeks), WEEKS],
        [createLighter(singly('.pushes__list li')), PUSHES],
        [createLighter(singly('.grind__records')), RECORDS],
        [createLighter(singly('.dial__bar')), HOURS],
        [createLighter(singly('.commits__list li')), COMMITS],
    ];
    section.classList.add('is-staged');

    return (progress) => parts.forEach(([light, range]) => light(within(progress, range)));
}
