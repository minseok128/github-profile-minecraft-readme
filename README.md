# github-profile-minecraft-readme

Render GitHub contribution data as a Minecraft-style Three.js scene and export README-ready `PNG` and `GIF` assets.

> Unofficial fan project. Not approved by or associated with Mojang or Microsoft.

## Preview

![Minecraft contribution world](./profile/profile-minecraft.gif)

## Requirements

- Node.js 22+
- `ffmpeg`
- Chromium for Playwright

## Installation

```bash
npm install
npx playwright install chromium
```

## Usage

Sample data:

```bash
npm run render:sample
```

GitHub profile:

```bash
GITHUB_TOKEN=your_token npm run render -- --username your-github-id --output-dir profile
```

`GITHUB_TOKEN` can also be loaded from `.env.local`.

Common options:

- `--config config/default.json`
- `--weeks 53`
- `--width 1200`
- `--height 892`
- `--background sky`
- `--background transparent`
- `--emit-html`
- `--no-gif`
- `--no-png`

CLI help:

```bash
npm run render -- --help
```

## Output

- `profile/profile-minecraft.png`
- `profile/profile-minecraft.gif`
- `profile/README-snippet.md`

## Embedding in a README

[profile/README-snippet.md](./profile/README-snippet.md):

```md
![Minecraft contribution world](./profile/profile-minecraft.gif)
<sub>Unofficial fan project. Not approved by or associated with Mojang or Microsoft.</sub>
```

Raw URL:

```md
![Minecraft contribution world](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/profile/profile-minecraft.gif)
```

## Configuration

Default settings live in [config/default.json](./config/default.json).

Common settings:

- `weeks`
- `width`, `height`
- `background`
- `showHud`
- `createPng`, `createGif`
- `emitHtml`
- `gif.durationSec`, `gif.fps`

## Development

- `npm run render:sample`
- `npm run typecheck`
- `npm test`

## GitHub Actions

[.github/workflows/render-profile.yml](./.github/workflows/render-profile.yml)

## Project Structure

- [src/cli.ts](./src/cli.ts): CLI entry point
- [src/github](./src/github): GitHub data fetching and aggregation
- [src/scene](./src/scene): scene generation and browser runtime
- [src/render](./src/render): capture pipeline and asset export

## License

This project is released under the [MIT License](./LICENSE). See [ASSET_NOTICE.md](./ASSET_NOTICE.md) for third-party asset and output usage notes.
