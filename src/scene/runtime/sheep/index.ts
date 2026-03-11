import * as THREE from 'three';
import type {
    LoadedSceneTextures,
    SceneData,
    SheepStateSnapshot,
} from '../types.js';
import {
    sheepBodyBaseY,
    sheepHeadBaseY,
    sheepHeadBaseZ,
    sheepHeadNeutralRotation,
    sheepHeadRigBaseY,
    sheepHeadRigBaseZ,
    grazeAnimationLengthSec,
    grazeHeadRigLowerAmount,
    grazeHeadBaseRotation,
    grazeHeadChewAmplitude,
    grazeHeadChewDropAmount,
} from './constants.js';
import { createSheepMaterial, createSheepInstance } from './model.js';
import type { SheepModel } from './model.js';
import {
    wrapLoopTime,
    buildRouteMetrics,
    sampleRouteAtProgress,
    findActiveLoopSegment,
    getDominantSegment,
} from './animation.js';
import type { RouteMetrics } from './animation.js';

type SheepState = 'walk' | 'idle' | 'graze';

export interface SheepInstance extends SheepModel {
    islandId: number;
    sheepIndex: number;
    islandSheepCount: number;
    route: Array<THREE.Vector3>;
    routeMetrics: RouteMetrics;
    loopPlan: import('../../../types.js').SheepLoopPlan;
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
    sceneData,
    gifDurationSec,
    textures,
}: {
    scene: THREE.Scene;
    sceneData: SceneData;
    gifDurationSec: number;
    textures: LoadedSceneTextures;
}): SheepRuntimeController => {
    const sheepBaseMaterial = createSheepMaterial(textures.sheepBaseTexture);
    const sheepFurMaterial = createSheepMaterial(textures.sheepFurTexture);
    const loopDurationSec = Math.max(gifDurationSec, 0.001);

    const sheepInstances = sceneData.showSheep
        ? sceneData.sheepPlans.map((plan, sheepIndex) => {
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
                      textures.sheepFurTexture,
                      sceneData.sheepTargetHeight,
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
                  state: 'walk' as SheepState,
                  routeIndex: 0,
              };
          })
        : [];

    const applyAtTime = (sceneTimeSec: number): void => {
        sheepInstances.forEach((sheepInstance) => {
            const localTimeSec = wrapLoopTime(
                sceneTimeSec + sheepInstance.loopPlan.phaseOffsetSec,
                loopDurationSec,
            );
            const activeLoopSegment = findActiveLoopSegment(
                sheepInstance.loopPlan,
                localTimeSec,
            );
            const segmentDuration = Math.max(
                activeLoopSegment.endSec - activeLoopSegment.startSec,
                1e-6,
            );
            const segmentT = THREE.MathUtils.clamp(
                (localTimeSec - activeLoopSegment.startSec) / segmentDuration,
                0,
                1,
            );
            const routeProgress = THREE.MathUtils.lerp(
                activeLoopSegment.progressStart,
                activeLoopSegment.progressEnd,
                segmentT,
            );
            const routeSample = sampleRouteAtProgress(
                sheepInstance.routeMetrics,
                routeProgress,
            );

            sheepInstance.root.position.copy(routeSample.position);
            if (routeSample.direction.lengthSq() > 1e-6) {
                sheepInstance.root.rotation.y =
                    Math.atan2(
                        routeSample.direction.x,
                        routeSample.direction.z,
                    ) + Math.PI;
            }
            sheepInstance.shadow.position.set(
                routeSample.position.x,
                0.03,
                routeSample.position.z,
            );

            const grazeState = getDominantSegment(
                sheepInstance.loopPlan,
                'graze',
                localTimeSec,
                0.18,
            );
            const idleState = getDominantSegment(
                sheepInstance.loopPlan,
                'idle',
                localTimeSec,
                0.16,
            );
            const grazeBlend = grazeState.mix;
            const idleBlend = Math.max(0, idleState.mix * (1 - grazeBlend));
            const walkBlend = Math.max(0, 1 - Math.max(grazeBlend, idleBlend));
            const gaitPhase =
                sheepInstance.gaitPhaseOffset + routeSample.distance * 7.6;
            const walkSwing =
                Math.cos(gaitPhase) *
                THREE.MathUtils.degToRad(24) *
                walkBlend;

            sheepInstance.legPivots[0].rotation.x = walkSwing;
            sheepInstance.legPivots[3].rotation.x = walkSwing;
            sheepInstance.legPivots[1].rotation.x = -walkSwing;
            sheepInstance.legPivots[2].rotation.x = -walkSwing;

            let bodyY =
                sheepBodyBaseY +
                Math.abs(Math.sin(gaitPhase)) * 0.05 * walkBlend +
                Math.sin(localTimeSec * 2.1 + sheepInstance.idlePhaseOffset) *
                    0.006 *
                    idleBlend;
            const headY = sheepHeadBaseY;
            const headZ = sheepHeadBaseZ;
            let headRotX =
                sheepHeadNeutralRotation +
                Math.sin(gaitPhase * 0.5) * 0.06 * walkBlend +
                Math.sin(localTimeSec * 1.3 + sheepInstance.idlePhaseOffset) *
                    0.03 *
                    idleBlend;
            let headRigY = sheepHeadRigBaseY;
            let headRigZ =
                sheepHeadRigBaseZ +
                Math.sin(localTimeSec * 1.1 + sheepInstance.idlePhaseOffset) *
                    0.005 *
                    idleBlend;

            if (grazeBlend > 1e-3 && grazeState.segment) {
                const grazeLocalTimeSec =
                    Math.max(0, localTimeSec - grazeState.segment.startSec) +
                    sheepInstance.grazePhaseOffset;
                const cycleTime = grazeLocalTimeSec % grazeAnimationLengthSec;
                const lowerT =
                    cycleTime <= 0.2
                        ? cycleTime / 0.2
                        : cycleTime >= 1.8
                          ? Math.max(
                                0,
                                (grazeAnimationLengthSec - cycleTime) / 0.2,
                            )
                          : 1;
                const chew =
                    cycleTime >= 0.2 && cycleTime <= 1.8
                        ? Math.sin(((cycleTime - 0.2) / 1.6) * Math.PI * 8)
                        : 0;
                const chewDip =
                    cycleTime >= 0.2 && cycleTime <= 1.8
                        ? Math.max(0, chew)
                        : 0;
                const grazeBodyY =
                    sheepBodyBaseY - lowerT * 0.004 - chewDip * 0.0015;
                const grazeHeadRigY =
                    sheepHeadRigBaseY -
                    grazeHeadRigLowerAmount * lowerT -
                    grazeHeadChewDropAmount * chewDip * lowerT;
                const grazeHeadRotX =
                    sheepHeadNeutralRotation * (1 - lowerT) +
                    (grazeHeadBaseRotation - grazeHeadChewAmplitude * chew) *
                        lowerT;

                bodyY = THREE.MathUtils.lerp(bodyY, grazeBodyY, grazeBlend);
                headRigY = THREE.MathUtils.lerp(
                    headRigY,
                    grazeHeadRigY,
                    grazeBlend,
                );
                headRotX = THREE.MathUtils.lerp(
                    headRotX,
                    grazeHeadRotX,
                    grazeBlend,
                );
            }

            sheepInstance.headPivot.position.set(0, headY, headZ);
            sheepInstance.headRig.position.set(0, headRigY, headRigZ);
            sheepInstance.headNeck.rotation.x = headRotX;
            sheepInstance.bodyGroup.position.y = bodyY;

            sheepInstance.state =
                grazeBlend >= 0.5
                    ? 'graze'
                    : idleBlend >= 0.5
                      ? 'idle'
                      : (activeLoopSegment.kind as SheepState);
            sheepInstance.routeIndex = routeSample.routeIndex;
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
