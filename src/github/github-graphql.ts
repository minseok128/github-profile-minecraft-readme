import axios from 'axios';
import type { ContributionLevelName } from '../types.js';

const GITHUB_GRAPHQL_URL =
    process.env.GITHUB_ENDPOINT ?? 'https://api.github.com/graphql';
const MAX_REPOS_PER_QUERY = 100;

export interface CommitContributionsByRepository {
    contributions: {
        totalCount: number;
    };
    repository: {
        primaryLanguage: {
            name: string;
            color: string | null;
        } | null;
    };
}

export interface ContributionCalendarDay {
    contributionCount: number;
    contributionLevel: ContributionLevelName;
    date: string;
}

export interface ContributionCalendar {
    totalContributions: number;
    weeks: Array<{
        contributionDays: Array<ContributionCalendarDay>;
    }>;
}

export interface RepositorySummary {
    forkCount: number;
    stargazerCount: number;
}

export interface RepositoryConnection {
    edges: Array<{
        cursor: string;
    }>;
    nodes: Array<RepositorySummary>;
}

export interface GitHubFirstResponse {
    data?: {
        user: {
            contributionsCollection: {
                contributionCalendar: ContributionCalendar;
                commitContributionsByRepository: Array<CommitContributionsByRepository>;
                totalCommitContributions: number;
                totalIssueContributions: number;
                totalPullRequestContributions: number;
                totalPullRequestReviewContributions: number;
                totalRepositoryContributions: number;
            };
            repositories: RepositoryConnection;
        };
    };
    errors?: Array<{
        message: string;
    }>;
}

export interface ContributionWindow {
    from: string;
    to: string;
}

interface GitHubNextResponse {
    data?: {
        user: {
            repositories: RepositoryConnection;
        };
    };
    errors?: Array<{
        message: string;
    }>;
}

const postGraphql = async <T>(
    token: string,
    query: string,
    variables: Record<string, string>,
): Promise<T> => {
    const response = await axios.post<T>(
        GITHUB_GRAPHQL_URL,
        {
            query: query.replace(/\s+/g, ' '),
            variables,
        },
        {
            headers: {
                Authorization: `bearer ${token}`,
            },
        },
    );
    return response.data;
};

export const fetchFirstGithubProfile = async (
    token: string,
    username: string,
    year?: number,
    contributionWindow?: ContributionWindow,
): Promise<GitHubFirstResponse> => {
    const contributionArgs = year
        ? `(from: "${year}-01-01T00:00:00.000Z", to: "${year}-12-31T23:59:59.000Z")`
        : contributionWindow
          ? `(from: "${contributionWindow.from}", to: "${contributionWindow.to}")`
          : '';

    return postGraphql<GitHubFirstResponse>(
        token,
        `
            query($login: String!) {
                user(login: $login) {
                    contributionsCollection${contributionArgs} {
                        contributionCalendar {
                            totalContributions
                            weeks {
                                contributionDays {
                                    contributionCount
                                    contributionLevel
                                    date
                                }
                            }
                        }
                        commitContributionsByRepository(maxRepositories: ${MAX_REPOS_PER_QUERY}) {
                            repository {
                                primaryLanguage {
                                    name
                                    color
                                }
                            }
                            contributions {
                                totalCount
                            }
                        }
                        totalCommitContributions
                        totalIssueContributions
                        totalPullRequestContributions
                        totalPullRequestReviewContributions
                        totalRepositoryContributions
                    }
                    repositories(first: ${MAX_REPOS_PER_QUERY}, ownerAffiliations: OWNER) {
                        edges {
                            cursor
                        }
                        nodes {
                            forkCount
                            stargazerCount
                        }
                    }
                }
            }
        `,
        { login: username },
    );
};

const fetchNextRepositories = async (
    token: string,
    username: string,
    cursor: string,
): Promise<GitHubNextResponse> =>
    postGraphql<GitHubNextResponse>(
        token,
        `
            query($login: String!, $cursor: String!) {
                user(login: $login) {
                    repositories(after: $cursor, first: ${MAX_REPOS_PER_QUERY}, ownerAffiliations: OWNER) {
                        edges {
                            cursor
                        }
                        nodes {
                            forkCount
                            stargazerCount
                        }
                    }
                }
            }
        `,
        {
            login: username,
            cursor,
        },
    );

export const fetchGithubProfile = async (
    token: string,
    username: string,
    maxRepos: number,
    year?: number,
    contributionWindow?: ContributionWindow,
): Promise<GitHubFirstResponse> => {
    const initial = await fetchFirstGithubProfile(
        token,
        username,
        year,
        contributionWindow,
    );
    const user = initial.data?.user;

    if (!user) {
        return initial;
    }

    const repositories = user.repositories;
    while (
        repositories.nodes.length < maxRepos &&
        repositories.nodes.length % MAX_REPOS_PER_QUERY === 0 &&
        repositories.edges.length > 0
    ) {
        const cursor = repositories.edges[repositories.edges.length - 1]?.cursor;
        if (!cursor) {
            break;
        }
        const next = await fetchNextRepositories(token, username, cursor);
        const nextRepositories = next.data?.user.repositories;
        if (!nextRepositories) {
            break;
        }
        repositories.edges.push(...nextRepositories.edges);
        repositories.nodes.push(...nextRepositories.nodes);
        if (nextRepositories.nodes.length < MAX_REPOS_PER_QUERY) {
            break;
        }
    }

    return initial;
};
