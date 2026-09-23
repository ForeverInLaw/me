// Live local-time clock in the footer ("Hand-built after dark") - the 2am
// joke becomes real. Runs on a 1s interval, paused when the tab is hidden.
// Minute/hour text changes go through swapText (.t-text-swap); the CSS glow
// stays, and reduced-motion users get instant text changes (no transform).
import { swapText } from './text-swap.js';
export function initLocalTime() {
    const timeEl = document.getElementById('local-time');
    const stateEl = document.getElementById('night-clock-state');
    if (!timeEl) return;

    const pad = (n) => String(n).padStart(2, '0');

    const stateFor = (hour) => {
        if (hour >= 0 && hour < 5) return 'peak hours';
        if (hour >= 5 && hour < 9) return 'too early';
        if (hour >= 9 && hour < 18) return 'daylight wasted';
        if (hour >= 18 && hour < 22) return 'warming up';
        return 'almost time'; // 22–24
    };

    let timerId = 0;

    const tick = () => {
        const now = new Date();
        const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        if (timeEl.textContent !== hhmm) {
            // datetime is machine-readable metadata, not pixels: it updates
            // immediately, while the visible text goes through the swap.
            timeEl.setAttribute('datetime', hhmm);
            swapText(timeEl, hhmm);
        }
        if (stateEl) {
            const label = stateFor(now.getHours());
            if (stateEl.textContent !== label) swapText(stateEl, label);
        }
    };

    const start = () => {
        if (timerId) return;
        tick();
        timerId = window.setInterval(tick, 1000);
    };

    const stop = () => {
        if (!timerId) return;
        clearInterval(timerId);
        timerId = 0;
    };

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else start();
    });

    start();
}
