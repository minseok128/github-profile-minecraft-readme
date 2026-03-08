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
import { ensureDir, writeTextFile } from '../utils.js';
import { startStaticSceneServer } from './static-server.js';

const runCommand = async (command: string, args: Array<string>): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
        });
        child.on('error', reject);
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
        'Use the generated asset directly in your profile README:',
        '',
        '```md',
        `![Minecraft contribution world](${relativeAsset})`,
        '```',
        '',
        `PNG enabled: ${config.createPng}`,
        `GIF enabled: ${config.createGif}`,
        `Preview HTML enabled: ${config.emitHtml}`,
    ].join('\n');
};

const writeStandalonePreview = async (
    projectRoot: string,
    outputDir: string,
    baseName: string,
    html: string,
): Promise<string> => {
    const previewHtml = html
        .replaceAll('/vendor/three.module.js', './vendor/three.module.js')
        .replaceAll('/assets/sheep.png', './assets/sheep.png')
        .replaceAll('/assets/sheep_fur.png', './assets/sheep_fur.png')
        .replaceAll('/assets/grass_block_top.png', './assets/grass_block_top.png')
        .replaceAll('/assets/grass_block_side.png', './assets/grass_block_side.png')
        .replaceAll(
            '/assets/grass_block_side_overlay.png',
            './assets/grass_block_side_overlay.png',
        )
        .replaceAll('/assets/grass_block_snow.png', './assets/grass_block_snow.png')
        .replaceAll('/assets/pink_petals.png', './assets/pink_petals.png')
        .replaceAll('/assets/leaf_litter.png', './assets/leaf_litter.png')
        .replaceAll('/assets/poppy.png', './assets/poppy.png')
        .replaceAll('/assets/dandelion.png', './assets/dandelion.png')
        .replaceAll('/assets/cornflower.png', './assets/cornflower.png')
        .replaceAll('/assets/blue_orchid.png', './assets/blue_orchid.png')
        .replaceAll('/assets/azure_bluet.png', './assets/azure_bluet.png')
        .replaceAll('/assets/pink_tulip.png', './assets/pink_tulip.png')
        .replaceAll('/assets/white_tulip.png', './assets/white_tulip.png')
        .replaceAll('/assets/snow.png', './assets/snow.png')
        .replaceAll('/assets/dirt.png', './assets/dirt.png')
        .replaceAll('/assets/water_top.png', './assets/water_top.png')
        .replaceAll('/assets/water_side.png', './assets/water_side.png');
    const vendorDir = path.join(outputDir, 'vendor');
    const assetDir = path.join(outputDir, 'assets');
    await ensureDir(vendorDir);
    await ensureDir(assetDir);
    await copyFile(
        path.join(projectRoot, 'node_modules/three/build/three.module.js'),
        path.join(vendorDir, 'three.module.js'),
    );
    await copyFile(
        path.join(projectRoot, 'node_modules/three/build/three.core.js'),
        path.join(vendorDir, 'three.core.js'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/sheep.png'),
        path.join(assetDir, 'sheep.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/sheep_fur.png'),
        path.join(assetDir, 'sheep_fur.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/grass_block_top.png'),
        path.join(assetDir, 'grass_block_top.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/grass_block_side.png'),
        path.join(assetDir, 'grass_block_side.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/grass_block_side_overlay.png'),
        path.join(assetDir, 'grass_block_side_overlay.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/grass_block_snow.png'),
        path.join(assetDir, 'grass_block_snow.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/pink_petals.png'),
        path.join(assetDir, 'pink_petals.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/leaf_litter.png'),
        path.join(assetDir, 'leaf_litter.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/poppy.png'),
        path.join(assetDir, 'poppy.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/dandelion.png'),
        path.join(assetDir, 'dandelion.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/cornflower.png'),
        path.join(assetDir, 'cornflower.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/blue_orchid.png'),
        path.join(assetDir, 'blue_orchid.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/azure_bluet.png'),
        path.join(assetDir, 'azure_bluet.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/pink_tulip.png'),
        path.join(assetDir, 'pink_tulip.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/white_tulip.png'),
        path.join(assetDir, 'white_tulip.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/snow.png'),
        path.join(assetDir, 'snow.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/dirt.png'),
        path.join(assetDir, 'dirt.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/water_top.png'),
        path.join(assetDir, 'water_top.png'),
    );
    await copyFile(
        path.join(projectRoot, 'assets/water_side.png'),
        path.join(assetDir, 'water_side.png'),
    );
    const htmlPath = path.join(outputDir, `${baseName}.html`);
    await writeTextFile(htmlPath, previewHtml);
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

    const server = await startStaticSceneServer(projectRoot, html);
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
            exportedAssets.htmlPath = await writeStandalonePreview(
                projectRoot,
                outputDir,
                config.baseName,
                html,
            );
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
