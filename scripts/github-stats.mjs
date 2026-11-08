// Pulls a year of GitHub activity through the GraphQL API and writes it to
// assets/github.json, which the page renders itself (js/modules/github-activity.js).
// Runs daily from .github/workflows/stats.yml; locally: GITHUB_TOKEN=... node scripts/github-stats.mjs
//
// Use a personal token (STATS_TOKEN in the workflow) so private contributions
// count toward the totals; the default Actions token only sees public ones.

import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const LOGIN = 'ForeverInLaw';
const OUT = new URL('../assets/github.json', import.meta.url);
const RECENT_LIMIT = 5;

const QUERY = `
query ($login: String!, $recent: Int!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
    repositories(first: $recent, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC },
                 ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
      nodes { nameWithOwner url pushedAt primaryLanguage { name color } }
    }
  }
}`;

/**
 * Shapes the GraphQL `user` node into the compact payload the page reads:
 * totals, one count per day from `start` onward, and the latest public pushes.
 */
export function toStats(user, generatedAt = new Date().toISOString()) {
    const collection = user.contributionsCollection;
    const days = collection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);

    return {
        generatedAt,
        totals: {
            contributions: collection.contributionCalendar.totalContributions,
            commits: collection.totalCommitContributions,
            pullRequests: collection.totalPullRequestContributions,
            issues: collection.totalIssueContributions,
            repos: collection.totalRepositoriesWithContributedCommits,
        },
        calendar: {
            start: days[0]?.date ?? null,
            counts: days.map((day) => day.contributionCount),
        },
        recent: user.repositories.nodes.map((repo) => ({
            name: repo.nameWithOwner,
            url: repo.url,
            pushedAt: repo.pushedAt,
            language: repo.primaryLanguage?.name ?? null,
            color: repo.primaryLanguage?.color ?? null,
        })),
    };
}

async function main() {
    const token = process.env.STATS_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Set STATS_TOKEN or GITHUB_TOKEN.');

    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'zaebal.dev-stats' },
        body: JSON.stringify({ query: QUERY, variables: { login: LOGIN, recent: RECENT_LIMIT } }),
    });
    const body = await res.json();
    if (!res.ok || body.errors) {
        throw new Error(`GitHub GraphQL failed: ${res.status} ${JSON.stringify(body.errors ?? body)}`);
    }

    const stats = toStats(body.data.user);
    if (!stats.calendar.counts.length) throw new Error('Empty contribution calendar; keeping the old file.');

    await writeFile(OUT, `${JSON.stringify(stats, null, 2)}\n`);
    console.log(`Wrote ${OUT.pathname}: ${stats.totals.contributions} contributions`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
