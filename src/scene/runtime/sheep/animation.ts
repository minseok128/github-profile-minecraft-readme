import * as THREE from 'three';
import type { SheepLoopPlan, SheepLoopSegment } from '../../../types.js';

export interface RouteMetrics {
    points: Array<THREE.Vector3>;
    cumulativeDistances: Array<number>;
    totalLength: number;
}

export interface DominantSegmentState {
    mix: number;
    segment: SheepLoopSegment | null;
}

export const wrapLoopTime = (timeSec: number, loopDurationSec: number): number => {
    const wrapped = timeSec % loopDurationSec;
    return wrapped < 0 ? wrapped + loopDurationSec : wrapped;
};

export const smootherstep01 = (value: number): number => {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
};

export const buildRouteMetrics = (points: Array<THREE.Vector3>): RouteMetrics => {
    const cumulativeDistances = [0];
    for (let index = 1; index < points.length; index += 1) {
        cumulativeDistances.push(
            cumulativeDistances[index - 1] +
                points[index - 1].distanceTo(points[index]),
        );
    }

    return {
        points,
        cumulativeDistances,
        totalLength: cumulativeDistances[cumulativeDistances.length - 1] || 0,
    };
};

export const sampleRouteAtProgress = (
    routeMetrics: RouteMetrics,
    progress: number,
): {
    position: THREE.Vector3;
    direction: THREE.Vector3;
    distance: number;
    routeIndex: number;
} => {
    if (routeMetrics.points.length === 0) {
        return {
            position: new THREE.Vector3(),
            direction: new THREE.Vector3(0, 0, 1),
            distance: 0,
            routeIndex: 0,
        };
    }

    if (routeMetrics.points.length === 1 || routeMetrics.totalLength <= 1e-6) {
        return {
            position: routeMetrics.points[0].clone(),
            direction: new THREE.Vector3(0, 0, 1),
            distance: 0,
            routeIndex: 0,
        };
    }

    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const targetDistance = routeMetrics.totalLength * clampedProgress;

    for (let index = 1; index < routeMetrics.points.length; index += 1) {
        const segmentStartDistance = routeMetrics.cumulativeDistances[index - 1];
        const segmentEndDistance = routeMetrics.cumulativeDistances[index];
        if (
            targetDistance > segmentEndDistance &&
            index < routeMetrics.points.length - 1
        ) {
            continue;
        }

        const start = routeMetrics.points[index - 1];
        const end = routeMetrics.points[index];
        const segmentLength = Math.max(
            segmentEndDistance - segmentStartDistance,
            1e-6,
        );
        const segmentProgress =
            (targetDistance - segmentStartDistance) / segmentLength;
        return {
            position: start
                .clone()
                .lerp(end, THREE.MathUtils.clamp(segmentProgress, 0, 1)),
            direction: end.clone().sub(start).normalize(),
            distance: targetDistance,
            routeIndex: index - 1,
        };
    }

    const lastIndex = routeMetrics.points.length - 1;
    return {
        position: routeMetrics.points[lastIndex].clone(),
        direction: routeMetrics.points[lastIndex]
            .clone()
            .sub(routeMetrics.points[lastIndex - 1])
            .normalize(),
        distance: routeMetrics.totalLength,
        routeIndex: Math.max(0, lastIndex - 1),
    };
};

export const findActiveLoopSegment = (
    loopPlan: SheepLoopPlan,
    localTimeSec: number,
): SheepLoopSegment =>
    loopPlan.segments.find(
        (segment, segmentIndex) =>
            localTimeSec >= segment.startSec &&
            (localTimeSec < segment.endSec ||
                segmentIndex === loopPlan.segments.length - 1),
    ) ?? loopPlan.segments[loopPlan.segments.length - 1];

const getSegmentMix = (
    localTimeSec: number,
    segment: SheepLoopSegment | null,
    edgeSec: number,
): number => {
    if (!segment) {
        return 0;
    }

    const segmentDuration = Math.max(segment.endSec - segment.startSec, 1e-6);
    const fadeSec = Math.min(edgeSec, segmentDuration * 0.5);
    if (fadeSec <= 1e-6) {
        return localTimeSec >= segment.startSec && localTimeSec <= segment.endSec
            ? 1
            : 0;
    }

    if (
        localTimeSec <= segment.startSec - fadeSec ||
        localTimeSec >= segment.endSec + fadeSec
    ) {
        return 0;
    }
    if (localTimeSec < segment.startSec + fadeSec) {
        return smootherstep01(
            (localTimeSec - (segment.startSec - fadeSec)) / (fadeSec * 2),
        );
    }
    if (localTimeSec > segment.endSec - fadeSec) {
        return (
            1 -
            smootherstep01(
                (localTimeSec - (segment.endSec - fadeSec)) / (fadeSec * 2),
            )
        );
    }

    return 1;
};

export const getDominantSegment = (
    loopPlan: SheepLoopPlan,
    kind: SheepLoopSegment['kind'],
    localTimeSec: number,
    edgeSec: number,
): DominantSegmentState =>
    loopPlan.segments.reduce<DominantSegmentState>(
        (best, segment) => {
            if (segment.kind !== kind) {
                return best;
            }

            const mix = getSegmentMix(localTimeSec, segment, edgeSec);
            if (mix > best.mix) {
                return { mix, segment };
            }
            return best;
        },
        { mix: 0, segment: null },
    );
