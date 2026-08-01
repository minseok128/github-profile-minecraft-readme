import { spawn } from 'node:child_process';

export const runCommand = async (
    command: string,
    args: Array<string>,
    timeoutMs: number,
): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'ignore', 'pipe'],
            signal: AbortSignal.timeout(timeoutMs),
        });
        let settled = false;
        let stderr = '';
        child.stderr?.on('data', (chunk: Buffer) => {
            if (stderr.length < 8_000) {
                stderr += chunk.toString('utf8');
            }
        });
        const finish = (error?: Error): void => {
            if (settled) {
                return;
            }
            settled = true;
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };
        child.once('error', (error) => {
            finish(
                error.name === 'AbortError'
                    ? new Error(`${command} timed out after ${timeoutMs}ms`)
                    : error,
            );
        });
        child.once('exit', (code) => {
            if (code === 0) {
                finish();
                return;
            }
            const detail = stderr.trim();
            finish(
                new Error(
                    `${command} exited with code ${code ?? 'unknown'}${detail ? `: ${detail}` : ''}`,
                ),
            );
        });
    });
