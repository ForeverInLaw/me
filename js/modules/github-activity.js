// "The grind": renders assets/github.json (written daily by scripts/github-stats.mjs)
// as a sentence of totals, a contribution heatmap in the site palette, the
// year's records (grind-records.js), the latest public pushes and commits, and
// the commits by hour of the day (day-dial.js).

import { renderDayDial } from './day-dial.js';
import { renderRecords } from './grind-records.js';

const DATA_URL = 'assets/github.json';
const OWN_LOGIN = 'ForeverInLaw';
const DAY_MS = 86_400_000;
const LEVELS = 4;

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** 6483 -> "6.5k", 513 -> "513". */
export function compactNumber(value) {
    if (value < 1000) return String(value);
    const thousands = value / 1000;
    return `${thousands >= 10 ? Math.round(thousands) : Number(thousands.toFixed(1))}k`;
}

/**
 * Upper bounds for levels 1..3, taken from percentiles of the active days.
 * Percentiles rather than a linear scale, so one 500-commit day does not
 * flatten the rest of the year; skewed high so the brightest shade marks only
 * the busiest ~15% of days instead of every fourth one.
 */
export function levelThresholds(counts) {
    const active = counts.filter((count) => count > 0).sort((a, b) => a - b);
    if (!active.length) return [];
    const at = (q) => active[Math.min(active.length - 1, Math.floor(q * active.length))];
    return [at(0.3), at(0.6), at(0.85)];
}

/** 0 for an empty day, otherwise 1..4 against the thresholds. */
export function levelFor(count, thresholds) {
    if (count <= 0) return 0;
    const index = thresholds.findIndex((bound) => count <= bound);
    return index === -1 ? LEVELS : index + 1;
}

