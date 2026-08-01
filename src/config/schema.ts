import { z } from 'zod';
import {
    CREATURE_IDS,
    OUTPUT_FORMAT_IDS,
    THEME_IDS,
} from '../scene/registry-ids.js';
import type { RenderConfig } from './types.js';

const currentUtcYear = (): number => new Date().getUTCFullYear();

const trailingPeriodSchema = z
    .object({
        mode: z.literal('trailing'),
        days: z.number().int().min(7).max(366),
    })
    .strict();

const yearPeriodSchema = z
    .object({
        mode: z.literal('year'),
        year: z.number().int().min(2008).max(currentUtcYear()),
    })
    .strict();

const profileSchema = z
    .object({
        source: z.enum(['github', 'sample']),
        username: z.string().trim().min(1).optional(),
        period: z.discriminatedUnion('mode', [
            trailingPeriodSchema,
            yearPeriodSchema,
        ]),
    })
    .strict();

const sceneSchema = z
    .object({
        weeks: z.number().int().min(1).max(53),
        background: z.enum(['sky', 'transparent']),
        hud: z.boolean(),
        theme: z.enum(THEME_IDS),
        creatures: z.array(z.enum(CREATURE_IDS)),
    })
    .strict();

const captureSchema = z
    .object({
        width: z.number().int().min(1).max(8192),
        height: z.number().int().min(1).max(8192),
        formats: z
            .array(z.enum(OUTPUT_FORMAT_IDS))
            .min(1)
            .refine((formats) => new Set(formats).size === formats.length, {
                message: 'capture.formats must not contain duplicates',
            }),
        gif: z
            .object({
                durationSec: z.number().min(0.1).max(30),
                fps: z.number().int().min(1).max(60),
            })
            .strict(),
    })
    .strict();

const outputSchema = z
    .object({
        directory: z.string().trim().min(1),
        baseName: z
            .string()
            .trim()
            .regex(
                /^[A-Za-z0-9._-]+$/,
                'output.baseName contains unsafe characters',
            ),
    })
    .strict();

export const renderConfigSchema: z.ZodType<RenderConfig> = z
    .object({
        version: z.literal(2),
        profile: profileSchema,
        scene: sceneSchema,
        capture: captureSchema,
        output: outputSchema,
    })
    .strict();

export const renderConfigInputSchema = z
    .object({
        version: z.literal(2),
        profile: profileSchema.partial().strict().optional(),
        scene: sceneSchema.partial().strict().optional(),
        capture: captureSchema
            .omit({ gif: true })
            .partial()
            .extend({
                gif: captureSchema.shape.gif.partial().strict().optional(),
            })
            .strict()
            .optional(),
        output: outputSchema.partial().strict().optional(),
    })
    .strict();

export const DEFAULT_CONFIG: RenderConfig = {
    version: 2,
    profile: {
        source: 'github',
        period: {
            mode: 'trailing',
            days: 365,
        },
    },
    scene: {
        weeks: 53,
        background: 'transparent',
        hud: false,
        theme: 'korean-seasonal',
        creatures: ['sheep'],
    },
    capture: {
        width: 1200,
        height: 892,
        formats: ['png', 'gif', 'html'],
        gif: {
            durationSec: 5,
            fps: 10,
        },
    },
    output: {
        directory: 'profile',
        baseName: 'profile-minecraft',
    },
};
