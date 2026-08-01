import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../config/schema.js';
import type { ContributionProfile } from '../../profile/types.js';
import { createSampleProfile } from '../../sample-profile.js';
import {
    buildCalendarMetrics,
    buildMonthGuideEntries,
    calcWorldHeight,
    prepareScene,
} from '../../scene/planner.js';
import {
    SCENE_ASSETS,
    buildSceneAssetUrls,
    getRequiredAssetKeys,
} from '../../scene/assets.js';
import { THEMES } from '../../scene/theme-registry.js';

describe('scene planner', () => {
    it('is deterministic for a fixed profile date', () => {
        const profileA = createSampleProfile(
            'planner-user',
            new Date('2026-08-01T00:00:00.000Z'),
        );
        const profileB = createSampleProfile(
            'planner-user',
            new Date('2026-08-01T00:00:00.000Z'),
        );
        expect(profileA).toEqual(profileB);
    });

    it('aligns weeks to Sunday and trims visible weeks', () => {
        const profile = createSampleProfile(
            'planner-user',
            new Date('2026-08-01T00:00:00.000Z'),
        );
        const metrics = buildCalendarMetrics(profile, 1);
        expect(metrics).toHaveLength(7);
        expect(metrics[0].week).toBeGreaterThanOrEqual(0);
        expect(metrics.every((metric) => metric.dayOfWeek >= 0)).toBe(true);
    });

    it('calculates month totals in a single logical grouping', () => {
        const profile: ContributionProfile = {
            username: 'months',
            totalContributions: 10,
            calendar: [
                {
                    contributionCount: 2,
                    contributionLevel: 1,
                    date: '2026-01-31',
                },
                {
                    contributionCount: 3,
                    contributionLevel: 1,
                    date: '2026-02-01',
                },
                {
                    contributionCount: 5,
                    contributionLevel: 2,
                    date: '2026-02-02',
                },
            ],
        };
        const guides = buildMonthGuideEntries(
            buildCalendarMetrics(profile, 53),
        );
        expect(guides.map((guide) => guide.detailLabel)).toEqual(['2', '8']);
    });

    it('uses height one for empty contribution cells', () => {
        expect(calcWorldHeight(0, 0)).toBe(1);
        expect(calcWorldHeight(10, 2)).toBeGreaterThan(1);
    });

    it('rejects empty calendars', () => {
        expect(() =>
            buildCalendarMetrics(
                { username: 'empty', totalContributions: 0, calendar: [] },
                53,
            ),
        ).toThrow('No contribution calendar');
    });

    it('dispatches registered themes and creatures into a serializable scene', () => {
        const profile = createSampleProfile(
            'planner-user',
            new Date('2026-08-01T00:00:00.000Z'),
        );
        const scene = prepareScene(
            profile,
            DEFAULT_CONFIG.scene,
            DEFAULT_CONFIG.capture.gif.durationSec,
            buildSceneAssetUrls(
                '/assets',
                getRequiredAssetKeys(
                    DEFAULT_CONFIG.scene.theme,
                    DEFAULT_CONFIG.scene.creatures,
                ),
            ),
        );
        expect(scene.sceneData.theme).toBe('korean-seasonal');
        expect(scene.sceneData.entities).toHaveLength(1);
        expect(() => JSON.stringify(scene.sceneData)).not.toThrow();
    });

    it('dispatches injected test theme and creature implementations', () => {
        const profile = createSampleProfile(
            'registry-user',
            new Date('2026-08-01T00:00:00.000Z'),
        );
        const fakeCreaturePlanner = vi.fn(() => ({
            kind: 'sheep' as const,
            targetHeight: 9,
            plans: [],
        }));
        const fakeTheme = {
            ...THEMES['korean-seasonal'],
            requiredAssets: [] as const,
        };
        const scene = prepareScene(
            profile,
            DEFAULT_CONFIG.scene,
            5,
            buildSceneAssetUrls('/assets', []),
            {
                themes: { 'korean-seasonal': fakeTheme },
                creaturePlanners: { sheep: fakeCreaturePlanner },
            },
        );
        expect(fakeCreaturePlanner).toHaveBeenCalledOnce();
        expect(scene.sceneData.entities).toEqual([
            { kind: 'sheep', targetHeight: 9, plans: [] },
        ]);
    });

    it('maps every manifest entry to an existing local asset', () => {
        for (const fileName of Object.values(SCENE_ASSETS)) {
            expect(existsSync(path.resolve('assets', fileName))).toBe(true);
        }
    });
});
