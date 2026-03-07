import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import type { ContribPattern, RenderConfig, UserSnapshot } from '../types.js';
import { formatThousands, toFixed, trimLastWeeks } from '../utils.js';
import { MINECRAFT_GRASS_PATTERNS } from './minecraft-grass-theme.js';

const ANGLE = 30;
const ANGLE_RAD = (ANGLE * Math.PI) / 180;
const DY_RATIO = Math.tan(ANGLE_RAD);
const DXX_RATIO = 0.9;
const DYY_RATIO = DY_RATIO * 0.9;

interface CalendarMetricLike {
    contributionCount: number;
    contributionLevel: number;
    date: Date;
    week: number;
    dayOfWeek: number;
    calHeight: number;
}

interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

const calcCalHeight = (contributionCount: number): number =>
    Math.log10(contributionCount / 20 + 1) * 144 + 3;

const toEpochDays = (date: Date): number =>
    Math.floor(date.getTime() / (24 * 60 * 60 * 1000));

const atanDegrees = (value: number): number =>
    (Math.atan(value) * 180) / Math.PI;

const buildCalendarMetrics = (
    userSnapshot: UserSnapshot,
    weeks: number,
): Array<CalendarMetricLike> => {
    const visibleCalendar = trimLastWeeks(userSnapshot.calendar, weeks);
    const firstDate = new Date(visibleCalendar[0].date);
    const sundayOfFirstWeek = toEpochDays(firstDate) - firstDate.getUTCDay();

    return visibleCalendar.map((day) => {
        const date = new Date(day.date);
        return {
            contributionCount: day.contributionCount,
            contributionLevel: day.contributionLevel,
            date,
            week: Math.floor((toEpochDays(date) - sundayOfFirstWeek) / 7),
            dayOfWeek: date.getUTCDay(),
            calHeight: calcCalHeight(day.contributionCount),
        };
    });
};

const calculateBounds = (
    metrics: Array<CalendarMetricLike>,
    dx: number,
): Bounds => {
    const dxx = dx * DXX_RATIO;
    const dy = dx * DY_RATIO;
    const dyy = dx * DYY_RATIO;

    return metrics.reduce<Bounds>(
        (bounds, metric) => {
            const baseX = (metric.week - metric.dayOfWeek) * dx;
            const baseY = (metric.week + metric.dayOfWeek) * dy;

            return {
                minX: Math.min(bounds.minX, baseX),
                maxX: Math.max(bounds.maxX, baseX + dxx),
                minY: Math.min(bounds.minY, baseY - metric.calHeight),
                maxY: Math.max(bounds.maxY, baseY + dyy),
            };
        },
        {
            minX: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY,
        },
    );
};

const createBitmapCss = (patterns: Array<ContribPattern>): string => {
    const css = [
        'svg { shape-rendering: geometricPrecision; }',
        '.panel { stroke: none; shape-rendering: crispEdges; }',
        '.hud text { font-family: "SF Pro Display", "Segoe UI", sans-serif; }',
        '.hud-bg { fill: rgba(15, 23, 42, 0.82); }',
        '.hud-title { fill: #86efac; font-size: 18px; font-weight: 700; }',
        '.hud-copy { fill: #f8fafc; font-size: 14px; font-weight: 600; }',
        '.hud-subcopy { fill: #dbeafe; font-size: 12px; }',
    ];

    patterns.forEach((pattern, index) => {
        const topBack = pattern.top.backgroundColor;
        const topFore = pattern.top.foregroundColor;
        const leftBack = pattern.left.backgroundColor ?? topBack;
        const leftFore = pattern.left.foregroundColor ?? topFore;
        const rightBack = pattern.right.backgroundColor ?? topBack;
        const rightFore = pattern.right.foregroundColor ?? topFore;

        css.push(
            `.cont-top-bg-${index} { fill: ${topBack}; }`,
            `.cont-top-fg-${index} { fill: ${topFore}; }`,
            `.cont-left-bg-${index} { fill: ${leftBack}; }`,
            `.cont-left-fg-${index} { fill: ${leftFore}; }`,
            `.cont-right-bg-${index} { fill: ${rightBack}; }`,
            `.cont-right-fg-${index} { fill: ${rightFore}; }`,
        );
    });

    return css.join('\n');
};

