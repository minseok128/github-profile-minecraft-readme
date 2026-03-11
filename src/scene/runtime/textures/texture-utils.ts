import * as THREE from 'three';
import type { LoadedSceneTextures, SceneRuntimeAssets } from '../types.js';

type CanvasTextureImage = CanvasImageSource & {
    width: number;
    height: number;
};

export const get2dContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
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

export const createCanvasTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
};

export const loadSceneTextures = async (
    assets: SceneRuntimeAssets,
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
        loadTexture(textureLoader, assets.sheepTexturePath),
        loadTexture(textureLoader, assets.sheepFurTexturePath),
        loadTexture(textureLoader, assets.grassTopTexturePath),
        loadTexture(textureLoader, assets.grassSideTexturePath),
        loadTexture(textureLoader, assets.grassSideOverlayTexturePath),
        loadTexture(textureLoader, assets.grassSnowTexturePath),
        loadTexture(textureLoader, assets.pinkPetalsTexturePath),
        loadTexture(textureLoader, assets.leafLitterTexturePath),
        loadTexture(textureLoader, assets.poppyTexturePath),
        loadTexture(textureLoader, assets.dandelionTexturePath),
        loadTexture(textureLoader, assets.cornflowerTexturePath),
        loadTexture(textureLoader, assets.blueOrchidTexturePath),
        loadTexture(textureLoader, assets.azureBluetTexturePath),
        loadTexture(textureLoader, assets.pinkTulipTexturePath),
        loadTexture(textureLoader, assets.whiteTulipTexturePath),
        loadTexture(textureLoader, assets.snowTexturePath),
        loadTexture(textureLoader, assets.dirtTexturePath),
        loadTexture(textureLoader, assets.waterTopTexturePath),
        loadTexture(textureLoader, assets.waterSideTexturePath),
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
