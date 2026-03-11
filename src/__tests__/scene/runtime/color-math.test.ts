import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex, mixHexColors, liftHex } from '../../../scene/runtime/textures/color-math.js';

describe('hexToRgb', () => {
    it('converts red', () => {
        expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('converts black', () => {
        expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('converts white', () => {
        expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('converts a mixed color', () => {
        expect(hexToRgb('#3178c6')).toEqual({ r: 49, g: 120, b: 198 });
    });
});

describe('rgbToHex', () => {
    it('converts black', () => {
        expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    });

    it('converts white', () => {
        expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
    });

    it('converts red', () => {
        expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    });

    it('round-trips with hexToRgb', () => {
        const original = '#3178c6';
        expect(rgbToHex(hexToRgb(original))).toBe(original);
    });
});

describe('mixHexColors', () => {
    it('t=0 returns colorA', () => {
        expect(mixHexColors('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    });

    it('t=1 returns colorB', () => {
        expect(mixHexColors('#ff0000', '#0000ff', 1)).toBe('#0000ff');
    });

    it('t=0.5 returns midpoint', () => {
        expect(mixHexColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    });

    it('mixes two colors at a quarter', () => {
        const result = hexToRgb(mixHexColors('#000000', '#ffffff', 0.25));
        expect(result.r).toBe(64);
        expect(result.g).toBe(64);
        expect(result.b).toBe(64);
    });
});

describe('liftHex', () => {
    it('amount=0 returns original color', () => {
        expect(liftHex('#3178c6', 0)).toBe('#3178c6');
    });

    it('amount=1 returns white', () => {
        expect(liftHex('#3178c6', 1)).toBe('#ffffff');
    });

    it('partial lift raises channels toward 255', () => {
        const result = hexToRgb(liftHex('#000000', 0.5));
        expect(result.r).toBe(128);
        expect(result.g).toBe(128);
        expect(result.b).toBe(128);
    });

    it('does not exceed 255 for any channel', () => {
        const result = hexToRgb(liftHex('#ffffff', 0.5));
        expect(result.r).toBe(255);
        expect(result.g).toBe(255);
        expect(result.b).toBe(255);
    });
});
