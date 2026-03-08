import * as THREE from 'three';
import type {
    SheepLoopPlan,
    SheepLoopSegment,
} from '../../../types.js';
import type {
    LoadedSceneTextures,
    SceneData,
    SheepStateSnapshot,
} from '../types.js';

type SheepState = 'walk' | 'idle' | 'graze';

interface RouteMetrics {
    points: Array<THREE.Vector3>;
    cumulativeDistances: Array<number>;
    totalLength: number;
}

interface SheepModel {
    root: THREE.Group;
    legPivots: Array<THREE.Group>;
    bodyGroup: THREE.Group;
    headPivot: THREE.Group;
    headNeck: THREE.Group;
    headRig: THREE.Group;
    shadow: THREE.Mesh;
}

export interface SheepInstance extends SheepModel {
    islandId: number;
    sheepIndex: number;
    islandSheepCount: number;
    route: Array<THREE.Vector3>;
    routeMetrics: RouteMetrics;
    loopPlan: SheepLoopPlan;
    gaitPhaseOffset: number;
    idlePhaseOffset: number;
    grazePhaseOffset: number;
    state: SheepState;
    routeIndex: number;
}

interface DominantSegmentState {
    mix: number;
    segment: SheepLoopSegment | null;
}

export interface SheepRuntimeController {
    sheepInstances: Array<SheepInstance>;
    applyAtTime: (sceneTimeSec: number) => void;
    getStateSnapshot: () => Array<SheepStateSnapshot>;
}

const unit = 1 / 16;
const sheepBodyBaseY = 15 * unit;
const sheepHeadBaseY = 18 * unit;
const sheepHeadBaseZ = -8 * unit;
const sheepHeadNeutralRotation = THREE.MathUtils.degToRad(-10);
const sheepHeadRigBaseY = 0;
const sheepHeadRigBaseZ = 0;
const grazeAnimationLengthSec = 2.0;
const grazeHeadRigLowerAmount = 9 * unit;
const grazeHeadBaseRotation = THREE.MathUtils.degToRad(-36);
const grazeHeadChewAmplitude = THREE.MathUtils.degToRad(10);
const grazeHeadChewDropAmount = 0.5 * unit;

const createSheepMaterial = (map: THREE.Texture): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
        map,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        alphaTest: 0.08,
    });

const setBedrockBoxUv = (
    geometry: THREE.BoxGeometry,
    uvOrigin: [number, number],
    sizePx: [number, number, number],
    textureWidth = 64,
    textureHeight = 32,
): void => {
    const [u, v] = uvOrigin;
    const [sx, sy, sz] = sizePx;
    const rect = {
        left: [u, v + sz, sz, sy],
        front: [u + sz, v + sz, sx, sy],
        right: [u + sz + sx, v + sz, sz, sy],
        back: [u + sz + sx + sz, v + sz, sx, sy],
        top: [u + sz, v, sx, sz],
        bottom: [u + sz + sx, v, sx, sz],
    } as const;

    const faceOrder = ['right', 'left', 'top', 'bottom', 'back', 'front'] as const;
    const uvAttr = geometry.attributes.uv;

    faceOrder.forEach((face, faceIndex) => {
        const [x, y, w, h] = rect[face];
        const u0 = x / textureWidth;
        const u1 = (x + w) / textureWidth;
        const v0 = 1 - (y + h) / textureHeight;
        const v1 = 1 - y / textureHeight;
        const flipX =
            face === 'right' ||
            face === 'back' ||
            face === 'top' ||
            face === 'bottom';
        const ua = flipX ? u1 : u0;
        const ub = flipX ? u0 : u1;
        const index = faceIndex * 4;
        uvAttr.setXY(index + 0, ua, v1);
        uvAttr.setXY(index + 1, ub, v1);
        uvAttr.setXY(index + 2, ua, v0);
        uvAttr.setXY(index + 3, ub, v0);
    });

    uvAttr.needsUpdate = true;
};

