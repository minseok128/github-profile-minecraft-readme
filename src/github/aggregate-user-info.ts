import type { GitHubFirstResponse } from './github-graphql.js';
import type {
    ContributionLevelName,
    LanguageContribution,
    UserSnapshot,
} from '../types.js';
import { toIsoDate } from '../utils.js';

const OTHER_COLOR = '#666666';

const toNumericContributionLevel = (level: ContributionLevelName): number => {
    switch (level) {
        case 'NONE':
            return 0;
        case 'FIRST_QUARTILE':
            return 1;
        case 'SECOND_QUARTILE':
            return 2;
        case 'THIRD_QUARTILE':
            return 3;
        case 'FOURTH_QUARTILE':
            return 4;
    }
};

export const aggregateGithubProfile = (
    username: string,
    response: GitHubFirstResponse,
): UserSnapshot => {
    if (!response.data?.user) {
        throw new Error(response.errors?.[0]?.message ?? 'GitHub API returned no user data.');
    }

    const user = response.data.user;
    const calendar = user.contributionsCollection.contributionCalendar.weeks
        .flatMap((week) => week.contributionDays)
        .map((day) => ({
            contributionCount: day.contributionCount,
            contributionLevel: toNumericContributionLevel(day.contributionLevel),
            date: toIsoDate(new Date(day.date)),
        }));

    const languageMap = new Map<string, LanguageContribution>();
    user.contributionsCollection.commitContributionsByRepository
        .filter((repo) => repo.repository.primaryLanguage)
        .forEach((repo) => {
            const primaryLanguage = repo.repository.primaryLanguage;
            if (!primaryLanguage) {
                return;
            }
            const existing = languageMap.get(primaryLanguage.name);
            const contributionCount = repo.contributions.totalCount;
            if (existing) {
                existing.contributions += contributionCount;
                return;
            }
            languageMap.set(primaryLanguage.name, {
                language: primaryLanguage.name,
                color: primaryLanguage.color ?? OTHER_COLOR,
                contributions: contributionCount,
            });
        });

    const totalForkCount = user.repositories.nodes.reduce(
        (sum, repository) => sum + repository.forkCount,
        0,
    );
    const totalStargazerCount = user.repositories.nodes.reduce(
        (sum, repository) => sum + repository.stargazerCount,
        0,
    );

    return {
        username,
        calendar,
        languages: [...languageMap.values()].sort(
            (left, right) => right.contributions - left.contributions,
        ),
        totalContributions:
            user.contributionsCollection.contributionCalendar.totalContributions,
        totalCommitContributions:
            user.contributionsCollection.totalCommitContributions,
        totalIssueContributions:
            user.contributionsCollection.totalIssueContributions,
        totalPullRequestContributions:
            user.contributionsCollection.totalPullRequestContributions,
        totalPullRequestReviewContributions:
            user.contributionsCollection.totalPullRequestReviewContributions,
        totalRepositoryContributions:
            user.contributionsCollection.totalRepositoryContributions,
        totalForkCount,
        totalStargazerCount,
    };
};

