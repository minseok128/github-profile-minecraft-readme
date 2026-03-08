import { readFile } from 'node:fs/promises';
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

const loadLocalEnv = async (rootDir: string): Promise<void> => {
    const envPath = path.join(rootDir, '.env.local');
    let content = '';
    try {
        content = await readFile(envPath, 'utf8');
    } catch (error) {
        const errorCode = (error as NodeJS.ErrnoException).code;
        if (errorCode === 'ENOENT') {
            return;
        }
        throw error;
    }

    content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex <= 0) {
            return;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        const value =
            rawValue.startsWith('"') && rawValue.endsWith('"')
                ? rawValue.slice(1, -1)
                : rawValue;

        if (!process.env[key]) {
            process.env[key] = value;
        }
    });
};

const buildTrailing365DayWindow = (): { from: string; to: string } => {
    const today = new Date();
    const from = new Date(
        Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate() - 364,
            0,
            0,
            0,
            0,
        ),
    );
    const to = new Date(
        Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
            23,
            59,
            59,
            999,
        ),
    );
    return {
        from: from.toISOString(),
        to: to.toISOString(),
    };
};

const main = async (): Promise<void> => {
    await loadLocalEnv(projectRoot);
    const cliOptions = parseCliOptions(process.argv.slice(2));
    const config = await loadRenderConfig(projectRoot, cliOptions);
    const username =
        cliOptions.username ??
        process.env.USERNAME ??
        process.env.GITHUB_ACTOR ??
        'minecraft-shepherd';
    const token = cliOptions.token ?? process.env.GITHUB_TOKEN;
    const maxRepos = cliOptions.maxRepos ?? 100;
    const contributionWindow = buildTrailing365DayWindow();

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
            await fetchGithubProfile(
                token as string,
                username,
                maxRepos,
                cliOptions.year,
                contributionWindow,
            ),
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
