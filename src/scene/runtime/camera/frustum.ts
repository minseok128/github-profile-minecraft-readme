import type * as THREE from 'three';

export interface OrthographicFrustum {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export const calculateOrthographicFrustum = ({
    width,
    height,
    fitHalfWidth,
    fitHalfHeight,
}: {
    width: number;
    height: number;
    fitHalfWidth: number;
    fitHalfHeight: number;
}): OrthographicFrustum => {
    const aspect = Math.max(width, 1) / Math.max(height, 1);
    const halfHeight = Math.max(fitHalfHeight, fitHalfWidth / aspect);
    const halfWidth = halfHeight * aspect;
    return {
        left: -halfWidth,
        right: halfWidth,
        top: halfHeight,
        bottom: -halfHeight,
    };
};

export const updateCameraFrustum = (
    camera: THREE.OrthographicCamera,
    width: number,
    height: number,
): void => {
    const frustum = calculateOrthographicFrustum({
        width,
        height,
        fitHalfWidth:
            (camera.userData.fitHalfWidth as number | undefined) ?? 12,
        fitHalfHeight:
            (camera.userData.fitHalfHeight as number | undefined) ?? 12,
    });
    camera.left = frustum.left;
    camera.right = frustum.right;
    camera.top = frustum.top;
    camera.bottom = frustum.bottom;
    camera.updateProjectionMatrix();
};
