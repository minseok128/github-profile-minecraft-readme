import * as THREE from 'three';

export const unit = 1 / 16;
export const sheepBodyBaseY = 15 * unit;
export const sheepHeadBaseY = 18 * unit;
export const sheepHeadBaseZ = -8 * unit;
export const sheepHeadNeutralRotation = THREE.MathUtils.degToRad(-10);
export const sheepHeadRigBaseY = 0;
export const sheepHeadRigBaseZ = 0;
export const grazeAnimationLengthSec = 2.0;
export const grazeHeadRigLowerAmount = 9 * unit;
export const grazeHeadBaseRotation = THREE.MathUtils.degToRad(-36);
export const grazeHeadChewAmplitude = THREE.MathUtils.degToRad(10);
export const grazeHeadChewDropAmount = 0.5 * unit;
