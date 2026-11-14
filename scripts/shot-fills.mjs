// Writes assets/shot-fills.json: for every project screenshot, what fills the
// margins it leaves in its frame (js/modules/shot-fill.js). Worked out here so
// the page never has to decode a screenshot a second time to read two lines of
// its pixels. Run it again whenever a screenshot is added or changed:
// npm run fills
//
// Needs Chrome installed; playwright-core drives it and ships no browser.

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = new URL('../', import.meta.url);

// The frame's shape (project-stage.css, works.css): a shot wider than it is
// left with margins above and below, a narrower one with margins at its sides.
const FRAME_RATIO = 16 / 9;

/** The screenshots the works list names, in its order. */
export async function screenshotPaths() {
    const html = await readFile(new URL('index.html', ROOT), 'utf8');
    return Array.from(html.matchAll(/data-screenshot="([^"]+)"/g), ([, path]) => path);
}

/**
 * Runs in the page. The fill for one screenshot: its two outer rows of pixels,
 * or columns, each a strip one pixel deep, as a CSS image list.
 */
async function fillOf({ base64, type, frameRatio }) {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const shot = await createImageBitmap(new Blob([bytes], { type }));
    const strip = (x, y, width, height) => {
        const canvas = Object.assign(document.createElement('canvas'), { width, height });
        canvas.getContext('2d').drawImage(shot, x, y, width, height, 0, 0, width, height);
        return `url(${canvas.toDataURL()})`;
    };
    const { width, height } = shot;
    const rows = width / height > frameRatio;
    const strips = rows
        ? [strip(0, 0, width, 1), strip(0, height - 1, width, 1)]
        : [strip(0, 0, 1, height), strip(width - 1, 0, 1, height)];
    return { axis: rows ? 'rows' : 'columns', image: strips.join(', ') };
}

async function main() {
    const browser = await chromium.launch({ channel: 'chrome' });
    try {
        const page = await browser.newPage();
        const fills = {};
        for (const path of await screenshotPaths()) {
            const file = await readFile(new URL(path, ROOT));
            const type = `image/${path.split('.').pop()}`;
            fills[path] = await page.evaluate(fillOf, { base64: file.toString('base64'), type, frameRatio: FRAME_RATIO });
        }
        await writeFile(new URL('assets/shot-fills.json', ROOT), `${JSON.stringify(fills, null, 2)}\n`);
        console.log(`assets/shot-fills.json: ${Object.keys(fills).length} screenshots`);
    } finally {
        await browser.close();
    }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
