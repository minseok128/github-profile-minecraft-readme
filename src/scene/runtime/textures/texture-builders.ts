import * as THREE from 'three';
import { createCanvasTexture, get2dContext, getTextureImage } from './texture-utils.js';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const createTintedTopTexture = (
    baseTexture: THREE.Texture,
    tintHex: string,
): THREE.CanvasTexture => {
    const image = getTextureImage(baseTexture);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = get2dContext(canvas);
    context.drawImage(image, 0, 0);
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = tintHex;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = 0.06;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    return createCanvasTexture(canvas);
};

export const createTintedSideTexture = (
    baseTexture: THREE.Texture,
    overlayTexture: THREE.Texture,
    tintHex: string,
): THREE.CanvasTexture => {
    const baseImage = getTextureImage(baseTexture);
    const overlayImage = getTextureImage(overlayTexture);
    const canvas = document.createElement('canvas');
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    const context = get2dContext(canvas);
    context.drawImage(baseImage, 0, 0);

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = overlayImage.width;
    overlayCanvas.height = overlayImage.height;
    const overlayContext = get2dContext(overlayCanvas);
    overlayContext.drawImage(overlayImage, 0, 0);
    overlayContext.globalCompositeOperation = 'source-atop';
    overlayContext.fillStyle = tintHex;
    overlayContext.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayContext.globalCompositeOperation = 'source-over';

    context.drawImage(overlayCanvas, 0, 0);
    return createCanvasTexture(canvas);
};

export const createOverlayTopTexture = (
    baseTexture: THREE.Texture,
    overlayTexture: THREE.Texture,
    tintHex: string | null = null,
): THREE.CanvasTexture => {
    const baseImage = getTextureImage(baseTexture);
    const overlayImage = getTextureImage(overlayTexture);
    const canvas = document.createElement('canvas');
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    const context = get2dContext(canvas);
    context.drawImage(baseImage, 0, 0);

    if (tintHex) {
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = overlayImage.width;
        overlayCanvas.height = overlayImage.height;
        const overlayContext = get2dContext(overlayCanvas);
        overlayContext.drawImage(overlayImage, 0, 0);
        overlayContext.globalCompositeOperation = 'source-atop';
        overlayContext.fillStyle = tintHex;
        overlayContext.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        overlayContext.globalCompositeOperation = 'source-over';
        context.drawImage(overlayCanvas, 0, 0);
    } else {
        context.drawImage(overlayImage, 0, 0);
    }

    return createCanvasTexture(canvas);
};

export const createStackedSideTexture = (
    topTileTexture: THREE.Texture,
    fillTileTexture: THREE.Texture,
    totalHeightBlocks: number,
): THREE.CanvasTexture => {
    const topImage = getTextureImage(topTileTexture);
    const fillImage = getTextureImage(fillTileTexture);
    const tileWidth = topImage.width;
    const tileHeight = topImage.height;
    const totalPixelHeight = Math.max(
        tileHeight,
        Math.round(tileHeight * totalHeightBlocks),
    );
    const canvas = document.createElement('canvas');
    canvas.width = tileWidth;
    canvas.height = totalPixelHeight;
    const context = get2dContext(canvas);
    context.imageSmoothingEnabled = false;

    const topSegmentHeight = Math.min(tileHeight, totalPixelHeight);
    context.drawImage(
        topImage,
        0,
        0,
        tileWidth,
        topSegmentHeight,
        0,
        0,
        tileWidth,
        topSegmentHeight,
    );

    let destY = topSegmentHeight;
    while (destY < totalPixelHeight) {
        const drawHeight = Math.min(tileHeight, totalPixelHeight - destY);
        context.drawImage(
            fillImage,
            0,
            0,
            tileWidth,
            drawHeight,
            0,
            destY,
            tileWidth,
            drawHeight,
        );
        destY += drawHeight;
    }

    return createCanvasTexture(canvas);
};

export const createPartialOverlayTopTexture = (
    baseTexture: THREE.Texture,
    overlayTexture: THREE.Texture,
    tintHex: string,
    sourceRect: Rect,
    targetRect: Rect,
): THREE.CanvasTexture => {
    const baseImage = getTextureImage(baseTexture);
    const overlayImage = getTextureImage(overlayTexture);
    const canvas = document.createElement('canvas');
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    const context = get2dContext(canvas);
    context.drawImage(baseImage, 0, 0);

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = overlayImage.width;
    overlayCanvas.height = overlayImage.height;
    const overlayContext = get2dContext(overlayCanvas);
    overlayContext.drawImage(overlayImage, 0, 0);
    overlayContext.globalCompositeOperation = 'source-atop';
    overlayContext.fillStyle = tintHex;
    overlayContext.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayContext.globalCompositeOperation = 'source-over';

    context.drawImage(
        overlayCanvas,
        sourceRect.x,
        sourceRect.y,
        sourceRect.width,
        sourceRect.height,
        targetRect.x,
        targetRect.y,
        targetRect.width,
        targetRect.height,
    );

    return createCanvasTexture(canvas);
};
