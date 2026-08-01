import { describe, expect, it } from 'vitest';
import { calculateOrthographicFrustum } from '../../../scene/runtime/camera/frustum.js';

describe('calculateOrthographicFrustum', () => {
    it('preserves horizontal fit for a wide viewport', () => {
        const frustum = calculateOrthographicFrustum({
            width: 1200,
            height: 600,
            fitHalfWidth: 20,
            fitHalfHeight: 8,
        });
        expect(frustum).toEqual({
            left: -20,
            right: 20,
            top: 10,
            bottom: -10,
        });
    });

    it('preserves vertical fit for a narrow viewport', () => {
        const frustum = calculateOrthographicFrustum({
            width: 600,
            height: 1200,
            fitHalfWidth: 20,
            fitHalfHeight: 8,
        });
        expect(frustum.left).toBe(-20);
        expect(frustum.right).toBe(20);
        expect(frustum.top).toBe(40);
        expect(frustum.bottom).toBe(-40);
    });
});
