import type { ContributionWindow, ProfilePeriod } from './types.js';

const atUtcStartOfDay = (date: Date): Date =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const buildContributionWindow = (
    period: ProfilePeriod,
    asOf: Date,
): ContributionWindow => {
    if (period.mode === 'year') {
        return {
            from: `${period.year}-01-01T00:00:00.000Z`,
            to: `${period.year}-12-31T23:59:59.999Z`,
        };
    }

    const end = atUtcStartOfDay(asOf);
    const start = new Date(end.getTime());
    start.setUTCDate(start.getUTCDate() - period.days + 1);
    return {
        from: start.toISOString(),
        to: `${end.toISOString().slice(0, 10)}T23:59:59.999Z`,
    };
};
