export const clampChannel = (value: number): number =>
    Math.max(0, Math.min(255, Math.round(value)));

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const normalized = hex.replace('#', '');
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
};

export const rgbToHex = (rgb: { r: number; g: number; b: number }): string =>
    `#${[rgb.r, rgb.g, rgb.b]
        .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
        .join('')}`;

export const mixHexColors = (startHex: string, endHex: string, t: number): string => {
    const clampedT = Math.max(0, Math.min(1, t));
    const start = hexToRgb(startHex);
    const end = hexToRgb(endHex);
    return rgbToHex({
        r: start.r + (end.r - start.r) * clampedT,
        g: start.g + (end.g - start.g) * clampedT,
        b: start.b + (end.b - start.b) * clampedT,
    });
};

export const liftHex = (hex: string, amount: number): string => {
    const rgb = hexToRgb(hex);
    if (amount >= 0) {
        return rgbToHex({
            r: rgb.r + (255 - rgb.r) * amount,
            g: rgb.g + (255 - rgb.g) * amount,
            b: rgb.b + (255 - rgb.b) * amount,
        });
    }
    const darken = 1 + amount;
    return rgbToHex({
        r: rgb.r * darken,
        g: rgb.g * darken,
        b: rgb.b * darken,
    });
};
