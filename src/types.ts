export type ContributionLevelName =
    | 'NONE'
    | 'FIRST_QUARTILE'
    | 'SECOND_QUARTILE'
    | 'THIRD_QUARTILE'
    | 'FOURTH_QUARTILE';

export interface CalendarDay {
    contributionCount: number;
    contributionLevel: number;
    date: string;
}

export interface LanguageContribution {
    language: string;
    color: string;
    contributions: number;
}

export interface UserSnapshot {
    username: string;
    calendar: Array<CalendarDay>;
    languages: Array<LanguageContribution>;
    totalContributions: number;
    totalCommitContributions: number;
    totalIssueContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    totalRepositoryContributions: number;
    totalForkCount: number;
    totalStargazerCount: number;
}

export interface RenderConfig {
    weeks: number;
    width: number;
    height: number;
    background: 'sky' | 'transparent';
    showHud: boolean;
    showSheep: boolean;
    baseName: string;
    outputDir: string;
}

export interface CalendarMetric {
    contributionCount: number;
    contributionLevel: number;
    date: string;
    week: number;
    dayOfWeek: number;
    worldHeight: number;
}

export interface GrassWorldCell {
    contributionLevel: number;
    week: number;
    dayOfWeek: number;
    worldHeight: number;
}

export interface SheepColorDefinition {
    name:
        | 'white'
        | 'black'
        | 'gray'
        | 'light_gray'
        | 'brown'
        | 'pink';
    hex: string;
    weight: number;
}

export interface SheepSpawnPlan {
    islandId: number;
    sheepIndex: number;
    islandSheepCount: number;
    colorName: SheepColorDefinition['name'];
    colorHex: string;
    route: Array<GrassWorldCell>;
}

export interface PanelPattern {
    width: number;
    bitmap: Array<number | string>;
    backgroundColor?: string;
    foregroundColor?: string;
}

export interface ContribPattern {
    top: PanelPattern & {
        backgroundColor: string;
        foregroundColor: string;
    };
    left: PanelPattern;
    right: PanelPattern;
}

export interface ExportedAssetPaths {
    svgPath: string;
    readmeSnippetPath: string;
}
