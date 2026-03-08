# github-profile-minecraft-readme

GitHub 기여 데이터를 Minecraft 스타일 Three.js 씬으로 렌더링하고, GitHub README에 넣을 수 있는 `PNG`/`GIF` 자산으로 내보내는 프로젝트입니다.

## Preview

![Minecraft contribution world](./profile/profile-minecraft.gif)

## Requirements

- Node.js 22+
- `ffmpeg`
- Chromium for Playwright

## Install

```bash
npm install
npx playwright install chromium
```

## Usage

샘플 데이터로 렌더링:

```bash
npm run render:sample
```

실제 GitHub 데이터로 렌더링:

```bash
GITHUB_TOKEN=your_token npm run render -- --username your-github-id --output-dir profile
```

자주 쓰는 옵션:

- `--config config/default.json`
- `--weeks 53`
- `--width 1200`
- `--height 892`
- `--background sky`
- `--background transparent`
- `--no-gif`
- `--no-png`
- `--emit-html`
- `--max-repos 100`

## Output

기본 출력 디렉터리는 `profile/` 입니다.

- `profile/profile-minecraft.png`
- `profile/profile-minecraft.gif`
- `profile/profile-minecraft.html`
- `profile/scene-runtime.js`
- `profile/README-snippet.md`

## README Embed

렌더 후 생성되는 `profile/README-snippet.md`를 그대로 사용하면 됩니다.

기본 예시는 다음과 같습니다.

```md
![Minecraft contribution world](./profile/profile-minecraft.gif)
```

다른 레포에서 이 이미지를 참조하려면 공개 저장소 기준 raw URL을 사용하면 됩니다.

```md
![Minecraft contribution world](https://raw.githubusercontent.com/minseok128/github-profile-minecraft-readme/main/profile/profile-minecraft.gif)
```

## Config

기본 설정 파일: [config/default.json](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/config/default.json)

주요 설정:

- `weeks`
- `width`, `height`
- `background`
- `showHud`
- `createPng`, `createGif`
- `emitHtml`
- `gif.durationSec`, `gif.fps`

## Checks

```bash
npm run typecheck
```

## GitHub Actions

예제 워크플로: [.github/workflows/render-profile.yml](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/.github/workflows/render-profile.yml)

포함된 워크플로는 매일 한 번 렌더링을 실행하고, `profile/` 변경사항이 있으면 자동으로 커밋합니다.

## Project Structure

- [src/cli.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/cli.ts): CLI entry
- [src/github](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/github): GitHub 데이터 수집 및 집계
- [src/scene](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene): scene payload 생성 및 browser runtime
- [src/render](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/render): Playwright 캡처와 export

## License

MIT.
