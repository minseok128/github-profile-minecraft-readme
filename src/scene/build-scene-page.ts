import type { CalendarMetric, RenderConfig, UserSnapshot } from '../types.js';
import { formatThousands, toFixed, toIsoDate, trimLastWeeks } from '../utils.js';
import { MINECRAFT_GRASS_PATTERNS } from './minecraft-grass-theme.js';
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

const createHudMarkup = (
    userSnapshot: UserSnapshot,
    period: string,
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
    <div class="hud-row">${config.weeks} weeks, Three.js scene, README-safe export</div>
  </div>`;
};

export const buildSceneHtml = (
    userSnapshot: UserSnapshot,
    config: RenderConfig,
): string => {
    const calendarMetrics = buildCalendarMetrics(userSnapshot, config.weeks);
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
        sheepPlans: config.showSheep
            ? buildSheepPopulationPlans(calendarMetrics)
            : [],
        contribPatterns: MINECRAFT_GRASS_PATTERNS,
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
${createHudMarkup(userSnapshot, period, config)}
  <script type="module">
    import * as THREE from "/vendor/three.module.js";

    const sceneData = ${JSON.stringify(sceneData)};
    const gifDurationSec = ${JSON.stringify(config.gif.durationSec)};
    const assets = {
      sheepTexturePath: "/assets/sheep.png",
      sheepFurTexturePath: "/assets/sheep_fur.png"
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (sceneData.background === "transparent") {
      renderer.setClearColor(0x000000, 0);
    } else {
      renderer.setClearColor("#dff3ff", 0);
    }
    app.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 240);
    const isoDirection = new THREE.Vector3(1, 1, 1).normalize();
    const cameraFitPadding = sceneData.background === "transparent" ? 1.005 : 1.04;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b4b31, 0.98));

    const sun = new THREE.DirectionalLight(0xfffae0, 1.2);
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
        color: "#bfe4ff",
        transparent: true,
        opacity: sceneData.background === "transparent" ? 0 : 0.18
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.visible = sceneData.background !== "transparent";
    scene.add(ground);

    function parseBitmapValue(value) {
      return typeof value === "string" ? Number.parseInt(value, 16) : value;
    }

    function createPanelTexture(panelPattern) {
      const width = Math.max(1, panelPattern.width);
      const height = Math.max(1, panelPattern.bitmap.length);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = panelPattern.backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = panelPattern.foregroundColor;
      panelPattern.bitmap.forEach((bitmapValue, y) => {
        const bitmap = parseBitmapValue(bitmapValue);
        for (let x = 0; x < width; x += 1) {
          if ((bitmap & (1 << (width - x - 1))) !== 0) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      return texture;
    }

    const materialCache = new Map();
    function getBlockMaterials(contributionLevel) {
      if (materialCache.has(contributionLevel)) {
        return materialCache.get(contributionLevel);
      }
      const pattern = sceneData.contribPatterns[contributionLevel];
      const topTexture = createPanelTexture(pattern.top);
      const leftTexture = createPanelTexture({
        ...pattern.left,
        backgroundColor: pattern.left.backgroundColor || pattern.top.backgroundColor,
        foregroundColor: pattern.left.foregroundColor || pattern.top.foregroundColor
      });
      const rightTexture = createPanelTexture({
        ...pattern.right,
        backgroundColor: pattern.right.backgroundColor || pattern.top.backgroundColor,
        foregroundColor: pattern.right.foregroundColor || pattern.top.foregroundColor
      });

      const materials = [
        new THREE.MeshLambertMaterial({ map: rightTexture }),
        new THREE.MeshLambertMaterial({ map: leftTexture }),
        new THREE.MeshLambertMaterial({ map: topTexture }),
        new THREE.MeshLambertMaterial({ map: leftTexture }),
        new THREE.MeshLambertMaterial({ map: rightTexture }),
        new THREE.MeshLambertMaterial({ map: leftTexture })
      ];
      materialCache.set(contributionLevel, materials);
      return materials;
    }

    const blocks = [];
    sceneData.calendarMetrics.forEach((cell) => {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(1, cell.worldHeight, 1),
        getBlockMaterials(cell.contributionLevel)
      );
      block.position.set(cell.week, cell.worldHeight * 0.5, cell.dayOfWeek);
      block.castShadow = true;
      block.receiveShadow = true;
      scene.add(block);
      blocks.push(block);
    });

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

    const [sheepBaseTexture, sheepFurTexture] = await Promise.all([
      loadTexture(assets.sheepTexturePath),
      loadTexture(assets.sheepFurTexturePath)
    ]);

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

      const headSheared = makeTexturedBox([6, 6, 8], [0, 0], sheepBaseMaterial);
      headSheared.position.set(0, 1 * unit, -2 * unit);
      headPivot.add(headSheared);

      const headWool = makeTexturedBox(
        [6, 6, 6],
        [0, 0],
        sheepFurMaterial,
        64,
        32,
        [1.2, 1.2, 1.2]
      );
      headWool.position.set(0, 1 * unit, -1 * unit);
      headPivot.add(headWool);

      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      root.scale.setScalar(sceneData.sheepTargetHeight / size.y);

      return { root, legPivots, bodyGroup, headPivot };
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
          opacity: 0.22
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

    const stepDurationSec = 0.72;
    const grazeAnimationLengthSec = 2.0;
    const grazeHeadLowerAmount = 6.5 * unit;
    const grazeHeadForwardAmount = 2.2 * unit;
    const grazeHeadBaseRotation = THREE.MathUtils.degToRad(18);
    const grazeHeadChewAmplitude = THREE.MathUtils.degToRad(5.5);
    const clock = new THREE.Clock();
    let simulatedTimeSec = 0;

    const sheepInstances = sceneData.showSheep
      ? sceneData.sheepPlans.map((plan, sheepIndex) => ({
          ...createSheepInstance(plan.colorHex),
          islandId: plan.islandId,
          sheepIndex,
          islandSheepCount: plan.islandSheepCount,
          route: plan.route.map((cell) =>
            new THREE.Vector3(cell.week, cell.worldHeight + 0.01, cell.dayOfWeek),
          ),
          routeIndex: 0,
          segmentProgress: 0,
          moveSpeed: 0.9 + (sheepIndex % 3) * 0.05,
          walkCycle: sheepIndex * 0.8,
          state: "walk",
          stateRemaining:
            plan.sheepIndex *
            0.35 *
            Math.max(1, Math.floor(plan.route.length / Math.max(1, plan.islandSheepCount))),
          grazeClock: 0,
          pausedPosition: null,
          pausedYaw: null,
          gaitBlend: 1,
          grazeBlend: 0,
          rngState: (((plan.islandId + 1) * 1103515245) ^ ((sheepIndex + 3) * 12345)) >>> 0,
        }))
      : [];

    const contentBounds = new THREE.Box3();
    const tempBounds = new THREE.Box3();

    blocks.forEach((block) => {
      tempBounds.setFromObject(block);
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

    function normalizeAngle(rad) {
      let angle = rad;
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      return angle;
    }

    function dampAngle(current, target, lambda, dt) {
      const delta = normalizeAngle(target - current);
      return current + delta * (1 - Math.exp(-lambda * dt));
    }

    function dampValue(current, target, lambda, dt) {
      return current + (target - current) * (1 - Math.exp(-lambda * dt));
    }

    function nextRandom(sheepInstance) {
      sheepInstance.rngState = (1664525 * sheepInstance.rngState + 1013904223) >>> 0;
      return sheepInstance.rngState / 4294967296;
    }

    function resetHeadPose(sheepInstance) {
      sheepInstance.headPivot.position.set(0, 18 * unit, -8 * unit);
      sheepInstance.headPivot.rotation.x = THREE.MathUtils.degToRad(-10);
      sheepInstance.bodyGroup.position.y = 12 * unit + 3 * unit;
    }

    function startRandomBehavior(sheepInstance) {
      const roll = nextRandom(sheepInstance);
      if (roll < 0.18) {
        sheepInstance.state = "graze";
        sheepInstance.stateRemaining = 2.2 + nextRandom(sheepInstance) * 2.2;
        sheepInstance.grazeClock = 0;
        return;
      }
      if (roll < 0.42) {
        sheepInstance.state = "idle";
        sheepInstance.stateRemaining = 0.8 + nextRandom(sheepInstance) * 1.8;
        return;
      }
      sheepInstance.state = "walk";
      sheepInstance.stateRemaining = 0;
    }

    function applyGrazingPose(sheepInstance, dt) {
      sheepInstance.grazeClock += dt;
      const cycleTime = sheepInstance.grazeClock % grazeAnimationLengthSec;
      const lowerT =
        cycleTime <= 0.2
          ? cycleTime / 0.2
          : cycleTime >= 1.8
            ? Math.max(0, (2.0 - cycleTime) / 0.2)
            : 1;
      const chew =
        cycleTime >= 0.2 && cycleTime <= 1.8
          ? Math.sin(((cycleTime - 0.2) / 1.6) * Math.PI * 8)
          : 0;
      sheepInstance.headPivot.position.set(
        0,
        18 * unit - grazeHeadLowerAmount * lowerT,
        -8 * unit - grazeHeadForwardAmount * lowerT,
      );
      sheepInstance.headPivot.rotation.x =
        THREE.MathUtils.degToRad(-10) * (1 - lowerT) +
        (grazeHeadBaseRotation + grazeHeadChewAmplitude * chew) * lowerT;
      sheepInstance.bodyGroup.position.y = 12 * unit + 3 * unit - lowerT * 0.01;
    }

    function resetSheepState(sheepInstance) {
      sheepInstance.routeIndex = 0;
      sheepInstance.segmentProgress = 0;
      sheepInstance.walkCycle = sheepInstance.sheepIndex * 0.8;
      sheepInstance.state = "walk";
      sheepInstance.stateRemaining =
        sheepInstance.sheepIndex *
        0.35 *
        Math.max(
          1,
          Math.floor(sheepInstance.route.length / Math.max(1, sheepInstance.islandSheepCount)),
        );
      sheepInstance.grazeClock = 0;
      sheepInstance.pausedPosition = null;
      sheepInstance.pausedYaw = null;
      sheepInstance.gaitBlend = 1;
      sheepInstance.grazeBlend = 0;
      sheepInstance.rngState =
        (((sheepInstance.islandId + 1) * 1103515245) ^
          ((sheepInstance.sheepIndex + 3) * 12345)) >>>
        0;

      if (sheepInstance.route.length > 0) {
        const start = sheepInstance.route[0];
        sheepInstance.root.position.copy(start);
        sheepInstance.shadow.position.set(start.x, 0.03, start.z);
      }
      resetHeadPose(sheepInstance);
    }

    function updateSheep(dt) {
      sheepInstances.forEach((sheepInstance) => {
        if (sheepInstance.route.length < 2) {
          return;
        }

        const segmentCount = Math.max(1, sheepInstance.route.length - 1);
        if (sheepInstance.state === "walk") {
          sheepInstance.segmentProgress +=
            (dt * sheepInstance.moveSpeed) / stepDurationSec;

          let crossedSegment = false;
          while (sheepInstance.segmentProgress >= 1) {
            sheepInstance.segmentProgress -= 1;
            sheepInstance.routeIndex = (sheepInstance.routeIndex + 1) % segmentCount;
            crossedSegment = true;
          }

          if (crossedSegment) {
            startRandomBehavior(sheepInstance);
          }

          const currentIndex = sheepInstance.routeIndex % segmentCount;
          const start = sheepInstance.route[currentIndex];
          const end = sheepInstance.route[currentIndex + 1];

          if (sheepInstance.state !== "walk") {
            sheepInstance.segmentProgress = 0;
            sheepInstance.pausedPosition = start.clone();
            sheepInstance.pausedYaw = sheepInstance.root.rotation.y;
            sheepInstance.gaitBlend = dampValue(sheepInstance.gaitBlend, 0, 10, dt);
            sheepInstance.grazeBlend = dampValue(
              sheepInstance.grazeBlend,
              sheepInstance.state === "graze" ? 1 : 0,
              7,
              dt,
            );
            sheepInstance.root.position.copy(sheepInstance.pausedPosition);
            sheepInstance.shadow.position.set(
              sheepInstance.pausedPosition.x,
              sheepInstance.pausedPosition.y - start.y + 0.03,
              sheepInstance.pausedPosition.z,
            );
            const transitionSwing =
              Math.cos(sheepInstance.walkCycle) *
              THREE.MathUtils.degToRad(24) *
              sheepInstance.gaitBlend;
            sheepInstance.legPivots[0].rotation.x = transitionSwing;
            sheepInstance.legPivots[1].rotation.x = -transitionSwing;
            sheepInstance.legPivots[2].rotation.x = -transitionSwing;
            sheepInstance.legPivots[3].rotation.x = transitionSwing;
            resetHeadPose(sheepInstance);
            if (sheepInstance.state === "graze") {
              applyGrazingPose(sheepInstance, 0);
            }
            return;
          }

          const flatDelta = end.clone().sub(start);
          flatDelta.y = 0;
          const targetYaw = Math.atan2(flatDelta.x, flatDelta.z) + Math.PI;
          sheepInstance.root.rotation.y = dampAngle(
            sheepInstance.root.rotation.y,
            targetYaw,
            10.5,
            dt,
          );

          sheepInstance.walkCycle += dt * sheepInstance.moveSpeed * 8.4;
          const position = start.clone().lerp(end, sheepInstance.segmentProgress);
          sheepInstance.root.position.copy(position);
          sheepInstance.shadow.position.set(
            position.x,
            position.y - start.y + 0.03,
            position.z,
          );
          sheepInstance.gaitBlend = dampValue(sheepInstance.gaitBlend, 1, 10, dt);
          sheepInstance.grazeBlend = dampValue(sheepInstance.grazeBlend, 0, 8, dt);

          const gaitPhase = sheepInstance.walkCycle;
          const swing =
            Math.cos(gaitPhase) *
            THREE.MathUtils.degToRad(24) *
            sheepInstance.gaitBlend;
          sheepInstance.legPivots[0].rotation.x = swing;
          sheepInstance.legPivots[3].rotation.x = swing;
          sheepInstance.legPivots[1].rotation.x = -swing;
          sheepInstance.legPivots[2].rotation.x = -swing;
          sheepInstance.bodyGroup.position.y =
            12 * unit +
            3 * unit +
            Math.abs(Math.sin(gaitPhase)) * 0.05 * sheepInstance.gaitBlend;
          sheepInstance.headPivot.position.set(0, 18 * unit, -8 * unit);
          sheepInstance.headPivot.rotation.x =
            THREE.MathUtils.degToRad(-10) +
            Math.sin(gaitPhase * 0.5) * 0.06 * sheepInstance.gaitBlend;
          return;
        }

        const currentIndex = sheepInstance.routeIndex % segmentCount;
        const start = sheepInstance.route[currentIndex];
        sheepInstance.root.rotation.y = dampAngle(
          sheepInstance.root.rotation.y,
          sheepInstance.pausedYaw ?? sheepInstance.root.rotation.y,
          14,
          dt,
        );

        sheepInstance.stateRemaining = Math.max(0, sheepInstance.stateRemaining - dt);
        sheepInstance.pausedPosition = sheepInstance.pausedPosition || start.clone();
        sheepInstance.root.position.copy(sheepInstance.pausedPosition);
        sheepInstance.shadow.position.set(
          sheepInstance.pausedPosition.x,
          sheepInstance.pausedPosition.y - start.y + 0.03,
          sheepInstance.pausedPosition.z,
        );
        sheepInstance.gaitBlend = dampValue(sheepInstance.gaitBlend, 0, 10, dt);
        sheepInstance.grazeBlend = dampValue(
          sheepInstance.grazeBlend,
          sheepInstance.state === "graze" ? 1 : 0,
          7,
          dt,
        );
        const idleSwing =
          Math.cos(sheepInstance.walkCycle) *
          THREE.MathUtils.degToRad(24) *
          sheepInstance.gaitBlend;
        sheepInstance.legPivots[0].rotation.x = idleSwing;
        sheepInstance.legPivots[1].rotation.x = -idleSwing;
        sheepInstance.legPivots[2].rotation.x = -idleSwing;
        sheepInstance.legPivots[3].rotation.x = idleSwing;

        resetHeadPose(sheepInstance);
        if (sheepInstance.state === "graze") {
          applyGrazingPose(sheepInstance, dt);
        }

        if (sheepInstance.stateRemaining <= 0) {
          sheepInstance.state = "walk";
          sheepInstance.grazeClock = 0;
          sheepInstance.pausedPosition = null;
          sheepInstance.pausedYaw = null;
          resetHeadPose(sheepInstance);
        }
      });
    }

    function resetSimulation() {
      simulatedTimeSec = 0;
      sheepInstances.forEach((sheepInstance) => {
        resetSheepState(sheepInstance);
      });
      renderer.render(scene, camera);
    }

    let autoAnimate = true;

    function stepSimulationTo(targetTimeSec) {
      const normalizedTarget = Math.max(0, targetTimeSec);
      if (normalizedTarget < simulatedTimeSec) {
        resetSimulation();
      }

      while (simulatedTimeSec < normalizedTarget - 1e-6) {
        const dt = Math.min(0.05, normalizedTarget - simulatedTimeSec);
        updateSheep(dt);
        simulatedTimeSec += dt;
      }

      renderer.render(scene, camera);
    }

    function animate() {
      if (!autoAnimate) {
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.05);
      updateSheep(dt);
      simulatedTimeSec += dt;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__setSceneTime = (timeSec) => {
      autoAnimate = false;
      stepSimulationTo(timeSec);
    };
    window.__getSceneState = (timeSec) => {
      autoAnimate = false;
      stepSimulationTo(timeSec);
      return sheepInstances.map((sheepInstance) => ({
        x: sheepInstance.root.position.x,
        y: sheepInstance.root.position.y,
        z: sheepInstance.root.position.z,
        yaw: sheepInstance.root.rotation.y,
        state: sheepInstance.state,
        shadowY: sheepInstance.shadow.position.y,
        headY: sheepInstance.headPivot.position.y,
        headZ: sheepInstance.headPivot.position.z,
        headRotX: sheepInstance.headPivot.rotation.x,
        bodyY: sheepInstance.bodyGroup.position.y,
        routeIndex: sheepInstance.routeIndex,
        leg0: sheepInstance.legPivots[0].rotation.x,
        leg1: sheepInstance.legPivots[1].rotation.x,
        leg2: sheepInstance.legPivots[2].rotation.x,
        leg3: sheepInstance.legPivots[3].rotation.x,
      }));
    };
    window.__applyLoopClosure = (startStates, endStates, blend) => {
      autoAnimate = false;
      sheepInstances.forEach((sheepInstance, index) => {
        const startState = startStates[index];
        const endState = endStates[index];
        if (!startState || !endState) {
          return;
        }
        const t = Math.min(1, Math.max(0, blend));
        sheepInstance.root.position.set(
          endState.x + (startState.x - endState.x) * t,
          endState.y + (startState.y - endState.y) * t,
          endState.z + (startState.z - endState.z) * t,
        );
        sheepInstance.shadow.position.set(
          sheepInstance.root.position.x,
          endState.shadowY + (startState.shadowY - endState.shadowY) * t,
          sheepInstance.root.position.z,
        );
        sheepInstance.root.rotation.y =
          endState.yaw + normalizeAngle(startState.yaw - endState.yaw) * t;
        sheepInstance.headPivot.position.set(
          0,
          endState.headY + (startState.headY - endState.headY) * t,
          endState.headZ + (startState.headZ - endState.headZ) * t,
        );
        sheepInstance.headPivot.rotation.x =
          endState.headRotX + (startState.headRotX - endState.headRotX) * t;
        sheepInstance.bodyGroup.position.y =
          endState.bodyY + (startState.bodyY - endState.bodyY) * t;
        sheepInstance.legPivots[0].rotation.x =
          endState.leg0 + (startState.leg0 - endState.leg0) * t;
        sheepInstance.legPivots[1].rotation.x =
          endState.leg1 + (startState.leg1 - endState.leg1) * t;
        sheepInstance.legPivots[2].rotation.x =
          endState.leg2 + (startState.leg2 - endState.leg2) * t;
        sheepInstance.legPivots[3].rotation.x =
          endState.leg3 + (startState.leg3 - endState.leg3) * t;
      });
      renderer.render(scene, camera);
    };
    window.__PROFILE_SCENE_LOOP_DURATION = gifDurationSec;
    window.__resumeScene = () => {
      if (!autoAnimate) {
        autoAnimate = true;
        clock.getDelta();
        requestAnimationFrame(animate);
      }
    };

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      updateCameraFrustum();
      renderer.render(scene, camera);
    });

    resetSimulation();
    window.__PROFILE_SCENE_READY = true;
    requestAnimationFrame(animate);
  </script>
</body>
</html>`;
};
