// "The grind": renders assets/github.json (written daily by scripts/github-stats.mjs)
// as a sentence of totals, a contribution heatmap in the site palette and the
// latest public pushes.

const DATA_URL = 'assets/github.json';
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
 * Upper bounds for levels 1..3, taken from the quartiles of the active days.
 * Quartiles rather than a linear scale, so one 500-commit day does not flatten
 * the rest of the year into the lowest shade.
 */
export function levelThresholds(counts) {
    const active = counts.filter((count) => count > 0).sort((a, b) => a - b);
    if (!active.length) return [];
    const at = (q) => active[Math.min(active.length - 1, Math.floor(q * active.length))];
    return [at(0.25), at(0.5), at(0.75)];
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

function renderHeatmap(grid, months, caption, { start, counts }, total) {
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const offset = new Date(startMs).getUTCDay(); // weeks run Sunday..Saturday, like GitHub
    const thresholds = levelThresholds(counts);
    const dayAt = (i) => new Date(startMs + i * DAY_MS);

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

    const resting = `${total.toLocaleString('en')} contributions in the last year`;
    grid.setAttribute('aria-label', resting);
    caption.textContent = resting;

    grid.addEventListener('pointerover', (event) => {
        const i = event.target.dataset?.i;
        if (i === undefined) return;
        const count = counts[Number(i)];
        caption.textContent = `${count || 'No'} contribution${count === 1 ? '' : 's'} · ${dateFormat.format(dayAt(Number(i)))}`;
    });
    grid.addEventListener('pointerleave', () => { caption.textContent = resting; });

    // On narrow screens the year scrolls sideways; open on the latest weeks.
    const scroller = grid.closest('.heatmap__scroll');
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
}

function renderRecent(list, recent) {
    list.replaceChildren(...recent.map((repo) => {
        const [owner, name] = repo.name.split('/');
        const link = el('a', 'push');
        link.href = repo.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const title = el('span', 'push__name');
        title.append(el('span', 'push__owner', `${owner}/`), el('strong', '', name));
        const meta = el('span', 'push__meta');
        if (repo.language) {
            const dot = el('i', 'push__lang');
            if (repo.color) dot.style.setProperty('--lang', repo.color);
            meta.append(dot, `${repo.language} · `);
        }
        const time = el('time', '', timeAgo(repo.pushedAt));
        time.dateTime = repo.pushedAt;
        meta.append(time);

        link.append(title, meta);
        const item = el('li');
        item.append(link);
        return item;
    }));
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

    renderSentence(sentence, data.totals);
    renderHeatmap(section.querySelector('#heatmap'), section.querySelector('#heatmap-months'),
        section.querySelector('#heatmap-caption'), data.calendar, data.totals.contributions);
    renderRecent(section.querySelector('#recent-pushes'), data.recent);
    section.classList.add('is-ready');
}
