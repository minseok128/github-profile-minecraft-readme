export { buildHelpText, parseCliOptions } from './config/cli.js';
export { loadRenderConfig, resolveRenderRequest } from './config/load.js';
export { DEFAULT_CONFIG, renderConfigSchema } from './config/schema.js';
export type {
    CaptureConfig,
    CliOptions,
    OutputConfig,
    ProfileConfig,
    RenderConfig,
    ResolvedRenderRequest,
    SceneConfig,
} from './config/types.js';
