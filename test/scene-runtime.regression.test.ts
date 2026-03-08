import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
    buildSceneHtml,
    SERVER_SCENE_ASSET_URLS,
} from '../src/scene/build-scene-page.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { buildSceneRuntimeBundle } from '../src/render/scene-runtime-bundle.js';
import { startStaticSceneServer } from '../src/render/static-server.js';
import { createSampleProfile } from '../src/sample-profile.js';

const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);

const normalizeSceneValue = (value: unknown): unknown => {
    if (Object.is(value, -0)) {
        return 0;
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeSceneValue(item));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, entryValue]) => [
                key,
                normalizeSceneValue(entryValue),
            ]),
        );
    }
    return value;
};

test('scene runtime matches sample baseline states', async () => {
    const expectedStates = JSON.parse(
        await readFile(
            path.join(
                projectRoot,
                'test/fixtures/scene-runtime-sample.json',
            ),
            'utf8',
        ),
    ) as Record<
        string,
        {
            sheep: Array<Record<string, number | string>>;
            loopDuration: number;
            ready: boolean;
        }
    >;

    const userSnapshot = createSampleProfile('minecraft-shepherd');
    const html = buildSceneHtml(
        userSnapshot,
        DEFAULT_CONFIG,
        SERVER_SCENE_ASSET_URLS,
    );
    const runtimeScript = await buildSceneRuntimeBundle(projectRoot);
    const server = await startStaticSceneServer(projectRoot, html, runtimeScript);
    const browser = await chromium.launch({
        channel: 'chromium',
        headless: true,
        args: [
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            '--use-angle=swiftshader',
        ],
    });
    const page = await browser.newPage({
        viewport: {
            width: DEFAULT_CONFIG.width,
            height: DEFAULT_CONFIG.height,
        },
        deviceScaleFactor: 1,
    });

    try {
        await page.goto(`${server.origin}/scene.html`, {
            waitUntil: 'networkidle',
        });
        await page.waitForFunction(
            () => (window as any).__PROFILE_SCENE_READY === true,
        );

        const actualStates: Record<
            string,
            {
                sheep: Array<Record<string, number | string>>;
                loopDuration: number;
                ready: boolean;
            }
        > = {};

        for (const time of [0, 2, 4]) {
            actualStates[String(time)] = await page.evaluate((sceneTime) => ({
                sheep: (window as any).__getSceneState(sceneTime),
                loopDuration: (window as any).__PROFILE_SCENE_LOOP_DURATION,
                ready: (window as any).__PROFILE_SCENE_READY,
            }), time);
        }

        assert.deepStrictEqual(
            normalizeSceneValue(actualStates),
            normalizeSceneValue(expectedStates),
        );

        const debugState = await page.evaluate(
            () => (window as any).__PROFILE_SCENE_DEBUG,
        );
        assert.equal(debugState.blockCount, userSnapshot.calendar.length);
        assert.equal(debugState.sheepCount, expectedStates['0'].sheep.length);
        assert.ok(debugState.floraCount > 0);
        assert.ok(debugState.camera.left < 0);
        assert.ok(debugState.camera.right > 0);
    } finally {
        await page.close();
        await browser.close();
        await server.close();
    }
});
