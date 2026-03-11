import type { LanguageContribution, UserSnapshot } from './types.js';
import { hashString, mulberry32, toIsoDate } from './utils.js';

/**
 * Maps raw contribution count to GitHub's 0-4 contribution level scale.
 * @param contributionCount - The number of contributions
 * @returns A level from 0 (no contributions) to 4 (high activity)
 */
const toContributionLevel = (contributionCount: number): number => {
    if (contributionCount === 0) {
        return 0;
    }
    if (contributionCount <= 4) {
        return 1;
    }
    if (contributionCount <= 9) {
        return 2;
    }
    if (contributionCount <= 16) {
        return 3;
    }
    return 4;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Generates deterministic sample language contribution data using seeded RNG.
 * Uses the username to create a reproducible sequence via FNV-1a hash and Mulberry32 PRNG.
 * @param username - The GitHub username used as the seed source
 * @returns An array of language contributions with seeded randomized counts
 */
const buildLanguageSamples = (username: string): Array<LanguageContribution> => {
    const rng = mulberry32(hashString(`${username}:languages`));
    const seeds = [
        ['TypeScript', '#3178c6'],
        ['GLSL', '#5686a5'],
        ['Rust', '#dea584'],
        ['Python', '#3572a5'],
        ['C++', '#f34b7d'],
    ] as const;
    return seeds.map(([language, color], index) => ({
        language,
        color,
        contributions: 40 + Math.floor(rng() * 70) + index * 9,
    }));
};

/**
 * Creates a deterministic sample UserSnapshot for preview and testing purposes.
 * Uses FNV-1a hashing and Mulberry32 PRNG seeded by username for reproducible output.
 *
 * Contribution simulation strategy:
 * - Seasonal wave: Sinusoidal oscillation creating natural peaks/valleys
 * - Sprint phases: Two intense work periods (around days 105 and 305) with high contribution spikes
 * - Rest windows: Periodic low-activity zones reducing contribution likelihood
 * - Burst events: Random high-contribution days for unpredictable peaks
 * - Off days: Probabilistically reduced activity with weekend multipliers
 *
 * @param username - GitHub username to seed the deterministic generation
 * @returns A realistic sample UserSnapshot with 365 days of contribution data and language stats
 */
export const createSampleProfile = (username: string): UserSnapshot => {
    const today = new Date();
    const start = new Date(
        Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate() - 364,
        ),
    );
    const rng = mulberry32(hashString(`${username}:calendar`));
    const calendar = [...Array<undefined>(365)].map((_, index) => {
        const date = new Date(start.getTime());
        date.setUTCDate(start.getUTCDate() + index);

        const seasonalWave =
            (Math.sin(index / 11) + Math.cos(index / 23) + 2) * 3.4;
        const sprintA = clamp01(1 - Math.abs(index - 105) / 34);
        const sprintB = clamp01(1 - Math.abs(index - 305) / 40);
        const sprintIntensity = Math.max(sprintA, sprintB);
        const restWindow = Math.sin(index / 8) < -0.72;
        const offDayMultiplier = sprintIntensity > 0 ? 0.42 : 1;
        const isOffDay =
            rng() < 0.14 * offDayMultiplier ||
            (date.getUTCDay() === 0 && rng() < 0.24 * offDayMultiplier) ||
            (restWindow && rng() < 0.32 * offDayMultiplier);
        const burst = rng() > 0.88 ? 10 + Math.floor(rng() * 14) : 0;
        const routineWork = 1 + Math.floor(rng() * 5);
        const sprintLoad =
            sprintIntensity > 0
                ? 16 + sprintIntensity * 34 + Math.floor(rng() * 8)
                : 0;
        const releasePush =
            sprintIntensity > 0.45 && rng() > 0.7
                ? 12 + Math.floor(rng() * 24)
                : 0;
        const contributionCount = isOffDay
            ? 0
            : Math.max(
                  0,
                  Math.floor(
                      seasonalWave +
                          routineWork +
                          burst +
                          sprintLoad +
                          releasePush,
                  ),
              );

        return {
            contributionCount,
            contributionLevel: toContributionLevel(contributionCount),
            date: toIsoDate(date),
        };
    });

    const languages = buildLanguageSamples(username);
    const totalContributions = calendar.reduce(
        (sum, day) => sum + day.contributionCount,
        0,
    );

    return {
        username,
        calendar,
        languages,
        totalContributions,
        totalCommitContributions: Math.floor(totalContributions * 0.72),
        totalIssueContributions: Math.floor(totalContributions * 0.08),
        totalPullRequestContributions: Math.floor(totalContributions * 0.11),
        totalPullRequestReviewContributions: Math.floor(totalContributions * 0.06),
        totalRepositoryContributions: Math.floor(totalContributions * 0.03),
        totalForkCount: 38,
        totalStargazerCount: 172,
    };
};
