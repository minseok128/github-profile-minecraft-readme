import type {
    GrassWorldCell,
    SheepColorDefinition,
    SheepLoopPlan,
    SheepSpawnPlan,
} from '../types.js';
import { hashString, mulberry32 } from '../utils.js';

const ISLAND_DIRECTIONS = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
] as const;

const MAX_WALK_STEPS = 6;
const SHEEP_WALK_SPEED_BLOCKS_PER_SEC = 1.35;
const MIN_LOOP_PAUSE_SEC = 0.95;
const TWO_PAUSE_MIN_SEC = 1.7;

export const MINECRAFT_SHEEP_COLORS: ReadonlyArray<SheepColorDefinition> = [
    { name: 'white', hex: '#E6E6E6', weight: 1 },
    { name: 'orange', hex: '#F39C12', weight: 1 },
    { name: 'magenta', hex: '#C74EBD', weight: 1 },
    { name: 'light_blue', hex: '#6699D8', weight: 1 },
    { name: 'yellow', hex: '#E5E533', weight: 1 },
    { name: 'lime', hex: '#7FCC19', weight: 1 },
    { name: 'pink', hex: '#F2B2CC', weight: 1 },
    { name: 'gray', hex: '#4C4C4C', weight: 1 },
    { name: 'light_gray', hex: '#999999', weight: 1 },
    { name: 'cyan', hex: '#4C7F99', weight: 1 },
    { name: 'purple', hex: '#7F3FB2', weight: 1 },
    { name: 'blue', hex: '#334CB2', weight: 1 },
    { name: 'brown', hex: '#664C33', weight: 1 },
    { name: 'green', hex: '#667F33', weight: 1 },
    { name: 'red', hex: '#993333', weight: 1 },
    { name: 'black', hex: '#191919', weight: 1 },
] as const;

const ORANGE_SHEEP_COLOR =
    MINECRAFT_SHEEP_COLORS.find((color) => color.name === 'orange') ??
    MINECRAFT_SHEEP_COLORS[0];
const WHITE_SHEEP_COLOR =
    MINECRAFT_SHEEP_COLORS.find((color) => color.name === 'white') ??
    MINECRAFT_SHEEP_COLORS[0];

const toCellKey = (cell: Pick<GrassWorldCell, 'week' | 'dayOfWeek'>): string =>
    `${cell.week},${cell.dayOfWeek}`;

const mixSeed = (value: number): number => {
    let seed = value >>> 0;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
};

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const getCellDistance = (
    left: GrassWorldCell,
    right: GrassWorldCell,
): number =>
    Math.hypot(
        right.week - left.week,
        right.worldHeight - left.worldHeight,
        right.dayOfWeek - left.dayOfWeek,
    );

const buildRouteProgressStops = (route: Array<GrassWorldCell>): Array<number> => {
    if (route.length <= 1) {
        return [0];
    }

    const cumulativeDistances = [0];
    for (let index = 1; index < route.length; index += 1) {
        const previous = route[index - 1];
        const current = route[index];
        cumulativeDistances.push(
            cumulativeDistances[index - 1] +
                Math.hypot(
                    current.week - previous.week,
                    current.worldHeight - previous.worldHeight,
                    current.dayOfWeek - previous.dayOfWeek,
                ),
        );
    }

    const totalDistance =
        cumulativeDistances[cumulativeDistances.length - 1] ?? 0;
    if (totalDistance <= 1e-6) {
        const segmentCount = Math.max(1, route.length - 1);
        return cumulativeDistances.map((_, index) => index / segmentCount);
    }

    return cumulativeDistances.map((distance) => distance / totalDistance);
};

const measureRouteDistance = (route: Array<GrassWorldCell>): number => {
    let totalDistance = 0;
    for (let index = 1; index < route.length; index += 1) {
        totalDistance += getCellDistance(route[index - 1], route[index]);
    }
    return totalDistance;
};

const pickIndexInFractionRange = (
    segmentCount: number,
    minFraction: number,
    maxFraction: number,
    random: () => number,
    minIndex = 1,
    maxIndex = segmentCount - 1,
): number => {
    const safeMinIndex = Math.max(1, minIndex);
    const safeMaxIndex = Math.max(
        safeMinIndex,
        Math.min(maxIndex, segmentCount - 1),
    );
    const lower = Math.min(
        safeMaxIndex,
        Math.max(safeMinIndex, Math.ceil(segmentCount * minFraction)),
    );
    const upper = Math.max(
        lower,
        Math.min(safeMaxIndex, Math.floor(segmentCount * maxFraction)),
    );

    return lower + Math.floor(random() * (upper - lower + 1));
};

