import * as THREE from 'three';
import type { SheepLoopPlan } from '../../types.js';
import {
    grazeAnimationLengthSec,
    grazeHeadBaseRotation,
    grazeHeadChewAmplitude,
    grazeHeadChewDropAmount,
    grazeHeadRigLowerAmount,
    sheepBodyBaseY,
    sheepHeadBaseY,
    sheepHeadBaseZ,
    sheepHeadNeutralRotation,
    sheepHeadRigBaseY,
    sheepHeadRigBaseZ,
} from './constants.js';
import {
    findActiveLoopSegment,
    getDominantSegment,
    sampleRouteAtProgress,
    wrapLoopTime,
} from './animation.js';
import type { RouteMetrics } from './animation.js';

export type SheepState = 'walk' | 'idle' | 'graze';

export interface SheepPoseInput {
    sceneTimeSec: number;
    loopDurationSec: number;
    loopPlan: SheepLoopPlan;
    routeMetrics: RouteMetrics;
    gaitPhaseOffset: number;
    idlePhaseOffset: number;
    grazePhaseOffset: number;
}

export interface SheepPose {
    position: THREE.Vector3;
    yaw?: number;
    state: SheepState;
    routeIndex: number;
    legRotations: [number, number, number, number];
    bodyY: number;
    headY: number;
    headZ: number;
    headRotX: number;
    headRigY: number;
    headRigZ: number;
}

export const calculateSheepPose = ({
    sceneTimeSec,
    loopDurationSec,
    loopPlan,
    routeMetrics,
    gaitPhaseOffset,
    idlePhaseOffset,
    grazePhaseOffset,
}: SheepPoseInput): SheepPose => {
    const localTimeSec = wrapLoopTime(
        sceneTimeSec + loopPlan.phaseOffsetSec,
        loopDurationSec,
    );
    const activeLoopSegment = findActiveLoopSegment(loopPlan, localTimeSec);
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
    const routeSample = sampleRouteAtProgress(routeMetrics, routeProgress);
    const grazeState = getDominantSegment(
        loopPlan,
        'graze',
        localTimeSec,
        0.18,
    );
    const idleState = getDominantSegment(loopPlan, 'idle', localTimeSec, 0.16);
    const grazeBlend = grazeState.mix;
    const idleBlend = Math.max(0, idleState.mix * (1 - grazeBlend));
    const walkBlend = Math.max(0, 1 - Math.max(grazeBlend, idleBlend));
    const gaitPhase = gaitPhaseOffset + routeSample.distance * 7.6;
    const walkSwing =
        Math.cos(gaitPhase) * THREE.MathUtils.degToRad(24) * walkBlend;

    let bodyY =
        sheepBodyBaseY +
        Math.abs(Math.sin(gaitPhase)) * 0.05 * walkBlend +
        Math.sin(localTimeSec * 2.1 + idlePhaseOffset) * 0.006 * idleBlend;
    let headRotX =
        sheepHeadNeutralRotation +
        Math.sin(gaitPhase * 0.5) * 0.06 * walkBlend +
        Math.sin(localTimeSec * 1.3 + idlePhaseOffset) * 0.03 * idleBlend;
    let headRigY = sheepHeadRigBaseY;
    const headRigZ =
        sheepHeadRigBaseZ +
        Math.sin(localTimeSec * 1.1 + idlePhaseOffset) * 0.005 * idleBlend;

    if (grazeBlend > 1e-3 && grazeState.segment) {
        const grazeLocalTimeSec =
            Math.max(0, localTimeSec - grazeState.segment.startSec) +
            grazePhaseOffset;
        const cycleTime = grazeLocalTimeSec % grazeAnimationLengthSec;
        const lowerT =
            cycleTime <= 0.2
                ? cycleTime / 0.2
                : cycleTime >= 1.8
                  ? Math.max(0, (grazeAnimationLengthSec - cycleTime) / 0.2)
                  : 1;
        const chew =
            cycleTime >= 0.2 && cycleTime <= 1.8
                ? Math.sin(((cycleTime - 0.2) / 1.6) * Math.PI * 8)
                : 0;
        const chewDip =
            cycleTime >= 0.2 && cycleTime <= 1.8 ? Math.max(0, chew) : 0;
        const grazeBodyY = sheepBodyBaseY - lowerT * 0.004 - chewDip * 0.0015;
        const grazeHeadRigY =
            sheepHeadRigBaseY -
            grazeHeadRigLowerAmount * lowerT -
            grazeHeadChewDropAmount * chewDip * lowerT;
        const grazeHeadRotX =
            sheepHeadNeutralRotation * (1 - lowerT) +
            (grazeHeadBaseRotation - grazeHeadChewAmplitude * chew) * lowerT;

        bodyY = THREE.MathUtils.lerp(bodyY, grazeBodyY, grazeBlend);
        headRigY = THREE.MathUtils.lerp(headRigY, grazeHeadRigY, grazeBlend);
        headRotX = THREE.MathUtils.lerp(headRotX, grazeHeadRotX, grazeBlend);
    }

    return {
        position: routeSample.position,
        yaw:
            routeSample.direction.lengthSq() > 1e-6
                ? Math.atan2(routeSample.direction.x, routeSample.direction.z) +
                  Math.PI
                : undefined,
        state:
            grazeBlend >= 0.5
                ? 'graze'
                : idleBlend >= 0.5
                  ? 'idle'
                  : activeLoopSegment.kind,
        routeIndex: routeSample.routeIndex,
        legRotations: [walkSwing, -walkSwing, -walkSwing, walkSwing],
        bodyY,
        headY: sheepHeadBaseY,
        headZ: sheepHeadBaseZ,
        headRotX,
        headRigY,
        headRigZ,
    };
};
