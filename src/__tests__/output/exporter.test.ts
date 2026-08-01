import { mkdtemp, readFile, stat } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Browser } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../config/schema.js';
import { exportProfileAssets } from '../../render/exporter.js';
import { createSampleProfile } from '../../sample-profile.js';

const roots: Array<string> = [];

const createOutputDirectory = async (): Promise<string> => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'minecraft-exporter-'));
    roots.push(root);
    return path.join(root, 'output');
};

afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await Promise.all(
        roots.splice(0).map((root) =>
            rm(root, { recursive: true, force: true }),
        ),
    );
});

const profile = createSampleProfile(
    'exporter-user',
    new Date('2026-08-01T00:00:00.000Z'),
);

describe('exportProfileAssets', () => {
    it('does not start a browser or ffmpeg for HTML-only output', async () => {
        const outputDirectory = await createOutputDirectory();
        const launchBrowser = vi.fn(async (): Promise<Browser> => {
            throw new Error('must not launch');
        });
        const commandRunner = vi.fn(async () => undefined);
        const result = await exportProfileAssets(
            path.resolve('.'),
            profile,
            {
                ...DEFAULT_CONFIG,
                capture: {
                    ...DEFAULT_CONFIG.capture,
                    formats: ['html'],
                },
                output: {
                    ...DEFAULT_CONFIG.output,
                    directory: outputDirectory,
                },
            },
            {
                buildRuntimeBundle: async () => 'export {};',
                launchBrowser,
                commandRunner,
            },
        );
        expect(launchBrowser).not.toHaveBeenCalled();
        expect(commandRunner).not.toHaveBeenCalled();
        expect(await readFile(result.htmlPath as string, 'utf8')).toContain(
            '<!doctype html>',
        );
        expect(await readFile(result.readmeSnippetPath, 'utf8')).toContain(
            '[Open Minecraft contribution world]',
        );
    });

    it('closes a started server when browser launch fails', async () => {
        const outputDirectory = await createOutputDirectory();
        const closeServer = vi.fn(async () => undefined);
        await expect(
            exportProfileAssets(
                path.resolve('.'),
                profile,
                {
                    ...DEFAULT_CONFIG,
                    capture: {
                        ...DEFAULT_CONFIG.capture,
                        formats: ['png'],
                    },
                    output: {
                        ...DEFAULT_CONFIG.output,
                        directory: outputDirectory,
                    },
                },
                {
                    buildRuntimeBundle: async () => 'export {};',
                    startServer: async () => ({
                        origin: 'http://127.0.0.1:12345',
                        close: closeServer,
                    }),
                    launchBrowser: async () => {
                        throw new Error('browser failed');
                    },
                },
            ),
        ).rejects.toThrow('browser failed');
        expect(closeServer).toHaveBeenCalledOnce();
        await expect(stat(outputDirectory)).rejects.toThrow();
    });

    it('closes browser and server when page creation fails', async () => {
        const outputDirectory = await createOutputDirectory();
        const closeServer = vi.fn(async () => undefined);
        const closeBrowser = vi.fn(async () => undefined);
        const browser = {
            newPage: vi.fn(async () => {
                throw new Error('page failed');
            }),
            close: closeBrowser,
        } as unknown as Browser;
        await expect(
            exportProfileAssets(
                path.resolve('.'),
                profile,
                {
                    ...DEFAULT_CONFIG,
                    capture: {
                        ...DEFAULT_CONFIG.capture,
                        formats: ['png'],
                    },
                    output: {
                        ...DEFAULT_CONFIG.output,
                        directory: outputDirectory,
                    },
                },
                {
                    buildRuntimeBundle: async () => 'export {};',
                    startServer: async () => ({
                        origin: 'http://127.0.0.1:12345',
                        close: closeServer,
                    }),
                    launchBrowser: async () => browser,
                },
            ),
        ).rejects.toThrow('page failed');
        expect(closeBrowser).toHaveBeenCalledOnce();
        expect(closeServer).toHaveBeenCalledOnce();
    });
});