const distributeDurations = (
    totalDurationSec: number,
    weights: Array<number>,
): Array<number> => {
    const safeWeights = weights.map((weight) => Math.max(weight, 1e-3));
    const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0);
    return safeWeights.map((weight) => (totalDurationSec * weight) / totalWeight);
};

const buildLoopPlan = (
    route: Array<GrassWorldCell>,
    loopDurationSec: number,
    seedText: string,
): SheepLoopPlan => {
    const durationSec = Math.max(1.5, loopDurationSec);
    const random = mulberry32(hashString(seedText));
    const phaseOffsetSec = random() * durationSec;

    if (route.length <= 1) {
        return {
            phaseOffsetSec,
            segments: [
                {
                    kind: 'idle' as const,
                    startSec: 0,
                    endSec: durationSec,
                    progressStart: 0,
                    progressEnd: 0,
                },
            ],
        };
    }

    const segmentCount = route.length - 1;
    const routeProgressStops = buildRouteProgressStops(route);
    const routeDistance = measureRouteDistance(route);
    const walkDurationSec = routeDistance / SHEEP_WALK_SPEED_BLOCKS_PER_SEC;
    const pauseBudgetSec = Math.max(0, durationSec - walkDurationSec);
    const pauseCount =
        pauseBudgetSec >= TWO_PAUSE_MIN_SEC && segmentCount >= 5
            ? 2
            : pauseBudgetSec >= MIN_LOOP_PAUSE_SEC
              ? 1
              : 0;

    if (pauseCount === 0) {
        return {
            phaseOffsetSec,
            segments: [
                {
                    kind: 'walk',
                    startSec: 0,
                    endSec: durationSec,
                    progressStart: 0,
                    progressEnd: 1,
                },
            ],
        };
    }

    const firstPauseIndex = pickIndexInFractionRange(
        segmentCount,
        pauseCount === 2 ? 0.22 : 0.3,
        pauseCount === 2 ? 0.44 : 0.7,
        random,
    );
    const firstPauseProgress =
        routeProgressStops[firstPauseIndex] ??
        (pauseCount === 2 ? 0.34 : 0.5);

    let secondPauseIndex = segmentCount - 1;
    let secondPauseProgress = 1;
    if (pauseCount === 2) {
        secondPauseIndex = pickIndexInFractionRange(
            segmentCount,
            0.58,
            0.86,
            random,
            firstPauseIndex + 1,
            segmentCount - 1,
        );
        secondPauseProgress =
            routeProgressStops[secondPauseIndex] ??
            Math.max(firstPauseProgress + 0.22, 0.78);
    }

    const secondPauseKind: 'idle' | 'graze' =
        random() < 0.45 ? 'idle' : 'graze';
    const firstPauseDurationSec =
        pauseCount === 1
            ? pauseBudgetSec
            : pauseBudgetSec *
              clamp(0.54 + (random() - 0.5) * 0.16, 0.44, 0.66);
    const secondPauseDurationSec =
        pauseCount === 2 ? pauseBudgetSec - firstPauseDurationSec : 0;
    const totalWalkDurationSec = walkDurationSec;

    if (pauseCount === 1) {
        const [walkBeforePauseDurationSec] = distributeDurations(
            totalWalkDurationSec,
            [firstPauseProgress, 1 - firstPauseProgress],
        );
        const firstPauseEndSec =
            walkBeforePauseDurationSec + firstPauseDurationSec;

        return {
            phaseOffsetSec,
            segments: [
                {
                    kind: 'walk' as const,
                    startSec: 0,
                    endSec: walkBeforePauseDurationSec,
                    progressStart: 0,
                    progressEnd: firstPauseProgress,
                },
                {
                    kind: 'graze' as const,
                    startSec: walkBeforePauseDurationSec,
                    endSec: firstPauseEndSec,
                    progressStart: firstPauseProgress,
                    progressEnd: firstPauseProgress,
                },
                {
                    kind: 'walk' as const,
                    startSec: firstPauseEndSec,
                    endSec: durationSec,
                    progressStart: firstPauseProgress,
                    progressEnd: 1,
                },
            ],
        };
    }

    const [walkToFirstPauseSec, walkToSecondPauseSec, walkHomeSec] =
        distributeDurations(
        totalWalkDurationSec,
        [
            firstPauseProgress,
            secondPauseProgress - firstPauseProgress,
            1 - secondPauseProgress,
        ],
    );
    const walkToFirstPauseEndSec = walkToFirstPauseSec;
    const firstPauseEndSec = walkToFirstPauseEndSec + firstPauseDurationSec;
    const walkToSecondPauseEndSec = firstPauseEndSec + walkToSecondPauseSec;
    const secondPauseEndSec = walkToSecondPauseEndSec + secondPauseDurationSec;

    return {
        phaseOffsetSec,
        segments: [
            {
                kind: 'walk' as const,
                startSec: 0,
                endSec: walkToFirstPauseEndSec,
                progressStart: 0,
                progressEnd: firstPauseProgress,
            },
            {
                kind: 'graze' as const,
                startSec: walkToFirstPauseEndSec,
                endSec: firstPauseEndSec,
                progressStart: firstPauseProgress,
                progressEnd: firstPauseProgress,
            },
            {
                kind: 'walk' as const,
                startSec: firstPauseEndSec,
                endSec: walkToSecondPauseEndSec,
                progressStart: firstPauseProgress,
                progressEnd: secondPauseProgress,
            },
            {
                kind: secondPauseKind,
                startSec: walkToSecondPauseEndSec,
                endSec: secondPauseEndSec,
                progressStart: secondPauseProgress,
                progressEnd: secondPauseProgress,
            },
            {
                kind: 'walk' as const,
                startSec: secondPauseEndSec,
                endSec: secondPauseEndSec + walkHomeSec,
                progressStart: secondPauseProgress,
                progressEnd: 1,
            },
        ],
    };
};