const addPatternDefinitions = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    patterns: Array<ContribPattern>,
): void => {
    const defs = svg.append('defs');

    patterns.forEach((pattern, contributionLevel) => {
        (['top', 'left', 'right'] as const).forEach((panel) => {
            const panelPattern = pattern[panel];
            const width = Math.max(1, panelPattern.width);
            const height = Math.max(1, panelPattern.bitmap.length);
            const patternNode = defs
                .append('pattern')
                .attr('id', `pattern_${contributionLevel}_${panel}`)
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', width)
                .attr('height', height)
                .attr('patternUnits', 'userSpaceOnUse');

            patternNode
                .append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', width)
                .attr('height', height)
                .attr('class', `cont-${panel}-bg-${contributionLevel}`);

            const pixelPath = d3.path();
            panelPattern.bitmap.forEach((bitmapValue, y) => {
                const bitmap =
                    typeof bitmapValue === 'string'
                        ? Number.parseInt(bitmapValue, 16)
                        : bitmapValue;
                for (let x = 0; x < width; x += 1) {
                    if ((bitmap & (1 << (width - x - 1))) !== 0) {
                        pixelPath.rect(x, y, 1, 1);
                    }
                }
            });

            patternNode
                .append('path')
                .attr('stroke', 'none')
                .attr('class', `cont-${panel}-fg-${contributionLevel}`)
                .attr('d', pixelPath.toString());
        });
    });
};

const addHud = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    userSnapshot: UserSnapshot,
    weeks: number,
): void => {
    const copy = `${formatThousands(userSnapshot.totalContributions)} contributions`;
    const subcopy = `${weeks} weeks · SVG export`;
    const estimatedWidth = Math.max(
        240,
        Math.ceil(Math.max(userSnapshot.username.length * 10, copy.length * 7)),
    );

    const hud = svg.append('g').attr('class', 'hud').attr('transform', 'translate(20 20)');
    hud.append('rect')
        .attr('class', 'hud-bg')
        .attr('width', estimatedWidth)
        .attr('height', 78)
        .attr('rx', 16)
        .attr('ry', 16);
    hud.append('text')
        .attr('class', 'hud-title')
        .attr('x', 16)
        .attr('y', 28)
        .text(`${userSnapshot.username}'s Minecraft Contributions`);
    hud.append('text')
        .attr('class', 'hud-copy')
        .attr('x', 16)
        .attr('y', 50)
        .text(copy);
    hud.append('text')
        .attr('class', 'hud-subcopy')
        .attr('x', 16)
        .attr('y', 68)
        .text(subcopy);
};

