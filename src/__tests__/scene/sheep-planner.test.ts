import { describe, it, expect } from 'vitest';
import { findGrassIslands, buildSheepPopulationPlans } from '../../scene/sheep/planner.js';
import { MINECRAFT_SHEEP_COLORS } from '../../scene/sheep/colors.js';
import type { GrassWorldCell } from '../../types.js';

const makeCell = (week: number, dayOfWeek: number, contributionLevel = 1, worldHeight = 2): GrassWorldCell => ({
    week, dayOfWeek, contributionLevel, worldHeight,
});

describe('MINECRAFT_SHEEP_COLORS', () => {
    it('has 16 color definitions', () => {
        expect(MINECRAFT_SHEEP_COLORS).toHaveLength(16);
    });

    it('includes orange and white', () => {
        const names = MINECRAFT_SHEEP_COLORS.map(c => c.name);
        expect(names).toContain('orange');
        expect(names).toContain('white');
    });

    it('all have valid hex colors', () => {
        for (const color of MINECRAFT_SHEEP_COLORS) {
            expect(color.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
    });
});

describe('findGrassIslands', () => {
    it('returns empty array for no cells', () => {
        expect(findGrassIslands([])).toEqual([]);
    });

    it('returns empty array when all cells have zero contribution', () => {
        const cells = [makeCell(0, 0, 0), makeCell(1, 0, 0)];
        expect(findGrassIslands(cells)).toEqual([]);
    });

    it('finds a single island from adjacent cells', () => {
        const cells = [
            makeCell(0, 0), makeCell(1, 0), makeCell(2, 0),
        ];
        const islands = findGrassIslands(cells);
        expect(islands).toHaveLength(1);
        expect(islands[0].cells).toHaveLength(3);
    });

    it('finds multiple disconnected islands', () => {
        const cells = [
            makeCell(0, 0), makeCell(1, 0),  // island 1
            makeCell(5, 5), makeCell(6, 5),  // island 2 (far away)
        ];
        const islands = findGrassIslands(cells);
        expect(islands).toHaveLength(2);
    });

    it('considers diagonal cells as separate islands', () => {
        const cells = [
            makeCell(0, 0),  // island 1
            makeCell(1, 1),  // island 2 (diagonal = not adjacent)
        ];
        const islands = findGrassIslands(cells);
        expect(islands).toHaveLength(2);
    });

    it('finds L-shaped island as single island', () => {
        const cells = [
            makeCell(0, 0), makeCell(1, 0), makeCell(1, 1),
        ];
        const islands = findGrassIslands(cells);
        expect(islands).toHaveLength(1);
        expect(islands[0].cells).toHaveLength(3);
    });

    it('assigns unique island IDs', () => {
        const cells = [
            makeCell(0, 0),
            makeCell(5, 5),
        ];
        const islands = findGrassIslands(cells);
        const ids = islands.map(i => i.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('buildSheepPopulationPlans', () => {
    it('returns empty for empty grid', () => {
        expect(buildSheepPopulationPlans([], 5)).toEqual([]);
    });

    it('returns empty for island too small for sheep (< 18 cells)', () => {
        const cells = Array.from({ length: 10 }, (_, i) => makeCell(i, 0));
        expect(buildSheepPopulationPlans(cells, 5)).toEqual([]);
    });

    it('spawns sheep for a large enough island', () => {
        // 20 adjacent cells = 1 sheep (floor(20/18) = 1)
        const cells = Array.from({ length: 20 }, (_, i) => makeCell(i, 0));
        const plans = buildSheepPopulationPlans(cells, 5);
        expect(plans.length).toBeGreaterThanOrEqual(1);
    });

    it('limits sheep to 10 per island', () => {
        // 200 cells = floor(200/18) = 11, capped at 10
        const cells: GrassWorldCell[] = [];
        for (let w = 0; w < 40; w++) {
            for (let d = 0; d < 5; d++) {
                cells.push(makeCell(w, d));
            }
        }
        const plans = buildSheepPopulationPlans(cells, 5);
        expect(plans.length).toBeLessThanOrEqual(10);
    });

    it('produces deterministic plans', () => {
        const cells = Array.from({ length: 30 }, (_, i) => makeCell(i, 0));
        const plans1 = buildSheepPopulationPlans(cells, 5);
        const plans2 = buildSheepPopulationPlans(cells, 5);
        expect(plans1).toEqual(plans2);
    });

    it('each plan has valid loopPlan with segments', () => {
        const cells = Array.from({ length: 25 }, (_, i) => makeCell(i, 0));
        const plans = buildSheepPopulationPlans(cells, 5);
        for (const plan of plans) {
            expect(plan.loopPlan.segments.length).toBeGreaterThan(0);
            expect(plan.loopPlan.phaseOffsetSec).toBeGreaterThanOrEqual(0);
            for (const seg of plan.loopPlan.segments) {
                expect(['walk', 'idle', 'graze']).toContain(seg.kind);
                expect(seg.endSec).toBeGreaterThanOrEqual(seg.startSec);
            }
        }
    });

    it('assigns exactly one orange sheep', () => {
        const cells: GrassWorldCell[] = [];
        for (let w = 0; w < 20; w++) {
            for (let d = 0; d < 5; d++) {
                cells.push(makeCell(w, d));
            }
        }
        const plans = buildSheepPopulationPlans(cells, 5);
        const orangeCount = plans.filter(p => p.colorName === 'orange').length;
        expect(orangeCount).toBe(1);
    });
});
