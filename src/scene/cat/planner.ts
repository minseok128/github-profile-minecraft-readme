import type {
    CalendarMetric,
    CatLoopPlan,
    CatLoopSegment,
    CatSpawnPlan,
    GrassWorldCell,
} from '../../types.js';
import { hashString, mulberry32 } from '../../utils.js';
import { findGrassIslands, chooseWalkPath } from '../sheep/islands.js';

const CAT_WALK_SPEED = 1.8;
const CAT_SNEAK_SPEED = 1.0;
const CAT_SPRINT_SPEED = 2.8;
const CAT_SIT_DURATION_MIN = 1.0;
const CAT_SIT_DURATION_MAX = 2.0;
const CAT_IDLE_DURATION_MIN = 0.3;
const CAT_IDLE_DURATION_MAX = 0.8;
const CAT_WALK_DURATION_MIN = 1.5;
const CAT_WALK_DURATION_MAX = 3.0;
const CAT_SNEAK_DURATION_MIN = 1.0;
const CAT_SNEAK_DURATION_MAX = 2.0;
const CAT_SPRINT_DURATION_MIN = 0.8;
const CAT_SPRINT_DURATION_MAX = 1.5;
const MIN_LOOP_DURATION_SEC = 1.5;

const randBetween = (random: () => number, min: number, max: number): number =>
    min + random() * (max - min);

const buildCatLoopPlan = (
    route: ReadonlyArray<GrassWorldCell>,
    gifDurationSec: number,
    seedText: string,
): CatLoopPlan => {
    const durationSec = Math.max(MIN_LOOP_DURATION_SEC, gifDurationSec);
    const random = mulberry32(hashString(seedText));
    // phaseOffsetSec = 0 so the cat starts in sit (loaf) pose at t=0.
    // Consume one random call to keep the seed sequence consistent.
    random();
    const phaseOffsetSec = 0;

    if (route.length <= 1) {
        return {
            phaseOffsetSec,
            segments: [
                {
                    kind: 'sit' as const,
                    startSec: 0,
                    endSec: durationSec,
                    progressStart: 0,
                    progressEnd: 0,
                },
            ],
        };
    }

    const segments: Array<CatLoopSegment> = [];
    let cursor = 0;
    let currentProgress = 0;
    let direction = 1; // 1 = forward, -1 = backward along route

    // Start with lie down so the initial frame shows a relaxed cat.
    // Minimum 2s to ensure the lie pose is clearly visible before transitioning.
    const initialLieDuration = Math.min(
        durationSec * 0.25,
        randBetween(random, 2.0, 3.0),
    );
    segments.push({
        kind: 'lie',
        startSec: 0,
        endSec: initialLieDuration,
        progressStart: 0,
        progressEnd: 0,
    });
    cursor = initialLieDuration;

    // Insert a short idle after lie to avoid jarring leg transition.
    // The lie→idle crossfade lets the cat stand up naturally before walking.
    const standUpDuration = 0.6;
    if (cursor + standUpDuration < durationSec) {
        segments.push({
            kind: 'idle',
            startSec: cursor,
            endSec: cursor + standUpDuration,
            progressStart: 0,
            progressEnd: 0,
        });
        cursor += standUpDuration;
    }

    while (cursor < durationSec - 0.01) {
        const remaining = durationSec - cursor;

        // Cats: 40% walk, 15% sneak, 10% sprint, 20% sit, 15% idle
        const roll = random();
        const kind: CatLoopSegment['kind'] =
            roll < 0.40 ? 'walk'
            : roll < 0.55 ? 'sneak'
            : roll < 0.65 ? 'sprint'
            : roll < 0.85 ? 'sit'
            : 'idle';

        let segDuration: number;
        if (kind === 'walk') {
            segDuration = Math.min(
                remaining,
                randBetween(random, CAT_WALK_DURATION_MIN, CAT_WALK_DURATION_MAX),
            );
        } else if (kind === 'sneak') {
            segDuration = Math.min(
                remaining,
                randBetween(random, CAT_SNEAK_DURATION_MIN, CAT_SNEAK_DURATION_MAX),
            );
        } else if (kind === 'sprint') {
            segDuration = Math.min(
                remaining,
                randBetween(random, CAT_SPRINT_DURATION_MIN, CAT_SPRINT_DURATION_MAX),
            );
        } else if (kind === 'sit') {
            segDuration = Math.min(
                remaining,
                randBetween(random, CAT_SIT_DURATION_MIN, CAT_SIT_DURATION_MAX),
            );
        } else {
            segDuration = Math.min(
                remaining,
                randBetween(random, CAT_IDLE_DURATION_MIN, CAT_IDLE_DURATION_MAX),
            );
        }

        segDuration = Math.max(segDuration, 0.1);

        let progressEnd: number;
        if (kind === 'walk' || kind === 'sneak' || kind === 'sprint') {
            const speed = kind === 'sprint' ? CAT_SPRINT_SPEED
                : kind === 'sneak' ? CAT_SNEAK_SPEED
                : CAT_WALK_SPEED;
            const moveDistance = speed * segDuration;
            const progressAdvance = moveDistance / Math.max(1, route.length - 1);

            // Ping-pong: reverse direction when hitting route ends
            let targetProgress = currentProgress + progressAdvance * direction;
            if (targetProgress > 1) {
                targetProgress = 1;
                direction = -1;
            } else if (targetProgress < 0) {
                targetProgress = 0;
                direction = 1;
            }
            progressEnd = targetProgress;
        } else {
            progressEnd = currentProgress;
        }

        segments.push({
            kind,
            startSec: cursor,
            endSec: cursor + segDuration,
            progressStart: currentProgress,
            progressEnd,
        });

        currentProgress = progressEnd;
        cursor += segDuration;
    }

    // Ensure the cat returns to progress 0 for seamless loop.
    // If the last segment ends away from the start, insert a walk-back segment.
    if (currentProgress > 0.01) {
        const lastSeg = segments[segments.length - 1];
        const returnDistance = currentProgress * Math.max(1, route.length - 1);
        const returnDuration = returnDistance / CAT_WALK_SPEED;
        // Steal time from the last segment if needed, or extend slightly
        const availableTime = durationSec - cursor;
        if (availableTime > 0.05) {
            const walkBackDuration = Math.min(availableTime, returnDuration);
            const actualProgress = (CAT_WALK_SPEED * walkBackDuration) / Math.max(1, route.length - 1);
            const endProgress = Math.max(0, currentProgress - actualProgress);
            segments.push({
                kind: 'walk',
                startSec: cursor,
                endSec: cursor + walkBackDuration,
                progressStart: currentProgress,
                progressEnd: endProgress,
            });
            cursor += walkBackDuration;
            currentProgress = endProgress;
        } else if (lastSeg.kind === 'sit' || lastSeg.kind === 'idle' || lastSeg.kind === 'lie') {
            // Shorten last stationary segment to make room for return walk
            const shrinkBy = Math.min(lastSeg.endSec - lastSeg.startSec - 0.1, returnDuration);
            if (shrinkBy > 0.1) {
                const newEndSec = lastSeg.endSec - shrinkBy;
                // Replace the last segment with a shortened copy
                segments[segments.length - 1] = {
                    ...lastSeg,
                    endSec: newEndSec,
                };
                const walkStart = newEndSec;
                const walkBackDuration = shrinkBy;
                const actualProgress = (CAT_WALK_SPEED * walkBackDuration) / Math.max(1, route.length - 1);
                const endProgress = Math.max(0, currentProgress - actualProgress);
                segments.push({
                    kind: 'walk',
                    startSec: walkStart,
                    endSec: walkStart + walkBackDuration,
                    progressStart: currentProgress,
                    progressEnd: endProgress,
                });
                currentProgress = endProgress;
            }
        }
    }

    return { phaseOffsetSec, segments };
};

