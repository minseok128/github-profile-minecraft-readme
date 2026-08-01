import type { ContributionLevel } from '../profile/types.js';

export interface CalendarMetric {
    contributionCount: number;
    contributionLevel: ContributionLevel;
    date: string;
    week: number;
    dayOfWeek: number;
    worldHeight: number;
}

export interface GrassWorldCell {
    contributionLevel: ContributionLevel;
    week: number;
    dayOfWeek: number;
    worldHeight: number;
}

export interface SheepColorDefinition {
    name:
        | 'white'
        | 'orange'
        | 'magenta'
        | 'light_blue'
        | 'yellow'
        | 'lime'
        | 'pink'
        | 'cyan'
        | 'purple'
        | 'blue'
        | 'green'
        | 'red'
        | 'gray'
        | 'light_gray'
        | 'brown'
        | 'black';
    hex: string;
    weight: number;
}

export interface SheepLoopSegment {
    kind: 'walk' | 'idle' | 'graze';
    startSec: number;
    endSec: number;
    progressStart: number;
    progressEnd: number;
}

export interface SheepLoopPlan {
    phaseOffsetSec: number;
    segments: Array<SheepLoopSegment>;
}

export interface SheepSpawnPlan {
    islandId: number;
    sheepIndex: number;
    islandSheepCount: number;
    colorName: SheepColorDefinition['name'];
    colorHex: string;
    route: Array<GrassWorldCell>;
    loopPlan: SheepLoopPlan;
}

export interface SheepEntityBatch {
    kind: 'sheep';
    targetHeight: number;
    plans: Array<SheepSpawnPlan>;
}

export type SceneEntityBatch = SheepEntityBatch;
