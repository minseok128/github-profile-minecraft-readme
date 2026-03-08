import type { CalendarMetric, RenderConfig, UserSnapshot } from '../types.js';
import { formatThousands, toFixed, toIsoDate, trimLastWeeks } from '../utils.js';
import {
    KOREAN_BLOSSOM_COVER_STOPS,
    KOREAN_LEAF_LITTER_COVER_STOPS,
    KOREAN_SPRING_FLOWER_COVER_STOPS,
    KOREAN_SEASONAL_GRASS_STOPS,
    KOREAN_SNOW_COVER_STOPS,
    KOREAN_SUMMER_FLOWER_COVER_STOPS,
    KOREAN_SUMMER_WATER_COVER_STOPS,
} from './minecraft-grass-theme.js';
import { buildSheepPopulationPlans } from './sheep-planner.js';

const SHEEP_TARGET_HEIGHT_BLOCKS = 1.3;

const toEpochDays = (date: Date): number =>
    Math.floor(date.getTime() / (24 * 60 * 60 * 1000));

const calcCalHeight = (contributionCount: number): number =>
    Math.log10(contributionCount / 20 + 1) * 144 + 3;

const calcWorldHeight = (
    contributionCount: number,
    contributionLevel: number,
): number => {
    if (contributionLevel === 0) {
        return 1;
    }
    return toFixed(1 + calcCalHeight(contributionCount) / 54);
};

const buildCalendarMetrics = (
    userSnapshot: UserSnapshot,
    weeks: number,
): Array<CalendarMetric> => {
    const visibleCalendar = trimLastWeeks(userSnapshot.calendar, weeks);
    const firstDate = new Date(visibleCalendar[0].date);
    const sundayOfFirstWeek = toEpochDays(firstDate) - firstDate.getUTCDay();

    return visibleCalendar.map((day) => {
        const date = new Date(day.date);
        return {
            contributionCount: day.contributionCount,
            contributionLevel: day.contributionLevel,
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
    if (value >= 1000) {
        const compactValue = Math.round((value / 1000) * 10) / 10;
        return `${compactValue.toFixed(compactValue >= 10 ? 0 : 1)}k`;
    }
    return String(value);
};

const buildMonthGuideEntries = (
    calendarMetrics: Array<CalendarMetric>,
): Array<{
    week: number;
    monthLabel: string;
    detailLabel: string;
}> => {
    const monthFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        timeZone: 'UTC',
    });
    const entries: Array<{
        week: number;
        monthLabel: string;
        detailLabel: string;
    }> = [];
    let previousMonthKey = '';

    calendarMetrics.forEach((metric) => {
        const date = new Date(`${metric.date}T00:00:00Z`);
        const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
        if (monthKey === previousMonthKey) {
            return;
        }

        previousMonthKey = monthKey;
        const monthlyContributionCount = calendarMetrics
            .filter((calendarMetric) => {
                const calendarDate = new Date(`${calendarMetric.date}T00:00:00Z`);
                return (
                    calendarDate.getUTCFullYear() === date.getUTCFullYear() &&
                    calendarDate.getUTCMonth() === date.getUTCMonth()
                );
            })
            .reduce(
                (sum, calendarMetric) => sum + calendarMetric.contributionCount,
                0,
            );

        entries.push({
            week: metric.week,
            monthLabel: monthFormatter.format(date),
            detailLabel: formatCompactContributionCount(monthlyContributionCount),
        });
    });

    return entries;
};

const createHudMarkup = (
    userSnapshot: UserSnapshot,
    period: string,
    visibleDayCount: number,
    config: RenderConfig,
): string => {
    if (!config.showHud) {
        return '';
    }

    return `
  <div class="hud">
    <div class="hud-title">${userSnapshot.username}'s Minecraft Contributions</div>
    <div class="hud-row"><strong>${formatThousands(
        userSnapshot.totalContributions,
    )}</strong> contributions</div>
    <div class="hud-row">${period}</div>
    <div class="hud-row">${visibleDayCount} days, Three.js scene, README-safe export</div>
  </div>`;
};

export const buildSceneHtml = (
    userSnapshot: UserSnapshot,
    config: RenderConfig,
): string => {
    const calendarMetrics = buildCalendarMetrics(userSnapshot, config.weeks);
    const monthGuideEntries = buildMonthGuideEntries(calendarMetrics);
    const period = `${calendarMetrics[0].date} / ${
        calendarMetrics[calendarMetrics.length - 1].date
    }`;
    const sceneData = {
        username: userSnapshot.username,
        totalContributions: userSnapshot.totalContributions,
        period,
        background: config.background,
        showHud: config.showHud,
        showSheep: config.showSheep,
        sheepTargetHeight: SHEEP_TARGET_HEIGHT_BLOCKS,
        calendarMetrics,
        monthGuideEntries,
        sheepPlans: config.showSheep
            ? buildSheepPopulationPlans(calendarMetrics, config.gif.durationSec)
            : [],
        blossomCoverStops: KOREAN_BLOSSOM_COVER_STOPS,
        leafLitterCoverStops: KOREAN_LEAF_LITTER_COVER_STOPS,
        springFlowerCoverStops: KOREAN_SPRING_FLOWER_COVER_STOPS,
        seasonalGrassStops: KOREAN_SEASONAL_GRASS_STOPS,
        snowCoverStops: KOREAN_SNOW_COVER_STOPS,
        summerFlowerCoverStops: KOREAN_SUMMER_FLOWER_COVER_STOPS,
        summerWaterCoverStops: KOREAN_SUMMER_WATER_COVER_STOPS,
    };
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Minecraft Profile Renderer</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
  <style>
    :root {
      color-scheme: light;
      --sky-top: #93d5ff;
      --sky-bottom: #f4fbff;
      --hud-bg: rgba(15, 23, 42, 0.74);
      --hud-text: #f8fafc;
      --hud-muted: #dbeafe;
      --hud-accent: #86efac;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${
          config.background === 'transparent'
              ? 'transparent'
              : 'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.76), transparent 26%), linear-gradient(180deg, var(--sky-top), var(--sky-bottom))'
      };
      font-family: "SF Pro Display", "Segoe UI", sans-serif;
    }

    body {
      position: relative;
    }

    #app {
      width: 100%;
      height: 100%;
    }

    .hud {
      position: absolute;
      top: 18px;
      left: 18px;
      display: grid;
      gap: 6px;
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--hud-bg);
      color: var(--hud-text);
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
      user-select: none;
      pointer-events: none;
    }

    .hud-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--hud-accent);
    }

    .hud-row {
      font-size: 13px;
      line-height: 1.35;
      color: var(--hud-muted);
    }

    .hud strong {
      color: var(--hud-text);
    }
  </style>
</head>
<body>
  <div id="app"></div>
