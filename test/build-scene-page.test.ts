import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSceneHtml,
    SERVER_SCENE_ASSET_URLS,
    STANDALONE_SCENE_ASSET_URLS,
} from '../src/scene/build-scene-page.js';
import { createSampleProfile } from '../src/sample-profile.js';
import { DEFAULT_CONFIG } from '../src/config.js';

const extractBootstrapPayload = (html: string): unknown => {
    const match = html.match(
        /<script id="scene-bootstrap" type="application\/json">([\s\S]*?)<\/script>/,
    );
    assert.ok(match, 'Expected bootstrap payload script to be present.');
    return JSON.parse(match[1]);
};

test('buildSceneHtml embeds bootstrap payload and server runtime script', () => {
    const html = buildSceneHtml(
        createSampleProfile('minecraft-shepherd'),
        DEFAULT_CONFIG,
        SERVER_SCENE_ASSET_URLS,
    );
    assert.match(
        html,
        /<script type="module" src="\/scene-runtime\.js"><\/script>/,
    );

    const payload = extractBootstrapPayload(html) as {
        mountElementId: string;
        gifDurationSec: number;
        assets: { sheepTexturePath: string };
        sceneData: { username: string; background: string };
    };
    assert.equal(payload.mountElementId, 'app');
    assert.equal(payload.gifDurationSec, DEFAULT_CONFIG.gif.durationSec);
    assert.equal(payload.assets.sheepTexturePath, '/assets/sheep.png');
    assert.equal(payload.sceneData.username, 'minecraft-shepherd');
    assert.equal(payload.sceneData.background, DEFAULT_CONFIG.background);
});

test('buildSceneHtml swaps standalone asset paths and preserves HUD toggle', () => {
    const withHudHtml = buildSceneHtml(
        createSampleProfile('minecraft-shepherd'),
        { ...DEFAULT_CONFIG, showHud: true },
        STANDALONE_SCENE_ASSET_URLS,
    );
    const withoutHudHtml = buildSceneHtml(
        createSampleProfile('minecraft-shepherd'),
        { ...DEFAULT_CONFIG, showHud: false },
        STANDALONE_SCENE_ASSET_URLS,
    );

    assert.match(
        withHudHtml,
        /<script type="module" src="\.\/scene-runtime\.js"><\/script>/,
    );
    assert.match(withHudHtml, /<div class="hud">/);
    assert.doesNotMatch(withoutHudHtml, /<div class="hud">/);

    const payload = extractBootstrapPayload(withHudHtml) as {
        assets: { sheepTexturePath: string; waterSideTexturePath: string };
    };
    assert.equal(payload.assets.sheepTexturePath, './assets/sheep.png');
    assert.equal(payload.assets.waterSideTexturePath, './assets/water_side.png');
});
