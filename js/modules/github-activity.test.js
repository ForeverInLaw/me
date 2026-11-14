import { test } from 'node:test';
import assert from 'node:assert/strict';

import { commitTitle, compactNumber, levelFor, levelThresholds, timeAgo } from './github-activity.js';
import { dayCounts, hourCounts, reposToRead, toStats } from '../../scripts/github-stats.mjs';

test('compactNumber keeps small values and shortens thousands', () => {
    assert.equal(compactNumber(513), '513');
    assert.equal(compactNumber(6483), '6.5k');
    assert.equal(compactNumber(12400), '12k');
});

test('levels come from percentiles of active days, so one spike does not flatten the year', () => {
    const counts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 500];
    const thresholds = levelThresholds(counts);
    assert.equal(levelFor(0, thresholds), 0);
    assert.equal(levelFor(1, thresholds), 1);
    assert.equal(levelFor(6, thresholds), 2);
    assert.equal(levelFor(8, thresholds), 3);
    assert.equal(levelFor(500, thresholds), 4);
    assert.deepEqual(levelThresholds([0, 0]), []);
});

test('timeAgo reads naturally', () => {
    const now = Date.parse('2026-11-09T12:00:00Z');
    assert.equal(timeAgo('2026-11-09T09:00:00Z', now), '3 hours ago');
    assert.equal(timeAgo('2026-11-08T12:00:00Z', now), 'yesterday');
});

test('commitTitle names a merge by its branch and leaves other commits as written', () => {
    assert.equal(commitTitle('Merge pull request #163 from redstone-md/build/libwebrtc-headers'), 'Merge build/libwebrtc-headers (#163)');
    assert.equal(commitTitle('fix(ci): publish a release only when no build was cancelled'), 'fix(ci): publish a release only when no build was cancelled');
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
    const commits = [
        { repo: 'a/b', isPrivate: false, authoredDate: '2026-01-01T10:00:00Z', messageHeadline: 'older', url: 'c1' },
        { repo: 'a/secret', isPrivate: true, authoredDate: '2026-01-03T10:00:00Z', messageHeadline: 'hidden', url: 'c2' },
        { repo: 'a/b', isPrivate: false, authoredDate: '2026-01-02T10:00:00Z', messageHeadline: 'newer', url: 'c3' },
    ];
    const stats = toStats(user, commits);
    assert.deepEqual(stats.calendar, { start: '2026-01-01', counts: [4, 0, 9] });
    assert.deepEqual(stats.recent, [{ name: 'a/b', url: 'u', pushedAt: 't', language: null, color: null }]);
    assert.equal(stats.totals.commits, 10);
    // Private commits count toward the hours and appear nowhere else.
    assert.equal(stats.hours.counts.reduce((sum, count) => sum + count, 0), 3);
    assert.deepEqual(stats.commits, [
        { repo: 'a/b', message: 'newer', url: 'c3', at: '2026-01-02T10:00:00Z' },
        { repo: 'a/b', message: 'older', url: 'c1', at: '2026-01-01T10:00:00Z' },
    ]);
    assert.ok(!JSON.stringify(stats).includes('secret'));
});

test('toStats adds the commits made in forks to the totals and to their days', () => {
    const user = {
        contributionsCollection: {
            totalCommitContributions: 10, totalPullRequestContributions: 2, totalIssueContributions: 1,
            totalRepositoriesWithContributedCommits: 3,
            contributionCalendar: {
                totalContributions: 13,
                weeks: [{ contributionDays: [{ date: '2026-01-01', contributionCount: 4 }, { date: '2026-01-02', contributionCount: 9 }] }],
            },
        },
        repositories: { nodes: [] },
    };
    const commit = (repo, isFork, authoredDate) => ({ repo, isPrivate: false, isFork, authoredDate, messageHeadline: 'm', url: 'u' });
    const stats = toStats(user, [
        commit('a/counted', false, '2026-01-01T10:00:00Z'),
        commit('a/fork', true, '2026-01-02T10:00:00Z'),
        commit('a/fork', true, '2026-01-02T11:00:00Z'),
        commit('a/fork', true, '2026-01-09T10:00:00Z'), // past the calendar: waits for its day
    ]);
    assert.deepEqual(stats.calendar.counts, [4, 11]);
    assert.deepEqual(stats.totals, { contributions: 15, commits: 12, pullRequests: 2, issues: 1, repos: 4 });
});

test('dayCounts tells the day in the given zone', () => {
    // 23:30 UTC is already the next day in Warsaw.
    assert.deepEqual(dayCounts(['2026-01-01T23:30:00Z', '2026-01-02T10:00:00Z'], ['2026-01-01', '2026-01-02'], 'Europe/Warsaw'), [0, 2]);
});

test('reposToRead adds the forks pushed to within the year, which GitHub does not count', () => {
    const user = {
        contributionsCollection: { commitContributionsByRepository: [{ repository: { nameWithOwner: 'a/counted', isPrivate: false } }] },
        forks: { nodes: [
            { nameWithOwner: 'a/fork', isPrivate: false, pushedAt: '2026-11-11T21:38:15Z' },
            { nameWithOwner: 'a/stale-fork', isPrivate: false, pushedAt: '2025-06-01T00:00:00Z' },
        ] },
    };
    assert.deepEqual(reposToRead(user, '2025-11-09T00:00:00Z').map((repo) => repo.nameWithOwner), ['a/counted', 'a/fork']);
});

test('hourCounts tells the hour in the given zone, daylight saving included', () => {
    const counts = hourCounts(['2026-01-15T23:30:00Z', '2026-07-15T23:30:00Z', '2026-07-15T23:59:00Z'], 'Europe/Warsaw');
    assert.equal(counts.length, 24);
    assert.equal(counts[0], 1); // winter: UTC+1
    assert.equal(counts[1], 2); // summer: UTC+2
});
