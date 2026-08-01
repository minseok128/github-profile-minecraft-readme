import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildRouteMetrics } from '../../../scene/runtime/sheep/animation.js';
import { calculateSheepPose } from '../../../scene/runtime/sheep/pose.js';
import type { SheepPose } from '../../../scene/runtime/sheep/pose.js';
import type { SheepLoopPlan } from '../../../scene/types.js';

const loopPlan: SheepLoopPlan = {
    phaseOffsetSec: 0,
    segments: [
        {
            kind: 'walk',
            startSec: 0,
            endSec: 1,
            progressStart: 0,
            progressEnd: 0.5,
        },
        {
            kind: 'graze',
            startSec: 1,
            endSec: 3,
            progressStart: 0.5,
            progressEnd: 0.5,
        },
        {
            kind: 'idle',
            startSec: 3,
            endSec: 4,
            progressStart: 0.5,
            progressEnd: 0.5,
        },
        {
            kind: 'walk',
            startSec: 4,
            endSec: 5,
            progressStart: 0.5,
            progressEnd: 1,
        },
    ],
};

const routeMetrics = buildRouteMetrics([
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(0, 1, 0),
]);

const poseAt = (sceneTimeSec: number): SheepPose =>
    calculateSheepPose({
        sceneTimeSec,
        loopDurationSec: 5,
        loopPlan,
        routeMetrics,
        gaitPhaseOffset: 0.3,
        idlePhaseOffset: 0.2,
        grazePhaseOffset: 0.1,
    });

describe('calculateSheepPose', () => {
    it('wraps exactly at the loop boundary', () => {
        const start = poseAt(0);
        const end = poseAt(5);
        expect(end.position.toArray()).toEqual(start.position.toArray());
        expect(end.state).toBe(start.state);
        expect(end.legRotations).toEqual(start.legRotations);
    });

    it('returns finite pose values for walk, graze, and idle times', () => {
        for (const time of [0.5, 2, 3.5, 4.5]) {
            const pose = poseAt(time);
            const values = [
                ...pose.position.toArray(),
                ...pose.legRotations,
                pose.bodyY,
                pose.headRotX,
                pose.headRigY,
                pose.headRigZ,
            ];
            expect(values.every(Number.isFinite)).toBe(true);
        }
        expect(poseAt(2).state).toBe('graze');
        expect(poseAt(3.5).state).toBe('idle');
    });

    it('keeps position and pose continuous around segment boundaries', () => {
        const before = poseAt(0.999);
        const after = poseAt(1.001);
        expect(before.position.distanceTo(after.position)).toBeLessThan(0.01);
        expect(Math.abs(before.bodyY - after.bodyY)).toBeLessThan(0.05);
        expect(Math.abs(before.headRotX - after.headRotX)).toBeLessThan(0.1);
    });
});
