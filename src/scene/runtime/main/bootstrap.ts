import * as THREE from 'three';
import { fitCameraToBounds } from '../camera/bounds.js';
import { updateCameraFrustum } from '../camera/frustum.js';
import { buildCalendarGuideMarkers } from '../camera/guides.js';
import { CREATURE_RUNTIMES } from '../creature-registry.js';
import { buildTerrainAndFlora } from '../terrain/flora.js';
import { createTerrainTextureContext } from '../textures/seasonal.js';
import { loadSceneTextures } from '../textures/texture-utils.js';
import type {
    SceneDebugState,
    SceneEntityStateSnapshot,
    SceneRuntimeWindow,
} from '../types.js';
import {
    buildSceneDebugState,
    createGround,
    createLighting,
    createRenderer,
    getMountElement,
    parseBootstrapPayload,
} from './scene-setup.js';

const start = async (): Promise<void> => {
    const payload = parseBootstrapPayload();
    const runtimeWindow = window as SceneRuntimeWindow;
    runtimeWindow.__PROFILE_SCENE_STATUS = { state: 'loading' };

    const isTransparent = payload.sceneData.background === 'transparent';
    const mountElement = getMountElement(payload.mountElementId);
    const scene = new THREE.Scene();
    if (!isTransparent) {
        scene.fog = new THREE.Fog('#d8f0ff', 20, 74);
    }

    const renderer = createRenderer(mountElement, isTransparent);
    const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 240);
    const isoDirection = new THREE.Vector3(1, 1, 1).normalize();
    const cameraFitPadding = isTransparent ? 1.005 : 1.04;

    createLighting(scene);
    const ground = createGround(scene, isTransparent);

    const textures = await loadSceneTextures(payload.sceneData.assets);
    const terrainTextures = createTerrainTextureContext(
        payload.sceneData,
        textures,
    );
    const terrain = buildTerrainAndFlora(
        scene,
        payload.sceneData,
        terrainTextures,
    );
    const creatureRuntimes = payload.sceneData.entities.map((batch) =>
        CREATURE_RUNTIMES[batch.kind](batch, {
            scene,
            gifDurationSec: payload.gifDurationSec,
            textures,
        }),
    );
    const entityBounds = creatureRuntimes.flatMap(
        (runtime) => runtime.viewBounds,
    );

    const contentBounds = terrain.contentBounds.clone();
    entityBounds.forEach((bounds) => {
        contentBounds.union(bounds);
    });

    fitCameraToBounds({
        camera,
        scene,
        ground,
        isoDirection,
        cameraFitPadding,
        blocks: terrain.blocks,
        floraDecorations: terrain.floraDecorations,
        entityBounds,
        contentBounds,
    });
    updateCameraFrustum(camera, window.innerWidth, window.innerHeight);
    buildCalendarGuideMarkers({
        scene,
        camera,
        monthGuideEntries: payload.sceneData.monthGuideEntries,
        contentBounds,
    });

    const clock = new THREE.Clock();
    let autoAnimate = true;
    let manualSceneTimeSec = 0;
    let animationTimeOffsetSec = 0;
    let disposed = false;
    let animationFrameId: number | undefined;
    const entityCounts = Object.fromEntries(
        creatureRuntimes.map((runtime) => [runtime.kind, runtime.entityCount]),
    );
    let debugState = buildSceneDebugState(
        camera,
        terrain.blocks.length,
        terrain.floraDecorations.length,
        entityCounts,
    );

    const updateDebugState = (): void => {
        debugState = buildSceneDebugState(
            camera,
            terrain.blocks.length,
            terrain.floraDecorations.length,
            entityCounts,
        );
    };

    const renderSceneAtTime = (timeSec: number): void => {
        creatureRuntimes.forEach((runtime) => runtime.applyAtTime(timeSec));
        renderer.render(scene, camera);
        updateDebugState();
    };

    const animate = (): void => {
        if (!autoAnimate || disposed) {
            return;
        }
        renderSceneAtTime(clock.getElapsedTime() + animationTimeOffsetSec);
        animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = (): void => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        updateCameraFrustum(camera, window.innerWidth, window.innerHeight);
        renderSceneAtTime(
            autoAnimate
                ? clock.getElapsedTime() + animationTimeOffsetSec
                : manualSceneTimeSec,
        );
    };
    window.addEventListener('resize', handleResize);

    runtimeWindow.__PROFILE_SCENE_BRIDGE = {
        setTime: (timeSec: number): void => {
            autoAnimate = false;
            manualSceneTimeSec = Math.max(0, timeSec);
            renderSceneAtTime(manualSceneTimeSec);
        },
        getState: (timeSec: number): Array<SceneEntityStateSnapshot> => {
            autoAnimate = false;
            manualSceneTimeSec = Math.max(0, timeSec);
            renderSceneAtTime(manualSceneTimeSec);
            return creatureRuntimes.flatMap((runtime) =>
                runtime.getStateSnapshot(),
            );
        },
        getDebugState: (): SceneDebugState => debugState,
        resume: (): void => {
            if (!autoAnimate && !disposed) {
                autoAnimate = true;
                animationTimeOffsetSec =
                    manualSceneTimeSec - clock.getElapsedTime();
                animationFrameId = requestAnimationFrame(animate);
            }
        },
        dispose: (): void => {
            disposed = true;
            autoAnimate = false;
            if (animationFrameId !== undefined) {
                cancelAnimationFrame(animationFrameId);
            }
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
        },
    };
    renderSceneAtTime(0);
    runtimeWindow.__PROFILE_SCENE_STATUS = { state: 'ready' };
    animationFrameId = requestAnimationFrame(animate);
};

void start().catch((error: unknown) => {
    const runtimeWindow = window as SceneRuntimeWindow;
    runtimeWindow.__PROFILE_SCENE_STATUS = {
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
    };
    console.error(error);
});