const pickWeightedColor = (
    seedBase: number,
    colors: ReadonlyArray<SheepColorDefinition> = MINECRAFT_SHEEP_COLORS,
): SheepColorDefinition => {
    const totalWeight = colors.reduce(
        (sum, color) => sum + color.weight,
        0,
    );
    let roll = mixSeed(seedBase) % totalWeight;

    for (const color of colors) {
        if (roll < color.weight) {
            return color;
        }
        roll -= color.weight;
    }

    return colors[0];
};

const buildGlobalColorAssignments = (
    sheepSlots: Array<{
        islandId: number;
        sheepIndex: number;
        islandCellCount: number;
    }>,
): Array<SheepColorDefinition> => {
    if (sheepSlots.length === 0) {
        return [];
    }
    const randomizedSlots = sheepSlots.map((slot, slotIndex) => ({
        slotIndex,
        orderSeed: mixSeed(
            slot.islandId * 1009 +
                slot.sheepIndex * 173 +
                slot.islandCellCount * 37,
        ),
    }));

    randomizedSlots.sort(
        (left, right) => left.orderSeed - right.orderSeed || left.slotIndex - right.slotIndex,
    );

    const assignedColors = new Array<SheepColorDefinition>(sheepSlots.length);
    randomizedSlots.forEach((slot, orderIndex) => {
        assignedColors[slot.slotIndex] =
            orderIndex === 0 ? ORANGE_SHEEP_COLOR : WHITE_SHEEP_COLOR;
    });

    return assignedColors;
};

const rotateDirections = (
    offset: number,
): Array<(typeof ISLAND_DIRECTIONS)[number]> =>
    [...Array<undefined>(ISLAND_DIRECTIONS.length)].map(
        (_, index) =>
            ISLAND_DIRECTIONS[(index + offset) % ISLAND_DIRECTIONS.length],
    );

