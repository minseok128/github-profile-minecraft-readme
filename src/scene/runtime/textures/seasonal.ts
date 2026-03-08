import * as THREE from 'three';
import type { CalendarMetric } from '../../../types.js';
import type {
    LoadedSceneTextures,
    SceneData,
    SceneRuntimeAssets,
    SeasonalAmountStop,
} from '../types.js';

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

type CanvasTextureImage = CanvasImageSource & {
    width: number;
    height: number;
};

const get2dContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to acquire 2D canvas context.');
    }
    return context;
};

const getTextureImage = (texture: THREE.Texture): CanvasTextureImage =>
    texture.image as CanvasTextureImage;

const loadTexture = (
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

const createCanvasTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
};

const clampChannel = (value: number): number =>
    Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const normalized = hex.replace('#', '');
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
};

const rgbToHex = (rgb: { r: number; g: number; b: number }): string =>
    `#${[rgb.r, rgb.g, rgb.b]
        .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
        .join('')}`;

const mixHexColors = (startHex: string, endHex: string, t: number): string => {
    const clampedT = Math.max(0, Math.min(1, t));
    const start = hexToRgb(startHex);
    const end = hexToRgb(endHex);
    return rgbToHex({
        r: start.r + (end.r - start.r) * clampedT,
        g: start.g + (end.g - start.g) * clampedT,
        b: start.b + (end.b - start.b) * clampedT,
    });
};

const liftHex = (hex: string, amount: number): string => {
    const rgb = hexToRgb(hex);
    if (amount >= 0) {
        return rgbToHex({
            r: rgb.r + (255 - rgb.r) * amount,
            g: rgb.g + (255 - rgb.g) * amount,
            b: rgb.b + (255 - rgb.b) * amount,
        });
    }

    const darken = 1 + amount;
    return rgbToHex({
        r: rgb.r * darken,
        g: rgb.g * darken,
        b: rgb.b * darken,
    });
};

const isLeapYear = (year: number): boolean =>
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const toDayOfYear = (year: number, month: number, day: number): number => {
    const monthOffsets = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const leapOffset = isLeapYear(year) && month > 2 ? 1 : 0;
    return monthOffsets[month - 1] + day + leapOffset;
};

export const hashString = (value: string): number => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
};

const getInterpolatedSeasonalAmount = (
    isoDate: string,
    stops: ReadonlyArray<SeasonalAmountStop>,
): number => {
    const [yearText, monthText, dayText] = isoDate.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const dayOfYear = toDayOfYear(year, month, day);
    const daysInYear = isLeapYear(year) ? 366 : 365;
    const yearlyStops = stops
        .map((stop) => ({
            day: toDayOfYear(year, stop.month, stop.day),
            amount: stop.amount,
        }))
        .sort((left, right) => left.day - right.day);
    const extendedStops = [
        {
            day: yearlyStops[yearlyStops.length - 1].day - daysInYear,
            amount: yearlyStops[yearlyStops.length - 1].amount,
        },
        ...yearlyStops,
        {
            day: yearlyStops[0].day + daysInYear,
            amount: yearlyStops[0].amount,
        },
    ];

    let leftStop = extendedStops[0];
    let rightStop = extendedStops[1];
    for (let index = 0; index < extendedStops.length - 1; index += 1) {
        const left = extendedStops[index];
        const right = extendedStops[index + 1];
        if (dayOfYear >= left.day && dayOfYear < right.day) {
            leftStop = left;
            rightStop = right;
            break;
        }
    }

    const range = Math.max(1, rightStop.day - leftStop.day);
    const t = Math.max(0, Math.min(1, (dayOfYear - leftStop.day) / range));
    return leftStop.amount + (rightStop.amount - leftStop.amount) * t;
};

const getSeasonalGrassTint = (
    sceneData: SceneData,
    isoDate: string,
    contributionLevel: number,
): string => {
    const [yearText, monthText, dayText] = isoDate.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const dayOfYear = toDayOfYear(year, month, day);
    const daysInYear = isLeapYear(year) ? 366 : 365;
    const yearlyStops = sceneData.seasonalGrassStops
        .map((stop) => ({
            day: toDayOfYear(year, stop.month, stop.day),
            color: stop.color,
        }))
        .sort((left, right) => left.day - right.day);
    const extendedStops = [
        {
            day: yearlyStops[yearlyStops.length - 1].day - daysInYear,
            color: yearlyStops[yearlyStops.length - 1].color,
        },
        ...yearlyStops,
        {
            day: yearlyStops[0].day + daysInYear,
            color: yearlyStops[0].color,
        },
    ];

    let leftStop = extendedStops[0];
    let rightStop = extendedStops[1];
    for (let index = 0; index < extendedStops.length - 1; index += 1) {
        const left = extendedStops[index];
        const right = extendedStops[index + 1];
        if (dayOfYear >= left.day && dayOfYear < right.day) {
            leftStop = left;
            rightStop = right;
            break;
        }
    }

    const range = Math.max(1, rightStop.day - leftStop.day);
    const seasonalColor = mixHexColors(
        leftStop.color,
        rightStop.color,
        (dayOfYear - leftStop.day) / range,
    );
    const contributionLift = [0, 0.015, 0.035, 0.06, 0.09][contributionLevel] ?? 0;
    return liftHex(seasonalColor, contributionLift);
};

