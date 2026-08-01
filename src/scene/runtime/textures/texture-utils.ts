import * as THREE from 'three';
import type { SceneAssetUrls } from '../../assets.js';
import type { LoadedSceneTextures } from '../types.js';

type CanvasTextureImage = CanvasImageSource & {
    width: number;
    height: number;
};

export const get2dContext = (
    canvas: HTMLCanvasElement,
): CanvasRenderingContext2D => {
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to acquire 2D canvas context.');
    }
    return context;
};

export const getTextureImage = (texture: THREE.Texture): CanvasTextureImage =>
    texture.image as CanvasTextureImage;

export const loadTexture = (
    textureLoader: THREE.TextureLoader,
    texturePath: string,
): Promise<THREE.Texture> =>
    new Promise<THREE.Texture>((resolve, reject) => {
        textureLoader.load(
            texturePath,
            (texture: THREE.Texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                texture.generateMipmaps = false;
                texture.flipY = true;
                resolve(texture);
            },
            undefined,
            reject,
        );
    });

export const createCanvasTexture = (
    canvas: HTMLCanvasElement,
): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
};

export const loadSceneTextures = async (
    assets: SceneAssetUrls,
): Promise<LoadedSceneTextures> => {
    const textureLoader = new THREE.TextureLoader();
    const [
        sheepBaseTexture,
        sheepFurTexture,
        grassTopTexture,
        grassSideTexture,
        grassSideOverlayTexture,
        grassSnowTexture,
        pinkPetalsTexture,
        leafLitterTexture,
        poppyTexture,
        dandelionTexture,
        cornflowerTexture,
        blueOrchidTexture,
        azureBluetTexture,
        pinkTulipTexture,
        whiteTulipTexture,
        snowTexture,
        dirtTexture,
        waterTopTexture,
        waterSideTexture,
    ] = await Promise.all([
        assets.sheepBase
            ? loadTexture(textureLoader, assets.sheepBase)
            : Promise.resolve(undefined),
        assets.sheepFur
            ? loadTexture(textureLoader, assets.sheepFur)
            : Promise.resolve(undefined),
        loadTexture(textureLoader, assets.grassTop),
        loadTexture(textureLoader, assets.grassSide),
        loadTexture(textureLoader, assets.grassSideOverlay),
        loadTexture(textureLoader, assets.grassSnow),
        loadTexture(textureLoader, assets.pinkPetals),
        loadTexture(textureLoader, assets.leafLitter),
        loadTexture(textureLoader, assets.poppy),
        loadTexture(textureLoader, assets.dandelion),
        loadTexture(textureLoader, assets.cornflower),
        loadTexture(textureLoader, assets.blueOrchid),
        loadTexture(textureLoader, assets.azureBluet),
        loadTexture(textureLoader, assets.pinkTulip),
        loadTexture(textureLoader, assets.whiteTulip),
        loadTexture(textureLoader, assets.snow),
        loadTexture(textureLoader, assets.dirt),
        loadTexture(textureLoader, assets.waterTop),
        loadTexture(textureLoader, assets.waterSide),
    ]);

    return {
        sheepBaseTexture,
        sheepFurTexture,
        grassTopTexture,
        grassSideTexture,
        grassSideOverlayTexture,
        grassSnowTexture,
        pinkPetalsTexture,
        leafLitterTexture,
        poppyTexture,
        dandelionTexture,
        cornflowerTexture,
        blueOrchidTexture,
        azureBluetTexture,
        pinkTulipTexture,
        whiteTulipTexture,
        snowTexture,
        dirtTexture,
        waterTopTexture,
        waterSideTexture,
    };
};
