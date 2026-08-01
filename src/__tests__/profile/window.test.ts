import { describe, expect, it } from 'vitest';
import { buildContributionWindow } from '../../profile/window.js';

describe('buildContributionWindow', () => {
    it('builds an inclusive trailing UTC window', () => {
        expect(
            buildContributionWindow(
                { mode: 'trailing', days: 7 },
                new Date('2026-08-01T18:00:00.000Z'),
            ),
        ).toEqual({
            from: '2026-07-26T00:00:00.000Z',
            to: '2026-08-01T23:59:59.999Z',
        });
    });

    it('builds a leap-year calendar window', () => {
        expect(
            buildContributionWindow(
                { mode: 'year', year: 2024 },
                new Date('2026-08-01T00:00:00.000Z'),
            ),
        ).toEqual({
            from: '2024-01-01T00:00:00.000Z',
            to: '2024-12-31T23:59:59.999Z',
        });
    });
});
