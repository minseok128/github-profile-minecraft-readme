# Minecraft Profile Renderer

Render a GitHub contribution calendar as a Minecraft-style Three.js landscape and export README-ready PNG, GIF, and standalone HTML files.

> Unofficial fan project. Not approved by or associated with Mojang or Microsoft.

## Preview

![Minecraft contribution world](https://github.com/minseok128/github-profile-minecraft-readme/releases/download/profile-assets/profile-minecraft.gif)

The fixed `profile-assets/profile-minecraft.gif` Release URL is the public compatibility contract.

## Requirements

- Node.js 22+
- Chromium for PNG or GIF capture
- FFmpeg for GIF output

## Install

```bash
npm ci
npx playwright install chromium
```

FFmpeg is unnecessary when `capture.formats` excludes `gif`. Chromium and FFmpeg are both unnecessary for HTML-only output.

## Render

Deterministic sample data:

```bash
npm run render:sample -- --as-of 2026-08-01
```

GitHub data:

```bash
GITHUB_TOKEN=your_token npm run render -- --username your-github-id
```

For local use, put the token in an untracked `.env.local` instead:

```dotenv
GITHUB_TOKEN=your_token
```

Tokens are accepted only from `.env.local` or `GITHUB_TOKEN`; they are not valid config or CLI values. A GitHub username resolves in this order: `--username`, `profile.username`, then `GITHUB_ACTOR`. Sample mode defaults to `minecraft-shepherd`.

The v2 CLI deliberately stays small:

```text
--config <path>
--username <name>
--sample
--output-dir <path>
--as-of <YYYY-MM-DD>
--help
```

`--as-of` fixes the UTC end date for a trailing period and sample generation. It is invalid with year mode. Removed v1 flags and unknown options fail instead of being ignored.

## v2 configuration

The default file is [config/default.json](./config/default.json):

```json
{
    "version": 2,
    "profile": {
        "source": "github",
        "period": { "mode": "trailing", "days": 365 }
    },
    "scene": {
        "weeks": 53,
        "background": "transparent",
        "hud": false,
        "theme": "korean-seasonal",
        "creatures": ["sheep"]
    },
    "capture": {
        "width": 1200,
        "height": 892,
        "formats": ["png", "gif", "html"],
        "gif": { "durationSec": 5, "fps": 10 }
    },
    "output": {
        "directory": "profile",
        "baseName": "profile-minecraft"
    }
}
```

`profile.username` is optional. A period is either trailing (`days`: 7–366) or a UTC calendar year (`year`: 2008–current year). Configuration is strict: misspelled or legacy properties, duplicate formats, and unregistered IDs are rejected.

Resolution is built-in defaults → v2 JSON → the allowed CLI overrides.

## Output

With the default formats, `profile/` contains:

- `profile-minecraft.gif`
- `profile-minecraft.png`
- `profile-minecraft.html`
- `scene-runtime.js`
- `assets/` containing only assets required by the selected theme and creatures
- `README-snippet.md`
- `.profile-render-manifest.json`

Generation occurs in a sibling staging directory. Files are checked before publishing, managed files are replaced transactionally, and a failed render keeps the last successful output. Unrelated files in the output directory are not removed.

The generated README snippet prefers GIF, then PNG, then an HTML link. Its path is relative to this project root, so it can be pasted into a root README.

## Extending the internal registries

This project intentionally has no external plugin API.

- Add IDs in [src/scene/registry-ids.ts](./src/scene/registry-ids.ts).
- Register a theme and its required asset keys in [src/scene/theme-registry.ts](./src/scene/theme-registry.ts).
- Register Node planning in [src/scene/creature-registry.ts](./src/scene/creature-registry.ts) and browser rendering in [src/scene/runtime/creature-registry.ts](./src/scene/runtime/creature-registry.ts).
- Register output behavior and resource requirements in [src/output/handlers.ts](./src/output/handlers.ts).
- Add asset filenames only to the typed manifest in [src/scene/assets.ts](./src/scene/assets.ts).

The scene and output orchestrators dispatch through these registries and do not contain format- or creature-specific branches.

## Development

Run the complete browser-free quality gate:

```bash
npm run check
```

It runs formatting checks, ESLint, TypeScript, unit tests, and the production build. Browser automation and pixel snapshots are intentionally excluded from CI. Validate visual changes with a fixed real render:

```bash
npm run render:sample -- --as-of 2026-08-01 --output-dir /tmp/minecraft-profile-render
```

## Troubleshooting

- `GITHUB_TOKEN is required`: set it in `.env.local` or the process environment.
- `Executable doesn't exist`: run `npx playwright install chromium`.
- `ffmpeg` preflight failure: install FFmpeg or remove `gif` from `capture.formats`.
- `Scene runtime failed`: the CLI now reports the browser runtime error directly; check the preceding browser/request log line.
- Invalid config: only strict v2 keys are supported. Run `npm run render -- --help` for CLI options.
- Standalone HTML asset errors: serve the output directory instead of opening through `file://`, for example `npx serve profile`.

## GitHub Actions

[.github/workflows/render-profile.yml](./.github/workflows/render-profile.yml) runs the full quality gate, performs a real render, verifies the fixed GIF, and then replaces assets on the `profile-assets` Release. Generated files are not committed.

## License

Released under the [MIT License](./LICENSE). See [ASSET_NOTICE.md](./ASSET_NOTICE.md) for third-party asset and output usage notices.
