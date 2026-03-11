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

    const FADE_SEC = 0.3;
    const tail1BaseRotX = Math.PI / 3; // model's resting tail tilt

    const applyAtTime = (sceneTimeSec: number): void => {
        catInstances.forEach((cat) => {
            // --- Time & segment ---
            const localTimeSec = wrapLoopTime(
                sceneTimeSec + cat.loopPlan.phaseOffsetSec,
                loopDurationSec,
            );
            const activeSeg = findActiveCatLoopSegment(cat.loopPlan, localTimeSec);
            const segDur = Math.max(activeSeg.endSec - activeSeg.startSec, 1e-6);
            const segT = Math.min(Math.max(
                (localTimeSec - activeSeg.startSec) / segDur, 0), 1);
            const routeProgress =
                activeSeg.progressStart +
                segT * (activeSeg.progressEnd - activeSeg.progressStart);

            // --- Position from route ---
            const routeSample = sampleRouteAtProgress(cat.routeMetrics, routeProgress);
            cat.root.position.copy(routeSample.position);
            if (routeSample.direction.lengthSq() > 1e-6) {
                cat.root.rotation.y =
                    Math.atan2(routeSample.direction.x, routeSample.direction.z) + Math.PI;
            }
            cat.shadow.position.set(routeSample.position.x, 0.03, routeSample.position.z);

            // --- Blend weights (same pattern as sheep) ---
            const lieState = getDominantCatSegment(cat.loopPlan, 'lie', localTimeSec, FADE_SEC);
            const sitState = getDominantCatSegment(cat.loopPlan, 'sit', localTimeSec, FADE_SEC);
            const sneakState = getDominantCatSegment(cat.loopPlan, 'sneak', localTimeSec, FADE_SEC);
            const sprintState = getDominantCatSegment(cat.loopPlan, 'sprint', localTimeSec, FADE_SEC);
            const idleState = getDominantCatSegment(cat.loopPlan, 'idle', localTimeSec, FADE_SEC);

            const lieBlend = lieState.mix;
            const sitBlend = Math.max(0, sitState.mix * (1 - lieBlend));
            const sneakBlend = Math.max(0, sneakState.mix * (1 - lieBlend - sitBlend));
            const sprintBlend = Math.max(0, sprintState.mix * (1 - lieBlend - sitBlend - sneakBlend));
            const idleBlend = Math.max(0, idleState.mix * (1 - lieBlend - sitBlend - sneakBlend - sprintBlend));
            const walkBlend = Math.max(0, 1 - lieBlend - sitBlend - sneakBlend - sprintBlend - idleBlend);

            // --- Walk / sneak / sprint gait ---
            const movingBlend = walkBlend + sneakBlend + sprintBlend;
            const walkDist = routeSample.distance;
            const freq = sprintBlend > 0.5 ? CAT_SPRINT_GAIT_FREQUENCY : CAT_WALK_GAIT_FREQUENCY;
            const gaitPhase = Math.PI / 2 + walkDist * freq;
            const amp = sprintBlend > 0.5 ? sprintAmplitude : walkAmplitude;
            const swing = Math.cos(gaitPhase) * amp * movingBlend;

            // Sprint gallop offsets
            const flPhase = sprintBlend > 0.5
                ? Math.cos(gaitPhase + CAT_SPRINT_FL_PHASE_OFFSET) * sprintAmplitude * sprintBlend
                : swing;
            const brPhase = sprintBlend > 0.5
                ? Math.cos(gaitPhase + CAT_SPRINT_BR_PHASE_OFFSET) * sprintAmplitude * sprintBlend
                : swing;

            // --- Legs ---
            // Idle/walk base
            let legFL = walkBlend > 0.01 || sneakBlend > 0.01 ? swing : 0;
            let legFR = walkBlend > 0.01 || sneakBlend > 0.01 ? -swing : 0;
            let legBL = walkBlend > 0.01 || sneakBlend > 0.01 ? -swing : 0;
            let legBR = walkBlend > 0.01 || sneakBlend > 0.01 ? swing : 0;
            let legFLz = 0, legFRz = 0, legBLz = 0, legBRz = 0;

            // Sprint overrides diagonal pairs with gallop
            if (sprintBlend > 0.01) {
                legFL = flPhase;
                legFR = -swing;
                legBL = -swing;
                legBR = brPhase;
            }

            // Sit pose blend
            if (sitBlend > 0.01) {
                const sitFront = degToRad(CAT_SIT_FRONT_LEG_ROT_DEG);
                const sitBack = degToRad(CAT_SIT_BACK_LEG_ROT_DEG);
                legFL = legFL * (1 - sitBlend) + sitFront * sitBlend;
                legFR = legFR * (1 - sitBlend) + sitFront * sitBlend;
                legBL = legBL * (1 - sitBlend) + sitBack * sitBlend;
                legBR = legBR * (1 - sitBlend) + sitBack * sitBlend;
            }

            // Lie pose blend
            if (lieBlend > 0.01) {
                legFL = legFL * (1 - lieBlend) + degToRad(CAT_LIE_FRONT_L_ROT_DEG) * lieBlend;
                legFR = legFR * (1 - lieBlend) + degToRad(CAT_LIE_FRONT_R_ROT_DEG) * lieBlend;
                legBL = legBL * (1 - lieBlend) + degToRad(CAT_LIE_BACK_L_ROT_DEG) * lieBlend;
                legBR = legBR * (1 - lieBlend) + degToRad(CAT_LIE_BACK_R_ROT_DEG) * lieBlend;
                legFRz = degToRad(CAT_LIE_FRONT_R_Z_ROT_DEG) * lieBlend;
                legBRz = degToRad(CAT_LIE_BACK_R_Z_ROT_DEG) * lieBlend;
            }

            cat.legPivots[0].rotation.x = legFL;
            cat.legPivots[1].rotation.x = legFR;
            cat.legPivots[2].rotation.x = legBL;
            cat.legPivots[3].rotation.x = legBR;
            cat.legPivots[0].rotation.z = legFLz;
            cat.legPivots[1].rotation.z = legFRz;
            cat.legPivots[2].rotation.z = legBLz;
            cat.legPivots[3].rotation.z = legBRz;

            // --- Body ---
            const walkBob = Math.abs(Math.sin(gaitPhase)) * 0.05 * movingBlend;
            let bodyY = bodyBaseY + walkBob;
            let bodyRotX = -Math.PI / 2;
            let bodyRotZ = 0;

            if (sneakBlend > 0.01) {
                bodyY -= CAT_SNEAK_BODY_DROP * sneakBlend;
            }
            if (sitBlend > 0.01) {
                bodyY -= CAT_SIT_BODY_DROP * sitBlend;
                bodyRotX += degToRad(CAT_SIT_BODY_ROT_DEG) * sitBlend;
            }
            if (lieBlend > 0.01) {
                bodyY -= CAT_LIE_BODY_DROP * lieBlend;
                bodyRotZ = degToRad(CAT_LIE_BODY_Z_ROT_DEG) * lieBlend;
            }

            cat.bodyGroup.position.y = bodyY;
            cat.bodyGroup.rotation.x = bodyRotX;
            cat.bodyGroup.rotation.z = bodyRotZ;

            // --- Head ---
            const headNod = Math.sin(gaitPhase * 0.5) * 0.04 * movingBlend;
            let headY = headBaseY + headNod;
            let headRotX = 0;
            let headRotY = 0;

            if (sneakBlend > 0.01) {
                headY -= CAT_SNEAK_HEAD_DROP * sneakBlend;
            }
            if (sitBlend > 0.01) {
                headY -= CAT_SIT_HEAD_DROP * sitBlend;
            }
            if (lieBlend > 0.01) {
                headY -= CAT_LIE_BODY_DROP * lieBlend;
                headRotX = degToRad(CAT_LIE_HEAD_X_ROT_DEG) * lieBlend;
                headRotY = degToRad(CAT_LIE_HEAD_Y_ROT_DEG) * lieBlend;
            }

            cat.headPivot.position.set(0, headY, headBaseZ);
            cat.headPivot.rotation.x = headRotX;
            cat.headPivot.rotation.y = headRotY;

            // --- Tail ---
            const tailSway1 = Math.sin(gaitPhase * 1.3) * degToRad(15) * movingBlend;
            const tailSway2 = Math.sin(gaitPhase * 1.3 + 0.5) * degToRad(20) * movingBlend;
            let tail1RotX = 0;
            let tail2RotX = 0;

            if (sitBlend > 0.01) {
                tail1RotX += degToRad(CAT_SIT_TAIL1_ROT_DEG) * sitBlend;
                tail2RotX += degToRad(CAT_SIT_TAIL2_ROT_DEG) * sitBlend;
            }
            if (lieBlend > 0.01) {
                tail1RotX += degToRad(CAT_LIE_TAIL1_ROT_DEG) * lieBlend;
                tail2RotX += degToRad(CAT_LIE_TAIL2_ROT_DEG) * lieBlend;
            }

            // tail1Pivot base rotation is set in model; we adjust additively.
            // During lie pose the body rolls 90° on Z and drops, but tail1Pivot
            // is a sibling of bodyGroup under root — mirror the body transform
            // so the tail stays attached.
            const tail1BaseY = legBaseY + 4 * unit;
            let tail1Y = tail1BaseY;
            let tail1Z = tailSway1;

            if (lieBlend > 0.01) {
                tail1Y -= CAT_LIE_BODY_DROP * lieBlend;
                tail1Z += degToRad(CAT_LIE_BODY_Z_ROT_DEG) * lieBlend;
            }

            cat.tail1Pivot.position.y = tail1Y;
            cat.tail1Pivot.rotation.x = tail1BaseRotX + tail1RotX;
            cat.tail1Pivot.rotation.z = tail1Z;
            cat.tail2Pivot.rotation.x = tail2RotX;
            cat.tail2Pivot.rotation.z = tailSway2;

            // --- State ---
            cat.state =
                lieBlend >= 0.5 ? 'lie'
                : sitBlend >= 0.5 ? 'sit'
                : sneakBlend >= 0.5 ? 'sneak'
                : sprintBlend >= 0.5 ? 'sprint'
                : walkBlend >= 0.5 ? 'walk'
                : 'idle';
            cat.routeIndex = routeSample.routeIndex;
        });
    };

    return { catInstances, applyAtTime };
};