const getDistanceMap = (
    islandCells: Array<GrassWorldCell>,
    startCell: GrassWorldCell,
): Map<string, number> => {
    const cellMap = new Map(islandCells.map((cell) => [toCellKey(cell), cell]));
    const distanceMap = new Map<string, number>([[toCellKey(startCell), 0]]);
    const queue = [startCell];

    while (queue.length > 0) {
        const current = queue.shift() as GrassWorldCell;
        const currentDistance = distanceMap.get(toCellKey(current)) as number;
        ISLAND_DIRECTIONS.forEach(([weekOffset, dayOffset]) => {
            const nextCell = cellMap.get(
                `${current.week + weekOffset},${current.dayOfWeek + dayOffset}`,
            );
            if (!nextCell) {
                return;
            }
            const nextKey = toCellKey(nextCell);
            if (distanceMap.has(nextKey)) {
                return;
            }
            distanceMap.set(nextKey, currentDistance + 1);
            queue.push(nextCell);
        });
    }

    return distanceMap;
};

const chooseWalkPath = (
    islandCells: Array<GrassWorldCell>,
    startCell: GrassWorldCell,
    directionOffset: number,
    maxRouteDistance: number,
): Array<GrassWorldCell> => {
    if (islandCells.length === 0) {
        return [];
    }

    const cellMap = new Map(islandCells.map((cell) => [toCellKey(cell), cell]));
    const path = [startCell];
    let current = startCell;
    let previousKey = '';
    let currentDirection = directionOffset % ISLAND_DIRECTIONS.length;
    let forwardDistance = 0;

    for (let step = 0; step < MAX_WALK_STEPS; step += 1) {
        const candidates = rotateDirections(currentDirection)
            .map((direction, directionIndex) => ({
                directionIndex:
                    (directionOffset + directionIndex) % ISLAND_DIRECTIONS.length,
                cell: cellMap.get(
                    `${current.week + direction[0]},${
                        current.dayOfWeek + direction[1]
                    }`,
                ),
            }))
            .filter(
                (
                    info,
                ): info is { directionIndex: number; cell: GrassWorldCell } =>
                    Boolean(info.cell),
            )
            .filter(
                (info, index, list) =>
                    toCellKey(info.cell) !== previousKey || list.length === 1,
            );

        if (candidates.length === 0) {
            break;
        }

        const next = candidates[0];
        const nextForwardDistance =
            forwardDistance + getCellDistance(current, next.cell);
        if (nextForwardDistance * 2 > maxRouteDistance) {
            break;
        }

        previousKey = toCellKey(current);
        currentDirection = next.directionIndex;
        forwardDistance = nextForwardDistance;
        current = next.cell;
        path.push(current);
    }

    if (path.length > 1) {
        return [...path, ...path.slice(1, -1).reverse(), path[0]];
    }

    return path;
};

const selectSpawnCells = (
    islandCells: Array<GrassWorldCell>,
    count: number,
): Array<GrassWorldCell> => {
    const sortedCells = [...islandCells].sort(
        (left, right) => left.week - right.week || left.dayOfWeek - right.dayOfWeek,
    );
    const avgWeek =
        sortedCells.reduce((sum, cell) => sum + cell.week, 0) / sortedCells.length;
    const avgDay =
        sortedCells.reduce((sum, cell) => sum + cell.dayOfWeek, 0) /
        sortedCells.length;

    const selected = [
        sortedCells.reduce((best, cell) => {
            const bestDistance = Math.hypot(
                best.week - avgWeek,
                best.dayOfWeek - avgDay,
            );
            const cellDistance = Math.hypot(
                cell.week - avgWeek,
                cell.dayOfWeek - avgDay,
            );
            return cellDistance < bestDistance ? cell : best;
        }, sortedCells[0]),
    ];

    while (selected.length < count) {
        const nextCell = sortedCells.reduce((best, cell) => {
            if (selected.some((selectedCell) => toCellKey(selectedCell) === toCellKey(cell))) {
                return best;
            }
            const cellMinDistance = selected.reduce(
                (minDistance, selectedCell) =>
                    Math.min(
                        minDistance,
                        Math.hypot(
                            cell.week - selectedCell.week,
                            cell.dayOfWeek - selectedCell.dayOfWeek,
                        ),
                    ),
                Infinity,
            );
            const bestMinDistance = selected.reduce(
                (minDistance, selectedCell) =>
                    Math.min(
                        minDistance,
                        Math.hypot(
                            best.week - selectedCell.week,
                            best.dayOfWeek - selectedCell.dayOfWeek,
                        ),
                    ),
                Infinity,
            );
            return cellMinDistance > bestMinDistance ? cell : best;
        }, sortedCells[0]);
        selected.push(nextCell);
    }

    return selected;
};

