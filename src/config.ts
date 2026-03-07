import * as path from 'node:path';
import { readJsonFile } from './utils.js';
import type { RenderConfig } from './types.js';

export interface CliOptions {
    configPath?: string;
    username?: string;
    token?: string;
    year?: number;
    maxRepos?: number;
    outputDir?: string;
    sample: boolean;
    emitHtml?: boolean;
    createGif?: boolean;
    createPng?: boolean;
    background?: RenderConfig['background'];
    weeks?: number;
    width?: number;
    height?: number;
    gifDurationSec?: number;
    gifFps?: number;
}

export const DEFAULT_CONFIG: RenderConfig = {
    weeks: 26,
    width: 700,
    height: 520,
    background: 'transparent',
    showHud: false,
    showSheep: true,
    createPng: true,
    createGif: true,
    emitHtml: false,
    baseName: 'profile-minecraft',
    outputDir: 'profile',
    gif: {
        durationSec: 5,
        fps: 10,
    },
};

export const parseCliOptions = (argv: Array<string>): CliOptions => {
    const options: CliOptions = {
        sample: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = argv[i + 1];
        switch (arg) {
            case '--config':
                options.configPath = next;
                i += 1;
                break;
            case '--username':
                options.username = next;
                i += 1;
                break;
            case '--token':
                options.token = next;
                i += 1;
                break;
            case '--year':
                options.year = Number(next);
                i += 1;
                break;
            case '--max-repos':
                options.maxRepos = Number(next);
                i += 1;
                break;
            case '--output-dir':
                options.outputDir = next;
                i += 1;
                break;
            case '--weeks':
                options.weeks = Number(next);
                i += 1;
                break;
            case '--width':
                options.width = Number(next);
                i += 1;
                break;
            case '--height':
                options.height = Number(next);
                i += 1;
                break;
            case '--background':
                if (next === 'sky' || next === 'transparent') {
                    options.background = next;
                }
                i += 1;
                break;
            case '--duration':
                options.gifDurationSec = Number(next);
                i += 1;
                break;
            case '--fps':
                options.gifFps = Number(next);
                i += 1;
                break;
            case '--sample':
                options.sample = true;
                break;
            case '--emit-html':
                options.emitHtml = true;
                break;
            case '--no-gif':
                options.createGif = false;
                break;
            case '--no-png':
                options.createPng = false;
                break;
            default:
                break;
        }
    }

    return options;
};

export const loadRenderConfig = async (
    projectRoot: string,
    options: CliOptions,
): Promise<RenderConfig> => {
    const configPath = options.configPath
        ? path.resolve(projectRoot, options.configPath)
        : path.resolve(projectRoot, 'config/default.json');
    const fileConfig = await readJsonFile<Partial<RenderConfig>>(configPath);

    return {
        ...DEFAULT_CONFIG,
        ...fileConfig,
        weeks: options.weeks ?? fileConfig.weeks ?? DEFAULT_CONFIG.weeks,
        width: options.width ?? fileConfig.width ?? DEFAULT_CONFIG.width,
        height: options.height ?? fileConfig.height ?? DEFAULT_CONFIG.height,
        background:
            options.background ??
            fileConfig.background ??
            DEFAULT_CONFIG.background,
        createGif:
            options.createGif ??
            fileConfig.createGif ??
            DEFAULT_CONFIG.createGif,
        createPng:
            options.createPng ??
            fileConfig.createPng ??
            DEFAULT_CONFIG.createPng,
        emitHtml:
            options.emitHtml ??
            fileConfig.emitHtml ??
            DEFAULT_CONFIG.emitHtml,
        outputDir:
            options.outputDir ?? fileConfig.outputDir ?? DEFAULT_CONFIG.outputDir,
        gif: {
            durationSec:
                options.gifDurationSec ??
                fileConfig.gif?.durationSec ??
                DEFAULT_CONFIG.gif.durationSec,
            fps:
                options.gifFps ??
                fileConfig.gif?.fps ??
                DEFAULT_CONFIG.gif.fps,
        },
    };
};
