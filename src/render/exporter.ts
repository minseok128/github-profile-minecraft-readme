import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import type {
    ExportedAssetPaths,
    RenderConfig,
    UserSnapshot,
} from '../types.js';
import {
    STANDALONE_SCENE_ASSET_URLS,
    buildSceneHtml,
} from '../scene/build-scene-page.js';
import { SCENE_RUNTIME_BUNDLE_FILENAME } from '../scene/runtime/constants.js';
import { ensureDir, writeTextFile } from '../utils.js';
import { buildSceneRuntimeBundle } from './scene-runtime-bundle.js';
import { startStaticSceneServer } from './static-server.js';

const runCommand = async (
    command: string,
    args: Array<string>,
    timeoutMs = 120_000,
): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            signal: AbortSignal.timeout(timeoutMs),
        });
        child.on('error', (error) => {
            if (error.name === 'AbortError') {
                reject(new Error(`${command} timed out after ${timeoutMs}ms`));
                return;
            }
            reject(error);
        });
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
        });
    });

const createReadmeSnippet = (
    config: RenderConfig,
    exportedAssets: ExportedAssetPaths,
): string => {
    const preferredAsset = exportedAssets.gifPath ?? exportedAssets.pngPath;
    const relativeAsset = preferredAsset
        ? path
              .relative(process.cwd(), preferredAsset)
              .split(path.sep)
              .join('/')
        : '';

    return [
        '# README Embed',
        '',
        'Use the generated asset directly in your profile README with an unofficial notice:',
        '',
        '```md',
        `![Minecraft contribution world](${relativeAsset})`,
        '<sub>Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</sub>',
        '```',
        '',
        `PNG enabled: ${config.createPng}`,
        `GIF enabled: ${config.createGif}`,
        `Preview HTML enabled: ${config.emitHtml}`,
    ].join('\n');
};

const removeStandalonePreviewOutputs = async (
    outputDir: string,
    baseName: string,
): Promise<void> => {
    await Promise.all([
        rm(path.join(outputDir, 'assets'), {
            recursive: true,
            force: true,
        }),
        rm(path.join(outputDir, `${baseName}.html`), {
            force: true,
        }),
        rm(path.join(outputDir, SCENE_RUNTIME_BUNDLE_FILENAME), {
            force: true,
        }),
        rm(path.join(outputDir, 'vendor'), {
            recursive: true,
            force: true,
        }),
    ]);
};

const writeStandalonePreview = async (
    projectRoot: string,
    outputDir: string,
    baseName: string,
    html: string,
    sceneRuntimeScript: string,
): Promise<string> => {
    await rm(path.join(outputDir, 'vendor'), {
        recursive: true,
        force: true,
    });
    const assetDir = path.join(outputDir, 'assets');
    await ensureDir(assetDir);
    const assetFiles = [
        'sheep.png',
        'sheep_fur.png',
        'grass_block_top.png',
        'grass_block_side.png',
        'grass_block_side_overlay.png',
        'grass_block_snow.png',
        'pink_petals.png',
        'leaf_litter.png',
        'poppy.png',
        'dandelion.png',
        'cornflower.png',
        'blue_orchid.png',
        'azure_bluet.png',
        'pink_tulip.png',
        'white_tulip.png',
        'snow.png',
        'dirt.png',
        'water_top.png',
        'water_side.png',
    ];

    await Promise.all(
        assetFiles.map((assetFile) =>
            copyFile(
                path.join(projectRoot, 'assets', assetFile),
                path.join(assetDir, assetFile),
            ),
        ),
    );

    await writeTextFile(
        path.join(outputDir, SCENE_RUNTIME_BUNDLE_FILENAME),
        sceneRuntimeScript,
    );
    const htmlPath = path.join(outputDir, `${baseName}.html`);
    await writeTextFile(htmlPath, html);
    return htmlPath;
};

