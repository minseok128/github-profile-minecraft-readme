import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

export { hashUint32 as hashString, mulberry32 } from './shared/random.js';

export const toIsoDate = (date: Date): string =>
    date.toISOString().slice(0, 10);

export const toFixed = (value: number, digits = 2): number =>
    Number(value.toFixed(digits));

export const formatThousands = (value: number): string =>
    value.toLocaleString('en-US');

export const trimLastWeeks = <T>(days: Array<T>, weeks: number): Array<T> => {
    const normalizedWeeks = Number.isFinite(weeks)
        ? Math.max(1, Math.floor(weeks))
        : 52;
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
