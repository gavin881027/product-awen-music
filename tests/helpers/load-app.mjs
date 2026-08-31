// Awen Test_Loader — 把 docs/index.html 里的一个 plain <script> 块变成 Node 里可调用的沙箱。
//
// 依赖口径（design §3.5 / R3 AC 1）：只允许从 node:test、node:assert、node:fs、node:path、
// node:vm 五个内置模块 import。bare specifier（不以 `.` 或 `/` 开头的说明符）数量必须为 0；
// 仓库内相对路径导入（如 `./helpers/load-app.mjs`）按该口径不计入，因为它不引入任何安装步骤。
// 本文件只用到 node:fs / node:path / node:vm 三个，刻意不用 node:url（不在允许清单内）。
//
// 设计来源：design.md §4.1（导出面）、§4.2（路径解析）、§4.3（块定位五步）、§4.4（沙箱）、
// §4.5（错误包装与「不实现回退路径」原则）、§2.2（script 块清单）、§2.5（Data_Layer 依赖面）。

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/* ------------------------------------------------------------------ *
 * Node 版本门槛（R3 AC 4）
 * 模块作用域自检：主版本 < 20 直接 throw，使该测试文件以非 0 退出。
 * ------------------------------------------------------------------ */

const MIN_NODE_MAJOR = 20;
const MIN_NODE_VERSION = '20.0.0';

const observedNodeVersion = process.versions.node;
const observedNodeMajor = Number.parseInt(String(observedNodeVersion).split('.')[0], 10);

if (!Number.isInteger(observedNodeMajor) || observedNodeMajor < MIN_NODE_MAJOR) {
  throw new Error(
    'Awen Test_Loader: 运行环境 Node 版本过低。'
    + ` 实测 process.versions.node = ${observedNodeVersion}；`
    + ` 最低要求 ${MIN_NODE_VERSION}。`
    + ' 升级 Node 后重跑 `node --test tests/`；'
    + ' 需要逐文件排查时用退路命令 `node --test tests/<文件名>.test.mjs`。',
  );
}

/* ------------------------------------------------------------------ *
 * 路径解析（design §4.2 / R3 AC 6）
 * 只从 helper 文件自身位置推导，不依赖 process.cwd()，
 * 因此从仓库根与从 tests/ 执行解析到同一绝对路径。
 * ------------------------------------------------------------------ */

// import.meta.dirname 自 Node 20.11 起可用；Node 20.0–20.10 走 URL 兜底（不使用 node:url）。
const HELPERS_DIR = import.meta.dirname
  ?? decodeURIComponent(new URL('.', import.meta.url).pathname);

export const APP_HTML = path.resolve(HELPERS_DIR, '..', '..', 'docs', 'index.html');

/** Data_Layer 块首两行注释的字面文本（design §2.2）。第二行以三个空格起首。 */
export const DATA_LAYER_SIGNATURE = '/* Awen Study — Matrix data, brand defaults, reference sample, fallback prompt engine.\n'
  + '   Plain script: exposes window.AWEN. No build step. */';

/** Pure_Block 的开标签自定义属性签名（design §4.3 步骤 3）。 */
export const PURE_BLOCK_SIGNATURE = 'data-awen-pure';

/** 沙箱求值上限（design §4.4）。 */
const EVAL_TIMEOUT_MS = 5000;

/* ------------------------------------------------------------------ *
 * 全文读取（design §4.1）
 * 模块级缓存：每进程磁盘读取 1 次，只读，不写。
 * ------------------------------------------------------------------ */

let appTextCache = null;

/** @returns {string} docs/index.html 的 UTF-8 全文 */
export function readAppText() {
  if (appTextCache === null) {
    appTextCache = fs.readFileSync(APP_HTML, 'utf8');
  }
  return appTextCache;
}

/* ------------------------------------------------------------------ *
 * 块定位五步（design §4.3）
 * ------------------------------------------------------------------ */

/** 偏移 → 1 起的行号。 */
function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

/**
 * 从 `<script` 之后的位置起找到开标签的 `>`，对引号内的 `>` 不敏感。
 * @returns {number} `>` 的偏移；找不到返回 -1
 */
