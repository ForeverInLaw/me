// Tells a look from a pass-through as the pointer moves over a set of rows, so
// a consumer can keep its full response for the rows the pointer means and
// answer the ones it merely crosses with something lighter.

import { createPointerSpeed } from './pointer-speed.js';

// Entering a row faster than this (px/ms) starts a run; the run ends on the
// row the pointer then stays on for SETTLE_MS. The two belong together: at
// RUN_SPEED a row some 40px tall is crossed in about SETTLE_MS, so anything
// slower would have come to rest on every row anyway.
const RUN_SPEED = 0.3;
const SETTLE_MS = 120;

/**
 * Watches `rows`. Pointer speed is measured across `area`, an element around
 * them, so a pointer arriving from outside the rows is already known to be
 * running.
 *
 * - `onLook(index)`: the row was entered slowly, took focus, or is where a
 *   run ended - the last row it crossed, whether the pointer stayed on it or
 *   ran on off the rows.
 * - `onPass(index)`: a run is crossing the row.
 */
export function watchRowIntent(rows, { area, onLook, onPass }) {
    const speedAt = createPointerSpeed();
    let running = false;
    let settleTimer = 0;

    const look = (index) => {
        clearTimeout(settleTimer);
        running = false;
        onLook(index);
    };

    area.addEventListener('pointermove', speedAt, { passive: true });

    rows.forEach((row, index) => {
        // Once running, only time ends it: a pointer slowing as it crosses
        // rows would otherwise flip between the two answers.
        row.addEventListener('pointerenter', (event) => {
            if (speedAt(event) <= RUN_SPEED && !running) return look(index);
            running = true;
            clearTimeout(settleTimer);
            settleTimer = setTimeout(look, SETTLE_MS, index);
            onPass(index);
        });
        row.addEventListener('focus', () => look(index));
    });
}
