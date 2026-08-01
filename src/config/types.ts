import type {
    CreatureId,
    OutputFormat,
    ThemeId,
} from '../scene/registry-ids.js';
import type { ProfilePeriod } from '../profile/types.js';

export interface ProfileConfig {
    source: 'github' | 'sample';
    username?: string;
    period: ProfilePeriod;
}

export interface SceneConfig {
    weeks: number;
    background: 'sky' | 'transparent';
    hud: boolean;
    theme: ThemeId;
    creatures: Array<CreatureId>;
}

export interface CaptureConfig {
    width: number;
    height: number;
    formats: Array<OutputFormat>;
    gif: {
        durationSec: number;
        fps: number;
    };
}

export interface OutputConfig {
    directory: string;
    baseName: string;
}

export interface RenderConfig {
    version: 2;
    profile: ProfileConfig;
    scene: SceneConfig;
    capture: CaptureConfig;
    output: OutputConfig;
}

export interface CliOptions {
    configPath?: string;
    username?: string;
    sample: boolean;
    outputDir?: string;
    asOf?: string;
    help: boolean;
}

export interface ResolvedRenderRequest {
    config: RenderConfig;
    asOf: Date;
    githubToken?: string;
}
