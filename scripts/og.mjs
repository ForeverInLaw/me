// Takes og.png, the picture a link to the site unfurls with, from
// scripts/og/og.html. That card reads its words out of index.html, so run this
// again whenever the bio line or the top of the works list changes: npm run og
//
// Needs Chrome installed; playwright-core drives it and ships no browser.

import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const OUT = fileURLToPath(new URL('../og.png', import.meta.url));
const CARD = 'scripts/og/og.html';
// The size link previews are cut to.
const SIZE = { width: 1200, height: 630 };
// The glow drifts with the clock (bio-glow.js); the card is the frame at this
// moment of it, the same on every run.
const FRAME_MS = 9000;

// The site's own dev server, so the card loads the page's styles and modules.
const server = await createServer({ server: { open: false, port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });

try {
    const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await page.addInitScript((now) => { performance.now = () => now; }, FRAME_MS);
    await page.goto(new URL(CARD, server.resolvedUrls.local[0]).href);
    await page.waitForSelector('html[data-ready] .bio-glow.is-lit');
    await page.screenshot({ path: OUT });
    console.log(`og.png written, ${SIZE.width}x${SIZE.height}`);
} finally {
    await browser.close();
    await server.close();
}