/** "3 hours ago", "yesterday", "2 weeks ago" from an ISO timestamp. */
export function timeAgo(iso, now = Date.now()) {
    const seconds = (new Date(iso).getTime() - now) / 1000;
    const units = [['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
    }
    return 'just now';
}

const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

function renderSentence(target, { commits, pullRequests, issues, repos }) {
    // Even entries are the figures, odd ones the words between them.
    const parts = [
        `${compactNumber(commits)} commits`, ', ',
        `${compactNumber(pullRequests)} pull requests`, ' and ',
        `${compactNumber(issues)} issues`, ' across ',
        `${repos} repos`, ' in the last year.',
    ];
    target.replaceChildren(...parts.map((text, i) => (i % 2 === 0 ? el('strong', '', text) : text)));
}

/** `dayAt(index)` for a calendar starting on `start` ("2026-01-31"): the date of its day `index`. */
function calendarDays(start) {
    const startMs = Date.parse(`${start}T00:00:00Z`);
    return (i) => new Date(startMs + i * DAY_MS);
}

/** Draws the year of `counts` into the section's heatmap and returns its grid. */
function renderHeatmap(section, counts, dayAt, total) {
    const grid = section.querySelector('#heatmap');
    const months = section.querySelector('#heatmap-months');
    const tip = section.querySelector('#heatmap-tip');
    const offset = dayAt(0).getUTCDay(); // weeks run Sunday..Saturday, like GitHub
    const thresholds = levelThresholds(counts);

    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(el('span', 'heatmap__cell is-pad'));
    counts.forEach((count, i) => {
        const cell = el('span', 'heatmap__cell');
        cell.dataset.level = String(levelFor(count, thresholds));
        cell.dataset.i = String(i);
        cells.push(cell);
    });
    grid.replaceChildren(...cells);
    const weeks = Math.ceil(cells.length / 7);
    grid.style.setProperty('--weeks', String(weeks));
    months.style.setProperty('--weeks', String(weeks));

    // A month label sits over the first week that starts inside that month.
    const labels = [];
    let lastMonth = -1;
    for (let week = 0; week < weeks; week++) {
        const first = dayAt(Math.max(0, week * 7 - offset));
        if (first.getUTCMonth() === lastMonth) continue;
        lastMonth = first.getUTCMonth();
        if (week > weeks - 3 && labels.length) continue; // no clipped label at the right edge
        const label = el('span', '', monthFormat.format(first));
        label.style.gridColumn = `${week + 1} / span 3`;
        labels.push(label);
    }
    months.replaceChildren(...labels);

    const summary = `${total.toLocaleString('en')} contributions`;
    grid.setAttribute('aria-label', `${summary} in the last year`);
    section.querySelector('#grind-total').textContent = summary;

    // Day details float over the hovered cell, like GitHub's tooltip, instead
    // of a caption line that would pad the panel's bottom.
    const panel = grid.closest('.heatmap');
    grid.addEventListener('pointerover', (event) => {
        const i = event.target.dataset?.i;
        if (i === undefined) return;
        const count = counts[Number(i)];
        tip.textContent = `${count || 'No'} contribution${count === 1 ? '' : 's'} · ${dateFormat.format(dayAt(Number(i)))}`;
        const cell = event.target.getBoundingClientRect();
        const box = panel.getBoundingClientRect();
        tip.style.setProperty('--x', `${cell.left - box.left + cell.width / 2}px`);
        tip.style.setProperty('--y', `${cell.top - box.top}px`);
        tip.classList.add('is-visible');
    });
    grid.addEventListener('pointerleave', () => tip.classList.remove('is-visible'));

    // On narrow screens the year scrolls sideways; open on the latest weeks.
    const scroller = grid.closest('.heatmap__scroll');
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
    return grid;
}

function renderRecent(list, recent) {
    list.replaceChildren(...recent.map((repo) => {
        const [owner, name] = repo.name.split('/');
        const link = el('a', 'push');
        link.href = repo.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        // Language rides as a coloured dot before the name; the row only has
        // room for the name and how long ago it was pushed.
        const title = el('span', 'push__name');
        const dot = el('i', 'push__lang');
        dot.setAttribute('aria-hidden', 'true');
        if (repo.color) dot.style.setProperty('--lang', repo.color);
        if (repo.language) dot.title = repo.language;
        title.append(dot);
        // Own repos go by name alone; orgs keep their prefix so they read as someone else's.
        if (owner !== OWN_LOGIN) title.append(el('span', 'push__owner', `${owner}/`));
        title.append(el('strong', '', name));

        const meta = el('time', 'push__meta', timeAgo(repo.pushedAt));
        meta.dateTime = repo.pushedAt;

        link.append(title, meta);
        const item = el('li');
        item.append(link);
        return item;
    }));
}

/** The latest public commits, one line each: what it says, where, how long ago. */
function renderCommits(block, commits) {
    if (!commits?.length) return;
    block.querySelector('#latest-commits').replaceChildren(...commits.map((commit) => {
        const link = el('a', 'commit');
        link.href = commit.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const [owner, name] = commit.repo.split('/');
        const when = el('time', 'commit__when', timeAgo(commit.at));
        when.dateTime = commit.at;
        // Own repos go by name alone here too.
        link.append(el('span', 'commit__message', commit.message), el('span', 'commit__repo', owner === OWN_LOGIN ? name : commit.repo), when);

        const item = el('li');
        item.append(link);
        return item;
    }));
    block.hidden = false;
}

export async function initGithubActivity() {
    const section = document.querySelector('.grind');
    if (!section) return;
    const sentence = section.querySelector('#grind-sentence');

    let data;
    try {
        const res = await fetch(DATA_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
    } catch (error) {
        console.error('GitHub activity failed to load:', error);
        sentence.textContent = 'GitHub activity is unavailable right now.';
        section.classList.add('is-error');
        return;
    }

    const { counts } = data.calendar;
    const dayAt = calendarDays(data.calendar.start);

    renderSentence(sentence, data.totals);
    const heatmap = renderHeatmap(section, counts, dayAt, data.totals.contributions);
    renderRecords(section.querySelector('#grind-records'), heatmap, counts, dayAt);
    if (data.hours) renderDayDial(section.querySelector('#day-dial'), data.hours);
    renderCommits(section.querySelector('#commit-log'), data.commits);
    renderRecent(section.querySelector('#recent-pushes'), data.recent);
    section.classList.add('is-ready');
}