const partitionIslandCells = (
    islandCells: Array<GrassWorldCell>,
    spawnCells: Array<GrassWorldCell>,
): Array<Array<GrassWorldCell>> => {
    const distanceMaps = spawnCells.map((spawnCell) =>
        getDistanceMap(islandCells, spawnCell),
    );
    const partitions = spawnCells.map(() => [] as Array<GrassWorldCell>);

    islandCells.forEach((cell) => {
        const key = toCellKey(cell);
        let bestOwner = 0;
        let bestDistance = distanceMaps[0].get(key) ?? Number.POSITIVE_INFINITY;

        for (let owner = 1; owner < distanceMaps.length; owner += 1) {
            const distance = distanceMaps[owner].get(key) ?? Number.POSITIVE_INFINITY;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestOwner = owner;
                continue;
            }
            if (
                distance === bestDistance &&
                partitions[owner].length < partitions[bestOwner].length
            ) {
                bestOwner = owner;
            }
        }

        partitions[bestOwner].push(cell);
    });

    return partitions;
};

export const findGrassIslands = (
    cells: Array<GrassWorldCell>,
): Array<{ id: number; cells: Array<GrassWorldCell> }> => {
    const grassCells = cells.filter((cell) => cell.contributionLevel > 0);
    const remaining = new Map(grassCells.map((cell) => [toCellKey(cell), cell]));
    const islands: Array<{ id: number; cells: Array<GrassWorldCell> }> = [];
    let islandId = 0;

    while (remaining.size > 0) {
        const firstEntry = remaining.entries().next().value as
            | [string, GrassWorldCell]
            | undefined;
        if (!firstEntry) {
            break;
        }

        const [, firstCell] = firstEntry;
        const queue = [firstCell];
        const islandCells: Array<GrassWorldCell> = [];
        remaining.delete(toCellKey(firstCell));

        while (queue.length > 0) {
            const current = queue.shift() as GrassWorldCell;
            islandCells.push(current);
            ISLAND_DIRECTIONS.forEach(([weekOffset, dayOffset]) => {
                const nextKey = `${current.week + weekOffset},${
                    current.dayOfWeek + dayOffset
                }`;
                const nextCell = remaining.get(nextKey);
                if (!nextCell) {
                    return;
                }
                remaining.delete(nextKey);
                queue.push(nextCell);
            });
        }

        islands.push({ id: islandId, cells: islandCells });
        islandId += 1;
    }

    return islands;
};

export const buildSheepPopulationPlans = (
    cells: Array<GrassWorldCell>,
    loopDurationSec: number,
): Array<SheepSpawnPlan> => {
    const maxRouteDistance =
        SHEEP_WALK_SPEED_BLOCKS_PER_SEC *
        Math.max(0.5, loopDurationSec - MIN_LOOP_PAUSE_SEC);
    const sheepSlots = findGrassIslands(cells).flatMap((island) => {
        const sheepCount = Math.min(10, Math.floor(island.cells.length / 18));
        if (sheepCount <= 0) {
            return [];
        }

        const spawnCells = selectSpawnCells(island.cells, sheepCount);
        const territories = partitionIslandCells(island.cells, spawnCells);

        return spawnCells.map((startCell, sheepIndex) => ({
            islandId: island.id,
            sheepIndex,
            islandSheepCount: sheepCount,
            islandCellCount: island.cells.length,
            route: chooseWalkPath(
                territories[sheepIndex],
                startCell,
                (island.id + sheepIndex) % ISLAND_DIRECTIONS.length,
                maxRouteDistance,
            ),
        }));
    });

    const colorAssignments = buildGlobalColorAssignments(sheepSlots);

    return sheepSlots.map((slot, slotIndex) => {
        const color = colorAssignments[slotIndex] ?? ORANGE_SHEEP_COLOR;
        return {
            islandId: slot.islandId,
            sheepIndex: slot.sheepIndex,
            islandSheepCount: slot.islandSheepCount,
            colorName: color.name,
            colorHex: color.hex,
            route: slot.route,
            loopPlan: buildLoopPlan(
                slot.route,
                loopDurationSec,
                `${slot.islandId}:${slot.sheepIndex}:${slot.islandCellCount}`,
            ),
        };
    });
};