export const exportProfileAssets = async (
    projectRoot: string,
    userSnapshot: UserSnapshot,
    config: RenderConfig,
    html: string,
): Promise<ExportedAssetPaths> => {
    const outputDir = path.resolve(projectRoot, config.outputDir);
    await ensureDir(outputDir);

    const sceneRuntimeScript = await buildSceneRuntimeBundle(projectRoot);
    const server = await startStaticSceneServer(
        projectRoot,
        html,
        sceneRuntimeScript,
    );
    const browser = await chromium.launch({
        channel: 'chromium',
        headless: true,
        args: [
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            '--use-angle=swiftshader',
        ],
    });
    const frameTempDir = await mkdtemp(
        path.join(os.tmpdir(), 'github-profile-minecraft-'),
    );

    const page = await browser.newPage({
        viewport: {
            width: config.width,
            height: config.height,
        },
        deviceScaleFactor: 1,
    });
    page.on('console', (message) => {
        if (message.type() === 'error') {
            console.error(`[browser:${message.type()}] ${message.text()}`);
        }
    });
    page.on('response', (response) => {
        if (response.status() >= 400) {
            console.error(
                `[response:${response.status()}] ${response.url()}`,
            );
        }
    });
    page.on('requestfailed', (request) => {
        console.error(
            `[requestfailed] ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`,
        );
    });
    page.on('pageerror', (error) => {
        console.error(`[pageerror] ${error.message}`);
    });

    try {
        await page.goto(`${server.origin}/scene.html`, {
            waitUntil: 'networkidle',
        });
        await page.waitForFunction(
            () => (window as Window & { __PROFILE_SCENE_READY?: boolean }).__PROFILE_SCENE_READY === true,
        );

        const exportedAssets: ExportedAssetPaths = {
            readmeSnippetPath: path.join(outputDir, 'README-snippet.md'),
        };
        const screenshotOptions = {
            omitBackground: config.background === 'transparent',
        };
        const fps = config.gif.fps;
        const frameCount = Math.max(
            1,
            Math.round(config.gif.durationSec * fps),
        );

        if (config.createPng) {
            const pngPath = path.join(outputDir, `${config.baseName}.png`);
            await page.evaluate((timeSec) => {
                (window as any).__setSceneTime(timeSec);
            }, 0);
            await page.screenshot({
                path: pngPath,
                ...screenshotOptions,
            });
            exportedAssets.pngPath = pngPath;
        }

        if (config.createGif) {
            for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
                const framePath = path.join(
                    frameTempDir,
                    `frame-${String(frameIndex).padStart(4, '0')}.png`,
                );
                const timeSec = frameIndex / fps;
                await page.evaluate((time) => {
                    (window as any).__setSceneTime(time);
                }, timeSec);
                await page.screenshot({
                    path: framePath,
                    ...screenshotOptions,
                });
            }

            const palettePath = path.join(frameTempDir, 'palette.png');
            const gifPath = path.join(outputDir, `${config.baseName}.gif`);

            await runCommand('ffmpeg', [
                '-y',
                '-framerate',
                String(config.gif.fps),
                '-i',
                path.join(frameTempDir, 'frame-%04d.png'),
                '-vf',
                'palettegen=stats_mode=diff',
                '-frames:v',
                '1',
                '-update',
                '1',
                palettePath,
            ]);
            await runCommand('ffmpeg', [
                '-y',
                '-framerate',
                String(config.gif.fps),
                '-i',
                path.join(frameTempDir, 'frame-%04d.png'),
                '-i',
                palettePath,
                '-lavfi',
                'paletteuse=dither=sierra2_4a',
                gifPath,
            ]);

            exportedAssets.gifPath = gifPath;
        }

        if (config.emitHtml) {
            const standaloneHtml = buildSceneHtml(
                userSnapshot,
                config,
                STANDALONE_SCENE_ASSET_URLS,
            );
            exportedAssets.htmlPath = await writeStandalonePreview(
                projectRoot,
                outputDir,
                config.baseName,
                standaloneHtml,
                sceneRuntimeScript,
            );
        } else {
            await removeStandalonePreviewOutputs(outputDir, config.baseName);
        }

        await writeTextFile(
            exportedAssets.readmeSnippetPath,
            createReadmeSnippet(config, exportedAssets),
        );
        return exportedAssets;
    } finally {
        await page.close();
        await browser.close();
        await server.close();
        await rm(frameTempDir, { recursive: true, force: true });
    }
};
