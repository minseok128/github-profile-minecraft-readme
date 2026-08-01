import {
    mkdir,
    mkdtemp,
    readFile,
    stat,
    writeFile,
} from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    RENDER_MANIFEST_FILENAME,
    publishArtifacts,
    validateStagedArtifacts,
} from '../../output/publish.js';

const roots: Array<string> = [];

const createRoots = async (): Promise<{
    root: string;
    stagingDir: string;
    outputDir: string;
}> => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'minecraft-publish-'));
    roots.push(root);
    const stagingDir = path.join(root, 'staging');
    const outputDir = path.join(root, 'output');
    await Promise.all([
        mkdir(stagingDir, { recursive: true }),
        mkdir(outputDir, { recursive: true }),
    ]);
    return { root, stagingDir, outputDir };
};

afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await Promise.all(
        roots.splice(0).map((root) =>
            rm(root, { recursive: true, force: true }),
        ),
    );
});

describe('publishArtifacts', () => {
    it('publishes staged files and preserves unrelated files', async () => {
        const { stagingDir, outputDir } = await createRoots();
        await writeFile(path.join(stagingDir, 'profile.gif'), 'new gif');
        await writeFile(path.join(outputDir, 'notes.txt'), 'keep me');
        await publishArtifacts({
            stagingDir,
            outputDir,
            generatedPaths: ['profile.gif'],
            legacyManagedPaths: ['profile.gif'],
        });
        expect(await readFile(path.join(outputDir, 'profile.gif'), 'utf8')).toBe(
            'new gif',
        );
        expect(await readFile(path.join(outputDir, 'notes.txt'), 'utf8')).toBe(
            'keep me',
        );
        expect(
            JSON.parse(
                await readFile(
                    path.join(outputDir, RENDER_MANIFEST_FILENAME),
                    'utf8',
                ),
            ),
        ).toEqual({ version: 1, generated: ['profile.gif'] });
    });

    it('removes only stale files recorded by the previous manifest', async () => {
        const { stagingDir, outputDir } = await createRoots();
        await writeFile(path.join(stagingDir, 'profile.png'), 'png');
        await writeFile(path.join(outputDir, 'old.gif'), 'old');
        await writeFile(path.join(outputDir, 'keep.txt'), 'keep');
        await writeFile(
            path.join(outputDir, RENDER_MANIFEST_FILENAME),
            JSON.stringify({ version: 1, generated: ['old.gif'] }),
        );
        await publishArtifacts({
            stagingDir,
            outputDir,
            generatedPaths: ['profile.png'],
            legacyManagedPaths: [],
        });
        await expect(stat(path.join(outputDir, 'old.gif'))).rejects.toThrow();
        expect(await readFile(path.join(outputDir, 'keep.txt'), 'utf8')).toBe(
            'keep',
        );
    });

    it('rejects traversal and empty artifacts before touching outputs', async () => {
        const { stagingDir, outputDir } = await createRoots();
        await writeFile(path.join(outputDir, 'profile.gif'), 'previous');
        await writeFile(path.join(stagingDir, 'empty.gif'), '');
        await expect(
            validateStagedArtifacts(stagingDir, ['../outside.gif']),
        ).rejects.toThrow('escapes output root');
        await expect(
            publishArtifacts({
                stagingDir,
                outputDir,
                generatedPaths: ['empty.gif'],
                legacyManagedPaths: ['profile.gif'],
            }),
        ).rejects.toThrow('empty');
        expect(await readFile(path.join(outputDir, 'profile.gif'), 'utf8')).toBe(
            'previous',
        );
    });

    it('restores previous artifacts when publishing a replacement fails', async () => {
        const { stagingDir, outputDir } = await createRoots();
        await writeFile(path.join(stagingDir, 'profile.gif'), 'new');
        await writeFile(path.join(stagingDir, 'conflict'), 'cannot publish');
        await writeFile(path.join(outputDir, 'profile.gif'), 'previous');
        await mkdir(path.join(outputDir, 'conflict'));

        await expect(
            publishArtifacts({
                stagingDir,
                outputDir,
                generatedPaths: ['profile.gif', 'conflict'],
                legacyManagedPaths: ['profile.gif'],
            }),
        ).rejects.toThrow();
        expect(await readFile(path.join(outputDir, 'profile.gif'), 'utf8')).toBe(
            'previous',
        );
    });
});