const makeTexturedBox = (
    sizePx: [number, number, number],
    uvOrigin: [number, number],
    material: THREE.MeshStandardMaterial,
    textureWidth = 64,
    textureHeight = 32,
    scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(
        sizePx[0] * unit,
        sizePx[1] * unit,
        sizePx[2] * unit,
    );
    setBedrockBoxUv(geometry, uvOrigin, sizePx, textureWidth, textureHeight);
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

const buildSheep = (
    sheepBaseMaterial: THREE.MeshStandardMaterial,
    sheepFurMaterial: THREE.MeshStandardMaterial,
    sheepTargetHeight: number,
): Omit<SheepModel, 'shadow'> => {
    const root = new THREE.Group();
    const legLength = 12 * unit;
    const legPivots: Array<THREE.Group> = [];
    const legOffsets: Array<[number, number]> = [
        [-3 * unit, 7 * unit],
        [3 * unit, 7 * unit],
        [-3 * unit, -5 * unit],
        [3 * unit, -5 * unit],
    ];

    legOffsets.forEach(([x, z]) => {
        const pivot = new THREE.Group();
        pivot.position.set(x, legLength, z);

        const shearedLeg = makeTexturedBox([4, 12, 4], [0, 16], sheepBaseMaterial);
        shearedLeg.position.y = -6 * unit;
        pivot.add(shearedLeg);

        const woolLeg = makeTexturedBox(
            [4, 6, 4],
            [0, 16],
            sheepFurMaterial,
            64,
            32,
            [5 / 4, 7 / 6, 5 / 4],
        );
        woolLeg.position.y = -3 * unit;
        pivot.add(woolLeg);

        root.add(pivot);
        legPivots.push(pivot);
    });

    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = legLength + 3 * unit;
    bodyGroup.rotation.x = -Math.PI / 2;
    root.add(bodyGroup);

    bodyGroup.add(makeTexturedBox([8, 16, 6], [28, 8], sheepBaseMaterial));
    bodyGroup.add(
        makeTexturedBox(
            [8, 16, 6],
            [28, 8],
            sheepFurMaterial,
            64,
            32,
            [11.5 / 8, 19.5 / 16, 9.5 / 6],
        ),
    );

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 18 * unit, -8 * unit);
    root.add(headPivot);

    const headRig = new THREE.Group();
    headPivot.add(headRig);

    const headNeck = new THREE.Group();
    headNeck.position.set(0, 2.5 * unit, 1.75 * unit);
    headRig.add(headNeck);

    const headModel = new THREE.Group();
    headModel.position.set(0, -2.5 * unit, -1.75 * unit);
    headNeck.add(headModel);

    const headSheared = makeTexturedBox([6, 6, 8], [0, 0], sheepBaseMaterial);
    headSheared.position.set(0, 1 * unit, -2 * unit);
    headModel.add(headSheared);

    const headWool = makeTexturedBox(
        [6, 6, 6],
        [0, 0],
        sheepFurMaterial,
        64,
        32,
        [1.2, 1.2, 1.2],
    );
    headWool.position.set(0, 1 * unit, -1 * unit);
    headModel.add(headWool);

    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    root.scale.setScalar(sheepTargetHeight / size.y);

    return { root, legPivots, bodyGroup, headPivot, headNeck, headRig };
};

const createSheepInstance = (
    scene: THREE.Scene,
    colorHex: string,
    sheepBaseMaterial: THREE.MeshStandardMaterial,
    sheepFurMaterial: THREE.MeshStandardMaterial,
    sheepFurTexture: THREE.Texture,
    sheepTargetHeight: number,
): SheepModel => {
    const sheep = buildSheep(
        sheepBaseMaterial,
        sheepFurMaterial,
        sheepTargetHeight,
    );
    sheep.root.traverse((node: THREE.Object3D) => {
        if (!(node instanceof THREE.Mesh) || Array.isArray(node.material)) {
            return;
        }
        if (!(node.material instanceof THREE.MeshStandardMaterial)) {
            return;
        }
        if (node.material.map !== sheepFurTexture) {
            return;
        }

        const tintedMaterial = node.material.clone();
        tintedMaterial.color = new THREE.Color(colorHex);
        node.material = tintedMaterial;
    });

    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.58, 28),
        new THREE.MeshBasicMaterial({
            color: '#000000',
            transparent: true,
            opacity: 0.16,
        }),
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(sheep.root);
    scene.add(shadow);

    return {
        ...sheep,
        shadow,
    };
};

const wrapLoopTime = (timeSec: number, loopDurationSec: number): number => {
    const wrapped = timeSec % loopDurationSec;
    return wrapped < 0 ? wrapped + loopDurationSec : wrapped;
};

const smootherstep01 = (value: number): number => {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
};

const buildRouteMetrics = (points: Array<THREE.Vector3>): RouteMetrics => {
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

const sampleRouteAtProgress = (
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

const findActiveLoopSegment = (
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

const getDominantSegment = (
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
