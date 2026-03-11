import type { SheepColorDefinition } from '../../types.js';
import {
    SEED_ISLAND_MULTIPLIER,
    SEED_SHEEP_MULTIPLIER,
    SEED_CELL_COUNT_MULTIPLIER,
} from './constants.js';

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

export const ORANGE_SHEEP_COLOR =
    MINECRAFT_SHEEP_COLORS.find((color) => color.name === 'orange') ??
    MINECRAFT_SHEEP_COLORS[0];
export const WHITE_SHEEP_COLOR =
    MINECRAFT_SHEEP_COLORS.find((color) => color.name === 'white') ??
    MINECRAFT_SHEEP_COLORS[0];

export const mixSeed = (value: number): number => {
    let seed = value >>> 0;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
};

export const pickWeightedColor = (
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

export const buildGlobalColorAssignments = (
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
            slot.islandId * SEED_ISLAND_MULTIPLIER +
                slot.sheepIndex * SEED_SHEEP_MULTIPLIER +
                slot.islandCellCount * SEED_CELL_COUNT_MULTIPLIER,
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
