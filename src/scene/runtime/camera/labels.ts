import * as THREE from 'three';
import type { SceneMonthGuideEntry } from '../types.js';
import type { SheepInstance } from '../sheep/index.js';

interface LabelLine {
    text: string;
    fontSizePx: number;
    fontWeight: number;
    color?: string;
}

interface LabelMarkerOptions {
    heightWorld: number;
    paddingX: number;
    paddingY: number;
    anchorX: number;
    anchorY: number;
    stemHeightWorld: number;
    stemColor: string;
    lineGapPx?: number;
}

const get2dContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to acquire 2D canvas context.');
    }
    return context;
};

const addRoundedRectPath = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
): void => {
    const clampedRadius = Math.min(radius, width * 0.5, height * 0.5);
    context.beginPath();
    context.moveTo(x + clampedRadius, y);
    context.lineTo(x + width - clampedRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
    context.lineTo(x + width, y + height - clampedRadius);
    context.quadraticCurveTo(
        x + width,
        y + height,
        x + width - clampedRadius,
        y + height,
    );
    context.lineTo(x + clampedRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
    context.lineTo(x, y + clampedRadius);
    context.quadraticCurveTo(x, y, x + clampedRadius, y);
    context.closePath();
};

export const createLabelMarker = (
    camera: THREE.OrthographicCamera,
    lines: Array<LabelLine>,
    options: LabelMarkerOptions,
): THREE.Group => {
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
        color: line.color ?? 'rgba(31, 41, 30, 0.97)',
        fontSizePx: line.fontSizePx,
        fontWeight: line.fontWeight,
        text: line.text,
    }));
    const measureCanvas = document.createElement('canvas');
    const measureContext = get2dContext(measureCanvas);
    const lineMeasurements = normalizedLines.map((line) => {
        const font = `${line.fontWeight} ${line.fontSizePx}px "SF Pro Display", "Segoe UI", sans-serif`;
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
        lineMeasurements.reduce((sum, line) => sum + line.fontSizePx, 0) +
        Math.max(0, lineMeasurements.length - 1) * lineGapPx;
    const canvasWidth = Math.max(
        1,
        Math.ceil((textWidth + paddingX * 2) * resolutionScale),
    );
    const canvasHeight = Math.max(
        1,
        Math.ceil((textHeight + paddingY * 2) * resolutionScale),
    );
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = get2dContext(canvas);
    context.scale(resolutionScale, resolutionScale);
    const drawWidth = canvasWidth / resolutionScale;
    const drawHeight = canvasHeight / resolutionScale;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.lineJoin = 'round';
    context.shadowColor = 'rgba(255, 255, 255, 0.3)';
    context.shadowBlur = 8;
    addRoundedRectPath(
        context,
        1.5,
        1.5,
        drawWidth - 3,
        drawHeight - 3,
        Math.max(8, maxLineFontSize * 0.38),
    );
    context.fillStyle = 'rgba(246, 248, 239, 0.9)';
    context.fill();
    context.shadowBlur = 0;

    const totalTextBlockHeight =
        lineMeasurements.reduce((sum, line) => sum + line.fontSizePx, 0) +
        Math.max(0, lineMeasurements.length - 1) * lineGapPx;
    let currentTop = (drawHeight - totalTextBlockHeight) * 0.5;
    lineMeasurements.forEach((line) => {
        context.font = line.font;
        context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
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

    group.traverse((node: THREE.Object3D) => {
        node.frustumCulled = false;
    });

    return group;
};

const getBoundsCorners = (bounds: THREE.Box3): Array<THREE.Vector3> => {
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
        new THREE.Vector3(max.x, max.y, max.z),
    ];
};

const accumulateViewPoint = (
    camera: THREE.OrthographicCamera,
    point: THREE.Vector3,
    extents: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    },
): void => {
    const viewPoint = point.clone().applyMatrix4(camera.matrixWorldInverse);
    extents.minX = Math.min(extents.minX, viewPoint.x);
    extents.maxX = Math.max(extents.maxX, viewPoint.x);
    extents.minY = Math.min(extents.minY, viewPoint.y);
    extents.maxY = Math.max(extents.maxY, viewPoint.y);
};

export const fitCameraToBounds = ({
    camera,
    scene,
    ground,
    isoDirection,
    cameraFitPadding,
    blocks,
    floraDecorations,
    sheepInstances,
    sheepTargetHeight,
    contentBounds,
}: {
    camera: THREE.OrthographicCamera;
    scene: THREE.Scene;
    ground: THREE.Mesh;
    isoDirection: THREE.Vector3;
    cameraFitPadding: number;
    blocks: Array<THREE.Object3D>;
    floraDecorations: Array<THREE.Object3D>;
    sheepInstances: Array<SheepInstance>;
    sheepTargetHeight: number;
    contentBounds: THREE.Box3;
}): void => {
    const center = contentBounds.getCenter(new THREE.Vector3());
    const size = contentBounds.getSize(new THREE.Vector3());
    const distance = Math.max(size.x, size.z) * 1.65 + 14;
    camera.position.copy(
        center.clone().add(isoDirection.clone().multiplyScalar(distance)),
    );
    camera.lookAt(center);
    camera.near = 0.1;
    camera.far = distance * 4;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = distance * 0.55;
        scene.fog.far = distance * 1.75;
    }

    const extents = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
    };
    const tempBounds = new THREE.Box3();

    blocks.forEach((block) => {
        tempBounds.setFromObject(block);
        getBoundsCorners(tempBounds).forEach((corner) =>
            accumulateViewPoint(camera, corner, extents),
        );
    });

    floraDecorations.forEach((floraDecoration) => {
        tempBounds.setFromObject(floraDecoration);
        getBoundsCorners(tempBounds).forEach((corner) =>
            accumulateViewPoint(camera, corner, extents),
        );
    });

    sheepInstances.forEach((sheepInstance) => {
        sheepInstance.route.forEach((point) => {
            const sheepMin = new THREE.Vector3(
                point.x - 0.45,
                point.y,
                point.z - 0.45,
            );
            const sheepMax = new THREE.Vector3(
                point.x + 0.45,
                point.y + sheepTargetHeight,
                point.z + 0.45,
            );
            getBoundsCorners(new THREE.Box3(sheepMin, sheepMax)).forEach(
                (corner) => accumulateViewPoint(camera, corner, extents),
            );
        });
    });

    camera.userData.fitHalfWidth =
        (extents.maxX - extents.minX) * 0.5 * cameraFitPadding;
    camera.userData.fitHalfHeight =
        (extents.maxY - extents.minY) * 0.5 * cameraFitPadding;
    camera.userData.focusCenter = center.toArray();
    ground.scale.set(size.x + 6, size.z + 6, 1);
    ground.position.set(center.x, 0, center.z);
};

