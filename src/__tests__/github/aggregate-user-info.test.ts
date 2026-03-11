import { describe, it, expect } from 'vitest';
import { aggregateGithubProfile } from '../../github/aggregate-user-info.js';
import type { GitHubFirstResponse } from '../../github/github-graphql.js';

const createMockResponse = (overrides?: Partial<NonNullable<GitHubFirstResponse['data']>['user']>): GitHubFirstResponse => ({
    data: {
        user: {
            contributionsCollection: {
                contributionCalendar: {
                    totalContributions: 100,
                    weeks: [
                        {
                            contributionDays: [
                                { contributionCount: 5, contributionLevel: 'SECOND_QUARTILE', date: '2025-01-06' },
                                { contributionCount: 0, contributionLevel: 'NONE', date: '2025-01-07' },
                                { contributionCount: 12, contributionLevel: 'FOURTH_QUARTILE', date: '2025-01-08' },
                            ],
                        },
                    ],
                },
                totalCommitContributions: 60,
                totalIssueContributions: 10,
                totalPullRequestContributions: 15,
                totalPullRequestReviewContributions: 10,
                totalRepositoryContributions: 5,
                commitContributionsByRepository: [
                    {
                        repository: {
                            primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
                        },
                        contributions: { totalCount: 30 },
                    },
                    {
                        repository: {
                            primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
                        },
                        contributions: { totalCount: 20 },
                    },
                    {
                        repository: {
                            primaryLanguage: { name: 'Python', color: '#3572a5' },
                        },
                        contributions: { totalCount: 10 },
                    },
                    {
                        repository: {
                            primaryLanguage: null,
                        },
                        contributions: { totalCount: 5 },
                    },
                ],
            },
            repositories: {
                edges: [],
                nodes: [
                    { forkCount: 5, stargazerCount: 20 },
                    { forkCount: 3, stargazerCount: 15 },
                ],
            },
            ...overrides,
        },
    },
});

describe('aggregateGithubProfile', () => {
    it('throws when user data is missing', () => {
        const response = { data: { user: null } } as unknown as GitHubFirstResponse;
        expect(() => aggregateGithubProfile('test', response)).toThrow();
    });

    it('throws with error message from API', () => {
        const response = {
            data: { user: null },
            errors: [{ message: 'User not found' }],
        } as unknown as GitHubFirstResponse;
        expect(() => aggregateGithubProfile('test', response)).toThrow('User not found');
    });

    it('maps contribution levels correctly', () => {
        const result = aggregateGithubProfile('testuser', createMockResponse());
        expect(result.calendar[0].contributionLevel).toBe(2); // SECOND_QUARTILE
        expect(result.calendar[1].contributionLevel).toBe(0); // NONE
        expect(result.calendar[2].contributionLevel).toBe(4); // FOURTH_QUARTILE
    });

    it('sets username from parameter', () => {
        const result = aggregateGithubProfile('myuser', createMockResponse());
        expect(result.username).toBe('myuser');
    });

    it('aggregates language contributions', () => {
        const result = aggregateGithubProfile('test', createMockResponse());
        expect(result.languages).toHaveLength(2); // TypeScript + Python
        const ts = result.languages.find(l => l.language === 'TypeScript');
        expect(ts?.contributions).toBe(50); // 30 + 20
        const py = result.languages.find(l => l.language === 'Python');
        expect(py?.contributions).toBe(10);
    });

    it('sorts languages by contribution count descending', () => {
        const result = aggregateGithubProfile('test', createMockResponse());
        expect(result.languages[0].language).toBe('TypeScript');
        expect(result.languages[1].language).toBe('Python');
    });

    it('skips repos with no primary language', () => {
        const result = aggregateGithubProfile('test', createMockResponse());
        expect(result.languages).toHaveLength(2); // only TS + Python, not null
    });

    it('sums fork and star counts', () => {
        const result = aggregateGithubProfile('test', createMockResponse());
        expect(result.totalForkCount).toBe(8); // 5 + 3
        expect(result.totalStargazerCount).toBe(35); // 20 + 15
    });

    it('copies contribution totals from API', () => {
        const result = aggregateGithubProfile('test', createMockResponse());
        expect(result.totalContributions).toBe(100);
        expect(result.totalCommitContributions).toBe(60);
        expect(result.totalIssueContributions).toBe(10);
    });

    it('formats dates as ISO strings', () => {
        const result = aggregateGithubProfile('test', createMockResponse());
        expect(result.calendar[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
