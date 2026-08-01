import type { CreatureId } from './registry-ids.js';
import type { SceneAssetKey } from './assets.js';
import { buildSheepPopulationPlans } from './sheep/planner.js';
import type { CalendarMetric, SceneEntityBatch } from './types.js';

export interface CreaturePlanningContext {
    calendarMetrics: Array<CalendarMetric>;
    loopDurationSec: number;
}

export type CreaturePlanner = (
    context: CreaturePlanningContext,
) => SceneEntityBatch;

const SHEEP_TARGET_HEIGHT_BLOCKS = 1.3;

export const CREATURE_PLANNERS = {
    sheep: ({
        calendarMetrics,
        loopDurationSec,
    }: CreaturePlanningContext): SceneEntityBatch => ({
        kind: 'sheep',
        targetHeight: SHEEP_TARGET_HEIGHT_BLOCKS,
        plans: buildSheepPopulationPlans(calendarMetrics, loopDurationSec),
    }),
} satisfies Record<CreatureId, CreaturePlanner>;

export const CREATURE_ASSET_KEYS = {
    sheep: ['sheepBase', 'sheepFur'],
} satisfies Record<CreatureId, ReadonlyArray<SceneAssetKey>>;
