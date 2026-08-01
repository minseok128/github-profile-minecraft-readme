import * as THREE from 'three';
import { hashUnitInterval } from '../../../shared/random.js';
import type { CalendarMetric } from '../../types.js';
import { THEMES } from '../../theme-registry.js';
import type {
    SeasonalAmountStop,
    ThemeDefinition,
} from '../../theme-registry.js';
import type { LoadedSceneTextures, SceneData } from '../types.js';
import { liftHex, mixHexColors } from './color-math.js';
import { getCyclicInterpolation } from './seasonal-math.js';
import {
    createOverlayTopTexture,
    createPartialOverlayTopTexture,
    createStackedSideTexture,
    createTintedSideTexture,
    createTintedTopTexture,
} from './texture-builders.js';

export const hashString = hashUnitInterval;

const getInterpolatedSeasonalAmount = (
    isoDate: string,
    stops: ReadonlyArray<SeasonalAmountStop>,
): number => {
    const { left, right, t } = getCyclicInterpolation(isoDate, stops);
    return left.amount + (right.amount - left.amount) * t;
};

const getSeasonalGrassTint = (
    theme: ThemeDefinition,
    isoDate: string,
    contributionLevel: number,
): string => {
    const { left, right, t } = getCyclicInterpolation(
        isoDate,
        theme.seasonalGrassStops,
    );
    const seasonalColor = mixHexColors(left.color, right.color, t);
    const contributionLift =
        [0, 0.015, 0.035, 0.06, 0.09][contributionLevel] ?? 0;
    return liftHex(seasonalColor, contributionLift);
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

export const createTerrainTextureContext = (
    sceneData: SceneData,
    textures: LoadedSceneTextures,
): TerrainTextureContext => {
    const theme = THEMES[sceneData.theme];
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
        getInterpolatedSeasonalAmount(isoDate, theme.snowCoverStops);
    const getBlossomCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, theme.blossomCoverStops);
    const getLeafLitterCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, theme.leafLitterCoverStops);
    const getSpringFlowerCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, theme.springFlowerCoverStops);
    const getSummerFlowerCoverage = (isoDate: string): number =>
        getInterpolatedSeasonalAmount(isoDate, theme.summerFlowerCoverStops);
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
            selectedWaterKeys.has(`${cell.week + 1}:${cell.dayOfWeek}`)
                ? '0'
                : '1',
            selectedWaterKeys.has(`${cell.week - 1}:${cell.dayOfWeek}`)
                ? '0'
                : '1',
            '1',
            '1',
            selectedWaterKeys.has(`${cell.week}:${cell.dayOfWeek + 1}`)
                ? '0'
                : '1',
            selectedWaterKeys.has(`${cell.week}:${cell.dayOfWeek - 1}`)
                ? '0'
                : '1',
        ].join('');

    const getWaterBlockGeometry = (
        cell: CalendarMetric,
    ): THREE.BufferGeometry => {
        const key = getWaterGeometryKey(cell);
        const cachedGeometry = waterGeometryCache.get(key);
        if (cachedGeometry) {
            return cachedGeometry;
        }

        const geometry = baseWaterGeometry.clone();
        const visibleFaces = key.split('').map((value) => value === '1');
        geometry.clearGroups();
        for (
            let faceIndex = 0;
            faceIndex < baseWaterGeometry.groups.length;
            faceIndex += 1
        ) {
            const group = baseWaterGeometry.groups[faceIndex];
            if (visibleFaces[faceIndex]) {
                geometry.addGroup(
                    group.start,
                    group.count,
                    group.materialIndex,
                );
            }
        }
        waterGeometryCache.set(key, geometry);
        return geometry;
    };

    const getBlockMaterials = (cell: CalendarMetric): Array<THREE.Material> => {
        const isWaterCell = selectedWaterKeys.has(
            `${cell.week}:${cell.dayOfWeek}`,
        );
        const cacheKey = `${cell.date}:${cell.contributionLevel}:${
            isWaterCell ? 'water' : 'land'
        }`;
        const cachedMaterials = blockMaterialCache.get(cacheKey);
        if (cachedMaterials) {
            return cachedMaterials;
        }

        if (isWaterCell) {
            const materials = waterMaterials.map((material) =>
                material.clone(),
            );
            blockMaterialCache.set(cacheKey, materials);
            return materials;
        }

        let topTexture: THREE.Texture = textures.dirtTexture;
        let sideTexture: THREE.Texture = textures.dirtTexture;
        if (cell.contributionLevel > 0) {
            const snowCoverage = getSnowCoverage(cell.date);
            const hasSnowCover =
                snowCoverage > 0 &&
                hashString(`${cell.date}:${cell.contributionLevel}`) <
                    snowCoverage;
            if (hasSnowCover) {
                topTexture = textures.snowTexture;
                sideTexture = createStackedSideTexture(
                    textures.grassSnowTexture,
                    textures.dirtTexture,
                    cell.worldHeight,
                );
            } else {
                const tintHex = getSeasonalGrassTint(
                    theme,
                    cell.date,
                    cell.contributionLevel,
                );
                topTexture = createTintedTopTexture(
                    textures.grassTopTexture,
                    tintHex,
                );
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
                    hashString(
                        `${cell.date}:leaf:${cell.week}:${cell.dayOfWeek}`,
                    ) < leafLitterCoverage;
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
