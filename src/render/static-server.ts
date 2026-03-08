import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
};

export interface StaticSceneServer {
    origin: string;
    close: () => Promise<void>;
}

const getContentType = (filePath: string): string =>
    MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream';

export const startStaticSceneServer = async (
    projectRoot: string,
    html: string,
    sceneRuntimeScript: string,
): Promise<StaticSceneServer> => {
    const server = createServer(async (request, response) => {
        try {
            const requestUrl = new URL(
                request.url ?? '/',
                'http://127.0.0.1:0',
            );

            if (requestUrl.pathname === '/' || requestUrl.pathname === '/scene.html') {
                response.writeHead(200, {
                    'content-type': 'text/html; charset=utf-8',
                });
                response.end(html);
                return;
            }

            if (requestUrl.pathname === '/scene-runtime.js') {
                response.writeHead(200, {
                    'content-type': 'application/javascript; charset=utf-8',
                });
                response.end(sceneRuntimeScript);
                return;
            }

            let filePath: string | null = null;
            if (requestUrl.pathname.startsWith('/vendor/')) {
                filePath = path.join(
                    projectRoot,
                    'node_modules/three/build',
                    requestUrl.pathname.replace('/vendor/', ''),
                );
            } else if (requestUrl.pathname.startsWith('/assets/')) {
                filePath = path.join(projectRoot, requestUrl.pathname.slice(1));
            }

            if (!filePath) {
                response.writeHead(404);
                response.end('Not found');
                return;
            }

            const content = await readFile(filePath);
            response.writeHead(200, {
                'content-type': getContentType(filePath),
            });
            response.end(content);
        } catch (error) {
            response.writeHead(500);
            response.end(String(error));
        }
    });

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to bind local render server.');
    }

    return {
        origin: `http://127.0.0.1:${address.port}`,
        close: async () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            }),
    };
};
