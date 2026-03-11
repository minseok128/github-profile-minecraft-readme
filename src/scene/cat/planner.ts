import type {
    CalendarMetric,
    CatLoopPlan,
    CatLoopSegment,
    CatSpawnPlan,
    GrassWorldCell,
} from '../../types.js';
import { hashString, mulberry32 } from '../../utils.js';
import { findGrassIslands, toCellKey } from '../sheep/islands.js';
import { ISLAND_DIRECTIONS } from '../sheep/constants.js';

/**
 * Build a circular route for the cat: go out, loop around, return to start.
 * Uses BFS to find a path from start, then greedily walks back toward start
 * to form a closed loop. Total cells ≈ maxCells.
 */
const buildCircularRoute = (
    islandCells: ReadonlyArray<GrassWorldCell>,
    startCell: GrassWorldCell,
    directionOffset: number,
    maxCells: number,
): Array<GrassWorldCell> => {
    if (islandCells.length <= 1) return [startCell];

    const cellMap = new Map(islandCells.map((c) => [toCellKey(c), c]));
    const halfMax = Math.floor(maxCells / 2);

    // Phase 1: Walk outward from start for ~half the budget
    const outPath = [startCell];
    const visited = new Set<string>([toCellKey(startCell)]);
    let current = startCell;
    let dirIdx = directionOffset % ISLAND_DIRECTIONS.length;

    for (let step = 0; step < halfMax; step++) {
        // Try directions in rotated order, prefer continuing forward
        let found = false;
        for (let d = 0; d < ISLAND_DIRECTIONS.length; d++) {
            const di = (dirIdx + d) % ISLAND_DIRECTIONS.length;
            const [dw, dd] = ISLAND_DIRECTIONS[di];
            const key = `${current.week + dw},${current.dayOfWeek + dd}`;
            const next = cellMap.get(key);
            if (next && !visited.has(key)) {
                visited.add(key);
                outPath.push(next);
                current = next;
                dirIdx = di;
                found = true;
                break;
            }
        }
        if (!found) break;
    }

    // Phase 2: Walk back toward start, using remaining budget
    const returnBudget = maxCells - outPath.length;
    const returnPath: Array<GrassWorldCell> = [];
    const startKey = toCellKey(startCell);

    for (let step = 0; step < returnBudget; step++) {
        // Check if we can reach start directly
        for (const [dw, dd] of ISLAND_DIRECTIONS) {
            const key = `${current.week + dw},${current.dayOfWeek + dd}`;
            if (key === startKey) {
                // Can reach start — close the loop
                return [...outPath, ...returnPath, startCell];
            }
        }

        // Greedily pick the unvisited neighbor closest to start
        let bestCell: GrassWorldCell | null = null;
        let bestDist = Infinity;
        for (const [dw, dd] of ISLAND_DIRECTIONS) {
            const key = `${current.week + dw},${current.dayOfWeek + dd}`;
            const next = cellMap.get(key);
            if (next && !visited.has(key)) {
                const dist = Math.hypot(
                    next.week - startCell.week,
                    next.dayOfWeek - startCell.dayOfWeek,
                );
                if (dist < bestDist) {
                    bestDist = dist;
                    bestCell = next;
                }
            }
        }

        if (!bestCell) break;
        visited.add(toCellKey(bestCell));
        returnPath.push(bestCell);
        current = bestCell;
    }

    // Close the loop — add start at the end
    return [...outPath, ...returnPath, startCell];
};

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

    // Generate varied movement segments that together cover progress 0→1.0
    // exactly, for a seamless circular loop.
    const movementTimeSec = durationSec - cursor;
    if (movementTimeSec > 0.1) {
        // First, plan time segments with varied kinds
        const moveSegs: Array<{ kind: CatLoopSegment['kind']; duration: number; speedWeight: number }> = [];
        let moveCursor = 0;
        while (moveCursor < movementTimeSec - 0.05) {
            const remaining = movementTimeSec - moveCursor;
            const roll = random();
            // 50% walk, 20% sneak, 15% sprint, 15% idle (brief pauses)
            const kind: CatLoopSegment['kind'] =
                roll < 0.50 ? 'walk'
                : roll < 0.70 ? 'sneak'
                : roll < 0.85 ? 'sprint'
                : 'idle';

            let segDuration: number;
            if (kind === 'walk') {
                segDuration = Math.min(remaining, randBetween(random, 0.8, 1.8));
            } else if (kind === 'sneak') {
                segDuration = Math.min(remaining, randBetween(random, 0.6, 1.2));
            } else if (kind === 'sprint') {
                segDuration = Math.min(remaining, randBetween(random, 0.5, 1.0));
            } else {
                segDuration = Math.min(remaining, randBetween(random, 0.3, 0.6));
            }
            segDuration = Math.max(segDuration, 0.1);

            // Speed weights: sprint fast, walk normal, sneak slow, idle 0
            const speedWeight =
                kind === 'sprint' ? 1.6
                : kind === 'sneak' ? 0.6
                : kind === 'idle' ? 0
                : 1.0;

            moveSegs.push({ kind, duration: segDuration, speedWeight });
            moveCursor += segDuration;
        }

        // Calculate total weighted time (for distributing progress proportionally)
        const totalWeightedTime = moveSegs.reduce(
            (sum, s) => sum + s.duration * s.speedWeight, 0,
        );

        // Assign progress proportionally so total = 1.0
        let progress = 0;
        for (const seg of moveSegs) {
            const progressShare = totalWeightedTime > 0
                ? (seg.duration * seg.speedWeight) / totalWeightedTime
                : 0;
            const progressEnd = Math.min(progress + progressShare, 1.0);

            segments.push({
                kind: seg.kind,
                startSec: cursor,
                endSec: cursor + seg.duration,
                progressStart: progress,
                progressEnd,
            });
            progress = progressEnd;
            cursor += seg.duration;
        }

        // Ensure last segment ends exactly at 1.0
        if (segments.length > 0 && progress < 0.999) {
            const last = segments[segments.length - 1];
            segments[segments.length - 1] = { ...last, progressEnd: 1.0 };
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

    // 25-cell circular route (start = end for seamless loop)
    const maxRouteCells = 25;
    const directionOffset = hashString(`cat:dir:${island.id}`) % 4;
    const route = buildCircularRoute(
        island.cells,
        spawnCell,
        directionOffset,
        maxRouteCells,
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
