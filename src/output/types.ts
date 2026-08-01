import type { OutputFormat } from '../scene/registry-ids.js';

export interface ExportedAssetPaths {
    pngPath?: string;
    gifPath?: string;
    htmlPath?: string;
    readmeSnippetPath: string;
    manifestPath: string;
}

export interface GeneratedArtifact {
    format: OutputFormat | 'support';
    relativePath: string;
    absolutePath: string;
}
