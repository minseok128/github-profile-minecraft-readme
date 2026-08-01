import { Command } from 'commander';
import type { CliOptions } from './types.js';

export const buildHelpText = (): string => {
    const program = createProgram();
    return program.helpInformation();
};

const createProgram = (): Command =>
    new Command()
        .name('github-profile-minecraft-readme')
        .description('Render GitHub contributions as a Minecraft-style scene.')
        .allowUnknownOption(false)
        .allowExcessArguments(false)
        .configureOutput({ writeErr: () => undefined })
        .helpOption(false)
        .option('--config <path>', 'path to a v2 JSON config file')
        .option('--username <name>', 'GitHub username to render')
        .option('--sample', 'use deterministic sample data', false)
        .option('--output-dir <path>', 'override the output directory')
        .option('--as-of <YYYY-MM-DD>', 'UTC end date for trailing/sample data')
        .option('--help', 'show help', false);

export const parseCliOptions = (argv: Array<string>): CliOptions => {
    const program = createProgram();
    program.exitOverride();
    program.parse(argv, { from: 'user' });
    const options = program.opts<{
        config?: string;
        username?: string;
        sample: boolean;
        outputDir?: string;
        asOf?: string;
        help: boolean;
    }>();

    return {
        configPath: options.config,
        username: options.username,
        sample: options.sample,
        outputDir: options.outputDir,
        asOf: options.asOf,
        help: options.help,
    };
};
