import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { renderProfile } from './app/render-profile.js';
import { buildHelpText, parseCliOptions } from './config/cli.js';
import { resolveRenderRequest } from './config/load.js';

const projectRoot = path.dirname(
    fileURLToPath(new URL('../package.json', import.meta.url)),
);

const main = async (): Promise<void> => {
    loadEnvFile({
        path: path.join(projectRoot, '.env.local'),
        override: false,
        quiet: true,
    });
    const options = parseCliOptions(process.argv.slice(2));
    if (options.help) {
        console.log(buildHelpText());
        return;
    }
    const request = await resolveRenderRequest(
        projectRoot,
        options,
        process.env,
    );
    const exportedAssets = await renderProfile(projectRoot, request);

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
    console.log(`- Render manifest: ${exportedAssets.manifestPath}`);
};

void main().catch((error: unknown) => {
    console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
});
