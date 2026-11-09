import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shareBetween } from './day-dial.js';

test('shareBetween counts a range that wraps past midnight', () => {
    const counts = new Array(24).fill(0);
    counts[23] = 3; // inside 20..6
    counts[5] = 1; // inside
    counts[6] = 2; // the end hour is outside
    counts[12] = 2; // outside
    assert.equal(shareBetween(counts, [20, 6]), 0.5);
    assert.equal(shareBetween(counts, [6, 13]), 0.5);
    assert.equal(shareBetween(new Array(24).fill(0), [20, 6]), 0);
});
