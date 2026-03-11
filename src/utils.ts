import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

export const toIsoDate = (date: Date): string =>
    date.toISOString().slice(0, 10);

export const toFixed = (value: number, digits = 2): number =>
    Number(value.toFixed(digits));

export const formatThousands = (value: number): string =>
    value.toLocaleString('en-US');

export const trimLastWeeks = <T>(days: Array<T>, weeks: number): Array<T> => {
    const normalizedWeeks = Number.isFinite(weeks) ? Math.max(1, Math.floor(weeks)) : 52;
    const maxDays = normalizedWeeks * 7;
    return days.length <= maxDays ? days : days.slice(days.length - maxDays);
};

export const ensureDir = async (dirPath: string): Promise<void> => {
    await mkdir(dirPath, { recursive: true });
};

export const readJsonFile = async <T>(filePath: string): Promise<T> => {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
};

export const writeTextFile = async (
    filePath: string,
    content: string,
): Promise<void> => {
    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, content, 'utf8');
};

/**
 * FNV-1a hash returning an unsigned 32-bit integer.
 *
 * A similar FNV-1a implementation exists in `src/scene/runtime/textures/seasonal.ts`
 * that returns a normalized [0, 1) float instead. The two are intentionally separate:
 * this module runs in Node and imports `node:fs/promises`, so it cannot be bundled
 * into the browser runtime without breaking esbuild.
 */
export const hashString = (value: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

export const mulberry32 = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let result = Math.imul(state ^ (state >>> 15), state | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
};

