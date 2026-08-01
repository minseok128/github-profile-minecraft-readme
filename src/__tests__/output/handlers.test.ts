import { describe, expect, it } from 'vitest';
import { OUTPUT_HANDLERS } from '../../output/handlers.js';

describe('OUTPUT_HANDLERS', () => {
    it('declares resource requirements per output format', () => {
        expect(OUTPUT_HANDLERS.png.requirements).toEqual({
            runtimeBundle: true,
            browser: true,
            ffmpeg: false,
        });
        expect(OUTPUT_HANDLERS.gif.requirements.ffmpeg).toBe(true);
        expect(OUTPUT_HANDLERS.html.requirements).toEqual({
            runtimeBundle: true,
            browser: false,
            ffmpeg: false,
        });
    });
});
