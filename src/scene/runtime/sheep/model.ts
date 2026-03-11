import * as THREE from 'three';
import { unit } from './constants.js';

export interface SheepModel {
    root: THREE.Group;
    legPivots: Array<THREE.Group>;
    bodyGroup: THREE.Group;
    headPivot: THREE.Group;
    headNeck: THREE.Group;
    headRig: THREE.Group;
    shadow: THREE.Mesh;
}

export const createSheepMaterial = (map: THREE.Texture): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
        map,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        alphaTest: 0.08,
    });

export const setBedrockBoxUv = (
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

export const makeTexturedBox = (
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

export const buildSheep = (
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

export const createSheepInstance = (
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
