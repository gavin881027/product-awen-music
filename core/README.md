# Awen Core API

`core/awen-core.mjs` 是供其他项目复用的无状态 ESM 算法入口。它只包含音乐矩阵、确定性模板生成和专辑轨道编排；不包含 React、页面 UI、localStorage、GitHub 同步、网络请求、AI Provider 或任何凭据处理。

它目前由 `src/data.js` 的纯矩阵引擎抽取而来。Awen 主应用暂时仍以 `docs/index.html` 为运行入口，因此该模块的对外 API 是稳定的复用边界，但新功能若改变矩阵算法，需同步更新该模块并运行核心 API 测试。

## 从另一个本地项目调用

在其他 Node.js ESM 项目中，直接从已克隆仓库导入：

```js
import {
  DEFAULTS,
  fallbackPrompt,
  buildAlbum,
  fallbackAlbum,
  randomSelection,
} from '/absolute/path/to/product-awen-music/core/awen-core.mjs';

const selection = {
  ...DEFAULTS,
  environment: 'Rainy Window',
  mood: 'Focused',
  bpm: 62,
};

const prompt = fallbackPrompt(selection);
console.log(prompt.suno.style);

const { axis, recipes } = buildAlbum('day', selection, 16);
const album = fallbackAlbum(axis.key, selection, recipes);
console.log(album.album, album.tracks);
```

若另一个项目也位于同一父目录，可使用相对路径：

```js
import { fallbackPrompt, DEFAULTS } from '../product-awen-music/core/awen-core.mjs';
```

要求 Node.js 20 或更高版本，并在调用方的 `package.json` 中使用 `"type": "module"`；CommonJS 项目请使用动态导入：

```js
const { fallbackPrompt, DEFAULTS } = await import('../product-awen-music/core/awen-core.mjs');
```

## 以 Git 提交固定依赖版本

如项目需要可复现构建，建议固定到已验证提交，而不是跟随 `main`：

```json
{
  "dependencies": {
    "awen-music-core": "git+https://github.com/gavin881027/product-awen-music.git#<verified-commit>"
  }
}
```

安装后从包内路径导入：

```js
import { fallbackPrompt, DEFAULTS } from 'awen-music-core/core/awen-core.mjs';
```

私人仓库需要由调用项目自身通过 SSH、GitHub CLI 或其 CI 的安全凭据完成安装；不要把 PAT 写入 `package.json`、源码、日志或 URL。

## 浏览器项目调用

现代浏览器可使用模块脚本加载本地或部署后的文件：

```html
<script type="module">
  import { DEFAULTS, fallbackPrompt } from '/core/awen-core.mjs';
  const recipe = fallbackPrompt({ ...DEFAULTS, mood: 'Cozy' });
  console.log(recipe);
</script>
```

该模块不自动挂载 `window.AWEN`，避免污染调用方全局变量。若调用方需要显式暴露，可自行写：

```js
import * as AwenCore from '/core/awen-core.mjs';
window.AwenCore = AwenCore;
```

## 导出 API

`DIMS`、`BPM`、`DEFAULTS`、`REFERENCE`、`CONTENT_KEYS`、`PRESETS` 是只读的算法配置数据。请把它们视为输入选项来源，而不是向其写入状态。

`randomSelection()` 返回一组有效的随机矩阵选择。`mutations(selection)` 返回相对于 `REFERENCE.decomposed` 的变化维度数。`fallbackPrompt(selection)` 为一首歌返回本地确定性 Prompt、Suno Style、封面和视频文案。`buildAlbum(axisKey, baseSelection, trackCount)` 返回 `{ axis, recipes }`；合法 axis 可从 `ALBUM_AXES` 读取。`fallbackAlbum(axisKey, baseSelection, recipes)` 将已编排的 recipes 转换为本地确定性专辑数据。`anchorDims(axisKey)` 返回该专辑轴固定的维度列表。

调用前应由调用方确保 selection 含有 `environment`、`nature`、`time`、`mood`、`instrument`、`style` 和 `bpm`，且值来自 `DIMS` 与 `BPM.values`。推荐始终从 `{ ...DEFAULTS, ...yourOverrides }` 开始构造输入。

## 不包含的能力

这个接口不执行真实 AI 生成、不代替 Suno、不自动上传图片、不调用 GitHub，也不管理收藏或审核记录。需要这些业务能力时，应通过 Awen 主应用的明确 UI／协议流程集成，或在后续版本设计独立服务 API；不要从另一个项目调用主页面里的 React 内部函数。

## 验证

仓库内运行：

```bash
node --test 'tests/**/*.test.mjs'
```

核心接口测试文件为 `tests/core-api.test.mjs`。它不访问网络，也不需要任何密钥。
