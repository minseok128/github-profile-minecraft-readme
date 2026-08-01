import type { RenderConfig } from '../config/types.js';
import type { ContributionProfile } from '../profile/types.js';
import { formatThousands } from '../utils.js';
import { buildSceneAssetUrls, getRequiredAssetKeys } from './assets.js';
import { prepareScene } from './planner.js';
import {
    SCENE_BOOTSTRAP_SCRIPT_ID,
    SCENE_MOUNT_ELEMENT_ID,
    SCENE_RUNTIME_BUNDLE_FILENAME,
} from './runtime/constants.js';
import type { SceneBootstrapPayload } from './runtime/types.js';

export interface ScenePageAssetUrls {
    runtimeScriptPath: string;
    assetBaseUrl: string;
}

export const SERVER_SCENE_ASSET_URLS: ScenePageAssetUrls = {
    runtimeScriptPath: `/${SCENE_RUNTIME_BUNDLE_FILENAME}`,
    assetBaseUrl: '/assets',
};

export const STANDALONE_SCENE_ASSET_URLS: ScenePageAssetUrls = {
    runtimeScriptPath: `./${SCENE_RUNTIME_BUNDLE_FILENAME}`,
    assetBaseUrl: './assets',
};

const escapeHtml = (text: string): string =>
    text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const createHudMarkup = (
    profile: ContributionProfile,
    period: string,
    visibleDayCount: number,
    config: RenderConfig,
): string => {
    if (!config.scene.hud) {
        return '';
    }
    return `
  <div class="hud">
    <div class="hud-title">${escapeHtml(profile.username)}'s Minecraft Contributions</div>
    <div class="hud-row"><strong>${formatThousands(profile.totalContributions)}</strong> contributions</div>
    <div class="hud-row">${period}</div>
    <div class="hud-row">${visibleDayCount} days, Three.js scene, README-safe export</div>
  </div>`;
};

const buildSceneStyles = (config: RenderConfig): string => `    :root {
      color-scheme: light;
      --sky-top: #93d5ff;
      --sky-bottom: #f4fbff;
      --hud-bg: rgba(15, 23, 42, 0.74);
      --hud-text: #f8fafc;
      --hud-muted: #dbeafe;
      --hud-accent: #86efac;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${
          config.scene.background === 'transparent'
              ? 'transparent'
              : 'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.76), transparent 26%), linear-gradient(180deg, var(--sky-top), var(--sky-bottom))'
      };
      font-family: "SF Pro Display", "Segoe UI", sans-serif;
    }

    body {
      position: relative;
    }

    #${SCENE_MOUNT_ELEMENT_ID} {
      width: 100%;
      height: 100%;
    }

    .hud {
      position: absolute;
      top: 18px;
      left: 18px;
      display: grid;
      gap: 6px;
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--hud-bg);
      color: var(--hud-text);
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
      user-select: none;
      pointer-events: none;
    }

    .hud-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--hud-accent);
    }

    .hud-row {
      font-size: 13px;
      line-height: 1.35;
      color: var(--hud-muted);
    }

    .hud strong {
      color: var(--hud-text);
    }`;

export const encodeBootstrapPayload = (
    payload: SceneBootstrapPayload,
): string => JSON.stringify(payload).replaceAll('<', '\\u003c');

export const buildSceneHtml = (
    profile: ContributionProfile,
    config: RenderConfig,
    assetUrls: ScenePageAssetUrls = SERVER_SCENE_ASSET_URLS,
): string => {
    const requiredAssetKeys = getRequiredAssetKeys(
        config.scene.theme,
        config.scene.creatures,
    );
    const prepared = prepareScene(
        profile,
        config.scene,
        config.capture.gif.durationSec,
        buildSceneAssetUrls(assetUrls.assetBaseUrl, requiredAssetKeys),
    );
    const bootstrapPayload: SceneBootstrapPayload = {
        mountElementId: SCENE_MOUNT_ELEMENT_ID,
        gifDurationSec: config.capture.gif.durationSec,
        sceneData: prepared.sceneData,
    };

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Minecraft Profile Renderer</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
  <style>
${buildSceneStyles(config)}
  </style>
</head>
<body>
  <div id="${SCENE_MOUNT_ELEMENT_ID}"></div>
${createHudMarkup(profile, prepared.period, prepared.visibleDayCount, config)}
  <script id="${SCENE_BOOTSTRAP_SCRIPT_ID}" type="application/json">${encodeBootstrapPayload(bootstrapPayload)}</script>
  <script type="module" src="${assetUrls.runtimeScriptPath}"></script>
</body>
</html>`;
};
