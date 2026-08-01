import type { CreatureId, ThemeId } from './registry-ids.js';
import { CREATURE_ASSET_KEYS } from './creature-registry.js';
import { THEMES } from './theme-registry.js';

export const SCENE_ASSETS = {
    sheepBase: 'sheep.png',
    sheepFur: 'sheep_fur.png',
    grassTop: 'grass_block_top.png',
    grassSide: 'grass_block_side.png',
    grassSideOverlay: 'grass_block_side_overlay.png',
    grassSnow: 'grass_block_snow.png',
    pinkPetals: 'pink_petals.png',
    leafLitter: 'leaf_litter.png',
    poppy: 'poppy.png',
    dandelion: 'dandelion.png',
    cornflower: 'cornflower.png',
    blueOrchid: 'blue_orchid.png',
    azureBluet: 'azure_bluet.png',
    pinkTulip: 'pink_tulip.png',
    whiteTulip: 'white_tulip.png',
    snow: 'snow.png',
    dirt: 'dirt.png',
    waterTop: 'water_top.png',
    waterSide: 'water_side.png',
} as const;

export type SceneAssetKey = keyof typeof SCENE_ASSETS;
export type SceneAssetUrls = Record<SceneAssetKey, string>;

export const getRequiredAssetKeys = (
    theme: ThemeId,
    creatures: ReadonlyArray<CreatureId>,
): Array<SceneAssetKey> => [
    ...new Set([
        ...THEMES[theme].requiredAssets,
        ...creatures.flatMap((creature) => CREATURE_ASSET_KEYS[creature]),
    ]),
];

export const buildSceneAssetUrls = (
    baseUrl: string,
    requiredKeys: ReadonlyArray<SceneAssetKey>,
): SceneAssetUrls => {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const entries = Object.entries(SCENE_ASSETS).map(([key, fileName]) => [
        key,
        requiredKeys.includes(key as SceneAssetKey)
            ? `${normalizedBaseUrl}/${fileName}`
            : '',
    ]);
    return Object.fromEntries(entries) as SceneAssetUrls;
};
