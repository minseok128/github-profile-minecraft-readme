import * as THREE from 'three';
import type { SceneMonthGuideEntry } from '../types.js';
import { createLabelMarker } from './labels.js';

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
                stemHeightWorld: Math.max(
                    0.56,
                    guideCardBottomY - guideStemBaseY - 0.08,
                ),
                stemColor: '#7b8f71',
                lineGapPx: 6,
            },
        );
        monthMarker.position.set(entry.week + 0.14, guideStemBaseY, -0.42);
        scene.add(monthMarker);
    });
};
