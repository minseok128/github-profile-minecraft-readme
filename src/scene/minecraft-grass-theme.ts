import type { ContribPattern } from '../types.js';

const BARE_DIRT_BITMAP = [
    '0x0020',
    '0x2103',
    '0x100c',
    '0x0400',
    '0x0842',
    '0x4390',
    '0x0000',
    '0x0040',
    '0x0102',
    '0x2600',
    '0x0090',
    '0x0009',
    '0x4000',
    '0x0050',
    '0x2500',
    '0x0001',
] as const;

const GRASS_TOP_BITMAP = [
    '0x1f3b',
    '0x4587',
    '0x7f0e',
    '0xe2ed',
    '0x5267',
    '0x28be',
    '0x97c1',
    '0xdd3a',
    '0x0429',
    '0x598b',
    '0x0a5d',
    '0xa537',
    '0x33b2',
    '0xaa04',
    '0x1093',
    '0xb0ae',
] as const;

const DIRT_SIDE_BITMAP = [
    '0x0000',
    '0x0400',
    '0x4509',
    '0xb75f',
    '0x4beb',
    '0xcbfe',
    '0x764a',
    '0xc34c',
    '0x6b9f',
    '0xbff2',
    '0xa491',
    '0x621b',
    '0xd1fc',
    '0xbcd8',
    '0x6f2c',
    '0x4533',
] as const;

const createPattern = (
    topBackgroundColor: string,
    topForegroundColor: string,
    leftBackgroundColor: string,
    leftForegroundColor: string,
    rightBackgroundColor: string,
    rightForegroundColor: string,
    isBareDirt = false,
): ContribPattern => ({
    top: {
        backgroundColor: topBackgroundColor,
        foregroundColor: topForegroundColor,
        width: 16,
        bitmap: [...(isBareDirt ? BARE_DIRT_BITMAP : GRASS_TOP_BITMAP)],
    },
    left: {
        backgroundColor: leftBackgroundColor,
        foregroundColor: leftForegroundColor,
        width: 16,
        bitmap: [...(isBareDirt ? BARE_DIRT_BITMAP : DIRT_SIDE_BITMAP)],
    },
    right: {
        backgroundColor: rightBackgroundColor,
        foregroundColor: rightForegroundColor,
        width: 16,
        bitmap: [...(isBareDirt ? BARE_DIRT_BITMAP : DIRT_SIDE_BITMAP)],
    },
});

export const MINECRAFT_GRASS_PATTERNS: Array<ContribPattern> = [
    createPattern(
        '#8d6647',
        '#593d29',
        '#76553b',
        '#4a3322',
        '#634732',
        '#3e2b1d',
        true,
    ),
    createPattern('#88b04b', '#5f8d3a', '#8b5a34', '#6b4126', '#7a4b2d', '#5a341f'),
    createPattern('#72a342', '#4f7e2f', '#7c4c2e', '#5c351f', '#6b3f26', '#4a2a18'),
    createPattern('#5f8f36', '#3e6723', '#6d4228', '#4f2d1a', '#5b361f', '#3e2516'),
    createPattern('#4c7b2f', '#2f511d', '#5f3a23', '#432514', '#4f2f1d', '#321b10'),
];

