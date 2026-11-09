import { test } from 'node:test';
import assert from 'node:assert/strict';

import { yearRecords } from './year-records.js';

test('finds the longest streak, the busiest day and the loudest weekday', () => {
    // Starts on a Wednesday (3): indices 0..9 are Wed Thu Fri Sat Sun Mon Tue Wed Thu Fri.
    const counts = [2, 1, 0, 4, 9, 1, 3, 0, 5, 0];
    assert.deepEqual(yearRecords(counts, 3), {
        streak: { start: 3, length: 4 },
        peak: { index: 4, count: 9 },
        weekday: { day: 0, total: 9 },
    });
});

test('a tie goes to the later streak and the later day', () => {
    const { streak, peak } = yearRecords([3, 3, 0, 1, 3], 0);
    assert.deepEqual(streak, { start: 3, length: 2 });
    assert.equal(peak.index, 4);
});

test('a year with no activity has no records', () => {
    assert.equal(yearRecords([0, 0, 0], 0), null);
});
