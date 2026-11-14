import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { screenshotPaths } from '../../scripts/shot-fills.mjs';

test('every screenshot in the works list has its fill written (npm run fills)', async () => {
    const fills = JSON.parse(await readFile(new URL('../../assets/shot-fills.json', import.meta.url), 'utf8'));
    assert.deepEqual(Object.keys(fills), await screenshotPaths());
});
