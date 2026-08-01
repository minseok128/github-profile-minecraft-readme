import { z } from 'zod';
import type {
    ContributionLevel,
    ContributionProfile,
    ContributionWindow,
} from '../types.js';

const GITHUB_GRAPHQL_QUERY = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
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
            }
        }
    }
`;

const contributionLevelSchema = z.enum([
    'NONE',
    'FIRST_QUARTILE',
    'SECOND_QUARTILE',
    'THIRD_QUARTILE',
    'FOURTH_QUARTILE',
]);

const githubResponseSchema = z
    .object({
        data: z
            .object({
                user: z
                    .object({
                        contributionsCollection: z.object({
                            contributionCalendar: z.object({
                                totalContributions: z.number().int().nonnegative(),
                                weeks: z.array(
                                    z.object({
                                        contributionDays: z.array(
                                            z.object({
                                                contributionCount: z
                                                    .number()
                                                    .int()
                                                    .nonnegative(),
                                                contributionLevel:
                                                    contributionLevelSchema,
                                                date: z.string(),
                                            }),
                                        ),
                                    }),
                                ),
                            }),
                        }),
                    })
                    .nullable(),
            })
            .optional(),
        errors: z
            .array(
                z.object({
                    message: z.string(),
                }),
            )
            .optional(),
    })
    .passthrough();

type FetchFunction = typeof fetch;

export interface GithubProfileOptions {
    token: string;
    username: string;
    window: ContributionWindow;
    endpoint?: string;
    fetchFn?: FetchFunction;
    sleep?: (delayMs: number) => Promise<void>;
}

const CONTRIBUTION_LEVELS: Record<
    z.infer<typeof contributionLevelSchema>,
    ContributionLevel
> = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
};

const sleep = async (delayMs: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, delayMs));

const parseRetryAfter = (value: string | null): number | undefined => {
    if (!value) {
        return undefined;
    }
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(30_000, seconds * 1000);
    }
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return undefined;
    }
    return Math.min(30_000, Math.max(0, timestamp - Date.now()));
};

const isRetryableStatus = (status: number): boolean =>
    status === 429 || status >= 500;

export const loadGithubProfile = async ({
    token,
    username,
    window,
    endpoint = process.env.GITHUB_ENDPOINT ?? 'https://api.github.com/graphql',
    fetchFn = fetch,
    sleep: wait = sleep,
}: GithubProfileOptions): Promise<ContributionProfile> => {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        let response: Response;
        try {
            response = await fetchFn(endpoint, {
                method: 'POST',
                headers: {
                    authorization: `bearer ${token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    query: GITHUB_GRAPHQL_QUERY.replace(/\s+/g, ' ').trim(),
                    variables: {
                        login: username,
                        from: window.from,
                        to: window.to,
                    },
                }),
                signal: AbortSignal.timeout(20_000),
            });
        } catch (error) {
            lastError = error;
            if (attempt === 2) {
                break;
            }
            await wait(attempt === 0 ? 500 : 1500);
            continue;
        }

        if (!response.ok) {
            const error = new Error(`GitHub API returned HTTP ${response.status}.`);
            if (!isRetryableStatus(response.status) || attempt === 2) {
                throw error;
            }
            lastError = error;
            await wait(
                parseRetryAfter(response.headers.get('retry-after')) ??
                    (attempt === 0 ? 500 : 1500),
            );
            continue;
        }

        const rawResponse: unknown = await response.json();
        const parsedResponse = githubResponseSchema.safeParse(rawResponse);
        if (!parsedResponse.success) {
            throw new Error(
                `GitHub API returned an invalid response: ${parsedResponse.error.issues[0]?.message ?? 'unknown schema error'}`,
            );
        }
        const result = parsedResponse.data;
        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }
        if (!result.data?.user) {
            throw new Error(`GitHub user '${username}' was not found.`);
        }
        const calendar =
            result.data.user.contributionsCollection.contributionCalendar;
        return {
            username,
            totalContributions: calendar.totalContributions,
            calendar: calendar.weeks
                .flatMap((week) => week.contributionDays)
                .map((day) => ({
                    contributionCount: day.contributionCount,
                    contributionLevel: CONTRIBUTION_LEVELS[day.contributionLevel],
                    date: day.date,
                })),
        };
    }

    throw new Error(
        `GitHub API request failed after 3 attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
};
