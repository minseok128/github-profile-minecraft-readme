import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { RenderConfig } from '../config/types.js';
import { OUTPUT_HANDLERS, waitForSceneReady } from '../output/handlers.js';
import { runCommand } from '../output/command.js';
import {
    RENDER_MANIFEST_FILENAME,
    publishArtifacts,
} from '../output/publish.js';
import type { ExportedAssetPaths, GeneratedArtifact } from '../output/types.js';
import type { ContributionProfile } from '../profile/types.js';
import { SCENE_ASSETS } from '../scene/assets.js';
import { buildSceneHtml } from '../scene/build-scene-page.js';
import { SCENE_RUNTIME_BUNDLE_FILENAME } from '../scene/runtime/constants.js';
import { writeTextFile } from '../utils.js';
import { buildSceneRuntimeBundle } from './scene-runtime-bundle.js';
import { startStaticSceneServer } from './static-server.js';
import type { StaticSceneServer } from './static-server.js';

const README_SNIPPET_FILENAME = 'README-snippet.md';

export interface ExporterDependencies {
    buildRuntimeBundle: typeof buildSceneRuntimeBundle;
    startServer: typeof startStaticSceneServer;
    launchBrowser: () => Promise<Browser>;
    commandRunner: typeof runCommand;
    publish: typeof publishArtifacts;
}

const DEFAULT_DEPENDENCIES: ExporterDependencies = {
    buildRuntimeBundle: buildSceneRuntimeBundle,
    startServer: startStaticSceneServer,
    launchBrowser: async (): Promise<Browser> =>
        chromium.launch({
            channel: 'chromium',
            headless: true,
            args: [
                '--enable-webgl',
                '--ignore-gpu-blocklist',
                '--use-angle=swiftshader',
            ],
        }),
    commandRunner: runCommand,
    publish: publishArtifacts,
};

const toPosixPath = (filePath: string): string =>
    filePath.split(path.sep).join('/');

const buildReadmeSnippet = (
    projectRoot: string,
    outputDir: string,
    artifacts: Array<GeneratedArtifact>,
): string => {
    const preferredArtifact =
        artifacts.find((artifact) => artifact.format === 'gif') ??
        artifacts.find((artifact) => artifact.format === 'png') ??
        artifacts.find((artifact) => artifact.format === 'html');
    if (!preferredArtifact) {
        throw new Error('No embeddable output was generated.');
    }
    const relativeTarget = toPosixPath(
        path.relative(
            projectRoot,
            path.join(outputDir, preferredArtifact.relativePath),
        ),
    );
    const embedLine =
        preferredArtifact.format === 'html'
            ? `[Open Minecraft contribution world](${relativeTarget})`
            : `![Minecraft contribution world](${relativeTarget})`;
    return [
        '# README Embed',
        '',
        'Use the generated asset directly in your profile README with an unofficial notice:',
        '',
        '```md',
        embedLine,
        '<sub>Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</sub>',
        '```',
        '',
    ].join('\n');
};

const collectLegacyManagedPaths = (baseName: string): Array<string> => [
    `${baseName}.png`,
    `${baseName}.gif`,
    `${baseName}.html`,
    SCENE_RUNTIME_BUNDLE_FILENAME,
    README_SNIPPET_FILENAME,
    RENDER_MANIFEST_FILENAME,
    ...Object.values(SCENE_ASSETS).map((fileName) =>
        path.posix.join('assets', fileName),
    ),
];

