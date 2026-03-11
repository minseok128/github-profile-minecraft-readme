import { describe, it, expect } from 'vitest';
import { parseCliOptions, DEFAULT_CONFIG } from '../config.js';

describe('parseCliOptions', () => {
    it('returns defaults when no args provided', () => {
        const options = parseCliOptions([]);
        expect(options.sample).toBe(false);
        expect(options.username).toBeUndefined();
    });

    it('parses --username', () => {
        const options = parseCliOptions(['--username', 'testuser']);
        expect(options.username).toBe('testuser');
    });

    it('parses --sample flag', () => {
        const options = parseCliOptions(['--sample']);
        expect(options.sample).toBe(true);
    });

    it('parses --output-dir', () => {
        const options = parseCliOptions(['--output-dir', '/tmp/out']);
        expect(options.outputDir).toBe('/tmp/out');
    });

    it('parses --weeks as number', () => {
        const options = parseCliOptions(['--weeks', '26']);
        expect(options.weeks).toBe(26);
    });

    it('parses --width and --height', () => {
        const options = parseCliOptions(['--width', '800', '--height', '600']);
        expect(options.width).toBe(800);
        expect(options.height).toBe(600);
    });

    it('parses --background sky', () => {
        const options = parseCliOptions(['--background', 'sky']);
        expect(options.background).toBe('sky');
    });

    it('ignores invalid background values', () => {
        const options = parseCliOptions(['--background', 'invalid']);
        expect(options.background).toBeUndefined();
    });

    it('parses --no-gif and --no-png', () => {
        const options = parseCliOptions(['--no-gif', '--no-png']);
        expect(options.createGif).toBe(false);
        expect(options.createPng).toBe(false);
    });

    it('parses --emit-html flag', () => {
        const options = parseCliOptions(['--emit-html']);
        expect(options.emitHtml).toBe(true);
    });

    it('parses --duration and --fps', () => {
        const options = parseCliOptions(['--duration', '10', '--fps', '30']);
        expect(options.gifDurationSec).toBe(10);
        expect(options.gifFps).toBe(30);
    });

    it('parses multiple args together', () => {
        const options = parseCliOptions([
            '--sample', '--weeks', '10', '--width', '640', '--emit-html',
        ]);
        expect(options.sample).toBe(true);
        expect(options.weeks).toBe(10);
        expect(options.width).toBe(640);
        expect(options.emitHtml).toBe(true);
    });
});

describe('DEFAULT_CONFIG', () => {
    it('has valid default values', () => {
        expect(DEFAULT_CONFIG.weeks).toBe(53);
        expect(DEFAULT_CONFIG.width).toBe(1200);
        expect(DEFAULT_CONFIG.height).toBe(892);
        expect(DEFAULT_CONFIG.background).toBe('transparent');
        expect(DEFAULT_CONFIG.gif.fps).toBe(10);
        expect(DEFAULT_CONFIG.gif.durationSec).toBe(5);
    });
});
