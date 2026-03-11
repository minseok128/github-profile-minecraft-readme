import * as THREE from 'three';
import {
    buildCalendarGuideMarkers,
    fitCameraToBounds,
    updateCameraFrustum,
} from '../camera/labels.js';
import { buildSheepRuntime } from '../sheep/index.js';
import { buildTerrainAndFlora } from '../terrain/flora.js';
import { createTerrainTextureContext } from '../textures/seasonal.js';
import { loadSceneTextures } from '../textures/texture-utils.js';
import type { SceneRuntimeWindow } from '../types.js';
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

    const textures = await loadSceneTextures(payload.assets);
    const terrainTextures = createTerrainTextureContext(payload.sceneData, textures);
    const terrain = buildTerrainAndFlora(scene, payload.sceneData, terrainTextures);
    const sheepRuntime = buildSheepRuntime({
        scene,
        sceneData: payload.sceneData,
        gifDurationSec: payload.gifDurationSec,
        textures,
    });

    const contentBounds = terrain.contentBounds.clone();
    sheepRuntime.sheepInstances.forEach((sheepInstance) => {
        sheepInstance.route.forEach((point) => {
            contentBounds.expandByPoint(
                new THREE.Vector3(point.x - 0.45, point.y, point.z - 0.45),
            );
            contentBounds.expandByPoint(
                new THREE.Vector3(
                    point.x + 0.45,
                    point.y + payload.sceneData.sheepTargetHeight,
                    point.z + 0.45,
                ),
            );
        });
    });

    fitCameraToBounds({
        camera,
        scene,
        ground,
        isoDirection,
        cameraFitPadding,
        blocks: terrain.blocks,
        floraDecorations: terrain.floraDecorations,
        sheepInstances: sheepRuntime.sheepInstances,
        sheepTargetHeight: payload.sceneData.sheepTargetHeight,
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

    const updateDebugState = (): void => {
        runtimeWindow.__PROFILE_SCENE_DEBUG = buildSceneDebugState(
            camera,
            terrain.blocks.length,
            terrain.floraDecorations.length,
            sheepRuntime.sheepInstances.length,
        );
    };

    const renderSceneAtTime = (timeSec: number): void => {
        sheepRuntime.applyAtTime(timeSec);
        renderer.render(scene, camera);
        updateDebugState();
    };

    const animate = (): void => {
        if (!autoAnimate) {
            return;
        }

        renderSceneAtTime(clock.getElapsedTime() + animationTimeOffsetSec);
        requestAnimationFrame(animate);
    };

    runtimeWindow.__setSceneTime = (timeSec: number) => {
        autoAnimate = false;
        manualSceneTimeSec = Math.max(0, timeSec);
        renderSceneAtTime(manualSceneTimeSec);
    };
    runtimeWindow.__getSceneState = (timeSec: number) => {
        autoAnimate = false;
        manualSceneTimeSec = Math.max(0, timeSec);
        renderSceneAtTime(manualSceneTimeSec);
        return sheepRuntime.getStateSnapshot();
    };
    runtimeWindow.__PROFILE_SCENE_LOOP_DURATION = payload.gifDurationSec;
    runtimeWindow.__resumeScene = () => {
        if (!autoAnimate) {
            autoAnimate = true;
            animationTimeOffsetSec = manualSceneTimeSec - clock.getElapsedTime();
            requestAnimationFrame(animate);
        }
    };

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        updateCameraFrustum(camera, window.innerWidth, window.innerHeight);
        renderSceneAtTime(
            autoAnimate
                ? clock.getElapsedTime() + animationTimeOffsetSec
                : manualSceneTimeSec,
        );
    });

    renderSceneAtTime(0);
    runtimeWindow.__PROFILE_SCENE_READY = true;
    requestAnimationFrame(animate);
};

void start().catch((error: unknown) => {
    console.error(error);
});
