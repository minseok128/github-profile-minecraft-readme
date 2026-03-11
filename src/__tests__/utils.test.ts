import { describe, it, expect } from 'vitest';
import { toIsoDate, toFixed, formatThousands, trimLastWeeks, hashString, mulberry32 } from '../utils.js';

describe('toIsoDate', () => {
    it('formats a UTC date as YYYY-MM-DD', () => {
        expect(toIsoDate(new Date('2025-03-15T12:00:00Z'))).toBe('2025-03-15');
    });

    it('handles year boundary', () => {
        expect(toIsoDate(new Date('2024-12-31T23:59:59Z'))).toBe('2024-12-31');
    });

    it('zero-pads month and day', () => {
        expect(toIsoDate(new Date('2025-01-05T00:00:00Z'))).toBe('2025-01-05');
    });
});

describe('toFixed', () => {
    it('rounds to 2 decimal places by default', () => {
        expect(toFixed(3.14159)).toBe(3.14);
    });

    it('rounds to specified digits', () => {
        expect(toFixed(3.14159, 3)).toBe(3.142);
    });

    it('returns a number, not a string', () => {
        expect(typeof toFixed(1.005, 2)).toBe('number');
    });
});

describe('formatThousands', () => {
    it('formats numbers with comma separators', () => {
        expect(formatThousands(1234567)).toBe('1,234,567');
    });

    it('does not format small numbers', () => {
        expect(formatThousands(999)).toBe('999');
    });

    it('handles zero', () => {
        expect(formatThousands(0)).toBe('0');
    });
});

describe('trimLastWeeks', () => {
    it('returns full array when length <= weeks * 7', () => {
        const days = Array.from({ length: 14 }, (_, i) => i);
        expect(trimLastWeeks(days, 2)).toEqual(days);
    });

    it('trims to the last N weeks of days', () => {
        const days = Array.from({ length: 21 }, (_, i) => i);
        const result = trimLastWeeks(days, 2);
        expect(result).toHaveLength(14);
        expect(result[0]).toBe(7);
    });

    it('normalizes non-finite weeks to 52', () => {
        const days = Array.from({ length: 400 }, (_, i) => i);
        expect(trimLastWeeks(days, NaN)).toHaveLength(364);
    });

    it('clamps weeks to minimum of 1', () => {
        const days = Array.from({ length: 21 }, (_, i) => i);
        expect(trimLastWeeks(days, 0)).toHaveLength(7);
    });
});

describe('hashString', () => {
    it('returns a non-negative 32-bit integer', () => {
        const hash = hashString('test');
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
        expect(Number.isInteger(hash)).toBe(true);
    });

    it('is deterministic', () => {
        expect(hashString('hello')).toBe(hashString('hello'));
    });

    it('produces different hashes for different inputs', () => {
        expect(hashString('abc')).not.toBe(hashString('xyz'));
    });

    it('handles empty string', () => {
        const hash = hashString('');
        expect(hash).toBeGreaterThanOrEqual(0);
    });
});

describe('mulberry32', () => {
    it('produces deterministic sequences from the same seed', () => {
        const rng1 = mulberry32(42);
        const rng2 = mulberry32(42);
        const seq1 = Array.from({ length: 10 }, () => rng1());
        const seq2 = Array.from({ length: 10 }, () => rng2());
        expect(seq1).toEqual(seq2);
    });

    it('produces values in [0, 1)', () => {
        const rng = mulberry32(123);
        for (let i = 0; i < 100; i++) {
            const value = rng();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it('produces different sequences for different seeds', () => {
        const rng1 = mulberry32(1);
        const rng2 = mulberry32(2);
        const val1 = rng1();
        const val2 = rng2();
        expect(val1).not.toBe(val2);
    });
});
