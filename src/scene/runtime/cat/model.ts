import * as THREE from 'three';
import { unit } from './constants.js';
import { makeTexturedBox, setBedrockBoxUv } from '../sheep/model.js';

export { makeTexturedBox, setBedrockBoxUv };

export interface CatModel {
    root: THREE.Group;
    legPivots: [THREE.Group, THREE.Group, THREE.Group, THREE.Group]; // FL, FR, BL, BR
    bodyGroup: THREE.Group;
    headPivot: THREE.Group;
    tail1Pivot: THREE.Group;
    tail2Pivot: THREE.Group;
    shadow: THREE.Mesh;
}

export const createCatMaterial = (map: THREE.Texture): THREE.MeshStandardMaterial => {
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
        map,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        alphaTest: 0.08,
    });
};

export const buildCat = (
    material: THREE.MeshStandardMaterial,
    targetHeight: number,
): Omit<CatModel, 'shadow'> => {
    const root = new THREE.Group();

    // Minecraft cat UV layout on 64x32 texture:
    // Head [5,4,5]  UV(0,0)   — top-left
    // Body [4,8,6]  UV(20,0)  — centre-right
    // Front legs [2,6,2] UV(40,0) — right of body
    // Back legs  [2,6,2] UV(8,13) — below head
    // Tail [1,8,1] UV(0,15)  — lower-left

    // --- Legs ---
    const legLength = 6 * unit;
    const legOffsets: Array<{ x: number; z: number; uv: [number, number] }> = [
        { x: -1 * unit, z: -3 * unit, uv: [40, 0] }, // FL
        { x: 1 * unit, z: -3 * unit, uv: [40, 0] },  // FR
        { x: -1 * unit, z: 3 * unit, uv: [8, 13] },  // BL
        { x: 1 * unit, z: 3 * unit, uv: [8, 13] },   // BR
    ];

    const legPivotRaw: THREE.Group[] = legOffsets.map(({ x, z, uv }) => {
        const pivot = new THREE.Group();
        pivot.position.set(x, legLength, z);

        const leg = makeTexturedBox([2, 6, 2], uv, material, 64, 32);
        leg.position.y = -3 * unit;
        pivot.add(leg);

        root.add(pivot);
        return pivot;
    });

    const legPivots = legPivotRaw as [THREE.Group, THREE.Group, THREE.Group, THREE.Group];

    // --- Body (long and slim, rotated -90° on X like sheep) ---
    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = legLength + 2 * unit;
    bodyGroup.rotation.x = -Math.PI / 2;
    root.add(bodyGroup);

    const body = makeTexturedBox([4, 8, 6], [20, 0], material, 64, 32);
    bodyGroup.add(body);

    // --- Head ---
    const headPivot = new THREE.Group();
    headPivot.position.set(0, legLength + 4 * unit, -5 * unit);
    root.add(headPivot);

    const head = makeTexturedBox([5, 4, 5], [0, 0], material, 64, 32);
    headPivot.add(head);

    // --- Tail (two segments like Bedrock: tail1 + tail2) ---
    // Bedrock: tail extends backward (+Z in world), pivots at body rear.
    // tail1Pivot base rotation: -60°X so tail points up-and-back (resting pose).
    // Tail sway is on rotation.z (left-right), raise/lower on rotation.x.
    const tail1Pivot = new THREE.Group();
    tail1Pivot.position.set(0, legLength + 4 * unit, 5 * unit);
    tail1Pivot.rotation.x = Math.PI / 3; // ~60° tilted backward (away from head)
    root.add(tail1Pivot);

    const tail1 = makeTexturedBox([1, 5, 1], [0, 15], material, 64, 32);
    tail1.position.y = 2.5 * unit;
    tail1Pivot.add(tail1);

    // tail2 is a child of tail1, extending from the end of tail1
    const tail2Pivot = new THREE.Group();
    tail2Pivot.position.y = 5 * unit;
    tail1Pivot.add(tail2Pivot);

    const tail2 = makeTexturedBox([1, 5, 1], [0, 15], material, 64, 32);
    tail2.position.y = 2.5 * unit;
    tail2Pivot.add(tail2);

    // Scale to target height
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    root.scale.setScalar(targetHeight / size.y);

    return { root, legPivots, bodyGroup, headPivot, tail1Pivot, tail2Pivot };
};

export const createCatInstance = (
    scene: THREE.Scene,
    catTexture: THREE.Texture,
    targetHeight: number,
): Omit<CatModel, never> => {
    const material = createCatMaterial(catTexture);
    const cat = buildCat(material, targetHeight);

    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 24),
        new THREE.MeshBasicMaterial({
            color: '#000000',
            transparent: true,
            opacity: 0.16,
        }),
    );
    shadow.rotation.x = -Math.PI / 2;

    scene.add(cat.root);
    scene.add(shadow);

    return { ...cat, shadow };
};