const closeResources = async (
    page: Page | undefined,
    browser: Browser | undefined,
    server: StaticSceneServer | undefined,
): Promise<void> => {
    const cleanupSteps = [
        ['page', page ? (): Promise<void> => page.close() : undefined],
        ['browser', browser ? (): Promise<void> => browser.close() : undefined],
        ['server', server ? (): Promise<void> => server.close() : undefined],
    ] as const;
    for (const [resourceName, cleanup] of cleanupSteps) {
        if (!cleanup) {
            continue;
        }
        try {
            await cleanup();
        } catch (error) {
            console.error(
                `${resourceName} cleanup failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
};

export const exportProfileAssets = async (
    projectRoot: string,
    profile: ContributionProfile,
    config: RenderConfig,
    dependencyOverrides: Partial<ExporterDependencies> = {},
): Promise<ExportedAssetPaths> => {
    const dependencies = {
        ...DEFAULT_DEPENDENCIES,
        ...dependencyOverrides,
    };
    const outputDir = path.resolve(projectRoot, config.output.directory);
    const outputParent = path.dirname(outputDir);
    await mkdir(outputParent, { recursive: true });
    const stagingDir = await mkdtemp(
        path.join(outputParent, `.${path.basename(outputDir)}-staging-`),
    );
    const handlers = config.capture.formats.map(
        (format) => OUTPUT_HANDLERS[format],
    );
    const needsBrowser = handlers.some(
        (handler) => handler.requirements.browser,
    );
    const needsFfmpeg = handlers.some((handler) => handler.requirements.ffmpeg);
    let server: StaticSceneServer | undefined;
    let browser: Browser | undefined;
    let page: Page | undefined;

    try {
        if (needsFfmpeg) {
            await dependencies.commandRunner('ffmpeg', ['-version'], 30_000);
        }
        const runtimeScript =
            await dependencies.buildRuntimeBundle(projectRoot);
        if (needsBrowser) {
            server = await dependencies.startServer(
                projectRoot,
                buildSceneHtml(profile, config),
                runtimeScript,
            );
            browser = await dependencies.launchBrowser();
            page = await browser.newPage({
                viewport: {
                    width: config.capture.width,
                    height: config.capture.height,
                },
                deviceScaleFactor: 1,
            });
            page.on('console', (message) => {
                if (message.type() === 'error') {
                    console.error(`[browser:error] ${message.text()}`);
                }
            });
            page.on('requestfailed', (request) => {
                console.error(
                    `[requestfailed] ${request.url()} :: ${
                        request.failure()?.errorText ?? 'unknown'
                    }`,
                );
            });
            await page.goto(`${server.origin}/scene.html`, {
                waitUntil: 'networkidle',
            });
            await waitForSceneReady(page);
        }

        const artifacts: Array<GeneratedArtifact> = [];
        for (const handler of handlers) {
            artifacts.push(
                ...(await handler.produce({
                    projectRoot,
                    stagingDir,
                    profile,
                    config,
                    runtimeScript,
                    page,
                    runCommand: dependencies.commandRunner,
                })),
            );
        }

        const snippetPath = path.join(stagingDir, README_SNIPPET_FILENAME);
        await writeTextFile(
            snippetPath,
            buildReadmeSnippet(projectRoot, outputDir, artifacts),
        );
        artifacts.push({
            format: 'support',
            relativePath: README_SNIPPET_FILENAME,
            absolutePath: snippetPath,
        });

        const manifestPath = await dependencies.publish({
            stagingDir,
            outputDir,
            generatedPaths: artifacts.map((artifact) => artifact.relativePath),
            legacyManagedPaths: collectLegacyManagedPaths(
                config.output.baseName,
            ),
        });
        const findOutputPath = (
            format: 'png' | 'gif' | 'html',
        ): string | undefined => {
            const artifact = artifacts.find((entry) => entry.format === format);
            return artifact
                ? path.join(outputDir, artifact.relativePath)
                : undefined;
        };
        return {
            pngPath: findOutputPath('png'),
            gifPath: findOutputPath('gif'),
            htmlPath: findOutputPath('html'),
            readmeSnippetPath: path.join(outputDir, README_SNIPPET_FILENAME),
            manifestPath,
        };
    } finally {
        await closeResources(page, browser, server);
        try {
            await rm(stagingDir, { recursive: true, force: true });
        } catch (error) {
            console.error(
                `staging cleanup failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
};
