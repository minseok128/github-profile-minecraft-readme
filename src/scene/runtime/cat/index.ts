import * as THREE from 'three';
import type { CatLoopPlan, GrassWorldCell } from '../../../types.js';
import type { LoadedSceneTextures, SceneData } from '../types.js';
import type { CatModel } from './model.js';
import { createCatInstance } from './model.js';
import type { RouteMetrics } from './animation.js';
import {
    buildRouteMetrics,
    sampleRouteAtProgress,
    wrapLoopTime,
    findActiveCatLoopSegment,
    getDominantCatSegment,
} from './animation.js';
import {
    unit,
    CAT_WALK_GAIT_FREQUENCY,
    CAT_WALK_LEG_AMPLITUDE_DEG,
    CAT_WALK_TAIL1_ROT,
    CAT_WALK_TAIL2_BASE_DEG,
    CAT_WALK_TAIL2_AMPLITUDE_DEG,
    CAT_SIT_BODY_ROT_DEG,
    CAT_SIT_BODY_DROP,
    CAT_SIT_FRONT_LEG_ROT_DEG,
    CAT_SIT_BACK_LEG_ROT_DEG,
    CAT_SIT_TAIL1_ROT_DEG,
    CAT_SIT_TAIL2_ROT_DEG,
    CAT_SIT_HEAD_DROP,
    CAT_LIE_BODY_Z_ROT_DEG,
    CAT_LIE_BODY_DROP,
    CAT_LIE_FRONT_L_ROT_DEG,
    CAT_LIE_FRONT_R_ROT_DEG,
    CAT_LIE_BACK_L_ROT_DEG,
    CAT_LIE_BACK_R_ROT_DEG,
    CAT_LIE_BACK_R_Z_ROT_DEG,
    CAT_LIE_FRONT_R_Z_ROT_DEG,
    CAT_LIE_HEAD_X_ROT_DEG,
    CAT_LIE_HEAD_Y_ROT_DEG,
    CAT_LIE_TAIL1_ROT_DEG,
    CAT_LIE_TAIL2_ROT_DEG,
    CAT_SNEAK_BODY_DROP,
    CAT_SNEAK_HEAD_DROP,
    CAT_SNEAK_TAIL2_AMPLITUDE_DEG,
    CAT_SPRINT_GAIT_FREQUENCY,
    CAT_SPRINT_LEG_AMPLITUDE_DEG,
    CAT_SPRINT_TAIL2_AMPLITUDE_DEG,
    CAT_SPRINT_BR_PHASE_OFFSET,
    CAT_SPRINT_FL_PHASE_OFFSET,
} from './constants.js';

export interface CatInstance extends CatModel {
    route: Array<THREE.Vector3>;
    routeMetrics: RouteMetrics;
    loopPlan: CatLoopPlan;
    gaitPhaseOffset: number;
    catIndex: number;
    routeIndex: number;
    state: 'walk' | 'sit' | 'idle' | 'lie' | 'sneak' | 'sprint';
}

export interface CatRuntimeController {
    catInstances: Array<CatInstance>;
    applyAtTime: (sceneTimeSec: number) => void;
}

const routeCellToVec3 = (cell: GrassWorldCell): THREE.Vector3 =>
    new THREE.Vector3(cell.week, cell.worldHeight + 0.01, cell.dayOfWeek);

const degToRad = THREE.MathUtils.degToRad;

export const buildCatRuntime = ({
    scene,
    sceneData,
    gifDurationSec,
    textures,
}: {
    scene: THREE.Scene;
    sceneData: SceneData;
    gifDurationSec: number;
    textures: LoadedSceneTextures;
}): CatRuntimeController => {
    const loopDurationSec = Math.max(gifDurationSec, 0.001);

    const catInstances: Array<CatInstance> = sceneData.showCat
        ? sceneData.catPlans.map((plan, catIndex) => {
              const route = plan.route.map(routeCellToVec3);
              return {
                  ...createCatInstance(
                      scene,
                      textures.catTexture,
                      sceneData.catTargetHeight,
                  ),
                  route,
                  routeMetrics: buildRouteMetrics(route),
                  loopPlan: plan.loopPlan,
                  gaitPhaseOffset:
                      Math.PI / 2 + plan.loopPlan.phaseOffsetSec * 4.7 + catIndex * 0.93,
                  catIndex,
                  routeIndex: 0,
                  state: 'lie' as const,
              };
          })
        : [];

    // Base positions (model space, before scaling)
    const legBaseY = 6 * unit;
    const bodyBaseY = legBaseY + 2 * unit;
    const headBaseY = legBaseY + 4 * unit;
    const headBaseZ = -5 * unit;

    const walkAmplitude = degToRad(CAT_WALK_LEG_AMPLITUDE_DEG);
    const sprintAmplitude = degToRad(CAT_SPRINT_LEG_AMPLITUDE_DEG);

    const applyAtTime = (sceneTimeSec: number): void => {
        catInstances.forEach((cat) => {
            // Continuous walk forward only. progress: 0 → 1 over loopDurationSec.
            const cycleSec = loopDurationSec;
            const phase = sceneTimeSec % cycleSec;
            const progress = phase / cycleSec;
            const walkBlend = 1.0;

            const routeSample = sampleRouteAtProgress(
                cat.routeMetrics,
                progress,
            );
            cat.root.position.copy(routeSample.position);
            if (routeSample.direction.lengthSq() > 1e-6) {
                cat.root.rotation.y =
                    Math.atan2(
                        routeSample.direction.x,
                        routeSample.direction.z,
                    ) + Math.PI;
            }
            cat.shadow.position.set(
                routeSample.position.x,
                0.03,
                routeSample.position.z,
            );

            // Walk gait: distance-based
            const walkDist = routeSample.distance;
            const gaitPhase = Math.PI / 2 + walkDist * CAT_WALK_GAIT_FREQUENCY;
            const swing = Math.cos(gaitPhase) * walkAmplitude * walkBlend;

            // Legs: diagonal pairs
            cat.legPivots[0].rotation.x = swing;   // FL
            cat.legPivots[1].rotation.x = -swing;  // FR
            cat.legPivots[2].rotation.x = -swing;  // BL
            cat.legPivots[3].rotation.x = swing;   // BR
            cat.legPivots[0].rotation.z = 0;
            cat.legPivots[1].rotation.z = 0;
            cat.legPivots[2].rotation.z = 0;
            cat.legPivots[3].rotation.z = 0;

            // Body
            const walkBob = Math.abs(Math.sin(gaitPhase)) * 0.05 * walkBlend;
            cat.bodyGroup.position.y = bodyBaseY + walkBob;
            cat.bodyGroup.rotation.x = -Math.PI / 2;
            cat.bodyGroup.rotation.z = 0;

            // Head
            const headNod = Math.sin(gaitPhase * 0.5) * 0.04 * walkBlend;
            cat.headPivot.position.set(0, headBaseY + headNod, headBaseZ);
            cat.headPivot.rotation.x = 0;
            cat.headPivot.rotation.y = 0;

            // Tail
            // Tail sway: left-right (rotation.z) since tail points up-and-back
            cat.tail1Pivot.rotation.z =
                Math.sin(gaitPhase * 1.3) * degToRad(15) * walkBlend;
            cat.tail2Pivot.rotation.z =
                Math.sin(gaitPhase * 1.3 + 0.5) * degToRad(20) * walkBlend;

            cat.state = walkBlend > 0.5 ? 'walk' : 'idle';
            cat.routeIndex = routeSample.routeIndex;
        });
    };

    return { catInstances, applyAtTime };
};
