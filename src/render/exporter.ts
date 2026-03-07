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

interface SheepStateSample {
    x: number;
    y: number;
    z: number;
    yaw: number;
    state: string;
    shadowY: number;
    headY: number;
    headZ: number;
    headRotX: number;
    bodyY: number;
    routeIndex: number;
    leg0: number;
    leg1: number;
    leg2: number;
    leg3: number;
}

const normalizeAngle = (rad: number): number => {
    let angle = rad;
    while (angle > Math.PI) {
        angle -= Math.PI * 2;
    }
    while (angle < -Math.PI) {
        angle += Math.PI * 2;
    }
    return angle;
};

const calculateLoopError = (
    startStates: Array<SheepStateSample>,
    endStates: Array<SheepStateSample>,
): number =>
    startStates.reduce((sum, startState, index) => {
        const endState = endStates[index];
        if (!endState) {
            return sum + 1000;
        }

        const positionError = Math.hypot(
            endState.x - startState.x,
            endState.y - startState.y,
            endState.z - startState.z,
        );
        const yawError = Math.abs(normalizeAngle(endState.yaw - startState.yaw));
        const headError =
            Math.abs(endState.headY - startState.headY) * 4 +
            Math.abs(endState.headZ - startState.headZ) * 4 +
            Math.abs(endState.headRotX - startState.headRotX) * 2;
        const bodyError = Math.abs(endState.bodyY - startState.bodyY) * 4;
        const statePenalty = startState.state === endState.state ? 0 : 6;
        const routePenalty =
            startState.routeIndex === endState.routeIndex ? 0 : 3;

        return (
            sum +
            positionError * 14 +
            yawError * 3 +
            headError +
            bodyError +
            statePenalty +
            routePenalty
        );
    }, 0);

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
        .replaceAll('/assets/sheep_fur.png', './assets/sheep_fur.png');
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
        const preferredFrameCount = Math.max(
            1,
            Math.round(config.gif.durationSec * fps),
        );
        const maxFrameCount = preferredFrameCount + fps * 8;
        const maxStartFrame = fps * 6;
        const maxSampleFrame = maxStartFrame + maxFrameCount;
        const stateCache = new Map<number, Array<SheepStateSample>>();

        for (let frameIndex = 0; frameIndex <= maxSampleFrame; frameIndex += 1) {
            const timeSec = frameIndex / fps;
            const states = await page.evaluate((sampleTimeSec) => {
                const getter = (
                    window as Window & {
                        __getSceneState?: (
                            timeSec: number,
                        ) => Array<SheepStateSample>;
                    }
                ).__getSceneState;
                return getter ? getter(sampleTimeSec) : [];
            }, timeSec);
            stateCache.set(frameIndex, states);
        }

        let bestStartFrame = 0;
        let bestFrameCount = preferredFrameCount;
        let bestError = Number.POSITIVE_INFINITY;

        for (let startFrame = 0; startFrame <= maxStartFrame; startFrame += 1) {
            const startStates = stateCache.get(startFrame) ?? [];
            for (
                let frameCount = preferredFrameCount;
                frameCount <= maxFrameCount;
                frameCount += 1
            ) {
                const endStates = stateCache.get(startFrame + frameCount) ?? [];
                const durationPenalty =
                    Math.abs(frameCount - preferredFrameCount) * 0.12;
                const error =
                    calculateLoopError(startStates, endStates) + durationPenalty;

                if (error < bestError) {
                    bestError = error;
                    bestStartFrame = startFrame;
                    bestFrameCount = frameCount;
                }

                if (error <= 1.2) {
                    break;
                }
            }
        }

        const loopDurationSec = bestFrameCount / fps;
        const loopStartTimeSec = bestStartFrame / fps;
        const loopStartStates = stateCache.get(bestStartFrame) ?? [];
        const loopEndStates =
            stateCache.get(bestStartFrame + bestFrameCount) ?? [];

        if (config.createPng) {
            const pngPath = path.join(outputDir, `${config.baseName}.png`);
            await page.evaluate((timeSec) => {
                (window as any).__setSceneTime(timeSec);
            }, loopStartTimeSec);
            await page.screenshot({
                path: pngPath,
                ...screenshotOptions,
            });
            exportedAssets.pngPath = pngPath;
        }

        if (config.createGif) {
            const frameCount = bestFrameCount;
            for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
                const framePath = path.join(
                    frameTempDir,
                    `frame-${String(frameIndex).padStart(4, '0')}.png`,
                );
                const timeSec = loopStartTimeSec + frameIndex / fps;
                await page.evaluate((time) => {
                    (window as any).__setSceneTime(time);
                }, timeSec);
                await page.screenshot({
                    path: framePath,
                    ...screenshotOptions,
                });
            }

            const closureFrameCount = Math.max(4, Math.round(fps * 0.6));
            for (
                let closureIndex = 1;
                closureIndex <= closureFrameCount;
                closureIndex += 1
            ) {
                const framePath = path.join(
                    frameTempDir,
                    `frame-${String(frameCount + closureIndex - 1).padStart(
                        4,
                        '0',
                    )}.png`,
                );
                await page.evaluate(
                    ({ startStates, endStates, blend }) => {
                        const applier = (
                            window as Window & {
                                __applyLoopClosure?: (
                                    startStates: Array<SheepStateSample>,
                                    endStates: Array<SheepStateSample>,
                                    blend: number,
                                ) => void;
                            }
                        ).__applyLoopClosure;
                        if (applier) {
                            applier(startStates, endStates, blend);
                        }
                    },
                    {
                        startStates: loopStartStates,
                        endStates: loopEndStates,
                        blend: closureIndex / closureFrameCount,
                    },
                );
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
