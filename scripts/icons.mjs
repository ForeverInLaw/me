// Draws the raster icons from favicon.svg: favicon.ico for browsers that want
// one and apple-touch-icon.png for home screens. Run it again whenever the
// mark changes: npm run icons
//
// Needs Chrome installed; playwright-core drives it and ships no browser.

import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const ROOT = new URL('../', import.meta.url);
const ICO_SIZES = [16, 32, 48];
const TOUCH_SIZE = 180;

// An .ico is a directory of images, and each of them may be a whole PNG.
const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;
const ICO_TYPE_ICON = 1;
const BITS_PER_PIXEL = 32;

/** Packs `images`, each `{ size, png }`, into one .ico file. */
function toIco(images) {
    const header = Buffer.alloc(ICO_HEADER_BYTES);
    header.writeUInt16LE(ICO_TYPE_ICON, 2);
    header.writeUInt16LE(images.length, 4);

    let offset = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * images.length;
    const entries = images.map(({ size, png }) => {
        const entry = Buffer.alloc(ICO_ENTRY_BYTES);
        entry.writeUInt8(size, 0);
        entry.writeUInt8(size, 1);
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(BITS_PER_PIXEL, 6);
        entry.writeUInt32LE(png.length, 8);
        entry.writeUInt32LE(offset, 12);
        offset += png.length;
        return entry;
    });

    return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

const svg = await readFile(new URL('favicon.svg', ROOT), 'utf8');
const browser = await chromium.launch({ channel: 'chrome' });

try {
    const page = await browser.newPage();
    await page.setContent(`<style>html, body { margin: 0 } svg { display: block; width: 100vw; height: 100vh }</style>${svg}`);

    /** The mark at `size` pixels square, its corners left transparent. */
    const draw = async (size) => {
        await page.setViewportSize({ width: size, height: size });
        return page.screenshot({ omitBackground: true });
    };

    const images = [];
    for (const size of ICO_SIZES) images.push({ size, png: await draw(size) });
    await writeFile(new URL('favicon.ico', ROOT), toIco(images));
    await writeFile(new URL('apple-touch-icon.png', ROOT), await draw(TOUCH_SIZE));
    console.log(`favicon.ico (${ICO_SIZES.join(', ')}) and apple-touch-icon.png (${TOUCH_SIZE}) written`);
} finally {
    await browser.close();
}
