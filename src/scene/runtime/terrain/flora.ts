import * as THREE from 'three';
import type { SceneData } from '../types.js';
import type { TerrainTextureContext } from '../textures/seasonal.js';

const createPlantMaterial = (map: THREE.Texture): THREE.MeshLambertMaterial =>
    new THREE.MeshLambertMaterial({
        map,
        transparent: true,
        alphaTest: 0.12,
        side: THREE.DoubleSide,
    });

const createCrossPlant = (
    texture: THREE.Texture,
    x: number,
    y: number,
    z: number,
    rotation: number,
    scale = 0.62,
): THREE.Group => {
    const height = scale;
    const geometry = new THREE.PlaneGeometry(scale, height);
    const material = createPlantMaterial(texture);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const planeA = new THREE.Mesh(geometry, material);
    planeA.position.y = height * 0.5;
    planeA.rotation.y = rotation;
    group.add(planeA);

    const planeB = new THREE.Mesh(geometry, material.clone());
    planeB.position.y = height * 0.5;
    planeB.rotation.y = rotation + Math.PI / 2;
    group.add(planeB);

    group.traverse((node: THREE.Object3D) => {
        if (node instanceof THREE.Mesh) {
            node.castShadow = true;
            node.receiveShadow = false;
            node.renderOrder = 2;
        }
    });

    return group;
};

const pickFlowerTexture = (
    textures: Array<THREE.Texture>,
    seed: number,
): THREE.Texture | null => {
    if (textures.length === 0) {
        return null;
    }
    return textures[Math.floor(seed * textures.length) % textures.length];
};

export interface TerrainBuildResult {
    blocks: Array<THREE.Object3D>;
    floraDecorations: Array<THREE.Object3D>;
    contentBounds: THREE.Box3;
}

export const buildTerrainAndFlora = (
    scene: THREE.Scene,
    sceneData: SceneData,
    terrainTextures: TerrainTextureContext,
): TerrainBuildResult => {
    const blocks: Array<THREE.Object3D> = [];
    const floraDecorations: Array<THREE.Object3D> = [];
    const contentBounds = new THREE.Box3();
    const tempBounds = new THREE.Box3();

    sceneData.calendarMetrics.forEach((cell) => {
        const isWaterCell = terrainTextures.selectedWaterKeys.has(
            `${cell.week}:${cell.dayOfWeek}`,
        );

        const block = new THREE.Mesh(
            isWaterCell
                ? terrainTextures.getWaterBlockGeometry(cell)
                : new THREE.BoxGeometry(1, cell.worldHeight, 1),
            terrainTextures.getBlockMaterials(cell),
        );
        block.position.set(cell.week, cell.worldHeight * 0.5, cell.dayOfWeek);
        block.castShadow = !isWaterCell;
        block.receiveShadow = true;
        scene.add(block);
        blocks.push(block);
        tempBounds.setFromObject(block);
        contentBounds.union(tempBounds);
    });

    sceneData.calendarMetrics.forEach((cell) => {
        if (cell.contributionLevel === 0) {
            return;
        }

        const snowCoverage = terrainTextures.getSnowCoverage(cell.date);
        const hasSnowCover =
            snowCoverage > 0 &&
            terrainTextures.hashString(`${cell.date}:${cell.contributionLevel}`) <
                snowCoverage;
        if (hasSnowCover) {
            return;
        }

        const springFlowerCoverage = terrainTextures.getSpringFlowerCoverage(
            cell.date,
        );
        const summerFlowerCoverage = terrainTextures.getSummerFlowerCoverage(
            cell.date,
        );
        const flowerCoverage = Math.max(
            springFlowerCoverage,
            summerFlowerCoverage,
        );
        if (flowerCoverage <= 0) {
            return;
        }

        const seasonalTextures =
            springFlowerCoverage >= summerFlowerCoverage
                ? terrainTextures.springFlowerTextures
                : terrainTextures.summerFlowerTextures;
        const flowerRoll = terrainTextures.hashString(
            `${cell.date}:flora:${cell.week}:${cell.dayOfWeek}`,
        );
        if (flowerRoll >= flowerCoverage) {
            return;
        }

        const flowerCount = flowerRoll < flowerCoverage * 0.28 ? 2 : 1;
        const offsets =
            flowerCount === 2
                ? [
                      [-0.18, 0.12],
                      [0.14, -0.1],
                  ]
                : [[-0.02, 0.04]];

        offsets.forEach(([offsetX, offsetZ], flowerIndex) => {
            const texture = pickFlowerTexture(
                seasonalTextures,
                terrainTextures.hashString(
                    `${cell.date}:flora:texture:${flowerIndex}:${cell.week}:${cell.dayOfWeek}`,
                ),
            );
            if (!texture) {
                return;
            }

            const scale =
                0.48 +
                terrainTextures.hashString(
                    `${cell.date}:flora:scale:${flowerIndex}:${cell.week}:${cell.dayOfWeek}`,
                ) *
                    0.1;
            const rotation =
                terrainTextures.hashString(
                    `${cell.date}:flora:rotation:${flowerIndex}:${cell.week}:${cell.dayOfWeek}`,
                ) * Math.PI;
            const flower = createCrossPlant(
                texture,
                cell.week + offsetX,
                cell.worldHeight + 0.02,
                cell.dayOfWeek + offsetZ,
                rotation,
                scale,
            );
            scene.add(flower);
            floraDecorations.push(flower);
            tempBounds.setFromObject(flower);
            contentBounds.union(tempBounds);
        });
    });

    if (contentBounds.isEmpty()) {
        contentBounds.expandByPoint(new THREE.Vector3(0, 0, 0));
        contentBounds.expandByPoint(new THREE.Vector3(1, 1, 1));
    }

    return {
        blocks,
        floraDecorations,
        contentBounds,
    };
};