const createTintedTopTexture = (
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

const createTintedSideTexture = (
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

const createOverlayTopTexture = (
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

const createStackedSideTexture = (
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

const createPartialOverlayTopTexture = (
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

export interface TerrainTextureContext {
    selectedWaterKeys: Set<string>;
    springFlowerTextures: Array<THREE.Texture>;
    summerFlowerTextures: Array<THREE.Texture>;
    hashString: (value: string) => number;
    getSnowCoverage: (isoDate: string) => number;
    getSpringFlowerCoverage: (isoDate: string) => number;
    getSummerFlowerCoverage: (isoDate: string) => number;
    getWaterBlockGeometry: (cell: CalendarMetric) => THREE.BufferGeometry;
    getBlockMaterials: (cell: CalendarMetric) => Array<THREE.Material>;
}

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

export const createTerrainTextureContext = (
    sceneData: SceneData,
    textures: LoadedSceneTextures,
): TerrainTextureContext => {
    const springFlowerTextures = [
        textures.pinkTulipTexture,
        textures.whiteTulipTexture,
        textures.azureBluetTexture,
        textures.pinkTulipTexture,
    ];
    const summerFlowerTextures = [
        textures.poppyTexture,
        textures.dandelionTexture,
        textures.cornflowerTexture,
        textures.blueOrchidTexture,
        textures.poppyTexture,
    ];
    const waterMaterials = [
        new THREE.MeshPhongMaterial({
            map: textures.waterSideTexture,
            color: new THREE.Color('#3f76e4'),
            transparent: true,
            opacity: 0.86,
            shininess: 110,
            specular: new THREE.Color('#dff8ff'),
            emissive: new THREE.Color('#163d82'),
            emissiveIntensity: 0.18,
            depthWrite: false,
        }),
        new THREE.MeshPhongMaterial({
            map: textures.waterSideTexture,
            color: new THREE.Color('#3f76e4'),
            transparent: true,
            opacity: 0.86,
            shininess: 110,
            specular: new THREE.Color('#dff8ff'),
            emissive: new THREE.Color('#163d82'),
            emissiveIntensity: 0.18,
            depthWrite: false,
        }),
        new THREE.MeshPhongMaterial({
            map: textures.waterTopTexture,
            color: new THREE.Color('#4d88f0'),
            transparent: true,
            opacity: 0.9,
            shininess: 135,
            specular: new THREE.Color('#effcff'),
            emissive: new THREE.Color('#18427d'),
            emissiveIntensity: 0.18,
            depthWrite: false,
        }),
        new THREE.MeshPhongMaterial({
            map: textures.waterSideTexture,
            color: new THREE.Color('#3568d7'),
            transparent: true,
            opacity: 0.84,
            shininess: 100,
            specular: new THREE.Color('#cfefff'),
            emissive: new THREE.Color('#12315f'),
            emissiveIntensity: 0.14,
            depthWrite: false,
        }),
        new THREE.MeshPhongMaterial({
            map: textures.waterSideTexture,
            color: new THREE.Color('#3f76e4'),
            transparent: true,
            opacity: 0.86,
            shininess: 110,
            specular: new THREE.Color('#dff8ff'),
            emissive: new THREE.Color('#163d82'),
            emissiveIntensity: 0.18,
            depthWrite: false,
        }),
        new THREE.MeshPhongMaterial({
            map: textures.waterSideTexture,
            color: new THREE.Color('#3f76e4'),
            transparent: true,
            opacity: 0.86,
            shininess: 110,
            specular: new THREE.Color('#dff8ff'),
            emissive: new THREE.Color('#163d82'),
            emissiveIntensity: 0.18,
            depthWrite: false,
        }),
    ];

    const getSnowCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, sceneData.snowCoverStops);
    const getBlossomCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, sceneData.blossomCoverStops);
    const getLeafLitterCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, sceneData.leafLitterCoverStops);
    const getSpringFlowerCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, sceneData.springFlowerCoverStops);
    const getSummerFlowerCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, sceneData.summerFlowerCoverStops);
    const selectedWaterKeys = new Set(
        sceneData.calendarMetrics
            .filter((cell) => cell.contributionLevel === 0)
            .map((cell) => `${cell.week}:${cell.dayOfWeek}`),
    );
    const baseWaterGeometry = new THREE.BoxGeometry(1, 1, 1);
    const waterGeometryCache = new Map<string, THREE.BufferGeometry>();
    const blockMaterialCache = new Map<string, Array<THREE.Material>>();

    const getWaterGeometryKey = (cell: CalendarMetric): string =>
        [
            selectedWaterKeys.has(`${cell.week + 1}:${cell.dayOfWeek}`) ? '0' : '1',
            selectedWaterKeys.has(`${cell.week - 1}:${cell.dayOfWeek}`) ? '0' : '1',
            '1',
            '1',
            selectedWaterKeys.has(`${cell.week}:${cell.dayOfWeek + 1}`) ? '0' : '1',
            selectedWaterKeys.has(`${cell.week}:${cell.dayOfWeek - 1}`) ? '0' : '1',
        ].join('');

    const getWaterBlockGeometry = (cell: CalendarMetric): THREE.BufferGeometry => {
        const key = getWaterGeometryKey(cell);
        const cachedGeometry = waterGeometryCache.get(key);
        if (cachedGeometry) {
            return cachedGeometry;
        }

        const geometry = baseWaterGeometry.clone();
        const visibleFaces = key.split('').map((value) => value === '1');
        geometry.clearGroups();
        for (let faceIndex = 0; faceIndex < baseWaterGeometry.groups.length; faceIndex += 1) {
            const group = baseWaterGeometry.groups[faceIndex];
            if (visibleFaces[faceIndex]) {
                geometry.addGroup(group.start, group.count, group.materialIndex);
            }
        }
        waterGeometryCache.set(key, geometry);
        return geometry;
    };

    const getBlockMaterials = (cell: CalendarMetric): Array<THREE.Material> => {
        const isWaterCell = selectedWaterKeys.has(`${cell.week}:${cell.dayOfWeek}`);
        const cacheKey = `${cell.date}:${cell.contributionLevel}:${
            isWaterCell ? 'water' : 'land'
        }`;
        const cachedMaterials = blockMaterialCache.get(cacheKey);
        if (cachedMaterials) {
            return cachedMaterials;
        }

        if (isWaterCell) {
            const materials = waterMaterials.map((material) => material.clone());
            blockMaterialCache.set(cacheKey, materials);
            return materials;
        }

        let topTexture: THREE.Texture = textures.dirtTexture;
        let sideTexture: THREE.Texture = textures.dirtTexture;
        if (cell.contributionLevel > 0) {
            const snowCoverage = getSnowCoverage(cell.date);
            const hasSnowCover =
                snowCoverage > 0 &&
                hashString(`${cell.date}:${cell.contributionLevel}`) < snowCoverage;
            if (hasSnowCover) {
                topTexture = textures.snowTexture;
                sideTexture = createStackedSideTexture(
                    textures.grassSnowTexture,
                    textures.dirtTexture,
                    cell.worldHeight,
                );
            } else {
                const tintHex = getSeasonalGrassTint(
                    sceneData,
                    cell.date,
                    cell.contributionLevel,
                );
                topTexture = createTintedTopTexture(textures.grassTopTexture, tintHex);
                sideTexture = createStackedSideTexture(
                    createTintedSideTexture(
                        textures.grassSideTexture,
                        textures.grassSideOverlayTexture,
                        tintHex,
                    ),
                    textures.dirtTexture,
                    cell.worldHeight,
                );

                const blossomCoverage = getBlossomCoverage(cell.date);
                const hasBlossom =
                    blossomCoverage > 0 &&
                    hashString(
                        `${cell.date}:blossom:${cell.week}:${cell.dayOfWeek}`,
                    ) < blossomCoverage;
                if (hasBlossom) {
                    topTexture = createOverlayTopTexture(
                        topTexture,
                        textures.pinkPetalsTexture,
                    );
                }

                const leafLitterCoverage = getLeafLitterCoverage(cell.date);
                const hasLeafLitter =
                    leafLitterCoverage > 0 &&
                    hashString(`${cell.date}:leaf:${cell.week}:${cell.dayOfWeek}`) <
                        leafLitterCoverage;
                if (hasLeafLitter) {
                    topTexture = createPartialOverlayTopTexture(
                        topTexture,
                        textures.leafLitterTexture,
                        '#8b5a2b',
                        { x: 0, y: 0, width: 8, height: 16 },
                        { x: 0, y: 0, width: 8, height: 16 },
                    );
                }
            }
        }

        const materials = [
            new THREE.MeshLambertMaterial({ map: sideTexture }),
            new THREE.MeshLambertMaterial({ map: sideTexture }),
            new THREE.MeshLambertMaterial({ map: topTexture }),
            new THREE.MeshLambertMaterial({ map: textures.dirtTexture }),
            new THREE.MeshLambertMaterial({ map: sideTexture }),
            new THREE.MeshLambertMaterial({ map: sideTexture }),
        ];
        blockMaterialCache.set(cacheKey, materials);
        return materials;
    };

    return {
        selectedWaterKeys,
        springFlowerTextures,
        summerFlowerTextures,
        hashString,
        getSnowCoverage,
        getSpringFlowerCoverage,
        getSummerFlowerCoverage,
        getWaterBlockGeometry,
        getBlockMaterials,
    };
};
