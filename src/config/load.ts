import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { ZodError } from 'zod';
import {
    DEFAULT_CONFIG,
    renderConfigInputSchema,
    renderConfigSchema,
} from './schema.js';
import type {
    CliOptions,
    RenderConfig,
    ResolvedRenderRequest,
} from './types.js';

const parseAsOf = (value: string | undefined): Date => {
    if (!value) {
        const now = new Date();
        return new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(
            `Invalid --as-of date '${value}'. Expected YYYY-MM-DD.`,
        );
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
    ) {
        throw new Error(`Invalid --as-of date '${value}'.`);
    }
    return parsed;
};

const formatConfigError = (error: ZodError): Error => {
    const details = error.issues
        .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
        .join('; ');
    return new Error(`Invalid config: ${details}`);
};

export const loadRenderConfig = async (
    projectRoot: string,
    options: CliOptions,
): Promise<RenderConfig> => {
    const configPath = options.configPath
        ? path.resolve(projectRoot, options.configPath)
        : path.resolve(projectRoot, 'config/default.json');
    const rawText = await readFile(configPath, 'utf8');
    let rawConfig: unknown;
    try {
        rawConfig = JSON.parse(rawText);
    } catch (error) {
        throw new Error(
            `Invalid config JSON at ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
        );
    }

    const inputResult = renderConfigInputSchema.safeParse(rawConfig);
    if (!inputResult.success) {
        throw formatConfigError(inputResult.error);
    }
    const input = inputResult.data;
    const merged = {
        ...DEFAULT_CONFIG,
        ...input,
        profile: {
            ...DEFAULT_CONFIG.profile,
            ...input.profile,
            period: input.profile?.period ?? DEFAULT_CONFIG.profile.period,
        },
        scene: {
            ...DEFAULT_CONFIG.scene,
            ...input.scene,
        },
        capture: {
            ...DEFAULT_CONFIG.capture,
            ...input.capture,
            gif: {
                ...DEFAULT_CONFIG.capture.gif,
                ...input.capture?.gif,
            },
        },
        output: {
            ...DEFAULT_CONFIG.output,
            ...input.output,
        },
    };
    const result = renderConfigSchema.safeParse(merged);
    if (!result.success) {
        throw formatConfigError(result.error);
    }
    return result.data;
};

export const resolveRenderRequest = async (
    projectRoot: string,
    options: CliOptions,
    env: NodeJS.ProcessEnv,
): Promise<ResolvedRenderRequest> => {
    const loadedConfig = await loadRenderConfig(projectRoot, options);
    const asOf = parseAsOf(options.asOf);
    const source = options.sample ? 'sample' : loadedConfig.profile.source;
    if (loadedConfig.profile.period.mode === 'year' && options.asOf) {
        throw new Error(
            '--as-of cannot be used with profile.period.mode=year.',
        );
    }
    const username =
        options.username ??
        loadedConfig.profile.username ??
        (source === 'github' ? env.GITHUB_ACTOR : undefined) ??
        (source === 'sample' ? 'minecraft-shepherd' : undefined);
    if (!username) {
        throw new Error(
            'A GitHub username is required via --username, profile.username, or GITHUB_ACTOR.',
        );
    }

    return {
        config: {
            ...loadedConfig,
            profile: {
                ...loadedConfig.profile,
                source,
                username,
            },
            output: {
                ...loadedConfig.output,
                directory: options.outputDir ?? loadedConfig.output.directory,
            },
        },
        asOf,
        githubToken: env.GITHUB_TOKEN,
    };
};
