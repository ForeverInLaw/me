// "Around the clock": the year's commits by hour of the day, as a 24-hour dial
// with midnight at the top. Every hour has a track the full height of the
// scale and its bar on it, so a quiet hour reads as a low bar rather than as a
// gap in the dial. A mark travels the rim inside them at the current time in
// the zone the hours were counted in, and the middle reads the hour it is in;
// pointing at another hour reads that one instead.

const SVG_NS = 'http://www.w3.org/2000/svg';
const HOURS = 24;
// Geometry, in units of the 280-unit viewBox (index.html).
const CENTER = 140;
const RIM = 50; // the circle round the readout, which the "now" mark travels
const BASE = 60; // the radius the bars stand on
const REACH = 52; // how far the busiest hour's bar rises from it
const STUB = 3; // an hour with nothing still leaves a mark
const NUMERALS = 128;
const LABELLED = [0, 6, 12, 18];
// The hours called "after dark" in the note under the dial.
const NIGHT = [20, 6];
const TICK_MS = 30_000;

const pad = (n) => String(n).padStart(2, '0');

const svg = (tag, attrs) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
    return node;
};

const turned = (degrees) => `rotate(${degrees} ${CENTER} ${CENTER})`;

/** The share (0..1) of `counts` between the hours `from` and `to`; a range may wrap past midnight. */
export function shareBetween(counts, [from, to]) {
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (!total) return 0;
    const inside = (hour) => (from < to ? hour >= from && hour < to : hour >= from || hour < to);
    return counts.reduce((sum, count, hour) => sum + (inside(hour) ? count : 0), 0) / total;
}

/** A line `length` long standing on the bars' radius, in the middle of `hour`'s slice of the dial. */
const spoke = (hour, length, attrs) => svg('line', {
    x1: CENTER, y1: CENTER - BASE,
    x2: CENTER, y2: CENTER - BASE - length,
    transform: turned((hour + 0.5) * 360 / HOURS),
    ...attrs,
});

/** A track per hour, then on each the hour's bar; returns the bars. */
function drawBars(plot, counts) {
    const busiest = Math.max(...counts);
    plot.append(...counts.map((_, hour) => spoke(hour, REACH, { class: 'dial__track' })));
    return counts.map((count, hour) => {
        const share = count / busiest;
        // Its length counts as 1 whatever it is, so the stylesheet can draw
        // any bar from its foot by one dash (day-dial.css).
        const bar = spoke(hour, STUB + share * (REACH - STUB), { class: 'dial__bar', pathLength: 1 });
        bar.style.setProperty('--share', share.toFixed(3));
        plot.append(bar);
        return bar;
    });
}

function drawNumerals(plot) {
    LABELLED.forEach((hour) => {
        const angle = hour / HOURS * 2 * Math.PI;
        const numeral = svg('text', {
            class: 'dial__numeral',
            x: CENTER + Math.sin(angle) * NUMERALS,
            y: CENTER - Math.cos(angle) * NUMERALS,
        });
        numeral.textContent = pad(hour);
        plot.append(numeral);
    });
}

/** The hour of the dial under a pointer event, by its angle around the middle. */
function hourUnder(event, plot) {
    const box = plot.getBoundingClientRect();
    const x = event.clientX - (box.left + box.width / 2);
    const y = event.clientY - (box.top + box.height / 2);
    const turn = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1; // clockwise from the top
    return Math.floor(turn * HOURS);
}

/**
 * Draws `counts` (commits per hour, 0..23, told in `timeZone`) into `panel`
 * and reveals it. Without any commits the panel stays hidden.
 */
export function renderDayDial(panel, { timeZone, counts }) {
    if (!Math.max(...counts)) return;
    const plot = panel.querySelector('.dial__plot');
    const hourLabel = panel.querySelector('.dial__hour');
    const countLabel = panel.querySelector('.dial__count');
    const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });

    plot.replaceChildren(svg('circle', { class: 'dial__rim', cx: CENTER, cy: CENTER, r: RIM }));
    const bars = drawBars(plot, counts);
    drawNumerals(plot);
    const mark = svg('circle', { class: 'dial__now', cx: CENTER, cy: CENTER - RIM, r: 3.5 });
    plot.append(mark);

    let pointed = null; // the hour under the pointer, if any
    let read = -1; // the hour the middle shows

    const paint = () => {
        const [hour, minute] = clock.format(new Date()).split(':').map(Number);
        mark.setAttribute('transform', turned((hour + minute / 60) * 360 / HOURS));

        const shown = pointed ?? hour;
        hourLabel.textContent = pointed === null ? `Now, ${pad(hour)}:${pad(minute)}` : `${pad(shown)}:00`;
        if (shown === read) return;
        bars[read]?.classList.remove('is-read');
        bars[shown].classList.add('is-read');
        countLabel.textContent = counts[shown].toLocaleString('en');
        read = shown;
    };
    const point = (hour) => {
        pointed = hour;
        paint();
    };

    plot.addEventListener('pointermove', (event) => point(hourUnder(event, plot)));
    plot.addEventListener('pointerleave', () => point(null));
    setInterval(paint, TICK_MS);
    paint();

    const [from, to] = NIGHT;
    const share = Object.assign(document.createElement('strong'), { textContent: `${Math.round(shareBetween(counts, NIGHT) * 100)}%` });
    panel.querySelector('.dial__note').replaceChildren(share, ` of the year's commits land between ${pad(from)}:00 and ${pad(to)}:00.`);
    plot.setAttribute('aria-label', `Commits by hour of the day; the busiest hour starts at ${pad(counts.indexOf(Math.max(...counts)))}:00`);
    panel.hidden = false;
}
