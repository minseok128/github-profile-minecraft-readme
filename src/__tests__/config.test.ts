import { mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseCliOptions } from '../config/cli.js';
import { loadRenderConfig, resolveRenderRequest } from '../config/load.js';
import { DEFAULT_CONFIG, renderConfigSchema } from '../config/schema.js';

const temporaryDirectories: Array<string> = [];

const createConfigDirectory = async (config: unknown): Promise<string> => {
    const directory = await mkdtemp(
        path.join(os.tmpdir(), 'minecraft-config-'),
    );
    temporaryDirectories.push(directory);
    await writeFile(
        path.join(directory, 'config.json'),
        JSON.stringify(config),
        'utf8',
    );
    return directory;
};

afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) =>
                rm(directory, { recursive: true, force: true }),
            ),
    );
});

describe('parseCliOptions', () => {
    it('parses the minimal v2 CLI', () => {
        expect(
            parseCliOptions([
                '--config',
                'custom.json',
                '--username',
                'test-user',
                '--sample',
                '--output-dir',
                'out',
                '--as-of',
                '2026-08-01',
            ]),
        ).toEqual({
            configPath: 'custom.json',
            username: 'test-user',
            sample: true,
            outputDir: 'out',
            asOf: '2026-08-01',
            help: false,
        });
    });

    it('rejects unknown and removed flags', () => {
        expect(() => parseCliOptions(['--weeks', '10'])).toThrow();
        expect(() => parseCliOptions(['--token', 'secret'])).toThrow();
        expect(() => parseCliOptions(['--max-repos', '5'])).toThrow();
    });

    it('rejects missing option values', () => {
        expect(() => parseCliOptions(['--username'])).toThrow();
    });
});

describe('v2 config', () => {
    it('has valid built-in defaults', () => {
        expect(renderConfigSchema.parse(DEFAULT_CONFIG)).toEqual(
            DEFAULT_CONFIG,
        );
        expect(DEFAULT_CONFIG.version).toBe(2);
        expect(DEFAULT_CONFIG.scene.theme).toBe('korean-seasonal');
        expect(DEFAULT_CONFIG.capture.formats).toEqual(['png', 'gif', 'html']);
    });

    it('deep-merges a strict partial config over defaults', async () => {
        const directory = await createConfigDirectory({
            version: 2,
            scene: { weeks: 26 },
            capture: { gif: { fps: 12 } },
        });
        const config = await loadRenderConfig(directory, {
            configPath: 'config.json',
            sample: false,
            help: false,
        });
        expect(config.scene.weeks).toBe(26);
        expect(config.capture.gif.fps).toBe(12);
        expect(config.capture.width).toBe(1200);
    });

    it('rejects unknown keys and duplicate formats', async () => {
        const unknownDirectory = await createConfigDirectory({
            version: 2,
            unexpected: true,
        });
        await expect(
            loadRenderConfig(unknownDirectory, {
                configPath: 'config.json',
                sample: false,
                help: false,
            }),
        ).rejects.toThrow('Invalid config');

        const duplicateDirectory = await createConfigDirectory({
            version: 2,
            capture: { formats: ['png', 'png'] },
        });
        await expect(
            loadRenderConfig(duplicateDirectory, {
                configPath: 'config.json',
                sample: false,
                help: false,
            }),
        ).rejects.toThrow('duplicates');
    });

    it('rejects legacy v1 keys', async () => {
        const directory = await createConfigDirectory({
            version: 2,
            weeks: 53,
            createGif: true,
        });
        await expect(
            loadRenderConfig(directory, {
                configPath: 'config.json',
                sample: false,
                help: false,
            }),
        ).rejects.toThrow('Invalid config');
    });
});

describe('resolveRenderRequest', () => {
    it('applies CLI overrides and a fixed UTC date', async () => {
        const request = await resolveRenderRequest(
            path.resolve('.'),
            {
                username: 'cli-user',
                sample: true,
                outputDir: 'custom-output',
                asOf: '2026-08-01',
                help: false,
            },
            {},
        );
        expect(request.config.profile.source).toBe('sample');
        expect(request.config.profile.username).toBe('cli-user');
        expect(request.config.output.directory).toBe('custom-output');
        expect(request.asOf.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    });

    it('uses GITHUB_ACTOR only for the github source', async () => {
        const request = await resolveRenderRequest(
            path.resolve('.'),
            { sample: false, help: false },
            { GITHUB_ACTOR: 'workflow-owner', GITHUB_TOKEN: 'token' },
        );
        expect(request.config.profile.username).toBe('workflow-owner');
        expect(request.githubToken).toBe('token');
    });

    it('rejects an invalid date and year/as-of conflict', async () => {
        await expect(
            resolveRenderRequest(
                path.resolve('.'),
                { sample: true, asOf: '2026-02-30', help: false },
                {},
            ),
        ).rejects.toThrow('Invalid --as-of');

        const directory = await createConfigDirectory({
            version: 2,
            profile: {
                source: 'sample',
                period: { mode: 'year', year: 2025 },
            },
        });
        await expect(
            resolveRenderRequest(
                directory,
                {
                    configPath: 'config.json',
                    sample: false,
                    asOf: '2025-12-31',
                    help: false,
                },
                {},
            ),
        ).rejects.toThrow('--as-of cannot be used');
    });
});
