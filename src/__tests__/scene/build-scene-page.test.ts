import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../config/schema.js';
import { createSampleProfile } from '../../sample-profile.js';
import {
    SERVER_SCENE_ASSET_URLS,
    STANDALONE_SCENE_ASSET_URLS,
    buildSceneHtml,
    encodeBootstrapPayload,
} from '../../scene/build-scene-page.js';
import type { SceneBootstrapPayload } from '../../scene/runtime/types.js';

const profile = createSampleProfile(
    'test-user',
    new Date('2026-08-01T00:00:00.000Z'),
);

const extractPayload = (html: string): SceneBootstrapPayload => {
    const match = html.match(/id="scene-bootstrap"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) {
        throw new Error('Bootstrap payload was not found.');
    }
    return JSON.parse(match[1]) as SceneBootstrapPayload;
};

describe('buildSceneHtml', () => {
    it('builds the v1 browser payload without profile-only metadata', () => {
        const payload = extractPayload(buildSceneHtml(profile, DEFAULT_CONFIG));
        expect(payload.sceneData.version).toBe(1);
        expect(payload.sceneData.theme).toBe('korean-seasonal');
        expect(payload.sceneData.entities[0].kind).toBe('sheep');
        expect(payload.sceneData.calendarMetrics).toHaveLength(365);
        expect(payload.sceneData).not.toHaveProperty('username');
        expect(payload.sceneData).not.toHaveProperty('totalContributions');
        expect(payload.sceneData).not.toHaveProperty('seasonalGrassStops');
        expect(payload).not.toHaveProperty('assets');
    });

    it('uses server and standalone asset URLs from one manifest', () => {
        const serverPayload = extractPayload(
            buildSceneHtml(profile, DEFAULT_CONFIG, SERVER_SCENE_ASSET_URLS),
        );
        const standalonePayload = extractPayload(
            buildSceneHtml(
                profile,
                DEFAULT_CONFIG,
                STANDALONE_SCENE_ASSET_URLS,
            ),
        );
        expect(serverPayload.sceneData.assets.sheepBase).toBe(
            '/assets/sheep.png',
        );
        expect(standalonePayload.sceneData.assets.waterSide).toBe(
            './assets/water_side.png',
        );
    });

    it('renders escaped HUD metadata only when enabled', () => {
        const withHud = buildSceneHtml(
            { ...profile, username: '<script>alert(1)</script>' },
            {
                ...DEFAULT_CONFIG,
                scene: { ...DEFAULT_CONFIG.scene, hud: true },
            },
        );
        const withoutHud = buildSceneHtml(profile, DEFAULT_CONFIG);
        expect(withHud).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(withHud).toContain('class="hud"');
        expect(withoutHud).not.toContain('class="hud"');
    });

    it('escapes script-closing text in serialized payloads', () => {
        const payload = extractPayload(buildSceneHtml(profile, DEFAULT_CONFIG));
        const encoded = encodeBootstrapPayload({
            ...payload,
            mountElementId: '</script><script>alert(1)</script>',
        });
        expect(encoded).not.toContain('</script>');
        expect(JSON.parse(encoded).mountElementId).toContain('</script>');
    });
});
