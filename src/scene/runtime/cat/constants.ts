import * as THREE from 'three';

export const unit = 1 / 16;

// --- Walk animation ---
// Bedrock: cos(distance * 38.17) * 57.3 * moveSpeed
// In our system, distance is in world units (blocks). We use the same
// approach as sheep (distance * frequency_multiplier) which is proven to work.
// Sheep uses 7.6; cat walks faster so we use 8.5 for quicker leg cycles.
export const CAT_WALK_GAIT_FREQUENCY = 8.5;
// Bedrock amplitude: 57.3 * 0.7 ≈ 40 degrees. Reduced to 22deg for our scale
// to avoid overly exaggerated leg spread at small cat size.
export const CAT_WALK_LEG_AMPLITUDE_DEG = 22;

// Tail during walk: tail1 fixed raised, tail2 sways
export const CAT_WALK_TAIL1_ROT = THREE.MathUtils.degToRad(-45);
export const CAT_WALK_TAIL2_BASE_DEG = 55;
export const CAT_WALK_TAIL2_AMPLITUDE_DEG = 25;

// --- Sit animation (from Bedrock cat.animation.json) ---
export const CAT_SIT_BODY_ROT_DEG = -45;
export const CAT_SIT_BODY_DROP = 1 * unit;
export const CAT_SIT_FRONT_LEG_ROT_DEG = 42.15;
export const CAT_SIT_BACK_LEG_ROT_DEG = -45;
export const CAT_SIT_TAIL1_ROT_DEG = 45;
export const CAT_SIT_TAIL2_ROT_DEG = 45;
export const CAT_SIT_HEAD_DROP = 1.25 * unit;

// --- Lie down animation (from Bedrock cat.animation.json) ---
// Body rolls to side (Z rotation lerps to 90deg), drops Y by 4.5 pixels
export const CAT_LIE_BODY_Z_ROT_DEG = 90;
export const CAT_LIE_BODY_DROP = 4.5 * unit;
// Legs in relaxed positions
export const CAT_LIE_FRONT_L_ROT_DEG = -72.81;
export const CAT_LIE_FRONT_R_ROT_DEG = -30;
export const CAT_LIE_BACK_L_ROT_DEG = -22.92;
export const CAT_LIE_BACK_R_ROT_DEG = 28.65;
export const CAT_LIE_BACK_R_Z_ROT_DEG = -28.65;
export const CAT_LIE_FRONT_R_Z_ROT_DEG = -14.46;
// Head turns to side
export const CAT_LIE_HEAD_X_ROT_DEG = -10;
export const CAT_LIE_HEAD_Y_ROT_DEG = 75.81;
// Tail curls
export const CAT_LIE_TAIL1_ROT_DEG = -33.84;
export const CAT_LIE_TAIL2_ROT_DEG = -68.92;

// --- Sneak animation (from Bedrock cat.animation.json) ---
// Body and head drop 1 pixel, legs raise 1 pixel, same walk formula
export const CAT_SNEAK_BODY_DROP = 1 * unit;
export const CAT_SNEAK_HEAD_DROP = 1 * unit;
// Tail2: 62 + cos(distance * 57.3) * 27 * speed
export const CAT_SNEAK_TAIL2_AMPLITUDE_DEG = 27 * 0.5; // slower speed

// --- Sprint animation (from Bedrock cat.animation.json) ---
// Faster leg cycle, slightly offset phases for gallop effect
// backlegr offset: +17.19 degrees phase, frontlegl offset: +197.19 degrees
export const CAT_SPRINT_GAIT_FREQUENCY = 12; // faster than walk
export const CAT_SPRINT_LEG_AMPLITUDE_DEG = 32; // larger than walk but scaled down
// Tail2: 62 + cos(distance * 57.3) * 18 * speed (tighter tail)
export const CAT_SPRINT_TAIL2_AMPLITUDE_DEG = 18 * 0.8;
// Gallop phase offsets (in radians) from Bedrock
export const CAT_SPRINT_BR_PHASE_OFFSET = THREE.MathUtils.degToRad(17.19);
export const CAT_SPRINT_FL_PHASE_OFFSET = THREE.MathUtils.degToRad(197.19);