function findOpenTagEnd(text, from) {
  let quote = '';
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

/**
 * 解析开标签属性文本里的属性名清单（小写）。
 * 按属性名边界取名字，因此 `data-type` / `data-src` 不会被误当成 `type` / `src`
 * （design §4.3 步骤 2）。
 */
function attributeNames(attrs) {
  const names = [];
  let i = 0;
  while (i < attrs.length) {
    const ch = attrs[i];
    if (/\s/.test(ch) || ch === '/') { i += 1; continue; }
    let name = '';
    while (i < attrs.length && !/[\s=/]/.test(attrs[i])) {
      name += attrs[i];
      i += 1;
    }
    if (name) names.push(name.toLowerCase());
    while (i < attrs.length && /\s/.test(attrs[i])) i += 1;
    if (attrs[i] === '=') {
      i += 1;
      while (i < attrs.length && /\s/.test(attrs[i])) i += 1;
      const q = attrs[i];
      if (q === '"' || q === "'") {
        i += 1;
        while (i < attrs.length && attrs[i] !== q) i += 1;
        i += 1; // 跳过闭合引号
      } else {
        while (i < attrs.length && !/\s/.test(attrs[i])) i += 1;
      }
    }
  }
  return names;
}

/**
 * plain 候选块清单（design §4.1 / §4.3 步骤 1–2、R3 AC 6）。
 * 「plain」口径：开标签属性中既无属性名 `type` 也无属性名 `src`。
 * 只扫 `<script` 开标签这一步就已排除 <style> 里的 CSS 文本。
 *
 * @param {string} [text] 默认取 readAppText()
 * @returns {Array<{index:number,label:string,attrs:string,attrNames:string[],body:string,
 *   openTagStart:number,openTagEnd:number,closeTagStart:number,startLine:number,endLine:number}>}
 */
export function plainScriptBlocks(text = readAppText()) {
  const lower = text.toLowerCase();
  const blocks = [];
  let cursor = 0;
  let scanned = 0;

  while (cursor < lower.length) {
    const open = lower.indexOf('<script', cursor);
    if (open === -1) break;
    const afterName = open + '<script'.length;
    const boundary = text[afterName];
    // 标签名边界：`<scriptfoo` 不是 script 开标签
    if (boundary !== undefined && /[A-Za-z0-9:_-]/.test(boundary)) {
      cursor = afterName;
      continue;
    }
    const tagEnd = findOpenTagEnd(text, afterName);
    if (tagEnd === -1) break;

    scanned += 1;
    const attrs = text.slice(afterName, tagEnd);
    const attrNames = attributeNames(attrs);
    const isPlain = !attrNames.includes('type') && !attrNames.includes('src');

    if (isPlain) {
      // 步骤 5：块尾取开标签之后出现的第一个 </script>（与 HTML 解析器语义一致）
      const close = lower.indexOf('</script', tagEnd + 1);
      const bodyEnd = close === -1 ? text.length : close;
      const startLine = lineOf(text, open);
      const endLine = lineOf(text, bodyEnd);
      blocks.push({
        index: blocks.length,
        label: `plain-script#${blocks.length + 1}@L${startLine}-L${endLine}`,
        attrs,
        attrNames,
        body: text.slice(tagEnd + 1, bodyEnd),
        openTagStart: open,
        openTagEnd: tagEnd,
        closeTagStart: close,
        startLine,
        endLine,
      });
    }

    cursor = tagEnd + 1;
  }

  // scanned 只用于失败信息，帮助区分「文件不对」与「口径不对」
  for (const block of blocks) block.scannedScriptTags = scanned;
  return blocks;
}

/** 按字面子串签名选定唯一 plain 块；命中数不等于 1 一律抛错（R3 AC 9、design §4.3 步骤 4）。 */
function selectBlock(signature, blocks) {
  if (typeof signature !== 'string' || signature.length === 0) {
    throw new Error('Awen Test_Loader: signature 必须是非空字符串（字面子串，不是正则）。');
  }
  const hits = blocks.filter((b) => (b.attrs + b.body).includes(signature));
  if (hits.length !== 1) {
    throw new Error(
      `Awen Test_Loader: signature ${JSON.stringify(signature)} matched `
      + `${hits.length} plain script block(s), expected exactly 1.`
      + ` File: ${APP_HTML}.`
      + ` 实测命中数 = ${hits.length}；plain 候选块数 = ${blocks.length}。`
      + ' 未建立沙箱，本次调用的求值次数为 0。',
    );
  }
  return hits[0];
}

/* ------------------------------------------------------------------ *
 * 沙箱（design §4.4 / R3 AC 7、AC 10）
 * ------------------------------------------------------------------ */

function makeSandbox() {
  const store = new Map(); // 每次调用新建，使新沙箱 localStorage 初始条目数为 0（R3 AC 10）
  const consoleCalls = [];
  const record = (level) => (...args) => { consoleCalls.push({ level, args }); };
  return {
    window: {},
    localStorage: {
      getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
      setItem: (k, v) => { store.set(String(k), String(v)); },
      removeItem: (k) => { store.delete(String(k)); },
    },
    console: { log: record('log'), warn: record('warn'), error: record('error') },
    __consoleCalls: consoleCalls,
    __localStorageStore: store,
  };
  // 刻意不注入 fetch / XMLHttpRequest / WebSocket / require / process / fs：
  // runInNewContext 建立全新 global，外层的 process 与 require 不会泄漏进来。
}

/**
 * 一次 runInNewContext 求值全部源码（design §4.4「多块拼接而不是多次求值」）。
 * 抛异常时重新包装（design §4.5 缓解 1）。
 */
function evaluate(sources, sandbox, blocks, target) {
  try {
    vm.runInNewContext(sources.join('\n'), sandbox, {
      timeout: EVAL_TIMEOUT_MS,
      filename: `docs/index.html#${target.label}`,
    });
  } catch (cause) {
    const ranges = blocks
      .map((b) => `${b.label}（docs/index.html 行 ${b.startLine}–${b.endLine}）`)
      .join('、');
    throw new Error(
      `Awen Test_Loader: 求值失败。块标签 ${target.label}，`
      + `原始起止行号 docs/index.html 行 ${target.startLine}–${target.endLine}。`
      + `本次求值的块（按文件顺序）：${ranges}。`
      + ' 注意：块尾可能被字符串内嵌的 `</script>` 提前截断，从而切出残缺代码；'
      + ' 若同时看到静态护栏的 `<script` / `</script>` 计数或 plain 块数变红，优先按该原因排查。'
      + ` 原始错误：${cause && cause.message ? cause.message : String(cause)}`,
      { cause },
    );
  }
}

function handleOf(sandbox, block) {
  return {
    sandbox,
    window: sandbox.window,
    AWEN: sandbox.window ? sandbox.window.AWEN : undefined,
    localStorage: sandbox.localStorage,
    consoleCalls: sandbox.__consoleCalls,
    block: {
      label: block.label,
      startLine: block.startLine,
      endLine: block.endLine,
      attrs: block.attrs,
    },
  };
}

/* ------------------------------------------------------------------ *
 * 导出面（design §4.1）
 * ------------------------------------------------------------------ */

/**
 * 按签名定位唯一 plain 块并在新沙箱中求值。
 * @param {{signature: string, withDataLayer?: boolean}} opts
 * @returns {{sandbox: object, window: object, AWEN: object|undefined,
 *   localStorage: object, consoleCalls: Array<object>, block: object}}
 */
export function loadPlainScriptBlock({ signature, withDataLayer = false } = {}) {
  const blocks = plainScriptBlocks(readAppText());
  const target = selectBlock(signature, blocks);

  let sources = [target];
  if (withDataLayer) {
    const dataLayer = selectBlock(DATA_LAYER_SIGNATURE, blocks);
    if (dataLayer.openTagStart !== target.openTagStart) {
      // 按文件顺序拼接，使两块共享同一个 global（与浏览器一致）
      sources = [dataLayer, target].sort((a, b) => a.openTagStart - b.openTagStart);
    }
  }

  const sandbox = makeSandbox();
  evaluate(sources.map((b) => b.body), sandbox, sources, target);
  return handleOf(sandbox, target);
}

/** 以 Data_Layer 块首注释文本为签名求值（design §4.1）。 */
export function loadDataLayer() {
  return loadPlainScriptBlock({ signature: DATA_LAYER_SIGNATURE });
}

/** 以 `data-awen-pure` 为签名求值；默认先在同一 context 中求值 Data_Layer（design §4.1）。 */
export function loadPureBlock({ withDataLayer = true } = {}) {
  return loadPlainScriptBlock({ signature: PURE_BLOCK_SIGNATURE, withDataLayer });
}
