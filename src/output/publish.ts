import {
    mkdir,
    readFile,
    rename,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';

export const RENDER_MANIFEST_FILENAME = '.profile-render-manifest.json';

const manifestSchema = z.object({
    version: z.literal(1),
    generated: z.array(z.string()),
});

export interface RenderManifest {
    version: 1;
    generated: Array<string>;
}

const resolveManagedPath = (root: string, relativePath: string): string => {
    if (!relativePath || path.isAbsolute(relativePath)) {
        throw new Error(`Unsafe generated path '${relativePath}'.`);
    }
    const resolvedRoot = path.resolve(root);
    const resolvedPath = path.resolve(root, relativePath);
    if (
        resolvedPath !== resolvedRoot &&
        !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
        throw new Error(`Generated path escapes output root: '${relativePath}'.`);
    }
    return resolvedPath;
};

const readPreviousManifest = async (
    outputDir: string,
): Promise<RenderManifest | undefined> => {
    try {
        const content = await readFile(
            path.join(outputDir, RENDER_MANIFEST_FILENAME),
            'utf8',
        );
        return manifestSchema.parse(JSON.parse(content));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return undefined;
        }
        return undefined;
    }
};

export const validateStagedArtifacts = async (
    stagingDir: string,
    relativePaths: ReadonlyArray<string>,
): Promise<void> => {
    for (const relativePath of relativePaths) {
        const filePath = resolveManagedPath(stagingDir, relativePath);
        const fileStat = await stat(filePath);
        if (!fileStat.isFile() || fileStat.size === 0) {
            throw new Error(`Generated artifact is empty: ${relativePath}`);
        }
    }
};

export const publishArtifacts = async ({
    stagingDir,
    outputDir,
    generatedPaths,
    legacyManagedPaths,
}: {
    stagingDir: string;
    outputDir: string;
    generatedPaths: Array<string>;
    legacyManagedPaths: Array<string>;
}): Promise<string> => {
    const previousManifest = await readPreviousManifest(outputDir);
    const normalizedGeneratedPaths = [...new Set(generatedPaths)].sort();
    const manifest: RenderManifest = {
        version: 1,
        generated: normalizedGeneratedPaths,
    };
    const stagedManifestPath = path.join(
        stagingDir,
        RENDER_MANIFEST_FILENAME,
    );
    await writeFile(
        stagedManifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
    );
    await validateStagedArtifacts(stagingDir, [
        ...normalizedGeneratedPaths,
        RENDER_MANIFEST_FILENAME,
    ]);

    await mkdir(outputDir, { recursive: true });
    const backupDir = path.join(stagingDir, '.backup');
    const managedPaths = [
        ...new Set([
            ...(previousManifest?.generated ?? []),
            ...legacyManagedPaths,
            ...normalizedGeneratedPaths,
            RENDER_MANIFEST_FILENAME,
        ]),
    ];
    const backedUpPaths: Array<string> = [];
    const publishedPaths: Array<string> = [];

    try {
        for (const relativePath of managedPaths) {
            const destinationPath = resolveManagedPath(outputDir, relativePath);
            try {
                const destinationStat = await stat(destinationPath);
                if (!destinationStat.isFile()) {
                    continue;
                }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    continue;
                }
                throw error;
            }
            const backupPath = resolveManagedPath(backupDir, relativePath);
            await mkdir(path.dirname(backupPath), { recursive: true });
            await rename(destinationPath, backupPath);
            backedUpPaths.push(relativePath);
        }

        for (const relativePath of [
            ...normalizedGeneratedPaths,
            RENDER_MANIFEST_FILENAME,
        ]) {
            const sourcePath = resolveManagedPath(stagingDir, relativePath);
            const destinationPath = resolveManagedPath(outputDir, relativePath);
            await mkdir(path.dirname(destinationPath), { recursive: true });
            await rename(sourcePath, destinationPath);
            publishedPaths.push(relativePath);
        }
        await rm(backupDir, { recursive: true, force: true });
        return path.join(outputDir, RENDER_MANIFEST_FILENAME);
    } catch (error) {
        for (const relativePath of publishedPaths.reverse()) {
            await rm(resolveManagedPath(outputDir, relativePath), { force: true });
        }
        for (const relativePath of backedUpPaths.reverse()) {
            const backupPath = resolveManagedPath(backupDir, relativePath);
            const destinationPath = resolveManagedPath(outputDir, relativePath);
            await mkdir(path.dirname(destinationPath), { recursive: true });
            await rename(backupPath, destinationPath);
        }
        throw error;
    }
};
