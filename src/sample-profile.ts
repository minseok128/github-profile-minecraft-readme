import type {
    ContributionLevel,
    ContributionProfile,
} from './profile/types.js';
import { hashString, mulberry32, toIsoDate } from './utils.js';

/**
 * Maps raw contribution count to GitHub's 0-4 contribution level scale.
 * @param contributionCount - The number of contributions
 * @returns A level from 0 (no contributions) to 4 (high activity)
 */
const toContributionLevel = (contributionCount: number): ContributionLevel => {
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
/**
 * Creates deterministic sample profile data for preview and testing purposes.
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
 * @returns A realistic sample contribution profile for the requested date window
 */
export const createSampleProfileForWindow = (
    username: string,
    from: string,
    to: string,
): ContributionProfile => {
    const start = new Date(from);
    const end = new Date(to);
    const dayCount =
        Math.floor(
            (Date.UTC(
                end.getUTCFullYear(),
                end.getUTCMonth(),
                end.getUTCDate(),
            ) -
                Date.UTC(
                    start.getUTCFullYear(),
                    start.getUTCMonth(),
                    start.getUTCDate(),
                )) /
                (24 * 60 * 60 * 1000),
        ) + 1;
    const rng = mulberry32(hashString(`${username}:calendar`));
    const calendar = [...Array<undefined>(dayCount)].map((_, index) => {
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

    const totalContributions = calendar.reduce(
        (sum, day) => sum + day.contributionCount,
        0,
    );

    return {
        username,
        calendar,
        totalContributions,
    };
};

export const createSampleProfile = (
    username: string,
    asOf = new Date(),
): ContributionProfile => {
    const end = new Date(
        Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
    );
    const start = new Date(end.getTime());
    start.setUTCDate(start.getUTCDate() - 364);
    return createSampleProfileForWindow(
        username,
        start.toISOString(),
        `${end.toISOString().slice(0, 10)}T23:59:59.999Z`,
    );
};
