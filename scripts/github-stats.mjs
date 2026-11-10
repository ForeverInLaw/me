// Pulls a year of GitHub activity through the GraphQL API and writes it to
// assets/github.json, which the page renders itself (js/modules/github-activity.js).
// Runs daily from .github/workflows/stats.yml; locally: GITHUB_TOKEN=... node scripts/github-stats.mjs
//
// Use a personal token (STATS_TOKEN in the workflow) so private contributions
// count toward the totals; the default Actions token only sees public ones.
// Reading the commits themselves (their hours, the latest messages) takes the
// `repo` scope for private repositories; without it they are left out.

import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const LOGIN = 'ForeverInLaw';
const OUT = new URL('../assets/github.json', import.meta.url);
const RECENT_LIMIT = 5;
const LOG_LIMIT = 6;
// Kept out of the latest pushes and commits: the profile README, the site
// before this one and this site are housekeeping, not work to show. Their
// commits still count toward the totals and the hours.
const HIDDEN = new Set(['ForeverInLaw/ForeverInLaw', 'ForeverInLaw/foreverinlaw.github.io', 'ForeverInLaw/me']);
// GitHub reports commit times in UTC; the hours of the day are told in this
// zone - central European time, the offset the commits themselves carry.
const TIME_ZONE = 'CET';

const QUERY = `
query ($login: String!, $recent: Int!) {
  user(login: $login) {
    id
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
      commitContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner isPrivate }
      }
    }
    repositories(first: $recent, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC },
                 ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
      nodes { nameWithOwner url pushedAt primaryLanguage { name color } }
    }
  }
}`;

const HISTORY_QUERY = `
query ($owner: String!, $name: String!, $author: ID!, $since: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, since: $since, author: { id: $author }, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { authoredDate messageHeadline url }
          }
        }
      }
    }
  }
}`;

const hourIn = (timeZone) => {
    const format = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone });
    return (iso) => Number(format.format(new Date(iso)));
};

/** How many of the ISO timestamps `dates` fall in each hour of the day, 0..23, in `timeZone`. */
export function hourCounts(dates, timeZone = TIME_ZONE) {
    const hourOf = hourIn(timeZone);
    const counts = new Array(24).fill(0);
    dates.forEach((iso) => { counts[hourOf(iso)] += 1; });
    return counts;
}

/**
 * Shapes the GraphQL `user` node and the year's `commits` (each a history
 * node plus its `repo` and `isPrivate`) into the compact payload the page
 * reads: totals, one count per day from `start` onward, the latest public
 * pushes, commits per hour of the day and the latest public commits. Private
 * commits only ever add to the hours; nothing else of them is written.
 */
export function toStats(user, commits = [], generatedAt = new Date().toISOString()) {
    const collection = user.contributionsCollection;
    const days = collection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
    const latest = commits.filter((commit) => !commit.isPrivate && !HIDDEN.has(commit.repo))
        .sort((a, b) => Date.parse(b.authoredDate) - Date.parse(a.authoredDate))
        .slice(0, LOG_LIMIT);

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
        recent: user.repositories.nodes.filter((repo) => !HIDDEN.has(repo.nameWithOwner)).slice(0, RECENT_LIMIT).map((repo) => ({
            name: repo.nameWithOwner,
            url: repo.url,
            pushedAt: repo.pushedAt,
            language: repo.primaryLanguage?.name ?? null,
            color: repo.primaryLanguage?.color ?? null,
        })),
        hours: {
            timeZone: TIME_ZONE,
            counts: hourCounts(commits.map((commit) => commit.authoredDate)),
        },
        commits: latest.map((commit) => ({
            repo: commit.repo,
            message: commit.messageHeadline,
            url: commit.url,
            at: commit.authoredDate,
        })),
    };
}

/** Posts a GraphQL query and returns the response body, `errors` and all. */
async function graphql(token, query, variables) {
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'zaebal.dev-stats' },
        body: JSON.stringify({ query, variables }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`GitHub GraphQL failed: ${res.status} ${JSON.stringify(body)}`);
    return body;
}

/**
 * Every commit `author` put on the default branch of `repo` since `since`,
 * page by page; null when the token cannot read the repository.
 */
async function commitsIn(token, repo, author, since) {
    const [owner, name] = repo.nameWithOwner.split('/');
    const commits = [];
    let after = null;
    do {
        const { data } = await graphql(token, HISTORY_QUERY, { owner, name, author, since, after });
        if (!data?.repository) return null;
        const history = data.repository.defaultBranchRef?.target?.history;
        if (!history) break;
        commits.push(...history.nodes.map((node) => ({ ...node, repo: repo.nameWithOwner, isPrivate: repo.isPrivate })));
        after = history.pageInfo.hasNextPage ? history.pageInfo.endCursor : null;
    } while (after);
    return commits;
}

/**
 * The year's commits across every repository the user committed to, one
 * repository after another so the API is never hit in parallel.
 */
async function yearOfCommits(token, user, since) {
    const repos = user.contributionsCollection.commitContributionsByRepository.map((entry) => entry.repository);
    const commits = [];
    let unreadable = 0;
    for (const repo of repos) {
        const found = await commitsIn(token, repo, user.id, since);
        if (found) commits.push(...found);
        else unreadable += 1;
    }
    // A count, never names: this log is public and some of the repositories are not.
    if (unreadable) console.warn(`${unreadable} of ${repos.length} repositories could not be read with this token.`);
    return commits;
}

async function main() {
    const token = process.env.STATS_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Set STATS_TOKEN or GITHUB_TOKEN.');

    // Asked for with room to spare, so the list is still full once the hidden
    // repositories are taken out of it.
    const body = await graphql(token, QUERY, { login: LOGIN, recent: RECENT_LIMIT + HIDDEN.size });
    if (body.errors) throw new Error(`GitHub GraphQL failed: ${JSON.stringify(body.errors)}`);
    const { user } = body.data;

    const start = user.contributionsCollection.contributionCalendar.weeks[0]?.contributionDays[0]?.date;
    if (!start) throw new Error('Empty contribution calendar; keeping the old file.');

    const stats = toStats(user, await yearOfCommits(token, user, `${start}T00:00:00Z`));
    await writeFile(OUT, `${JSON.stringify(stats, null, 2)}\n`);
    const timed = stats.hours.counts.reduce((sum, count) => sum + count, 0);
    console.log(`Wrote ${OUT.pathname}: ${stats.totals.contributions} contributions, ${timed} commits by hour`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
