import type {
    GrassWorldCell,
    SheepColorDefinition,
    SheepSpawnPlan,
} from '../types.js';

const ISLAND_DIRECTIONS = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
] as const;

const MAX_WALK_STEPS = 6;

export const NATURAL_SHEEP_COLORS: ReadonlyArray<SheepColorDefinition> = [
    { name: 'white', hex: '#E6E6E6', weight: 81836 },
    { name: 'black', hex: '#151518', weight: 5000 },
    { name: 'gray', hex: '#353B3D', weight: 5000 },
    { name: 'light_gray', hex: '#757571', weight: 5000 },
    { name: 'brown', hex: '#623F25', weight: 3000 },
    { name: 'pink', hex: '#B6687F', weight: 164 },
] as const;

const toCellKey = (cell: Pick<GrassWorldCell, 'week' | 'dayOfWeek'>): string =>
    `${cell.week},${cell.dayOfWeek}`;

const mixSeed = (value: number): number => {
    let seed = value >>> 0;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
};

const pickWeightedColor = (seedBase: number): SheepColorDefinition => {
    const totalWeight = NATURAL_SHEEP_COLORS.reduce(
        (sum, color) => sum + color.weight,
        0,
    );
    let roll = mixSeed(seedBase) % totalWeight;

    for (const color of NATURAL_SHEEP_COLORS) {
        if (roll < color.weight) {
            return color;
        }
        roll -= color.weight;
    }

    return NATURAL_SHEEP_COLORS[0];
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
): Array<GrassWorldCell> => {
    if (islandCells.length === 0) {
        return [];
    }

    const cellMap = new Map(islandCells.map((cell) => [toCellKey(cell), cell]));
    const path = [startCell];
    let current = startCell;
    let previousKey = '';
    let currentDirection = directionOffset % ISLAND_DIRECTIONS.length;

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
        previousKey = toCellKey(current);
        currentDirection = next.directionIndex;
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
): Array<SheepSpawnPlan> =>
    findGrassIslands(cells).flatMap((island) => {
        const sheepCount = Math.min(10, Math.floor(island.cells.length / 18));
        if (sheepCount <= 0) {
            return [];
        }

        const spawnCells = selectSpawnCells(island.cells, sheepCount);
        const territories = partitionIslandCells(island.cells, spawnCells);

        return spawnCells.map((startCell, sheepIndex) => {
            const color = pickWeightedColor(
                island.id * 1009 + sheepIndex * 173 + island.cells.length * 37,
            );
            const route = chooseWalkPath(
                territories[sheepIndex],
                startCell,
                (island.id + sheepIndex) % ISLAND_DIRECTIONS.length,
            );

            return {
                islandId: island.id,
                sheepIndex,
                islandSheepCount: sheepCount,
                colorName: color.name,
                colorHex: color.hex,
                route,
            };
        });
    });
