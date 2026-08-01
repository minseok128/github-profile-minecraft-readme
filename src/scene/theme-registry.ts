import {
    KOREAN_BLOSSOM_COVER_STOPS,
    KOREAN_LEAF_LITTER_COVER_STOPS,
    KOREAN_SPRING_FLOWER_COVER_STOPS,
    KOREAN_SEASONAL_GRASS_STOPS,
    KOREAN_SNOW_COVER_STOPS,
    KOREAN_SUMMER_FLOWER_COVER_STOPS,
} from './minecraft-grass-theme.js';
import type { ThemeId } from './registry-ids.js';
import type { SceneAssetKey } from './assets.js';

export interface SeasonalAmountStop {
    month: number;
    day: number;
    amount: number;
}

export interface SeasonalColorStop {
    month: number;
    day: number;
    color: string;
}

export interface ThemeDefinition {
    id: ThemeId;
    requiredAssets: ReadonlyArray<SceneAssetKey>;
    seasonalGrassStops: ReadonlyArray<SeasonalColorStop>;
    snowCoverStops: ReadonlyArray<SeasonalAmountStop>;
    blossomCoverStops: ReadonlyArray<SeasonalAmountStop>;
    springFlowerCoverStops: ReadonlyArray<SeasonalAmountStop>;
    summerFlowerCoverStops: ReadonlyArray<SeasonalAmountStop>;
    leafLitterCoverStops: ReadonlyArray<SeasonalAmountStop>;
}

export const THEMES = {
    'korean-seasonal': {
        id: 'korean-seasonal',
        requiredAssets: [
            'grassTop',
            'grassSide',
            'grassSideOverlay',
            'grassSnow',
            'pinkPetals',
            'leafLitter',
            'poppy',
            'dandelion',
            'cornflower',
            'blueOrchid',
            'azureBluet',
            'pinkTulip',
            'whiteTulip',
            'snow',
            'dirt',
            'waterTop',
            'waterSide',
        ],
        seasonalGrassStops: KOREAN_SEASONAL_GRASS_STOPS,
        snowCoverStops: KOREAN_SNOW_COVER_STOPS,
        blossomCoverStops: KOREAN_BLOSSOM_COVER_STOPS,
        springFlowerCoverStops: KOREAN_SPRING_FLOWER_COVER_STOPS,
        summerFlowerCoverStops: KOREAN_SUMMER_FLOWER_COVER_STOPS,
        leafLitterCoverStops: KOREAN_LEAF_LITTER_COVER_STOPS,
    },
} satisfies Record<ThemeId, ThemeDefinition>;
