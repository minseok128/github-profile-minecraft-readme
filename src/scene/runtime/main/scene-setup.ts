import * as THREE from 'three';
import type { SceneBootstrapPayload, SceneDebugState } from '../types.js';
import { SCENE_BOOTSTRAP_SCRIPT_ID } from '../constants.js';

export const SHADOW_MAP_SIZE = 2048;

export const parseBootstrapPayload = (): SceneBootstrapPayload => {
    const payloadElement = document.getElementById(SCENE_BOOTSTRAP_SCRIPT_ID);
    if (!(payloadElement instanceof HTMLScriptElement)) {
        throw new Error('Scene bootstrap payload element is missing.');
    }
    return JSON.parse(payloadElement.textContent ?? '') as SceneBootstrapPayload;
};

export const getMountElement = (mountElementId: string): HTMLElement => {
    const mountElement = document.getElementById(mountElementId);
    if (!(mountElement instanceof HTMLElement)) {
        throw new Error(`Scene mount element "#${mountElementId}" is missing.`);
    }
    return mountElement;
};

export const createRenderer = (
    mountElement: HTMLElement,
    isTransparent: boolean,
): THREE.WebGLRenderer => {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: isTransparent,
        preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (isTransparent) {
        renderer.setClearColor(0x000000, 0);
    } else {
        renderer.setClearColor('#eef9ff', 0);
    }
    mountElement.appendChild(renderer.domElement);
    return renderer;
};

export const createLighting = (scene: THREE.Scene): THREE.DirectionalLight => {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7b5a3d, 1.08));

    const sun = new THREE.DirectionalLight(0xfff6d8, 1.34);
    sun.position.set(24, 34, 18);
    sun.castShadow = true;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    scene.add(sun);
    return sun;
};

export const createGround = (
    scene: THREE.Scene,
    isTransparent: boolean,
): THREE.Mesh => {
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshLambertMaterial({
            color: '#d4efff',
            transparent: true,
            opacity: isTransparent ? 0 : 0.22,
        }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.visible = !isTransparent;
    scene.add(ground);
    return ground;
};

export const buildSceneDebugState = (
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
