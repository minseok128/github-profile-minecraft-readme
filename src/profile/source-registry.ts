import { createSampleProfileForWindow } from '../sample-profile.js';
import { loadGithubProfile } from './sources/github.js';
import type {
    ContributionProfile,
    ContributionWindow,
} from './types.js';

export interface ProfileSourceContext {
    username: string;
    window: ContributionWindow;
    githubToken?: string;
}

export type ProfileSource = (
    context: ProfileSourceContext,
) => Promise<ContributionProfile>;

export const PROFILE_SOURCES = {
    github: async (context: ProfileSourceContext): Promise<ContributionProfile> => {
        if (!context.githubToken) {
            throw new Error('GITHUB_TOKEN is required for the github profile source.');
        }
        return loadGithubProfile({
            token: context.githubToken,
            username: context.username,
            window: context.window,
        });
    },
    sample: (context: ProfileSourceContext): Promise<ContributionProfile> =>
        Promise.resolve(
            createSampleProfileForWindow(
                context.username,
                context.window.from,
                context.window.to,
            ),
        ),
} satisfies Record<'github' | 'sample', ProfileSource>;