export const buildCatPopulationPlans = (
    calendarMetrics: ReadonlyArray<CalendarMetric>,
    gifDurationSec: number,
): Array<CatSpawnPlan> => {
    const cells: Array<GrassWorldCell> = calendarMetrics.map((m) => ({
        contributionLevel: m.contributionLevel,
        week: m.week,
        dayOfWeek: m.dayOfWeek,
        worldHeight: m.worldHeight,
    }));

    const islands = findGrassIslands(cells);
    if (islands.length === 0) {
        return [];
    }

    // Sort by descending size; pick largest island
    const sorted = [...islands].sort((a, b) => b.cells.length - a.cells.length);
    const island = sorted[0];

    if (island.cells.length === 0) {
        return [];
    }

    // Pick a spawn cell deterministically via hashString, biased toward edges
    const sortedCells = [...island.cells].sort(
        (a, b) => a.week - b.week || a.dayOfWeek - b.dayOfWeek,
    );
    const avgWeek =
        sortedCells.reduce((sum, c) => sum + c.week, 0) / sortedCells.length;
    const avgDay =
        sortedCells.reduce((sum, c) => sum + c.dayOfWeek, 0) / sortedCells.length;

    const scored = sortedCells.map((cell, index) => ({
        cell,
        index,
        distFromCenter: Math.hypot(cell.week - avgWeek, cell.dayOfWeek - avgDay),
    }));
    scored.sort((a, b) => b.distFromCenter - a.distFromCenter);

    const topQuarterCount = Math.max(1, Math.floor(scored.length / 4));
    const topCandidates = scored.slice(0, topQuarterCount);
    const pickIndex = hashString(`cat:${island.id}:${island.cells.length}`) % topCandidates.length;
    const spawnCell = topCandidates[pickIndex].cell;

    // 10-cell route for compact movement
    const maxRouteDistance = 10;
    const directionOffset = hashString(`cat:dir:${island.id}`) % 4;
    const route = chooseWalkPath(
        island.cells,
        spawnCell,
        directionOffset,
        maxRouteDistance,
    );

    const loopPlan = buildCatLoopPlan(
        route,
        gifDurationSec,
        `cat:loop:${island.id}:${island.cells.length}`,
    );

    return [
        {
            islandId: island.id,
            catIndex: 0,
            route,
            loopPlan,
        },
    ];
};
