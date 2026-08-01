import { copyFile, mkdir, rm } from 'node:fs/promises';
import * as path from 'node:path';
import type { Page } from 'playwright';
import type { RenderConfig } from '../config/types.js';
import type { ContributionProfile } from '../profile/types.js';
import {
    SCENE_ASSETS,
    getRequiredAssetKeys,
} from '../scene/assets.js';
import {
    STANDALONE_SCENE_ASSET_URLS,
    buildSceneHtml,
} from '../scene/build-scene-page.js';
import { SCENE_RUNTIME_BUNDLE_FILENAME } from '../scene/runtime/constants.js';
import type { SceneRuntimeWindow } from '../scene/runtime/types.js';
import { writeTextFile } from '../utils.js';
import { runCommand } from './command.js';
import type { GeneratedArtifact } from './types.js';

export interface OutputRequirements {
    runtimeBundle: boolean;
    browser: boolean;
    ffmpeg: boolean;
}

export interface OutputContext {
    projectRoot: string;
    stagingDir: string;
    profile: ContributionProfile;
    config: RenderConfig;
    runtimeScript: string;
    page?: Page;
    runCommand: typeof runCommand;
}

export interface OutputHandler {
    id: 'png' | 'gif' | 'html';
    requirements: OutputRequirements;
    produce: (context: OutputContext) => Promise<Array<GeneratedArtifact>>;
}

const requirePage = (context: OutputContext): Page => {
    if (!context.page) {
        throw new Error('Browser page was not initialized for a capture output.');
    }
    return context.page;
};

const setSceneTime = async (page: Page, timeSec: number): Promise<void> => {
    await page.evaluate((time) => {
        const runtimeWindow = window as SceneRuntimeWindow;
        if (!runtimeWindow.__PROFILE_SCENE_BRIDGE) {
            throw new Error('Scene runtime bridge is unavailable.');
        }
        runtimeWindow.__PROFILE_SCENE_BRIDGE.setTime(time);
    }, timeSec);
};

const screenshotOptions = (config: RenderConfig): { omitBackground: boolean } => ({
    omitBackground: config.scene.background === 'transparent',
});

const pngHandler: OutputHandler = {
    id: 'png',
    requirements: {
        runtimeBundle: true,
        browser: true,
        ffmpeg: false,
    },
    produce: async (context): Promise<Array<GeneratedArtifact>> => {
        const page = requirePage(context);
        const relativePath = `${context.config.output.baseName}.png`;
        const absolutePath = path.join(context.stagingDir, relativePath);
        await setSceneTime(page, 0);
        await page.screenshot({
            path: absolutePath,
            ...screenshotOptions(context.config),
        });
        return [{ format: 'png', relativePath, absolutePath }];
    },
};

const gifHandler: OutputHandler = {
    id: 'gif',
    requirements: {
        runtimeBundle: true,
        browser: true,
        ffmpeg: true,
    },
    produce: async (context): Promise<Array<GeneratedArtifact>> => {
        const page = requirePage(context);
        const framesDir = path.join(context.stagingDir, '.frames');
        await mkdir(framesDir, { recursive: true });
        const { fps, durationSec } = context.config.capture.gif;
        const frameCount = Math.max(1, Math.round(durationSec * fps));
        try {
            for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
                await setSceneTime(page, frameIndex / fps);
                await page.screenshot({
                    path: path.join(
                        framesDir,
                        `frame-${String(frameIndex).padStart(4, '0')}.png`,
                    ),
                    ...screenshotOptions(context.config),
                });
            }

            const palettePath = path.join(framesDir, 'palette.png');
            await context.runCommand(
                'ffmpeg',
                [
                    '-y',
                    '-framerate',
                    String(fps),
                    '-i',
                    path.join(framesDir, 'frame-%04d.png'),
                    '-vf',
                    'palettegen=stats_mode=diff',
                    '-frames:v',
                    '1',
                    '-update',
                    '1',
                    palettePath,
                ],
                120_000,
            );
            const relativePath = `${context.config.output.baseName}.gif`;
            const absolutePath = path.join(context.stagingDir, relativePath);
            await context.runCommand(
                'ffmpeg',
                [
                    '-y',
                    '-framerate',
                    String(fps),
                    '-i',
                    path.join(framesDir, 'frame-%04d.png'),
                    '-i',
                    palettePath,
                    '-lavfi',
                    'paletteuse=dither=sierra2_4a',
                    absolutePath,
                ],
                120_000,
            );
            return [{ format: 'gif', relativePath, absolutePath }];
        } finally {
            await rm(framesDir, { recursive: true, force: true });
        }
    },
};

const htmlHandler: OutputHandler = {
    id: 'html',
    requirements: {
        runtimeBundle: true,
        browser: false,
        ffmpeg: false,
    },
    produce: async (context): Promise<Array<GeneratedArtifact>> => {
        const artifacts: Array<GeneratedArtifact> = [];
        const requiredAssetKeys = getRequiredAssetKeys(
            context.config.scene.theme,
            context.config.scene.creatures,
        );
        const assetDir = path.join(context.stagingDir, 'assets');
        await mkdir(assetDir, { recursive: true });
        for (const assetKey of requiredAssetKeys) {
            const fileName = SCENE_ASSETS[assetKey];
            const relativePath = path.posix.join('assets', fileName);
            const absolutePath = path.join(context.stagingDir, relativePath);
            await copyFile(
                path.join(context.projectRoot, 'assets', fileName),
                absolutePath,
            );
            artifacts.push({ format: 'support', relativePath, absolutePath });
        }

        const runtimeRelativePath = SCENE_RUNTIME_BUNDLE_FILENAME;
        const runtimeAbsolutePath = path.join(
            context.stagingDir,
            runtimeRelativePath,
        );
        await writeTextFile(runtimeAbsolutePath, context.runtimeScript);
        artifacts.push({
            format: 'support',
            relativePath: runtimeRelativePath,
            absolutePath: runtimeAbsolutePath,
        });

        const relativePath = `${context.config.output.baseName}.html`;
        const absolutePath = path.join(context.stagingDir, relativePath);
        await writeTextFile(
            absolutePath,
            buildSceneHtml(
                context.profile,
                context.config,
                STANDALONE_SCENE_ASSET_URLS,
            ),
        );
        artifacts.push({ format: 'html', relativePath, absolutePath });
        return artifacts;
    },
};

export const OUTPUT_HANDLERS = {
    png: pngHandler,
    gif: gifHandler,
    html: htmlHandler,
} satisfies Record<'png' | 'gif' | 'html', OutputHandler>;

export const waitForSceneReady = async (page: Page): Promise<void> => {
    await page.waitForFunction(
        () => {
            const status = (window as SceneRuntimeWindow)
                .__PROFILE_SCENE_STATUS;
            return status?.state === 'ready' || status?.state === 'error';
        },
        undefined,
        { timeout: 30_000 },
    );
    const status = await page.evaluate(
        () => (window as SceneRuntimeWindow).__PROFILE_SCENE_STATUS,
    );
    if (status?.state === 'error') {
        throw new Error(`Scene runtime failed: ${status.message}`);
    }
    if (status?.state !== 'ready') {
        throw new Error('Scene runtime did not report a ready state.');
    }
};
