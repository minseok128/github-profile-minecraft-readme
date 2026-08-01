import * as THREE from 'three';
import type { SceneEntityBatch } from '../types.js';
import { buildSheepRuntime } from './sheep/index.js';
import type { LoadedSceneTextures, SceneEntityStateSnapshot } from './types.js';

export interface CreatureRuntimeContext {
    scene: THREE.Scene;
    gifDurationSec: number;
    textures: LoadedSceneTextures;
}

export interface CreatureRuntimeController {
    kind: SceneEntityBatch['kind'];
    entityCount: number;
    viewBounds: Array<THREE.Box3>;
    applyAtTime: (sceneTimeSec: number) => void;
    getStateSnapshot: () => Array<SceneEntityStateSnapshot>;
}

export type CreatureRuntimeFactory = (
    batch: SceneEntityBatch,
    context: CreatureRuntimeContext,
) => CreatureRuntimeController;

export const CREATURE_RUNTIMES = {
    sheep: (
        batch: SceneEntityBatch,
        context: CreatureRuntimeContext,
    ): CreatureRuntimeController => {
        const runtime = buildSheepRuntime({
            scene: context.scene,
            batch,
            gifDurationSec: context.gifDurationSec,
            textures: context.textures,
        });
        return {
            kind: batch.kind,
            entityCount: batch.plans.length,
            viewBounds: batch.plans.flatMap((plan) =>
                plan.route.map(
                    (point) =>
                        new THREE.Box3(
                            new THREE.Vector3(
                                point.week - 0.45,
                                point.worldHeight,
                                point.dayOfWeek - 0.45,
                            ),
                            new THREE.Vector3(
                                point.week + 0.45,
                                point.worldHeight + batch.targetHeight,
                                point.dayOfWeek + 0.45,
                            ),
                        ),
                ),
            ),
            applyAtTime: runtime.applyAtTime,
            getStateSnapshot: runtime.getStateSnapshot,
        };
    },
} satisfies Record<SceneEntityBatch['kind'], CreatureRuntimeFactory>;
