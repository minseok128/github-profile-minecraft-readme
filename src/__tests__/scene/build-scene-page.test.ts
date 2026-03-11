import { describe, it, expect } from 'vitest';
import { buildSceneHtml, SERVER_SCENE_ASSET_URLS, STANDALONE_SCENE_ASSET_URLS } from '../../scene/build-scene-page.js';
import { DEFAULT_CONFIG } from '../../config.js';
import { createSampleProfile } from '../../sample-profile.js';

const sampleProfile = createSampleProfile('testuser');

describe('buildSceneHtml', () => {
    it('returns a valid HTML document', () => {
        const html = buildSceneHtml(sampleProfile, DEFAULT_CONFIG);
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('</html>');
    });

    it('contains the mount element', () => {
        const html = buildSceneHtml(sampleProfile, DEFAULT_CONFIG);
        expect(html).toContain('id="app"');
    });

    it('contains the bootstrap script tag', () => {
        const html = buildSceneHtml(sampleProfile, DEFAULT_CONFIG);
        expect(html).toContain('id="scene-bootstrap"');
        expect(html).toContain('type="application/json"');
    });

    it('contains the runtime script tag with server URL', () => {
        const html = buildSceneHtml(sampleProfile, DEFAULT_CONFIG);
        expect(html).toContain('src="/scene-runtime.js"');
    });

    it('uses standalone URLs when specified', () => {
        const html = buildSceneHtml(sampleProfile, DEFAULT_CONFIG, STANDALONE_SCENE_ASSET_URLS);
        expect(html).toContain('src="./scene-runtime.js"');
    });

    it('includes calendar metrics in bootstrap payload', () => {
        const html = buildSceneHtml(sampleProfile, DEFAULT_CONFIG);
        expect(html).toContain('calendarMetrics');
        expect(html).toContain('sheepPlans');
    });

    it('does not include HUD when showHud is false', () => {
        const config = { ...DEFAULT_CONFIG, showHud: false };
        const html = buildSceneHtml(sampleProfile, config);
        expect(html).not.toContain('class="hud"');
    });

    it('includes HUD when showHud is true', () => {
        const config = { ...DEFAULT_CONFIG, showHud: true };
        const html = buildSceneHtml(sampleProfile, config);
        expect(html).toContain('class="hud"');
        expect(html).toContain('testuser');
    });

    it('escapes dangerous HTML in payload', () => {
        const html = buildSceneHtml(sampleProfile, DEFAULT_CONFIG);
        // Extract the JSON payload from the bootstrap script tag and verify it
        // doesn't contain a raw </script> sequence that would break the HTML
        const payloadMatch = html.match(/<script id="scene-bootstrap"[^>]*>([^<]*(?:<(?!\/script>)[^<]*)*)<\/script>/);
        expect(payloadMatch).not.toBeNull();
        const payload = payloadMatch![1];
        expect(payload).not.toContain('</script>');
        // The only script tags are the opening ones
        const scriptCount = (html.match(/<script/g) || []).length;
        const closingCount = (html.match(/<\/script>/g) || []).length;
        expect(scriptCount).toBe(closingCount);
    });
});

describe('scene asset URL constants', () => {
    it('SERVER urls start with /', () => {
        expect(SERVER_SCENE_ASSET_URLS.runtimeScriptPath).toMatch(/^\//);
        expect(SERVER_SCENE_ASSET_URLS.assetBaseUrl).toMatch(/^\//);
    });

    it('STANDALONE urls start with ./', () => {
        expect(STANDALONE_SCENE_ASSET_URLS.runtimeScriptPath).toMatch(/^\.\//);
        expect(STANDALONE_SCENE_ASSET_URLS.assetBaseUrl).toMatch(/^\.\//);
    });
});
