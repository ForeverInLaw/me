// The records in a year of daily contribution counts: the longest unbroken
// run of active days, the single busiest day and the weekday that carries the
// most. Days are indices into `counts`; on a tie the later one wins, as the
// fresher story.

const DAYS_PER_WEEK = 7;

/**
 * `firstWeekday` is the weekday (0 = Sunday) of `counts[0]`. Returns
 * `{ streak: { start, length }, peak: { index, count }, weekday: { day, total } }`,
 * or null for a year with no activity at all.
 */
export function yearRecords(counts, firstWeekday) {
    const streak = { start: 0, length: 0 };
    const peak = { index: 0, count: 0 };
    const byWeekday = new Array(DAYS_PER_WEEK).fill(0);
    let run = 0;

    counts.forEach((count, i) => {
        run = count > 0 ? run + 1 : 0;
        if (run && run >= streak.length) Object.assign(streak, { start: i - run + 1, length: run });
        if (count && count >= peak.count) Object.assign(peak, { index: i, count });
        byWeekday[(firstWeekday + i) % DAYS_PER_WEEK] += count;
    });
    if (!peak.count) return null;

    const total = Math.max(...byWeekday);
    return { streak, peak, weekday: { day: byWeekday.lastIndexOf(total), total } };
}
