import * as THREE from 'three';

const getBoundsCorners = (bounds: THREE.Box3): Array<THREE.Vector3> => {
    const min = bounds.min;
    const max = bounds.max;
    return [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z),
    ];
};

const accumulateViewPoint = (
    camera: THREE.OrthographicCamera,
    point: THREE.Vector3,
    extents: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    },
): void => {
    const viewPoint = point.clone().applyMatrix4(camera.matrixWorldInverse);
    extents.minX = Math.min(extents.minX, viewPoint.x);
    extents.maxX = Math.max(extents.maxX, viewPoint.x);
    extents.minY = Math.min(extents.minY, viewPoint.y);
    extents.maxY = Math.max(extents.maxY, viewPoint.y);
};

export const fitCameraToBounds = ({
    camera,
    scene,
    ground,
    isoDirection,
    cameraFitPadding,
    blocks,
    floraDecorations,
    entityBounds,
    contentBounds,
}: {
    camera: THREE.OrthographicCamera;
    scene: THREE.Scene;
    ground: THREE.Mesh;
    isoDirection: THREE.Vector3;
    cameraFitPadding: number;
    blocks: Array<THREE.Object3D>;
    floraDecorations: Array<THREE.Object3D>;
    entityBounds: Array<THREE.Box3>;
    contentBounds: THREE.Box3;
}): void => {
    const center = contentBounds.getCenter(new THREE.Vector3());
    const size = contentBounds.getSize(new THREE.Vector3());
    const distance = Math.max(size.x, size.z) * 1.65 + 14;
    camera.position.copy(
        center.clone().add(isoDirection.clone().multiplyScalar(distance)),
    );
    camera.lookAt(center);
    camera.near = 0.1;
    camera.far = distance * 4;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = distance * 0.55;
        scene.fog.far = distance * 1.75;
    }

    const extents = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
    };
    const tempBounds = new THREE.Box3();

    blocks.forEach((block) => {
        tempBounds.setFromObject(block);
        getBoundsCorners(tempBounds).forEach((corner) =>
            accumulateViewPoint(camera, corner, extents),
        );
    });
    floraDecorations.forEach((floraDecoration) => {
        tempBounds.setFromObject(floraDecoration);
        getBoundsCorners(tempBounds).forEach((corner) =>
            accumulateViewPoint(camera, corner, extents),
        );
    });
    entityBounds.forEach((bounds) => {
        getBoundsCorners(bounds).forEach((corner) =>
            accumulateViewPoint(camera, corner, extents),
        );
    });

    camera.userData.fitHalfWidth =
        (extents.maxX - extents.minX) * 0.5 * cameraFitPadding;
    camera.userData.fitHalfHeight =
        (extents.maxY - extents.minY) * 0.5 * cameraFitPadding;
    camera.userData.focusCenter = center.toArray();
    ground.scale.set(size.x + 6, size.z + 6, 1);
    ground.position.set(center.x, 0, center.z);
};
