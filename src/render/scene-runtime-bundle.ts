import * as path from 'node:path';
import { build } from 'esbuild';
import { SCENE_RUNTIME_BUNDLE_FILENAME } from '../scene/runtime/constants.js';

let cachedSceneRuntimeBundle: Promise<string> | undefined;

export const buildSceneRuntimeBundle = async (
    projectRoot: string,
): Promise<string> => {
    if (!cachedSceneRuntimeBundle) {
        cachedSceneRuntimeBundle = (async () => {
            const result = await build({
                absWorkingDir: projectRoot,
                bundle: true,
                entryPoints: [
                    path.join(projectRoot, 'src/scene/runtime/main/bootstrap.ts'),
                ],
                format: 'esm',
                legalComments: 'none',
                minify: false,
                outfile: SCENE_RUNTIME_BUNDLE_FILENAME,
                platform: 'browser',
                target: ['es2022'],
                write: false,
            });

            const bundledFile = result.outputFiles.find((file) =>
                file.path.endsWith(SCENE_RUNTIME_BUNDLE_FILENAME),
            );
            if (!bundledFile) {
                throw new Error('Failed to build scene runtime bundle.');
            }

            return bundledFile.text;
        })();
    }

    return cachedSceneRuntimeBundle;
};
