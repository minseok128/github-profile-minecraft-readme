import type { SceneConfig } from '../config/types.js';
import type { ContributionProfile } from '../profile/types.js';
import { toFixed, toIsoDate, trimLastWeeks } from '../utils.js';
import type { SceneAssetUrls } from './assets.js';
import { CREATURE_PLANNERS } from './creature-registry.js';
import type { CreaturePlanner } from './creature-registry.js';
import type { CreatureId, ThemeId } from './registry-ids.js';
import { THEMES } from './theme-registry.js';
import type { ThemeDefinition } from './theme-registry.js';
import type { SceneData, SceneMonthGuideEntry } from './runtime/types.js';
import type { CalendarMetric } from './types.js';

const CAL_HEIGHT_DIVISOR = 20;
const CAL_HEIGHT_MULTIPLIER = 144;
const CAL_HEIGHT_BASE_OFFSET = 3;
const WORLD_HEIGHT_DIVISOR = 54;

const toEpochDays = (date: Date): number =>
    Math.floor(date.getTime() / (24 * 60 * 60 * 1000));

const calcCalHeight = (contributionCount: number): number =>
    Math.log10(contributionCount / CAL_HEIGHT_DIVISOR + 1) *
        CAL_HEIGHT_MULTIPLIER +
    CAL_HEIGHT_BASE_OFFSET;

export const calcWorldHeight = (
    contributionCount: number,
    contributionLevel: number,
): number =>
    contributionLevel === 0
        ? 1
        : toFixed(1 + calcCalHeight(contributionCount) / WORLD_HEIGHT_DIVISOR);

export const buildCalendarMetrics = (
    profile: ContributionProfile,
    weeks: number,
): Array<CalendarMetric> => {
    const visibleCalendar = trimLastWeeks(profile.calendar, weeks);
    if (visibleCalendar.length === 0) {
        throw new Error(
            'No contribution calendar data is available to render.',
        );
    }
    const firstDate = new Date(`${visibleCalendar[0].date}T00:00:00.000Z`);
    const sundayOfFirstWeek = toEpochDays(firstDate) - firstDate.getUTCDay();

    return visibleCalendar.map((day) => {
        const date = new Date(`${day.date}T00:00:00.000Z`);
        return {
            ...day,
            date: toIsoDate(date),
            week: Math.floor((toEpochDays(date) - sundayOfFirstWeek) / 7),
            dayOfWeek: date.getUTCDay(),
            worldHeight: calcWorldHeight(
                day.contributionCount,
                day.contributionLevel,
            ),
        };
    });
};

const formatCompactContributionCount = (value: number): string => {
    if (value < 1000) {
        return String(value);
    }
    const compactValue = Math.round((value / 1000) * 10) / 10;
    return `${compactValue.toFixed(compactValue >= 10 ? 0 : 1)}k`;
};

export const buildMonthGuideEntries = (
    calendarMetrics: Array<CalendarMetric>,
): Array<SceneMonthGuideEntry> => {
    const monthFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        timeZone: 'UTC',
    });
    const monthTotals = new Map<string, number>();
    for (const metric of calendarMetrics) {
        const monthKey = metric.date.slice(0, 7);
        monthTotals.set(
            monthKey,
            (monthTotals.get(monthKey) ?? 0) + metric.contributionCount,
        );
    }

    const entries: Array<SceneMonthGuideEntry> = [];
    let previousMonthKey = '';
    for (const metric of calendarMetrics) {
        const monthKey = metric.date.slice(0, 7);
        if (monthKey === previousMonthKey) {
            continue;
        }
        previousMonthKey = monthKey;
        entries.push({
            week: metric.week,
            monthLabel: monthFormatter.format(
                new Date(`${metric.date}T00:00:00.000Z`),
            ),
            detailLabel: formatCompactContributionCount(
                monthTotals.get(monthKey) ?? 0,
            ),
        });
    }
    return entries;
};

export interface PreparedScene {
    sceneData: SceneData;
    period: string;
    visibleDayCount: number;
}

export interface ScenePlanningRegistries {
    themes: Readonly<Record<ThemeId, ThemeDefinition>>;
    creaturePlanners: Readonly<Record<CreatureId, CreaturePlanner>>;
}

const DEFAULT_SCENE_PLANNING_REGISTRIES: ScenePlanningRegistries = {
    themes: THEMES,
    creaturePlanners: CREATURE_PLANNERS,
};

export const prepareScene = (
    profile: ContributionProfile,
    sceneConfig: SceneConfig,
    loopDurationSec: number,
    assets: SceneAssetUrls,
    registries: ScenePlanningRegistries = DEFAULT_SCENE_PLANNING_REGISTRIES,
): PreparedScene => {
    const calendarMetrics = buildCalendarMetrics(profile, sceneConfig.weeks);
    const theme = registries.themes[sceneConfig.theme];
    if (!theme) {
        throw new Error(`Unknown scene theme '${sceneConfig.theme}'.`);
    }
    return {
        period: `${calendarMetrics[0].date} / ${calendarMetrics.at(-1)?.date ?? calendarMetrics[0].date}`,
        visibleDayCount: calendarMetrics.length,
        sceneData: {
            version: 1,
            background: sceneConfig.background,
            theme: theme.id,
            assets,
            calendarMetrics,
            monthGuideEntries: buildMonthGuideEntries(calendarMetrics),
            entities: sceneConfig.creatures.map((creature) =>
                registries.creaturePlanners[creature]({
                    calendarMetrics,
                    loopDurationSec,
                }),
            ),
        },
    };
};
