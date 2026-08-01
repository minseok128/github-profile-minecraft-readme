import { describe, expect, it } from 'vitest';
import {
    getCyclicInterpolation,
    isLeapYear,
    toDayOfYear,
} from '../../../scene/runtime/textures/seasonal-math.js';

const stops = [
    { month: 3, day: 1, value: 'spring' },
    { month: 12, day: 1, value: 'winter' },
] as const;

describe('seasonal date interpolation', () => {
    it('accounts for leap years after February', () => {
        expect(isLeapYear(2024)).toBe(true);
        expect(isLeapYear(2100)).toBe(false);
        expect(toDayOfYear(2024, 3, 1)).toBe(61);
        expect(toDayOfYear(2025, 3, 1)).toBe(60);
    });

    it('interpolates continuously across December and January', () => {
        const december = getCyclicInterpolation('2025-12-31', stops);
        const january = getCyclicInterpolation('2026-01-01', stops);
        expect(december.left.value).toBe('winter');
        expect(december.right.value).toBe('spring');
        expect(january.left.value).toBe('winter');
        expect(january.right.value).toBe('spring');
        expect(january.t).toBeGreaterThan(december.t);
        expect(january.t - december.t).toBeLessThan(0.02);
    });
});
