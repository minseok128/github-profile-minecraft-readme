import type { Texture } from 'three';
import type { SceneAssetUrls } from '../assets.js';
import type { ThemeId } from '../registry-ids.js';
import type { CalendarMetric, SceneEntityBatch } from '../types.js';

export interface SceneMonthGuideEntry {
    week: number;
    monthLabel: string;
    detailLabel: string;
}

export interface SceneData {
    version: 1;
    background: 'sky' | 'transparent';
    theme: ThemeId;
    assets: SceneAssetUrls;
    calendarMetrics: Array<CalendarMetric>;
    monthGuideEntries: Array<SceneMonthGuideEntry>;
    entities: Array<SceneEntityBatch>;
}

export interface SceneBootstrapPayload {
    mountElementId: string;
    gifDurationSec: number;
    sceneData: SceneData;
}

export interface LoadedSceneTextures {
    sheepBaseTexture?: Texture;
    sheepFurTexture?: Texture;
    grassTopTexture: Texture;
    grassSideTexture: Texture;
    grassSideOverlayTexture: Texture;
    grassSnowTexture: Texture;
    pinkPetalsTexture: Texture;
    leafLitterTexture: Texture;
    poppyTexture: Texture;
    dandelionTexture: Texture;
    cornflowerTexture: Texture;
    blueOrchidTexture: Texture;
    azureBluetTexture: Texture;
    pinkTulipTexture: Texture;
    whiteTulipTexture: Texture;
    snowTexture: Texture;
    dirtTexture: Texture;
    waterTopTexture: Texture;
    waterSideTexture: Texture;
}

export interface SheepStateSnapshot {
    x: number;
    y: number;
    z: number;
    yaw: number;
    state: string;
    shadowY: number;
    headY: number;
    headZ: number;
    headRotX: number;
    headRigY: number;
    headRigZ: number;
    bodyY: number;
    routeIndex: number;
    leg0: number;
    leg1: number;
    leg2: number;
    leg3: number;
}

export interface SceneDebugState {
    blockCount: number;
    floraCount: number;
    entityCounts: Record<string, number>;
    camera: {
        left: number;
        right: number;
        top: number;
        bottom: number;
        position: [number, number, number];
    };
}

export type SceneEntityStateSnapshot = SheepStateSnapshot;

export type SceneRuntimeStatus =
    | { state: 'loading' }
    | { state: 'ready' }
    | { state: 'error'; message: string };

export interface SceneRuntimeBridge {
    setTime: (timeSec: number) => void;
    getState: (timeSec: number) => Array<SceneEntityStateSnapshot>;
    getDebugState: () => SceneDebugState;
    resume: () => void;
    dispose: () => void;
}

export interface SceneRuntimeWindow extends Window {
    __PROFILE_SCENE_BRIDGE?: SceneRuntimeBridge;
    __PROFILE_SCENE_STATUS?: SceneRuntimeStatus;
}
