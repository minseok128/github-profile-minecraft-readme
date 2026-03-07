import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRenderConfig, parseCliOptions } from './config.js';
import { aggregateGithubProfile } from './github/aggregate-user-info.js';
import { fetchGithubProfile } from './github/github-graphql.js';
import { exportProfileAssets } from './render/exporter.js';
import { buildSceneHtml } from './scene/build-scene-page.js';
import { createSampleProfile } from './sample-profile.js';

const projectRoot = path.dirname(
    fileURLToPath(new URL('../package.json', import.meta.url)),
);

const main = async (): Promise<void> => {
    const cliOptions = parseCliOptions(process.argv.slice(2));
    const config = await loadRenderConfig(projectRoot, cliOptions);
    const username =
        cliOptions.username ??
        process.env.USERNAME ??
        process.env.GITHUB_ACTOR ??
        'minecraft-shepherd';
    const token = cliOptions.token ?? process.env.GITHUB_TOKEN;
    const maxRepos = cliOptions.maxRepos ?? 100;

    const userSnapshot = cliOptions.sample
        ? createSampleProfile(username)
        : (() => {
              if (!token) {
                  throw new Error(
                      'GITHUB_TOKEN is required unless --sample is provided.',
                  );
              }
              return null;
          })();

    const resolvedSnapshot =
        userSnapshot ??
        aggregateGithubProfile(
            username,
            await fetchGithubProfile(token as string, username, maxRepos, cliOptions.year),
        );

    const html = buildSceneHtml(resolvedSnapshot, config);
    const exportedAssets = await exportProfileAssets(
        projectRoot,
        resolvedSnapshot,
        config,
        html,
    );

    console.log('Rendered profile assets:');
    if (exportedAssets.pngPath) {
        console.log(`- PNG: ${exportedAssets.pngPath}`);
    }
    if (exportedAssets.gifPath) {
        console.log(`- GIF: ${exportedAssets.gifPath}`);
    }
    if (exportedAssets.htmlPath) {
        console.log(`- HTML preview: ${exportedAssets.htmlPath}`);
    }
    console.log(`- README snippet: ${exportedAssets.readmeSnippetPath}`);
};

void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
