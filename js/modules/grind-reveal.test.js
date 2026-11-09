import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shareAbove } from './grind-reveal.js';

test('shareAbove is how much of a box has crossed the line', () => {
    assert.equal(shareAbove(700, 200, 600), 0); // still under the line
    assert.equal(shareAbove(500, 200, 600), 0.5); // halfway across
    assert.equal(shareAbove(100, 200, 600), 1); // all of it above
    assert.equal(shareAbove(100, 0, 600), 0); // a hidden part has no height
});
