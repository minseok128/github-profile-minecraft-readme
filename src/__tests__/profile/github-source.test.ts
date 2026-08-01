import { describe, expect, it, vi } from 'vitest';
import { loadGithubProfile } from '../../profile/sources/github.js';

const window = {
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-12-31T23:59:59.999Z',
};

const successResponse = (): Response =>
    new Response(
        JSON.stringify({
            data: {
                user: {
                    contributionsCollection: {
                        contributionCalendar: {
                            totalContributions: 7,
                            weeks: [
                                {
                                    contributionDays: [
                                        {
                                            contributionCount: 0,
                                            contributionLevel: 'NONE',
                                            date: '2026-01-01',
                                        },
                                        {
                                            contributionCount: 7,
                                            contributionLevel: 'FOURTH_QUARTILE',
                                            date: '2026-01-02',
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
    );

describe('loadGithubProfile', () => {
    it('queries only contribution data and maps levels', async () => {
        let requestInit: RequestInit | undefined;
        const fetchFn: typeof fetch = async (_input, init) => {
            requestInit = init;
            return successResponse();
        };
        const profile = await loadGithubProfile({
            token: 'secret-token',
            username: 'test-user',
            window,
            fetchFn,
        });
        expect(profile).toEqual({
            username: 'test-user',
            totalContributions: 7,
            calendar: [
                {
                    contributionCount: 0,
                    contributionLevel: 0,
                    date: '2026-01-01',
                },
                {
                    contributionCount: 7,
                    contributionLevel: 4,
                    date: '2026-01-02',
                },
            ],
        });
        const body = JSON.parse(String(requestInit?.body)) as { query: string };
        expect(body.query).not.toContain('repositories');
        expect(body.query).not.toContain('commitContributionsByRepository');
    });

    it('retries 429 and 5xx responses with injected delays', async () => {
        const fetchFn = vi
            .fn()
            .mockResolvedValueOnce(new Response('', { status: 429 }))
            .mockResolvedValueOnce(new Response('', { status: 503 }))
            .mockResolvedValueOnce(successResponse());
        const sleep = vi.fn(async () => undefined);
        await loadGithubProfile({
            token: 'secret-token',
            username: 'test-user',
            window,
            fetchFn,
            sleep,
        });
        expect(fetchFn).toHaveBeenCalledTimes(3);
        expect(sleep).toHaveBeenNthCalledWith(1, 500);
        expect(sleep).toHaveBeenNthCalledWith(2, 1500);
    });

    it('does not retry authentication or GraphQL errors', async () => {
        const unauthorizedFetch = vi.fn(
            async () => new Response('', { status: 401 }),
        );
        await expect(
            loadGithubProfile({
                token: 'secret-token',
                username: 'test-user',
                window,
                fetchFn: unauthorizedFetch,
            }),
        ).rejects.toThrow('HTTP 401');
        expect(unauthorizedFetch).toHaveBeenCalledOnce();

        const graphqlFetch = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({ errors: [{ message: 'rate limited' }] }),
                    { status: 200 },
                ),
        );
        await expect(
            loadGithubProfile({
                token: 'secret-token',
                username: 'test-user',
                window,
                fetchFn: graphqlFetch,
            }),
        ).rejects.toThrow('rate limited');
        expect(graphqlFetch).toHaveBeenCalledOnce();
    });

    it('rejects missing users and malformed responses without exposing the token', async () => {
        const missingUserFetch = vi.fn(
            async () =>
                new Response(JSON.stringify({ data: { user: null } }), {
                    status: 200,
                }),
        );
        await expect(
            loadGithubProfile({
                token: 'secret-token',
                username: 'missing-user',
                window,
                fetchFn: missingUserFetch,
            }),
        ).rejects.not.toThrow('secret-token');

        const malformedFetch = vi.fn(
            async () => new Response(JSON.stringify({ data: { user: {} } })),
        );
        await expect(
            loadGithubProfile({
                token: 'secret-token',
                username: 'test-user',
                window,
                fetchFn: malformedFetch,
            }),
        ).rejects.toThrow('invalid response');
    });
});
