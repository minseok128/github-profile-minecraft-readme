export const THEME_IDS = ['korean-seasonal'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const CREATURE_IDS = ['sheep'] as const;
export type CreatureId = (typeof CREATURE_IDS)[number];

export const OUTPUT_FORMAT_IDS = ['png', 'gif', 'html'] as const;
export type OutputFormat = (typeof OUTPUT_FORMAT_IDS)[number];