export const buildSceneSvg = (
    userSnapshot: UserSnapshot,
    config: RenderConfig,
): string => {
    const metrics = buildCalendarMetrics(userSnapshot, config.weeks);
    if (metrics.length === 0) {
        return [
            '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>',
        ].join('');
    }

    const xIndices = metrics.map((metric) => metric.week - metric.dayOfWeek);
    const xRange = Math.max(...xIndices) - Math.min(...xIndices);
    const dxFromWidth = config.width / Math.max(6, xRange + DXX_RATIO + 1.2);
    const dxFromHeight = config.height / Math.max(6, 14.5);
    const dx = Math.max(18, Math.min(dxFromWidth, dxFromHeight));
    const dy = dx * DY_RATIO;
    const dxx = dx * DXX_RATIO;
    const dyy = dx * DYY_RATIO;
    const contentBounds = calculateBounds(metrics, dx);
    const padding = dx * 0.55;
    const finalWidth = Math.ceil(contentBounds.maxX - contentBounds.minX + padding * 2);
    const finalHeight = Math.ceil(contentBounds.maxY - contentBounds.minY + padding * 2);
    const offsetX = padding - contentBounds.minX;
    const offsetY = padding - contentBounds.minY;

    const fakeDom = new JSDOM(
        '<!DOCTYPE html><html><body><div class="container"></div></body></html>',
    );
    const container = d3.select(fakeDom.window.document).select('.container');
    const svg = container
        .append('svg')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('width', finalWidth)
        .attr('height', finalHeight)
        .attr('viewBox', `0 0 ${finalWidth} ${finalHeight}`);

    svg.append('style').html(createBitmapCss(MINECRAFT_GRASS_PATTERNS));
    addPatternDefinitions(svg, MINECRAFT_GRASS_PATTERNS);

    if (config.background === 'sky') {
        svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', finalWidth)
            .attr('height', finalHeight)
            .attr('fill', 'url(#skyGradient)');

        const defs = svg.select('defs');
        const skyGradient = defs
            .append('linearGradient')
            .attr('id', 'skyGradient')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', 0)
            .attr('y2', 1);
        skyGradient.append('stop').attr('offset', '0%').attr('stop-color', '#93d5ff');
        skyGradient.append('stop').attr('offset', '100%').attr('stop-color', '#f4fbff');
    }

    const world = svg.append('g').attr(
        'transform',
        `translate(${toFixed(offsetX)} ${toFixed(offsetY)})`,
    );
    const layers = new Map<number, d3.Selection<SVGGElement, unknown, null, unknown>>();

    [...new Set(metrics.map((metric) => metric.week + metric.dayOfWeek))]
        .sort((left, right) => left - right)
        .forEach((depth) => {
            layers.set(depth, world.append('g').attr('data-depth', depth));
        });

    metrics.forEach((metric) => {
        const baseX = (metric.week - metric.dayOfWeek) * dx;
        const baseY = (metric.week + metric.dayOfWeek) * dy;
        const layer = layers.get(metric.week + metric.dayOfWeek);
        if (!layer) {
            return;
        }

        const block = layer
            .append('g')
            .attr(
                'transform',
                `translate(${toFixed(baseX)} ${toFixed(baseY - metric.calHeight)})`,
            );

        const pattern = MINECRAFT_GRASS_PATTERNS[metric.contributionLevel];
        const topWidth = Math.max(1, pattern.top.width);
        const leftWidth = Math.max(1, pattern.left.width);
        const rightWidth = Math.max(1, pattern.right.width);
        const leftScale = Math.sqrt(dxx ** 2 + dyy ** 2) / leftWidth;
        const rightScale = Math.sqrt(dxx ** 2 + dyy ** 2) / rightWidth;
        const topScaleX = dxx / topWidth;
        const topScaleY = (2 * dyy) / topWidth;
        const topSkewX = atanDegrees(dxx / 2 / dyy);

        block.append('rect')
            .attr('class', 'panel')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', topWidth)
            .attr('height', topWidth)
            .attr(
                'transform',
                `skewY(${-ANGLE}) skewX(${toFixed(topSkewX)}) scale(${toFixed(
                    topScaleX,
                )} ${toFixed(topScaleY)})`,
            )
            .attr('fill', `url(#pattern_${metric.contributionLevel}_top)`);

        block.append('rect')
            .attr('class', 'panel')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', leftWidth)
            .attr('height', toFixed(metric.calHeight / leftScale))
            .attr(
                'transform',
                `skewY(${ANGLE}) scale(${toFixed(dxx / leftWidth)} ${toFixed(
                    leftScale,
                )})`,
            )
            .attr('fill', `url(#pattern_${metric.contributionLevel}_left)`);

        block.append('rect')
            .attr('class', 'panel')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', rightWidth)
            .attr('height', toFixed(metric.calHeight / rightScale))
            .attr(
                'transform',
                `translate(${toFixed(dxx)} ${toFixed(dyy)}) skewY(${-ANGLE}) scale(${toFixed(
                    dxx / rightWidth,
                )} ${toFixed(rightScale)})`,
            )
            .attr('fill', `url(#pattern_${metric.contributionLevel}_right)`);
    });

    if (config.showHud) {
        addHud(svg, userSnapshot, config.weeks);
    }

    return container.html();
};
