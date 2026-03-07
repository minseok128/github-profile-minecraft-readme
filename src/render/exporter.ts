import * as path from 'node:path';
import type { ExportedAssetPaths, RenderConfig } from '../types.js';
import { ensureDir, writeTextFile } from '../utils.js';

const createReadmeSnippet = (
    exportedAssets: ExportedAssetPaths,
): string => {
    const relativeAsset = path
        .relative(process.cwd(), exportedAssets.svgPath)
        .split(path.sep)
        .join('/');

    return [
        '# README Embed',
        '',
        'Use the generated asset directly in your profile README:',
        '',
        '```md',
        `![Minecraft contribution world](${relativeAsset})`,
        '```',
    ].join('\n');
};

export const exportProfileAssets = async (
    projectRoot: string,
    config: RenderConfig,
    svg: string,
): Promise<ExportedAssetPaths> => {
    const outputDir = path.resolve(projectRoot, config.outputDir);
    await ensureDir(outputDir);
    const exportedAssets: ExportedAssetPaths = {
        svgPath: path.join(outputDir, `${config.baseName}.svg`),
        readmeSnippetPath: path.join(outputDir, 'README-snippet.md'),
    };
    await writeTextFile(exportedAssets.svgPath, svg);
    await writeTextFile(
        exportedAssets.readmeSnippetPath,
        createReadmeSnippet(exportedAssets),
    );
    return exportedAssets;
};
