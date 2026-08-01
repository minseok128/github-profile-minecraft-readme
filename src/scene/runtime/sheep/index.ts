import * as THREE from 'three';
import type { LoadedSceneTextures, SheepStateSnapshot } from '../types.js';
import type { SheepEntityBatch } from '../../types.js';
import { createSheepMaterial, createSheepInstance } from './model.js';
import type { SheepModel } from './model.js';
import { buildRouteMetrics } from './animation.js';
import type { RouteMetrics } from './animation.js';
import { calculateSheepPose } from './pose.js';
import type { SheepState } from './pose.js';

export interface SheepInstance extends SheepModel {
    islandId: number;
    sheepIndex: number;
    islandSheepCount: number;
    route: Array<THREE.Vector3>;
    routeMetrics: RouteMetrics;
    loopPlan: import('../../types.js').SheepLoopPlan;
    gaitPhaseOffset: number;
    idlePhaseOffset: number;
    grazePhaseOffset: number;
    state: SheepState;
    routeIndex: number;
}

export interface SheepRuntimeController {
    sheepInstances: Array<SheepInstance>;
    applyAtTime: (sceneTimeSec: number) => void;
    getStateSnapshot: () => Array<SheepStateSnapshot>;
}

export const buildSheepRuntime = ({
    scene,
    batch,
    gifDurationSec,
    textures,
}: {
    scene: THREE.Scene;
    batch?: SheepEntityBatch;
    gifDurationSec: number;
    textures: LoadedSceneTextures;
}): SheepRuntimeController => {
    if (!batch) {
        return {
            sheepInstances: [],
            applyAtTime: (): void => undefined,
            getStateSnapshot: (): Array<SheepStateSnapshot> => [],
        };
    }
    if (!textures.sheepBaseTexture || !textures.sheepFurTexture) {
        throw new Error(
            'Sheep runtime textures are missing from the scene assets.',
        );
    }
    const sheepBaseTexture = textures.sheepBaseTexture;
    const sheepFurTexture = textures.sheepFurTexture;
    const sheepBaseMaterial = createSheepMaterial(sheepBaseTexture);
    const sheepFurMaterial = createSheepMaterial(sheepFurTexture);
    const loopDurationSec = Math.max(gifDurationSec, 0.001);

    const sheepInstances: Array<SheepInstance> = batch.plans.map(
        (plan, sheepIndex) => {
            const route = plan.route.map(
                (cell) =>
                    new THREE.Vector3(
                        cell.week,
                        cell.worldHeight + 0.01,
                        cell.dayOfWeek,
                    ),
            );
            return {
                ...createSheepInstance(
                    scene,
                    plan.colorHex,
                    sheepBaseMaterial,
                    sheepFurMaterial,
                    sheepFurTexture,
                    batch.targetHeight,
                ),
                islandId: plan.islandId,
                sheepIndex,
                islandSheepCount: plan.islandSheepCount,
                route,
                routeMetrics: buildRouteMetrics(route),
                loopPlan: plan.loopPlan,
                gaitPhaseOffset:
                    plan.loopPlan.phaseOffsetSec * 5.2 + sheepIndex * 0.85,
                idlePhaseOffset:
                    plan.loopPlan.phaseOffsetSec * 2.1 + sheepIndex * 0.37,
                grazePhaseOffset:
                    plan.loopPlan.phaseOffsetSec * 1.35 + sheepIndex * 0.19,
                state: 'walk',
                routeIndex: 0,
            };
        },
    );

    const applyAtTime = (sceneTimeSec: number): void => {
        sheepInstances.forEach((sheepInstance) => {
            const pose = calculateSheepPose({
                sceneTimeSec,
                loopDurationSec,
                loopPlan: sheepInstance.loopPlan,
                routeMetrics: sheepInstance.routeMetrics,
                gaitPhaseOffset: sheepInstance.gaitPhaseOffset,
                idlePhaseOffset: sheepInstance.idlePhaseOffset,
                grazePhaseOffset: sheepInstance.grazePhaseOffset,
            });
            sheepInstance.root.position.copy(pose.position);
            if (pose.yaw !== undefined) {
                sheepInstance.root.rotation.y = pose.yaw;
            }
            sheepInstance.shadow.position.set(
                pose.position.x,
                0.03,
                pose.position.z,
            );
            for (let index = 0; index < pose.legRotations.length; index += 1) {
                sheepInstance.legPivots[index].rotation.x =
                    pose.legRotations[index];
            }
            sheepInstance.headPivot.position.set(0, pose.headY, pose.headZ);
            sheepInstance.headRig.position.set(0, pose.headRigY, pose.headRigZ);
            sheepInstance.headNeck.rotation.x = pose.headRotX;
            sheepInstance.bodyGroup.position.y = pose.bodyY;
            sheepInstance.state = pose.state;
            sheepInstance.routeIndex = pose.routeIndex;
        });
    };

    const getStateSnapshot = (): Array<SheepStateSnapshot> =>
        sheepInstances.map((sheepInstance) => ({
            x: sheepInstance.root.position.x,
            y: sheepInstance.root.position.y,
            z: sheepInstance.root.position.z,
            yaw: sheepInstance.root.rotation.y,
            state: sheepInstance.state,
            shadowY: sheepInstance.shadow.position.y,
            headY: sheepInstance.headPivot.position.y,
            headZ: sheepInstance.headPivot.position.z,
            headRotX: sheepInstance.headNeck.rotation.x,
            headRigY: sheepInstance.headRig.position.y,
            headRigZ: sheepInstance.headRig.position.z,
            bodyY: sheepInstance.bodyGroup.position.y,
            routeIndex: sheepInstance.routeIndex,
            leg0: sheepInstance.legPivots[0].rotation.x,
            leg1: sheepInstance.legPivots[1].rotation.x,
            leg2: sheepInstance.legPivots[2].rotation.x,
            leg3: sheepInstance.legPivots[3].rotation.x,
        }));

    return {
        sheepInstances,
        applyAtTime,
        getStateSnapshot,
    };
};