export const updateCameraFrustum = (
    camera: THREE.OrthographicCamera,
    width: number,
    height: number,
): void => {
    const aspect = width / Math.max(height, 1);
    const fitHalfWidth = (camera.userData.fitHalfWidth as number | undefined) ?? 12;
    const fitHalfHeight =
        (camera.userData.fitHalfHeight as number | undefined) ?? 12;
    const halfHeight = Math.max(fitHalfHeight, fitHalfWidth / aspect);
    const halfWidth = halfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
};

export const buildCalendarGuideMarkers = ({
    scene,
    camera,
    monthGuideEntries,
    contentBounds,
}: {
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    monthGuideEntries: Array<SceneMonthGuideEntry>;
    contentBounds: THREE.Box3;
}): void => {
    const guideStemBaseY = 0.03;
    const guideCardBottomY = Math.max(contentBounds.max.y + 0.98, 3.45);

    monthGuideEntries.forEach((entry) => {
        const monthMarker = createLabelMarker(
            camera,
            [
                {
                    text: entry.monthLabel,
                    fontSizePx: 36,
                    fontWeight: 700,
                },
                {
                    text: entry.detailLabel,
                    fontSizePx: 36,
                    fontWeight: 600,
                    color: 'rgba(72, 86, 61, 0.92)',
                },
            ],
            {
                heightWorld: 1.56,
                paddingX: 24,
                paddingY: 18,
                anchorX: 0.5,
                anchorY: 0,
                stemHeightWorld: Math.max(0.56, guideCardBottomY - guideStemBaseY - 0.08),
                stemColor: '#7b8f71',
                lineGapPx: 6,
            },
        );
        monthMarker.position.set(entry.week + 0.14, guideStemBaseY, -0.42);
        scene.add(monthMarker);
    });
};
