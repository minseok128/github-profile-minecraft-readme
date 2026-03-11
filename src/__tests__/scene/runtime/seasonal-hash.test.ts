import { describe, it, expect } from 'vitest';
import { hashString } from '../../../scene/runtime/textures/seasonal.js';

describe('hashString', () => {
    it('returns a number in [0, 1)', () => {
        const value = hashString('hello');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
    });

    it('is deterministic for the same input', () => {
        expect(hashString('minecraft')).toBe(hashString('minecraft'));
    });

    it('produces different outputs for different inputs', () => {
        expect(hashString('abc')).not.toBe(hashString('xyz'));
    });

    it('handles empty string', () => {
        const value = hashString('');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
    });

    it('handles longer strings', () => {
        const value = hashString('a-longer-string-to-hash-for-testing');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
    });
});
