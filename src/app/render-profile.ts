import type { ExportedAssetPaths } from '../output/types.js';
import { PROFILE_SOURCES } from '../profile/source-registry.js';
import { buildContributionWindow } from '../profile/window.js';
import { exportProfileAssets } from '../render/exporter.js';
import type { ResolvedRenderRequest } from '../config/types.js';

export const renderProfile = async (
    projectRoot: string,
    request: ResolvedRenderRequest,
): Promise<ExportedAssetPaths> => {
    const profileConfig = request.config.profile;
    if (!profileConfig.username) {
        throw new Error('Resolved profile username is missing.');
    }
    const profile = await PROFILE_SOURCES[profileConfig.source]({
        username: profileConfig.username,
        window: buildContributionWindow(profileConfig.period, request.asOf),
        githubToken: request.githubToken,
    });
    return exportProfileAssets(projectRoot, profile, request.config);
};
