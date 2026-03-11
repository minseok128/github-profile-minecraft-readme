import * as THREE from 'three';
import type { CatLoopPlan, CatLoopSegment } from '../../../types.js';
import {
    buildRouteMetrics,
    sampleRouteAtProgress,
    wrapLoopTime,
    findActiveLoopSegment,
    smootherstep01,
} from '../sheep/animation.js';

export type { RouteMetrics } from '../sheep/animation.js';
export { buildRouteMetrics, sampleRouteAtProgress, wrapLoopTime, smootherstep01 };

export interface CatDominantSegmentState {
    mix: number;
    segment: CatLoopSegment | null;
}

const getCatSegmentMix = (
    localTimeSec: number,
    segment: CatLoopSegment | null,
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

export const findActiveCatLoopSegment = (
    loopPlan: CatLoopPlan,
    localTimeSec: number,
): CatLoopSegment =>
    loopPlan.segments.find(
        (segment, segmentIndex) =>
            localTimeSec >= segment.startSec &&
            (localTimeSec < segment.endSec ||
                segmentIndex === loopPlan.segments.length - 1),
    ) ?? loopPlan.segments[loopPlan.segments.length - 1];

export const getDominantCatSegment = (
    loopPlan: CatLoopPlan,
    kind: CatLoopSegment['kind'],
    localTimeSec: number,
    edgeSec: number,
): CatDominantSegmentState =>
    loopPlan.segments.reduce<CatDominantSegmentState>(
        (best, segment) => {
            if (segment.kind !== kind) {
                return best;
            }

            const mix = getCatSegmentMix(localTimeSec, segment, edgeSec);
            if (mix > best.mix) {
                return { mix, segment };
            }
            return best;
        },
        { mix: 0, segment: null },
    );

// Re-export findActiveLoopSegment adapted for cat (same logic, just typed for CatLoopPlan)
export { findActiveLoopSegment };