${createHudMarkup(userSnapshot, period, calendarMetrics.length, config)}
  <script type="module">
    import * as THREE from "/vendor/three.module.js";

    const sceneData = ${JSON.stringify(sceneData)};
    const gifDurationSec = ${JSON.stringify(config.gif.durationSec)};
    const assets = {
      sheepTexturePath: "/assets/sheep.png",
      sheepFurTexturePath: "/assets/sheep_fur.png",
      grassTopTexturePath: "/assets/grass_block_top.png",
      grassSideTexturePath: "/assets/grass_block_side.png",
      grassSideOverlayTexturePath: "/assets/grass_block_side_overlay.png",
      grassSnowTexturePath: "/assets/grass_block_snow.png",
      pinkPetalsTexturePath: "/assets/pink_petals.png",
      leafLitterTexturePath: "/assets/leaf_litter.png",
      poppyTexturePath: "/assets/poppy.png",
      dandelionTexturePath: "/assets/dandelion.png",
      cornflowerTexturePath: "/assets/cornflower.png",
      blueOrchidTexturePath: "/assets/blue_orchid.png",
      azureBluetTexturePath: "/assets/azure_bluet.png",
      pinkTulipTexturePath: "/assets/pink_tulip.png",
      whiteTulipTexturePath: "/assets/white_tulip.png",
      snowTexturePath: "/assets/snow.png",
      dirtTexturePath: "/assets/dirt.png",
      waterTopTexturePath: "/assets/water_top.png",
      waterSideTexturePath: "/assets/water_side.png"
    };

    const app = document.getElementById("app");
    const scene = new THREE.Scene();
    if (sceneData.background !== "transparent") {
      scene.fog = new THREE.Fog("#d8f0ff", 20, 74);
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: sceneData.background === "transparent",
      preserveDrawingBuffer: true
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (sceneData.background === "transparent") {
      renderer.setClearColor(0x000000, 0);
    } else {
      renderer.setClearColor("#eef9ff", 0);
    }
    app.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 240);
    const isoDirection = new THREE.Vector3(1, 1, 1).normalize();
    const cameraFitPadding = sceneData.background === "transparent" ? 1.005 : 1.04;
    const calendarCellMap = new Map(
      sceneData.calendarMetrics.map((cell) => [cell.week + ":" + cell.dayOfWeek, cell]),
    );
    const weekHeightMap = new Map();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x7b5a3d, 1.08));

    const sun = new THREE.DirectionalLight(0xfff6d8, 1.34);
    sun.position.set(24, 34, 18);
    sun.castShadow = true;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshLambertMaterial({
        color: "#d4efff",
        transparent: true,
        opacity: sceneData.background === "transparent" ? 0 : 0.22
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.visible = sceneData.background !== "transparent";
    scene.add(ground);

    const textureLoader = new THREE.TextureLoader();
    function loadTexture(path) {
      return new Promise((resolve, reject) => {
        textureLoader.load(
          path,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.generateMipmaps = false;
            texture.flipY = true;
            resolve(texture);
          },
          undefined,
          reject
        );
      });
    }

    function createCanvasTexture(canvas) {
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      return texture;
    }

    function addRoundedRectPath(context, x, y, width, height, radius) {
      const clampedRadius = Math.min(radius, width * 0.5, height * 0.5);
      context.beginPath();
      context.moveTo(x + clampedRadius, y);
      context.lineTo(x + width - clampedRadius, y);
      context.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
      context.lineTo(x + width, y + height - clampedRadius);
      context.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
      context.lineTo(x + clampedRadius, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
      context.lineTo(x, y + clampedRadius);
      context.quadraticCurveTo(x, y, x + clampedRadius, y);
      context.closePath();
    }

    function createLabelMarker(lines, options) {
      const {
        heightWorld,
        paddingX,
        paddingY,
        anchorX,
        anchorY,
        stemHeightWorld,
        stemColor,
        lineGapPx = 4,
      } = options;
      const resolutionScale = 3;
      const normalizedLines = lines.map((line) => ({
        color: line.color || "rgba(31, 41, 30, 0.97)",
        fontSizePx: line.fontSizePx,
        fontWeight: line.fontWeight,
        text: line.text,
      }));
      const measureCanvas = document.createElement("canvas");
      const measureContext = measureCanvas.getContext("2d");
      const lineMeasurements = normalizedLines.map((line) => {
        const font =
          line.fontWeight +
          " " +
          line.fontSizePx +
          "px " +
          '"SF Pro Display", "Segoe UI", sans-serif';
        measureContext.font = font;
        return {
          ...line,
          font,
          width: Math.ceil(measureContext.measureText(line.text).width),
        };
      });
      const maxLineFontSize = lineMeasurements.reduce(
        (maxSize, line) => Math.max(maxSize, line.fontSizePx),
        0,
      );
      const textWidth = lineMeasurements.reduce(
        (maxWidth, line) => Math.max(maxWidth, line.width),
        0,
      );
      const textHeight =
        lineMeasurements.reduce(
          (sum, line) => sum + line.fontSizePx,
          0,
        ) +
        Math.max(0, lineMeasurements.length - 1) * lineGapPx;
      const canvasWidth = Math.max(
        1,
        Math.ceil((textWidth + paddingX * 2) * resolutionScale),
      );
      const canvasHeight = Math.max(
        1,
        Math.ceil((textHeight + paddingY * 2) * resolutionScale),
      );
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const context = canvas.getContext("2d");
      context.scale(resolutionScale, resolutionScale);
      const drawWidth = canvasWidth / resolutionScale;
      const drawHeight = canvasHeight / resolutionScale;
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.lineJoin = "round";
      context.shadowColor = "rgba(255, 255, 255, 0.3)";
      context.shadowBlur = 8;
      addRoundedRectPath(
        context,
        1.5,
        1.5,
        drawWidth - 3,
        drawHeight - 3,
        Math.max(8, maxLineFontSize * 0.38),
      );
      context.fillStyle = "rgba(246, 248, 239, 0.9)";
      context.fill();
      context.shadowBlur = 0;

      const totalTextBlockHeight =
        lineMeasurements.reduce((sum, line) => sum + line.fontSizePx, 0) +
        Math.max(0, lineMeasurements.length - 1) * lineGapPx;
      let currentTop =
        (drawHeight - totalTextBlockHeight) * 0.5;
      lineMeasurements.forEach((line) => {
        context.font = line.font;
        context.strokeStyle = "rgba(255, 255, 255, 0.92)";
        context.lineWidth = Math.max(1.6, line.fontSizePx * 0.14);
        const baselineY = currentTop + line.fontSizePx * 0.84;
        context.strokeText(line.text, drawWidth * 0.5, baselineY);
        context.fillStyle = line.color;
        context.fillText(line.text, drawWidth * 0.5, baselineY);
        currentTop += line.fontSizePx + lineGapPx;
      });

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      const aspect = canvas.width / Math.max(canvas.height, 1);
      const labelWidthWorld = heightWorld * aspect;
      const group = new THREE.Group();

      const stem = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, stemHeightWorld, 0.045),
        new THREE.MeshLambertMaterial({
          color: stemColor,
        }),
      );
      stem.position.y = stemHeightWorld * 0.5;
      stem.castShadow = true;
      stem.receiveShadow = true;
      group.add(stem);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.06, 0.11),
        new THREE.MeshLambertMaterial({
          color: stemColor,
        }),
      );
      cap.position.y = stemHeightWorld;
      cap.castShadow = true;
      cap.receiveShadow = true;
      group.add(cap);

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(labelWidthWorld, heightWorld),
        material,
      );
      panel.renderOrder = 12;
      panel.position.set(
        (0.5 - anchorX) * labelWidthWorld,
        stemHeightWorld + (0.5 - anchorY) * heightWorld + 0.08,
        0,
      );
      panel.quaternion.copy(camera.quaternion);
      group.add(panel);

      group.traverse((node) => {
        node.frustumCulled = false;
      });

      return group;
    }

    function clampChannel(value) {
      return Math.max(0, Math.min(255, Math.round(value)));
    }

    function hexToRgb(hex) {
      const normalized = hex.replace("#", "");
      return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16)
      };
    }

    function rgbToHex(rgb) {
      return "#" + [rgb.r, rgb.g, rgb.b]
        .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
        .join("");
    }

    function mixHexColors(startHex, endHex, t) {
      const clampedT = Math.max(0, Math.min(1, t));
      const start = hexToRgb(startHex);
      const end = hexToRgb(endHex);
      return rgbToHex({
        r: start.r + (end.r - start.r) * clampedT,
        g: start.g + (end.g - start.g) * clampedT,
        b: start.b + (end.b - start.b) * clampedT
      });
    }

    function liftHex(hex, amount) {
      const rgb = hexToRgb(hex);
      if (amount >= 0) {
        return rgbToHex({
          r: rgb.r + (255 - rgb.r) * amount,
          g: rgb.g + (255 - rgb.g) * amount,
          b: rgb.b + (255 - rgb.b) * amount
        });
      }
      const darken = 1 + amount;
      return rgbToHex({
        r: rgb.r * darken,
        g: rgb.g * darken,
        b: rgb.b * darken
      });
    }

    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }

    function toDayOfYear(year, month, day) {
      const monthOffsets = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
      const leapOffset = isLeapYear(year) && month > 2 ? 1 : 0;
      return monthOffsets[month - 1] + day + leapOffset;
    }

    function hashString(value) {
      let hash = 2166136261;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0) / 4294967296;
    }

    function getSeasonalGrassTint(isoDate, contributionLevel) {
      const [yearText, monthText, dayText] = isoDate.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      const dayOfYear = toDayOfYear(year, month, day);
      const daysInYear = isLeapYear(year) ? 366 : 365;
      const yearlyStops = sceneData.seasonalGrassStops
        .map((stop) => ({
          day: toDayOfYear(year, stop.month, stop.day),
          color: stop.color
        }))
        .sort((left, right) => left.day - right.day);
      const extendedStops = [
        {
          day: yearlyStops[yearlyStops.length - 1].day - daysInYear,
          color: yearlyStops[yearlyStops.length - 1].color
        },
        ...yearlyStops,
        {
          day: yearlyStops[0].day + daysInYear,
          color: yearlyStops[0].color
        }
      ];

      let leftStop = extendedStops[0];
      let rightStop = extendedStops[1];
      for (let index = 0; index < extendedStops.length - 1; index += 1) {
        const left = extendedStops[index];
        const right = extendedStops[index + 1];
        if (dayOfYear >= left.day && dayOfYear < right.day) {
          leftStop = left;
          rightStop = right;
          break;
        }
      }

      const range = Math.max(1, rightStop.day - leftStop.day);
      const seasonalColor = mixHexColors(
        leftStop.color,
        rightStop.color,
        (dayOfYear - leftStop.day) / range,
      );
      const contributionLift = [0, 0.015, 0.035, 0.06, 0.09][contributionLevel] ?? 0;
      return liftHex(seasonalColor, contributionLift);
    }

    function getInterpolatedSeasonalAmount(isoDate, stops) {
      const [yearText, monthText, dayText] = isoDate.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      const dayOfYear = toDayOfYear(year, month, day);
      const daysInYear = isLeapYear(year) ? 366 : 365;
      const yearlyStops = stops
        .map((stop) => ({
          day: toDayOfYear(year, stop.month, stop.day),
          amount: stop.amount
        }))
        .sort((left, right) => left.day - right.day);
      const extendedStops = [
        {
          day: yearlyStops[yearlyStops.length - 1].day - daysInYear,
          amount: yearlyStops[yearlyStops.length - 1].amount
        },
        ...yearlyStops,
        {
          day: yearlyStops[0].day + daysInYear,
          amount: yearlyStops[0].amount
        }
      ];

      let leftStop = extendedStops[0];
      let rightStop = extendedStops[1];
      for (let index = 0; index < extendedStops.length - 1; index += 1) {
        const left = extendedStops[index];
        const right = extendedStops[index + 1];
        if (dayOfYear >= left.day && dayOfYear < right.day) {
          leftStop = left;
          rightStop = right;
          break;
        }
      }

      const range = Math.max(1, rightStop.day - leftStop.day);
      const t = Math.max(0, Math.min(1, (dayOfYear - leftStop.day) / range));
      return leftStop.amount + (rightStop.amount - leftStop.amount) * t;
    }

    function getSnowCoverage(isoDate) {
      return getInterpolatedSeasonalAmount(isoDate, sceneData.snowCoverStops);
    }

    function getBlossomCoverage(isoDate) {
      return getInterpolatedSeasonalAmount(isoDate, sceneData.blossomCoverStops);
    }

    function getLeafLitterCoverage(isoDate) {
      return getInterpolatedSeasonalAmount(isoDate, sceneData.leafLitterCoverStops);
    }

    function getSpringFlowerCoverage(isoDate) {
      return getInterpolatedSeasonalAmount(isoDate, sceneData.springFlowerCoverStops);
    }

    function getSummerFlowerCoverage(isoDate) {
      return getInterpolatedSeasonalAmount(isoDate, sceneData.summerFlowerCoverStops);
    }

    function getSummerWaterCoverage(isoDate) {
      return getInterpolatedSeasonalAmount(isoDate, sceneData.summerWaterCoverStops);
    }

    function createTintedTopTexture(baseTexture, tintHex) {
      const canvas = document.createElement("canvas");
      canvas.width = baseTexture.image.width;
      canvas.height = baseTexture.image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(baseTexture.image, 0, 0);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = tintHex;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      return createCanvasTexture(canvas);
    }

    function createTintedSideTexture(baseTexture, overlayTexture, tintHex) {
      const canvas = document.createElement("canvas");
      canvas.width = baseTexture.image.width;
      canvas.height = baseTexture.image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(baseTexture.image, 0, 0);

      const overlayCanvas = document.createElement("canvas");
      overlayCanvas.width = overlayTexture.image.width;
      overlayCanvas.height = overlayTexture.image.height;
      const overlayCtx = overlayCanvas.getContext("2d");
      overlayCtx.drawImage(overlayTexture.image, 0, 0);
      overlayCtx.globalCompositeOperation = "source-atop";
      overlayCtx.fillStyle = tintHex;
      overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlayCtx.globalCompositeOperation = "source-over";

      ctx.drawImage(overlayCanvas, 0, 0);
      return createCanvasTexture(canvas);
    }

    function createOverlayTopTexture(baseTexture, overlayTexture, tintHex = null) {
      const canvas = document.createElement("canvas");
      canvas.width = baseTexture.image.width;
      canvas.height = baseTexture.image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(baseTexture.image, 0, 0);

      if (tintHex) {
        const overlayCanvas = document.createElement("canvas");
        overlayCanvas.width = overlayTexture.image.width;
        overlayCanvas.height = overlayTexture.image.height;
        const overlayCtx = overlayCanvas.getContext("2d");
        overlayCtx.drawImage(overlayTexture.image, 0, 0);
        overlayCtx.globalCompositeOperation = "source-atop";
        overlayCtx.fillStyle = tintHex;
        overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        overlayCtx.globalCompositeOperation = "source-over";
        ctx.drawImage(overlayCanvas, 0, 0);
      } else {
        ctx.drawImage(overlayTexture.image, 0, 0);
      }

      return createCanvasTexture(canvas);
    }

    function createStackedSideTexture(topTileTexture, fillTileTexture, totalHeightBlocks) {
      const tileWidth = topTileTexture.image.width;
      const tileHeight = topTileTexture.image.height;
      const totalPixelHeight = Math.max(tileHeight, Math.round(tileHeight * totalHeightBlocks));
      const canvas = document.createElement("canvas");
      canvas.width = tileWidth;
      canvas.height = totalPixelHeight;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;

      const topSegmentHeight = Math.min(tileHeight, totalPixelHeight);
      ctx.drawImage(
        topTileTexture.image,
        0,
        0,
        tileWidth,
        topSegmentHeight,
        0,
        0,
        tileWidth,
        topSegmentHeight,
      );

      let destY = topSegmentHeight;
      while (destY < totalPixelHeight) {
        const drawHeight = Math.min(tileHeight, totalPixelHeight - destY);
        ctx.drawImage(
          fillTileTexture.image,
          0,
          0,
          tileWidth,
          drawHeight,
          0,
          destY,
          tileWidth,
          drawHeight,
        );
        destY += drawHeight;
      }

      return createCanvasTexture(canvas);
    }

    function createPartialOverlayTopTexture(
      baseTexture,
      overlayTexture,
      tintHex,
      sourceRect,
      targetRect,
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = baseTexture.image.width;
      canvas.height = baseTexture.image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(baseTexture.image, 0, 0);

      const overlayCanvas = document.createElement("canvas");
      overlayCanvas.width = overlayTexture.image.width;
      overlayCanvas.height = overlayTexture.image.height;
      const overlayCtx = overlayCanvas.getContext("2d");
      overlayCtx.drawImage(overlayTexture.image, 0, 0);
      overlayCtx.globalCompositeOperation = "source-atop";
      overlayCtx.fillStyle = tintHex;
      overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlayCtx.globalCompositeOperation = "source-over";

      ctx.drawImage(
        overlayCanvas,
        sourceRect.x,
        sourceRect.y,
        sourceRect.width,
        sourceRect.height,
        targetRect.x,
        targetRect.y,
        targetRect.width,
        targetRect.height,
      );

      return createCanvasTexture(canvas);
    }

    function createSpriteTopOverlay(baseTexture, overlayTexture, x, y, size) {
      const canvas = document.createElement("canvas");
      canvas.width = baseTexture.image.width;
      canvas.height = baseTexture.image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(baseTexture.image, 0, 0);
      ctx.drawImage(overlayTexture.image, 0, 0, 16, 16, x, y, size, size);
      return createCanvasTexture(canvas);
    }

    function createPlantMaterial(map) {
      return new THREE.MeshLambertMaterial({
        map,
        transparent: true,
        alphaTest: 0.12,
        side: THREE.DoubleSide,
      });
    }

    function createCrossPlant(texture, x, y, z, rotation, scale = 0.62) {
      const height = scale;
      const geometry = new THREE.PlaneGeometry(scale, height);
      const material = createPlantMaterial(texture);
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const planeA = new THREE.Mesh(geometry, material);
      planeA.position.y = height * 0.5;
      planeA.rotation.y = rotation;
      group.add(planeA);

      const planeB = new THREE.Mesh(geometry, material.clone());
      planeB.position.y = height * 0.5;
      planeB.rotation.y = rotation + Math.PI / 2;
      group.add(planeB);

      group.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = false;
          node.renderOrder = 2;
        }
      });

      return group;
    }

    const [
      sheepBaseTexture,
      sheepFurTexture,
      grassTopTexture,
      grassSideTexture,
      grassSideOverlayTexture,
      grassSnowTexture,
      pinkPetalsTexture,
      leafLitterTexture,
      poppyTexture,
      dandelionTexture,
      cornflowerTexture,
      blueOrchidTexture,
      azureBluetTexture,
      pinkTulipTexture,
      whiteTulipTexture,
      snowTexture,
      dirtTexture,
      waterTopTexture,
      waterSideTexture
    ] = await Promise.all([
      loadTexture(assets.sheepTexturePath),
      loadTexture(assets.sheepFurTexturePath),
      loadTexture(assets.grassTopTexturePath),
      loadTexture(assets.grassSideTexturePath),
      loadTexture(assets.grassSideOverlayTexturePath),
      loadTexture(assets.grassSnowTexturePath),
      loadTexture(assets.pinkPetalsTexturePath),
      loadTexture(assets.leafLitterTexturePath),
      loadTexture(assets.poppyTexturePath),
      loadTexture(assets.dandelionTexturePath),
      loadTexture(assets.cornflowerTexturePath),
      loadTexture(assets.blueOrchidTexturePath),
      loadTexture(assets.azureBluetTexturePath),
      loadTexture(assets.pinkTulipTexturePath),
      loadTexture(assets.whiteTulipTexturePath),
      loadTexture(assets.snowTexturePath),
      loadTexture(assets.dirtTexturePath),
      loadTexture(assets.waterTopTexturePath),
      loadTexture(assets.waterSideTexturePath)
    ]);

    const springFlowerTextures = [
      pinkTulipTexture,
      whiteTulipTexture,
      azureBluetTexture,
      pinkTulipTexture,
    ];
    const summerFlowerTextures = [
      poppyTexture,
      dandelionTexture,
      cornflowerTexture,
      blueOrchidTexture,
      poppyTexture,
    ];
    const waterMaterials = [
      new THREE.MeshPhongMaterial({
        map: waterSideTexture,
        color: new THREE.Color("#3f76e4"),
        transparent: true,
        opacity: 0.86,
        shininess: 110,
        specular: new THREE.Color("#dff8ff"),
        emissive: new THREE.Color("#163d82"),
        emissiveIntensity: 0.18,
        depthWrite: false,
      }),
      new THREE.MeshPhongMaterial({
        map: waterSideTexture,
        color: new THREE.Color("#3f76e4"),
        transparent: true,
        opacity: 0.86,
        shininess: 110,
        specular: new THREE.Color("#dff8ff"),
        emissive: new THREE.Color("#163d82"),
        emissiveIntensity: 0.18,
        depthWrite: false,
      }),
      new THREE.MeshPhongMaterial({
        map: waterTopTexture,
        color: new THREE.Color("#4d88f0"),
        transparent: true,
        opacity: 0.9,
        shininess: 135,
        specular: new THREE.Color("#effcff"),
        emissive: new THREE.Color("#18427d"),
        emissiveIntensity: 0.18,
        depthWrite: false,
      }),
      new THREE.MeshPhongMaterial({
        map: waterSideTexture,
        color: new THREE.Color("#3568d7"),
        transparent: true,
        opacity: 0.84,
        shininess: 100,
        specular: new THREE.Color("#cfefff"),
        emissive: new THREE.Color("#12315f"),
        emissiveIntensity: 0.14,
        depthWrite: false,
      }),
      new THREE.MeshPhongMaterial({
        map: waterSideTexture,
        color: new THREE.Color("#3f76e4"),
        transparent: true,
        opacity: 0.86,
        shininess: 110,
        specular: new THREE.Color("#dff8ff"),
        emissive: new THREE.Color("#163d82"),
        emissiveIntensity: 0.18,
        depthWrite: false,
      }),
      new THREE.MeshPhongMaterial({
        map: waterSideTexture,
        color: new THREE.Color("#3f76e4"),
        transparent: true,
        opacity: 0.86,
        shininess: 110,
        specular: new THREE.Color("#dff8ff"),
        emissive: new THREE.Color("#163d82"),
        emissiveIntensity: 0.18,
        depthWrite: false,
      }),
    ];

    const selectedWaterKeys = new Set(
      sceneData.calendarMetrics
        .filter((cell) => cell.contributionLevel === 0)
        .map((cell) => cell.week + ":" + cell.dayOfWeek),
    );
    const baseWaterGeometry = new THREE.BoxGeometry(1, 1, 1);
    const waterGeometryCache = new Map();

    function getWaterGeometryKey(cell) {
      return [
        selectedWaterKeys.has(cell.week + 1 + ":" + cell.dayOfWeek) ? "0" : "1",
        selectedWaterKeys.has(cell.week - 1 + ":" + cell.dayOfWeek) ? "0" : "1",
        "1",
        "1",
        selectedWaterKeys.has(cell.week + ":" + (cell.dayOfWeek + 1)) ? "0" : "1",
        selectedWaterKeys.has(cell.week + ":" + (cell.dayOfWeek - 1)) ? "0" : "1",
      ].join("");
    }

    function getWaterBlockGeometry(cell) {
      const key = getWaterGeometryKey(cell);
      if (waterGeometryCache.has(key)) {
        return waterGeometryCache.get(key);
      }

      const geometry = baseWaterGeometry.clone();
      const visibleFaces = key.split("").map((value) => value === "1");
      geometry.clearGroups();
      baseWaterGeometry.groups.forEach((group, faceIndex) => {
        if (visibleFaces[faceIndex]) {
          geometry.addGroup(group.start, group.count, group.materialIndex);
        }
      });
      waterGeometryCache.set(key, geometry);
      return geometry;
    }

    const blockMaterialCache = new Map();
    function getBlockMaterials(cell) {
      const isWaterCell = selectedWaterKeys.has(cell.week + ":" + cell.dayOfWeek);
      const cacheKey = cell.date + ":" + cell.contributionLevel + ":" + (isWaterCell ? "water" : "land");
      if (blockMaterialCache.has(cacheKey)) {
        return blockMaterialCache.get(cacheKey);
      }

      if (isWaterCell) {
        const materials = waterMaterials.map((material) => material.clone());
        blockMaterialCache.set(cacheKey, materials);
        return materials;
      }

      let topTexture = dirtTexture;
      let sideTexture = dirtTexture;
      if (cell.contributionLevel > 0) {
        const snowCoverage = getSnowCoverage(cell.date);
        const hasSnowCover =
          snowCoverage > 0 &&
          hashString(cell.date + ":" + cell.contributionLevel) < snowCoverage;
        if (hasSnowCover) {
          topTexture = snowTexture;
          sideTexture = createStackedSideTexture(
            grassSnowTexture,
            dirtTexture,
            cell.worldHeight,
          );
        } else {
          const tintHex = getSeasonalGrassTint(cell.date, cell.contributionLevel);
          topTexture = createTintedTopTexture(grassTopTexture, tintHex);
          sideTexture = createStackedSideTexture(
            createTintedSideTexture(
              grassSideTexture,
              grassSideOverlayTexture,
              tintHex,
            ),
            dirtTexture,
            cell.worldHeight,
          );

          const blossomCoverage = getBlossomCoverage(cell.date);
          const hasBlossom =
            blossomCoverage > 0 &&
            hashString(cell.date + ":blossom:" + cell.week + ":" + cell.dayOfWeek) <
              blossomCoverage;
          if (hasBlossom) {
            topTexture = createOverlayTopTexture(topTexture, pinkPetalsTexture);
          }

          const leafLitterCoverage = getLeafLitterCoverage(cell.date);
          const hasLeafLitter =
            leafLitterCoverage > 0 &&
            hashString(cell.date + ":leaf:" + cell.week + ":" + cell.dayOfWeek) <
              leafLitterCoverage;
          if (hasLeafLitter) {
            topTexture = createPartialOverlayTopTexture(
              topTexture,
              leafLitterTexture,
              "#8b5a2b",
              { x: 0, y: 0, width: 8, height: 16 },
              { x: 0, y: 0, width: 8, height: 16 },
            );
          }

        }
      }

      const materials = [
        new THREE.MeshLambertMaterial({ map: sideTexture }),
        new THREE.MeshLambertMaterial({ map: sideTexture }),
        new THREE.MeshLambertMaterial({ map: topTexture }),
        new THREE.MeshLambertMaterial({ map: dirtTexture }),
        new THREE.MeshLambertMaterial({ map: sideTexture }),
        new THREE.MeshLambertMaterial({ map: sideTexture })
      ];
      blockMaterialCache.set(cacheKey, materials);
      return materials;
    }

    const blocks = [];
    sceneData.calendarMetrics.forEach((cell) => {
      const weekHeights = weekHeightMap.get(cell.week) || [];
      weekHeights.push(cell.worldHeight);
      weekHeightMap.set(cell.week, weekHeights);
      const isWaterCell = selectedWaterKeys.has(cell.week + ":" + cell.dayOfWeek);

      const block = new THREE.Mesh(
        isWaterCell
          ? getWaterBlockGeometry(cell)
          : new THREE.BoxGeometry(1, cell.worldHeight, 1),
        getBlockMaterials(cell)
      );
      block.position.set(cell.week, cell.worldHeight * 0.5, cell.dayOfWeek);
      block.castShadow = !isWaterCell;
      block.receiveShadow = true;
      scene.add(block);
      blocks.push(block);
    });

    const floraDecorations = [];
    function pickFlowerTexture(textures, seed) {
      if (textures.length === 0) {
        return null;
      }
      return textures[Math.floor(seed * textures.length) % textures.length];
    }

    sceneData.calendarMetrics.forEach((cell) => {
      if (cell.contributionLevel === 0) {
        return;
      }

      const snowCoverage = getSnowCoverage(cell.date);
      const hasSnowCover =
        snowCoverage > 0 &&
        hashString(cell.date + ":" + cell.contributionLevel) < snowCoverage;
      if (hasSnowCover) {
        return;
      }

      const springFlowerCoverage = getSpringFlowerCoverage(cell.date);
      const summerFlowerCoverage = getSummerFlowerCoverage(cell.date);
      const flowerCoverage = Math.max(springFlowerCoverage, summerFlowerCoverage);
      if (flowerCoverage <= 0) {
        return;
      }

      const seasonalTextures =
        springFlowerCoverage >= summerFlowerCoverage
          ? springFlowerTextures
          : summerFlowerTextures;
      const flowerRoll = hashString(
        cell.date + ":flora:" + cell.week + ":" + cell.dayOfWeek,
      );
      if (flowerRoll >= flowerCoverage) {
        return;
      }

      const flowerCount = flowerRoll < flowerCoverage * 0.28 ? 2 : 1;
      const offsets =
        flowerCount === 2
          ? [
              [-0.18, 0.12],
              [0.14, -0.1],
            ]
          : [[-0.02, 0.04]];

      offsets.forEach(([offsetX, offsetZ], flowerIndex) => {
        const texture = pickFlowerTexture(
          seasonalTextures,
          hashString(
            cell.date +
              ":flora:texture:" +
              flowerIndex +
              ":" +
              cell.week +
              ":" +
              cell.dayOfWeek,
          ),
        );
        if (!texture) {
          return;
        }

        const scale =
          0.48 +
          hashString(
            cell.date +
              ":flora:scale:" +
              flowerIndex +
              ":" +
              cell.week +
              ":" +
              cell.dayOfWeek,
          ) *
            0.1;
        const rotation =
          hashString(
            cell.date +
              ":flora:rotation:" +
              flowerIndex +
              ":" +
              cell.week +
              ":" +
              cell.dayOfWeek,
          ) *
          Math.PI;
        const flower = createCrossPlant(
          texture,
          cell.week + offsetX,
          cell.worldHeight + 0.02,
          cell.dayOfWeek + offsetZ,
          rotation,
          scale,
        );
        scene.add(flower);
        floraDecorations.push(flower);
      });
    });

    function createSheepMaterial(map) {
      return new THREE.MeshStandardMaterial({
        map,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        alphaTest: 0.08
      });
    }

    const sheepBaseMaterial = createSheepMaterial(sheepBaseTexture);
    const sheepFurMaterial = createSheepMaterial(sheepFurTexture);
    const unit = 1 / 16;

    function setBedrockBoxUv(geometry, uvOrigin, sizePx, textureWidth = 64, textureHeight = 32) {
      const u = uvOrigin[0];
      const v = uvOrigin[1];
      const sx = sizePx[0];
      const sy = sizePx[1];
      const sz = sizePx[2];
      const rect = {
        left: [u, v + sz, sz, sy],
        front: [u + sz, v + sz, sx, sy],
        right: [u + sz + sx, v + sz, sz, sy],
        back: [u + sz + sx + sz, v + sz, sx, sy],
        top: [u + sz, v, sx, sz],
        bottom: [u + sz + sx, v, sx, sz]
      };

      const faceOrder = ["right", "left", "top", "bottom", "back", "front"];
      const uvAttr = geometry.attributes.uv;

      faceOrder.forEach((face, faceIndex) => {
        const current = rect[face];
        const x = current[0];
        const y = current[1];
        const w = current[2];
        const h = current[3];
        const u0 = x / textureWidth;
        const u1 = (x + w) / textureWidth;
        const v0 = 1 - (y + h) / textureHeight;
        const v1 = 1 - y / textureHeight;
        const flipX = face === "right" || face === "back" || face === "top" || face === "bottom";
        const ua = flipX ? u1 : u0;
        const ub = flipX ? u0 : u1;
        const i = faceIndex * 4;
        uvAttr.setXY(i + 0, ua, v1);
        uvAttr.setXY(i + 1, ub, v1);
        uvAttr.setXY(i + 2, ua, v0);
        uvAttr.setXY(i + 3, ub, v0);
      });

      uvAttr.needsUpdate = true;
    }

    function makeTexturedBox(sizePx, uvOrigin, material, textureWidth = 64, textureHeight = 32, scale = [1, 1, 1]) {
      const geometry = new THREE.BoxGeometry(sizePx[0] * unit, sizePx[1] * unit, sizePx[2] * unit);
      setBedrockBoxUv(geometry, uvOrigin, sizePx, textureWidth, textureHeight);
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.scale.set(scale[0], scale[1], scale[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    function buildSheep() {
      const root = new THREE.Group();
      const legLength = 12 * unit;
      const legPivots = [];
      const legOffsets = [
        [-3 * unit, 7 * unit],
        [3 * unit, 7 * unit],
        [-3 * unit, -5 * unit],
        [3 * unit, -5 * unit]
      ];

      legOffsets.forEach(([x, z]) => {
        const pivot = new THREE.Group();
        pivot.position.set(x, legLength, z);

        const shearedLeg = makeTexturedBox([4, 12, 4], [0, 16], sheepBaseMaterial);
        shearedLeg.position.y = -6 * unit;
        pivot.add(shearedLeg);

        const woolLeg = makeTexturedBox(
          [4, 6, 4],
          [0, 16],
          sheepFurMaterial,
          64,
          32,
          [5 / 4, 7 / 6, 5 / 4]
        );
        woolLeg.position.y = -3 * unit;
        pivot.add(woolLeg);

        root.add(pivot);
        legPivots.push(pivot);
      });

      const bodyGroup = new THREE.Group();
      bodyGroup.position.y = legLength + 3 * unit;
      bodyGroup.rotation.x = -Math.PI / 2;
      root.add(bodyGroup);

      bodyGroup.add(makeTexturedBox([8, 16, 6], [28, 8], sheepBaseMaterial));
      bodyGroup.add(
        makeTexturedBox(
          [8, 16, 6],
          [28, 8],
          sheepFurMaterial,
          64,
          32,
          [11.5 / 8, 19.5 / 16, 9.5 / 6]
        )
      );

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 18 * unit, -8 * unit);
      root.add(headPivot);

      const headRig = new THREE.Group();
      headPivot.add(headRig);

      const headNeck = new THREE.Group();
      headNeck.position.set(0, 2.5 * unit, 1.75 * unit);
      headRig.add(headNeck);

      const headModel = new THREE.Group();
      headModel.position.set(0, -2.5 * unit, -1.75 * unit);
      headNeck.add(headModel);

      const headSheared = makeTexturedBox([6, 6, 8], [0, 0], sheepBaseMaterial);
      headSheared.position.set(0, 1 * unit, -2 * unit);
      headModel.add(headSheared);

      const headWool = makeTexturedBox(
        [6, 6, 6],
        [0, 0],
        sheepFurMaterial,
        64,
        32,
        [1.2, 1.2, 1.2]
      );
      headWool.position.set(0, 1 * unit, -1 * unit);
      headModel.add(headWool);

      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      root.scale.setScalar(sceneData.sheepTargetHeight / size.y);

      return { root, legPivots, bodyGroup, headPivot, headNeck, headRig };
    }

    function createSheepInstance(colorHex) {
      const sheep = buildSheep();
      sheep.root.traverse((node) => {
        if (node.isMesh && node.material && node.material.map === sheepFurTexture) {
          const tintedMaterial = node.material.clone();
          tintedMaterial.color = new THREE.Color(colorHex);
          node.material = tintedMaterial;
        }
      });

      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.58, 28),
        new THREE.MeshBasicMaterial({
          color: "#000000",
          transparent: true,
          opacity: 0.16
        })
      );
      shadow.rotation.x = -Math.PI / 2;
      scene.add(sheep.root);
      scene.add(shadow);
      return { ...sheep, shadow };
    }

    function getYawBetween(start, end) {
      const flatDelta = end.clone().sub(start);
      flatDelta.y = 0;
      return Math.atan2(flatDelta.x, flatDelta.z) + Math.PI;
    }

    const sheepBodyBaseY = 15 * unit;
    const sheepHeadBaseY = 18 * unit;
    const sheepHeadBaseZ = -8 * unit;
    const sheepHeadNeutralRotation = THREE.MathUtils.degToRad(-10);
    const sheepHeadRigBaseY = 0;
    const sheepHeadRigBaseZ = 0;
    const grazeAnimationLengthSec = 2.0;
    const grazeHeadRigLowerAmount = 9 * unit;
    const grazeHeadBaseRotation = THREE.MathUtils.degToRad(-36);
    const grazeHeadChewAmplitude = THREE.MathUtils.degToRad(10);
    const grazeHeadChewDropAmount = 0.5 * unit;
    const loopDurationSec = Math.max(gifDurationSec, 0.001);
    const clock = new THREE.Clock();
    let autoAnimate = true;
    let manualSceneTimeSec = 0;
    let animationTimeOffsetSec = 0;

    function wrapLoopTime(timeSec) {
      const wrapped = timeSec % loopDurationSec;
      return wrapped < 0 ? wrapped + loopDurationSec : wrapped;
    }

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function buildRouteMetrics(points) {
      const cumulativeDistances = [0];
      for (let index = 1; index < points.length; index += 1) {
        cumulativeDistances.push(
          cumulativeDistances[index - 1] + points[index - 1].distanceTo(points[index]),
        );
      }
      return {
        points,
        cumulativeDistances,
        totalLength: cumulativeDistances[cumulativeDistances.length - 1] || 0,
      };
    }

    const sheepInstances = sceneData.showSheep
      ? sceneData.sheepPlans.map((plan, sheepIndex) => {
          const route = plan.route.map((cell) =>
            new THREE.Vector3(cell.week, cell.worldHeight + 0.01, cell.dayOfWeek),
          );
          return {
            ...createSheepInstance(plan.colorHex),
            islandId: plan.islandId,
            sheepIndex,
            islandSheepCount: plan.islandSheepCount,
            route,
            routeMetrics: buildRouteMetrics(route),
            loopPlan: plan.loopPlan,
            gaitPhaseOffset: plan.loopPlan.phaseOffsetSec * 5.2 + sheepIndex * 0.85,
            idlePhaseOffset: plan.loopPlan.phaseOffsetSec * 2.1 + sheepIndex * 0.37,
            grazePhaseOffset: plan.loopPlan.phaseOffsetSec * 1.35 + sheepIndex * 0.19,
            state: "walk",
            routeIndex: 0,
          };
        })
      : [];

    const contentBounds = new THREE.Box3();
    const tempBounds = new THREE.Box3();

    blocks.forEach((block) => {
      tempBounds.setFromObject(block);
      contentBounds.union(tempBounds);
    });

    floraDecorations.forEach((floraDecoration) => {
      tempBounds.setFromObject(floraDecoration);
      contentBounds.union(tempBounds);
    });

    sheepInstances.forEach((sheepInstance) => {
      sheepInstance.route.forEach((point) => {
        contentBounds.expandByPoint(new THREE.Vector3(point.x - 0.45, point.y, point.z - 0.45));
        contentBounds.expandByPoint(
          new THREE.Vector3(point.x + 0.45, point.y + sceneData.sheepTargetHeight, point.z + 0.45)
        );
      });
    });

    function getWeekGuideHeight(week) {
      const heights = weekHeightMap.get(week) || [];
      return heights.length > 0 ? Math.max(...heights) : 1;
    }

    function buildCalendarGuideMarkers() {
      const guideStemBaseY = 0.03;
      const guideCardBottomY = Math.max(contentBounds.max.y + 0.98, 3.45);

      sceneData.monthGuideEntries.forEach((entry) => {
        const baseY = guideStemBaseY;
        const monthMarker = createLabelMarker([
          {
            text: entry.monthLabel,
            fontSizePx: 36,
            fontWeight: 700,
          },
          {
            text: entry.detailLabel,
            fontSizePx: 36,
            fontWeight: 600,
            color: "rgba(72, 86, 61, 0.92)",
          },
        ], {
          heightWorld: 1.56,
          paddingX: 24,
          paddingY: 18,
          anchorX: 0.5,
          anchorY: 0,
          stemHeightWorld: Math.max(0.56, guideCardBottomY - baseY - 0.08),
          stemColor: "#7b8f71",
          lineGapPx: 6,
        });
        monthMarker.position.set(
          entry.week + 0.14,
          baseY,
          -0.42,
        );
        scene.add(monthMarker);
      });
    }

    if (contentBounds.isEmpty()) {
      contentBounds.expandByPoint(new THREE.Vector3(0, 0, 0));
      contentBounds.expandByPoint(new THREE.Vector3(1, 1, 1));
    }

    function getBoundsCorners(bounds) {
      const min = bounds.min;
      const max = bounds.max;
      return [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z)
      ];
    }

    function accumulateViewPoint(point, extents) {
      const viewPoint = point.clone().applyMatrix4(camera.matrixWorldInverse);
      extents.minX = Math.min(extents.minX, viewPoint.x);
      extents.maxX = Math.max(extents.maxX, viewPoint.x);
      extents.minY = Math.min(extents.minY, viewPoint.y);
      extents.maxY = Math.max(extents.maxY, viewPoint.y);
    }

    function fitCameraToBounds(bounds) {
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const distance = Math.max(size.x, size.z) * 1.65 + 14;
      camera.position.copy(center.clone().add(isoDirection.clone().multiplyScalar(distance)));
      camera.lookAt(center);
      camera.near = 0.1;
      camera.far = distance * 4;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      if (scene.fog) {
        scene.fog.near = distance * 0.55;
        scene.fog.far = distance * 1.75;
      }

      const extents = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
      };

      blocks.forEach((block) => {
        tempBounds.setFromObject(block);
        getBoundsCorners(tempBounds).forEach((corner) => accumulateViewPoint(corner, extents));
      });

      floraDecorations.forEach((floraDecoration) => {
        tempBounds.setFromObject(floraDecoration);
        getBoundsCorners(tempBounds).forEach((corner) => accumulateViewPoint(corner, extents));
      });

      sheepInstances.forEach((sheepInstance) => {
        sheepInstance.route.forEach((point) => {
          const sheepMin = new THREE.Vector3(point.x - 0.45, point.y, point.z - 0.45);
          const sheepMax = new THREE.Vector3(
            point.x + 0.45,
            point.y + sceneData.sheepTargetHeight,
            point.z + 0.45
          );
          getBoundsCorners(new THREE.Box3(sheepMin, sheepMax)).forEach((corner) =>
            accumulateViewPoint(corner, extents)
          );
        });
      });

      camera.userData.fitHalfWidth = (extents.maxX - extents.minX) * 0.5 * cameraFitPadding;
      camera.userData.fitHalfHeight = (extents.maxY - extents.minY) * 0.5 * cameraFitPadding;
      camera.userData.focusCenter = center.toArray();
      ground.scale.set(size.x + 6, size.z + 6, 1);
      ground.position.set(center.x, 0, center.z);
    }

    fitCameraToBounds(contentBounds);

    function updateCameraFrustum() {
      const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
      const fitHalfWidth = camera.userData.fitHalfWidth || 12;
      const fitHalfHeight = camera.userData.fitHalfHeight || 12;
      const halfHeight = Math.max(fitHalfHeight, fitHalfWidth / aspect);
      const halfWidth = halfHeight * aspect;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
    }

    updateCameraFrustum();
    buildCalendarGuideMarkers();

    function sampleRouteAtProgress(routeMetrics, progress) {
      if (routeMetrics.points.length === 0) {
        return {
          position: new THREE.Vector3(),
          direction: new THREE.Vector3(0, 0, 1),
          distance: 0,
          routeIndex: 0,
        };
      }

      if (routeMetrics.points.length === 1 || routeMetrics.totalLength <= 1e-6) {
        return {
          position: routeMetrics.points[0].clone(),
          direction: new THREE.Vector3(0, 0, 1),
          distance: 0,
          routeIndex: 0,
        };
      }

      const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
      const targetDistance = routeMetrics.totalLength * clampedProgress;

      for (let index = 1; index < routeMetrics.points.length; index += 1) {
        const segmentStartDistance = routeMetrics.cumulativeDistances[index - 1];
        const segmentEndDistance = routeMetrics.cumulativeDistances[index];
        if (targetDistance > segmentEndDistance && index < routeMetrics.points.length - 1) {
          continue;
        }

        const start = routeMetrics.points[index - 1];
        const end = routeMetrics.points[index];
        const segmentLength = Math.max(segmentEndDistance - segmentStartDistance, 1e-6);
        const segmentProgress =
          (targetDistance - segmentStartDistance) / segmentLength;
        return {
          position: start.clone().lerp(end, THREE.MathUtils.clamp(segmentProgress, 0, 1)),
          direction: end.clone().sub(start).normalize(),
          distance: targetDistance,
          routeIndex: index - 1,
        };
      }

      const lastIndex = routeMetrics.points.length - 1;
      return {
        position: routeMetrics.points[lastIndex].clone(),
        direction: routeMetrics.points[lastIndex]
          .clone()
          .sub(routeMetrics.points[lastIndex - 1])
          .normalize(),
        distance: routeMetrics.totalLength,
        routeIndex: Math.max(0, lastIndex - 1),
      };
    }

    function findActiveLoopSegment(loopPlan, localTimeSec) {
      return (
        loopPlan.segments.find(
          (segment, segmentIndex) =>
            localTimeSec >= segment.startSec &&
            (localTimeSec < segment.endSec || segmentIndex === loopPlan.segments.length - 1),
        ) || loopPlan.segments[loopPlan.segments.length - 1]
      );
    }

    function getSegmentMix(localTimeSec, segment, edgeSec) {
      if (!segment) {
        return 0;
      }

      const segmentDuration = Math.max(segment.endSec - segment.startSec, 1e-6);
      const fadeSec = Math.min(edgeSec, segmentDuration * 0.5);
      if (fadeSec <= 1e-6) {
        return localTimeSec >= segment.startSec && localTimeSec <= segment.endSec ? 1 : 0;
      }

      if (localTimeSec <= segment.startSec - fadeSec || localTimeSec >= segment.endSec + fadeSec) {
        return 0;
      }
      if (localTimeSec < segment.startSec + fadeSec) {
        return smootherstep01(
          (localTimeSec - (segment.startSec - fadeSec)) / (fadeSec * 2),
        );
      }
      if (localTimeSec > segment.endSec - fadeSec) {
        return 1 - smootherstep01(
          (localTimeSec - (segment.endSec - fadeSec)) / (fadeSec * 2),
        );
      }
      return 1;
    }

    function getDominantSegment(loopPlan, kind, localTimeSec, edgeSec) {
      return loopPlan.segments.reduce(
        (best, segment) => {
          if (segment.kind !== kind) {
            return best;
          }

          const mix = getSegmentMix(localTimeSec, segment, edgeSec);
          if (mix > best.mix) {
            return { mix, segment };
          }
          return best;
        },
        { mix: 0, segment: null },
      );
    }

    function applySheepAtTime(sheepInstance, sceneTimeSec) {
      const localTimeSec = wrapLoopTime(
        sceneTimeSec + sheepInstance.loopPlan.phaseOffsetSec,
      );
      const activeLoopSegment = findActiveLoopSegment(
        sheepInstance.loopPlan,
        localTimeSec,
      );
      const segmentDuration = Math.max(
        activeLoopSegment.endSec - activeLoopSegment.startSec,
        1e-6,
      );
      const segmentT = THREE.MathUtils.clamp(
        (localTimeSec - activeLoopSegment.startSec) / segmentDuration,
        0,
        1,
      );
      const routeProgress = THREE.MathUtils.lerp(
        activeLoopSegment.progressStart,
        activeLoopSegment.progressEnd,
        segmentT,
      );
      const routeSample = sampleRouteAtProgress(
        sheepInstance.routeMetrics,
        routeProgress,
      );

      sheepInstance.root.position.copy(routeSample.position);
      if (routeSample.direction.lengthSq() > 1e-6) {
        sheepInstance.root.rotation.y =
          Math.atan2(routeSample.direction.x, routeSample.direction.z) + Math.PI;
      }
      sheepInstance.shadow.position.set(
        routeSample.position.x,
        0.03,
        routeSample.position.z,
      );

      const grazeState = getDominantSegment(
        sheepInstance.loopPlan,
        "graze",
        localTimeSec,
        0.18,
      );
      const idleState = getDominantSegment(
        sheepInstance.loopPlan,
        "idle",
        localTimeSec,
        0.16,
      );
      const grazeBlend = grazeState.mix;
      const idleBlend = Math.max(0, idleState.mix * (1 - grazeBlend));
      const walkBlend = Math.max(0, 1 - Math.max(grazeBlend, idleBlend));
      const gaitPhase =
        sheepInstance.gaitPhaseOffset + routeSample.distance * 7.6;
      const walkSwing =
        Math.cos(gaitPhase) *
        THREE.MathUtils.degToRad(24) *
        walkBlend;

      sheepInstance.legPivots[0].rotation.x = walkSwing;
      sheepInstance.legPivots[3].rotation.x = walkSwing;
      sheepInstance.legPivots[1].rotation.x = -walkSwing;
      sheepInstance.legPivots[2].rotation.x = -walkSwing;

      let bodyY =
        sheepBodyBaseY +
        Math.abs(Math.sin(gaitPhase)) * 0.05 * walkBlend +
        Math.sin(localTimeSec * 2.1 + sheepInstance.idlePhaseOffset) * 0.006 * idleBlend;
      let headY = sheepHeadBaseY;
      let headZ = sheepHeadBaseZ;
      let headRotX =
        sheepHeadNeutralRotation +
        Math.sin(gaitPhase * 0.5) * 0.06 * walkBlend +
        Math.sin(localTimeSec * 1.3 + sheepInstance.idlePhaseOffset) * 0.03 * idleBlend;
      let headRigY = sheepHeadRigBaseY;
      let headRigZ =
        sheepHeadRigBaseZ +
        Math.sin(localTimeSec * 1.1 + sheepInstance.idlePhaseOffset) * 0.005 * idleBlend;

      if (grazeBlend > 1e-3 && grazeState.segment) {
        const grazeLocalTimeSec =
          Math.max(0, localTimeSec - grazeState.segment.startSec) +
          sheepInstance.grazePhaseOffset;
        const cycleTime = grazeLocalTimeSec % grazeAnimationLengthSec;
        const lowerT =
          cycleTime <= 0.2
            ? cycleTime / 0.2
            : cycleTime >= 1.8
              ? Math.max(0, (grazeAnimationLengthSec - cycleTime) / 0.2)
              : 1;
        const chew =
          cycleTime >= 0.2 && cycleTime <= 1.8
            ? Math.sin(((cycleTime - 0.2) / 1.6) * Math.PI * 8)
            : 0;
        const chewDip =
          cycleTime >= 0.2 && cycleTime <= 1.8 ? Math.max(0, chew) : 0;
        const grazeBodyY =
          sheepBodyBaseY - lowerT * 0.004 - chewDip * 0.0015;
        const grazeHeadRigY =
          sheepHeadRigBaseY -
          grazeHeadRigLowerAmount * lowerT -
          grazeHeadChewDropAmount * chewDip * lowerT;
        const grazeHeadRotX =
          sheepHeadNeutralRotation * (1 - lowerT) +
          (grazeHeadBaseRotation - grazeHeadChewAmplitude * chew) * lowerT;

        bodyY = THREE.MathUtils.lerp(bodyY, grazeBodyY, grazeBlend);
        headRigY = THREE.MathUtils.lerp(headRigY, grazeHeadRigY, grazeBlend);
        headRotX = THREE.MathUtils.lerp(headRotX, grazeHeadRotX, grazeBlend);
      }

      sheepInstance.headPivot.position.set(0, headY, headZ);
      sheepInstance.headRig.position.set(0, headRigY, headRigZ);
      sheepInstance.headNeck.rotation.x = headRotX;
      sheepInstance.bodyGroup.position.y = bodyY;

      sheepInstance.state =
        grazeBlend >= 0.5
          ? "graze"
          : idleBlend >= 0.5
            ? "idle"
            : activeLoopSegment.kind;
      sheepInstance.routeIndex = routeSample.routeIndex;
    }

    function renderSceneAtTime(timeSec) {
      sheepInstances.forEach((sheepInstance) => {
        applySheepAtTime(sheepInstance, timeSec);
      });
      renderer.render(scene, camera);
    }

    function animate() {
      if (!autoAnimate) {
        return;
      }

      renderSceneAtTime(clock.getElapsedTime() + animationTimeOffsetSec);
      requestAnimationFrame(animate);
    }

    window.__setSceneTime = (timeSec) => {
      autoAnimate = false;
      manualSceneTimeSec = Math.max(0, timeSec);
      renderSceneAtTime(manualSceneTimeSec);
    };
    window.__getSceneState = (timeSec) => {
      autoAnimate = false;
      manualSceneTimeSec = Math.max(0, timeSec);
      renderSceneAtTime(manualSceneTimeSec);
      return sheepInstances.map((sheepInstance) => ({
        x: sheepInstance.root.position.x,
        y: sheepInstance.root.position.y,
        z: sheepInstance.root.position.z,
        yaw: sheepInstance.root.rotation.y,
        state: sheepInstance.state,
        shadowY: sheepInstance.shadow.position.y,
        headY: sheepInstance.headPivot.position.y,
        headZ: sheepInstance.headPivot.position.z,
        headRotX: sheepInstance.headNeck.rotation.x,
        headRigY: sheepInstance.headRig.position.y,
        headRigZ: sheepInstance.headRig.position.z,
        bodyY: sheepInstance.bodyGroup.position.y,
        routeIndex: sheepInstance.routeIndex,
        leg0: sheepInstance.legPivots[0].rotation.x,
        leg1: sheepInstance.legPivots[1].rotation.x,
        leg2: sheepInstance.legPivots[2].rotation.x,
        leg3: sheepInstance.legPivots[3].rotation.x,
      }));
    };
    window.__PROFILE_SCENE_LOOP_DURATION = gifDurationSec;
    window.__resumeScene = () => {
      if (!autoAnimate) {
        autoAnimate = true;
        animationTimeOffsetSec = manualSceneTimeSec - clock.getElapsedTime();
        requestAnimationFrame(animate);
      }
    };

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      updateCameraFrustum();
      renderSceneAtTime(
        autoAnimate ? clock.getElapsedTime() + animationTimeOffsetSec : manualSceneTimeSec,
      );
    });

    renderSceneAtTime(0);
    window.__PROFILE_SCENE_READY = true;
    requestAnimationFrame(animate);
  </script>
</body>
</html>`;
};
