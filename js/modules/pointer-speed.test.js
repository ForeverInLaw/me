import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPointerSpeed } from './pointer-speed.js';

/** Feeds `count` events `stepPx` apart every `stepMs`, returning the last reading. */
function travel(sample, { from = 0, startAt = 0, stepPx, stepMs, count }) {
    let speed = 0;
    for (let i = 0; i < count; i += 1) {
        speed = sample({ pageX: 0, pageY: from + i * stepPx, timeStamp: startAt + i * stepMs });
    }
    return speed;
}

test('a steady run settles on its real speed', () => {
    const speed = travel(createPointerSpeed(), { stepPx: 16, stepMs: 16, count: 20 });
    assert.ok(Math.abs(speed - 1) < 0.01, `expected about 1 px/ms, got ${speed}`);
});

test('a pause starts the measurement over', () => {
    const sample = createPointerSpeed();
    travel(sample, { stepPx: 16, stepMs: 16, count: 20 });
    assert.equal(sample({ pageX: 0, pageY: 400, timeStamp: 1000 }), 0);
});

test('one quick event does not outweigh a slow approach', () => {
    const sample = createPointerSpeed();
    travel(sample, { stepPx: 1, stepMs: 16, count: 20 });
    const speed = sample({ pageX: 0, pageY: 35, timeStamp: 320 });
    assert.ok(speed < 0.5, `expected a damped reading, got ${speed}`);
});
