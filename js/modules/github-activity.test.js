import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compactNumber, levelFor, levelThresholds, timeAgo } from './github-activity.js';
import { toStats } from '../../scripts/github-stats.mjs';

test('compactNumber keeps small values and shortens thousands', () => {
    assert.equal(compactNumber(513), '513');
    assert.equal(compactNumber(6483), '6.5k');
    assert.equal(compactNumber(12400), '12k');
});

test('levels come from quartiles of active days, so one spike does not flatten the year', () => {
    const counts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 500];
    const thresholds = levelThresholds(counts);
    assert.equal(levelFor(0, thresholds), 0);
    assert.equal(levelFor(1, thresholds), 1);
    assert.equal(levelFor(6, thresholds), 3);
    assert.equal(levelFor(500, thresholds), 4);
    assert.deepEqual(levelThresholds([0, 0]), []);
});

test('timeAgo reads naturally', () => {
    const now = Date.parse('2026-11-09T12:00:00Z');
    assert.equal(timeAgo('2026-11-09T09:00:00Z', now), '3 hours ago');
    assert.equal(timeAgo('2026-11-08T12:00:00Z', now), 'yesterday');
});

test('toStats flattens the calendar and keeps only what the page reads', () => {
    const user = {
        contributionsCollection: {
            totalCommitContributions: 10, totalPullRequestContributions: 2, totalIssueContributions: 1,
            totalRepositoriesWithContributedCommits: 3,
            contributionCalendar: {
                totalContributions: 13,
                weeks: [
                    { contributionDays: [{ date: '2026-01-01', contributionCount: 4 }] },
                    { contributionDays: [{ date: '2026-01-02', contributionCount: 0 }, { date: '2026-01-03', contributionCount: 9 }] },
                ],
            },
        },
        repositories: { nodes: [{ nameWithOwner: 'a/b', url: 'u', pushedAt: 't', primaryLanguage: null }] },
    };
    const stats = toStats(user, 'now');
    assert.deepEqual(stats.calendar, { start: '2026-01-01', counts: [4, 0, 9] });
    assert.deepEqual(stats.recent, [{ name: 'a/b', url: 'u', pushedAt: 't', language: null, color: null }]);
    assert.equal(stats.totals.commits, 10);
});
