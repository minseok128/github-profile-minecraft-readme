import { describe, it, expect } from 'vitest';
import { hashString as nodeHashString } from '../../../utils.js';
import { hashString as browserHashString } from '../../../scene/runtime/textures/seasonal.js';

const TEST_INPUTS = ['hello', 'test', '', 'github:calendar', 'user:languages', '2024-01-15:3'];

describe('hashString cross-validation', () => {
    it('browserHashString equals nodeHashString / 4294967296 for all inputs', () => {
        for (const input of TEST_INPUTS) {
            expect(browserHashString(input)).toBe(nodeHashString(input) / 4294967296);
        }
    });

    it('both implementations are deterministic', () => {
        for (const input of TEST_INPUTS) {
            expect(nodeHashString(input)).toBe(nodeHashString(input));
            expect(browserHashString(input)).toBe(browserHashString(input));
        }
    });

    it('browserHashString returns values in [0, 1)', () => {
        for (const input of TEST_INPUTS) {
            const value = browserHashString(input);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it('nodeHashString returns non-negative 32-bit integers', () => {
        for (const input of TEST_INPUTS) {
            const value = nodeHashString(input);
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(0xFFFFFFFF);
        }
    });
});
