import * as THREE from 'three';
import {
    SCENE_BOOTSTRAP_SCRIPT_ID,
} from '../constants.js';
import {
    buildCalendarGuideMarkers,
    fitCameraToBounds,
    updateCameraFrustum,
} from '../camera/labels.js';
import { buildSheepRuntime } from '../sheep/index.js';
import { buildTerrainAndFlora } from '../terrain/flora.js';
import {
    createTerrainTextureContext,
    loadSceneTextures,
} from '../textures/seasonal.js';
import type {
    SceneBootstrapPayload,
    SceneDebugState,
    SceneRuntimeWindow,
} from '../types.js';

const parseBootstrapPayload = (): SceneBootstrapPayload => {
    const payloadElement = document.getElementById(SCENE_BOOTSTRAP_SCRIPT_ID);
    if (!(payloadElement instanceof HTMLScriptElement)) {
        throw new Error('Scene bootstrap payload element is missing.');
    }

    return JSON.parse(payloadElement.textContent ?? '') as SceneBootstrapPayload;
};

const getMountElement = (mountElementId: string): HTMLElement => {
    const mountElement = document.getElementById(mountElementId);
    if (!(mountElement instanceof HTMLElement)) {
        throw new Error(`Scene mount element "#${mountElementId}" is missing.`);
    }
    return mountElement;
};

const buildSceneDebugState = (
    camera: THREE.OrthographicCamera,
    blockCount: number,
    floraCount: number,
    sheepCount: number,
): SceneDebugState => ({
    blockCount,
    floraCount,
    sheepCount,
    camera: {
        left: camera.left,
        right: camera.right,
        top: camera.top,
        bottom: camera.bottom,
        position: [camera.position.x, camera.position.y, camera.position.z],
    },
});

const start = async (): Promise<void> => {
    const payload = parseBootstrapPayload();
    const runtimeWindow = window as SceneRuntimeWindow;
    const mountElement = getMountElement(payload.mountElementId);
    const scene = new THREE.Scene();
    if (payload.sceneData.background !== 'transparent') {
        scene.fog = new THREE.Fog('#d8f0ff', 20, 74);
    }

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: payload.sceneData.background === 'transparent',
        preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (payload.sceneData.background === 'transparent') {
        renderer.setClearColor(0x000000, 0);
    } else {
        renderer.setClearColor('#eef9ff', 0);
    }
    mountElement.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 240);
    const isoDirection = new THREE.Vector3(1, 1, 1).normalize();
    const cameraFitPadding =
        payload.sceneData.background === 'transparent' ? 1.005 : 1.04;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7b5a3d, 1.08));

    const sun = new THREE.DirectionalLight(0xfff6d8, 1.34);
    sun.position.set(24, 34, 18);
    sun.castShadow = true;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshLambertMaterial({
            color: '#d4efff',
            transparent: true,
            opacity: payload.sceneData.background === 'transparent' ? 0 : 0.22,
        }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.visible = payload.sceneData.background !== 'transparent';
    scene.add(ground);

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
