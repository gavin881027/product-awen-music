// Awen Data_Layer 纯函数测试 — parseStyleString / fallbackPrompt / fallbackAlbum 的契约断言。
//
// 覆盖（本文件当前落地部分）：
//   R3 AC 5 / 11 / 12 / 13 / 14   parseStyleString 契约与边界（任务 3.3）
//   R3 AC 15 / 16 / 17 / 18 / 20  fallbackPrompt / fallbackAlbum 断言 + 确定性 random stub（任务 3.4）
//   R3 AC 21 / 12                 Property 14 已知失败登记 · 打印清单不 assert（任务 3.6）
//   R3 AC 12                      Observation 2 · BPM 吸附等距规则 · 打印清单不 assert（任务 3.7）
// O1（parse/print 往返观察项）在 R5 阶段的任务 5.23 追加，不属本阶段。
//
// 设计来源：design.md §5.1（fallbackPrompt 输出契约）、§5.2（fallbackAlbum 输出契约）、
// §5.3（parseStyleString 输入输出契约）、§10.1（属性以「确定性取样 + 循环断言」实现）、
// §10.3 P14、§10.4 O2、§11.1（本文件职责与覆盖面）。
//
// ── 依赖口径（design §3.5 / R3 AC 1）────────────────────────────────
// 只从 node:test、node:assert、node:fs、node:path、node:vm 五个内置模块 import。
// bare specifier（不以 `.` 或 `/` 开头的说明符）数量为 0；相对路径导入 helper 不计入该口径，
// 因为它不引入任何安装步骤。本文件只用到 node:test 与 node:assert。
//
// ── 跨 realm 比较口径（任务 3.1 实测发现）──────────────────────────
// 沙箱里的值由 node:vm 的另一个 realm 构造，其 Array / Object 原型与本 realm 不是同一对象。
// 因此 assert.deepStrictEqual(沙箱数组, 本 realm 数组) 会以
// 「Values have same structure but are not reference-equal」假失败。
// 口径：凡对沙箱返回的数组 / 对象做深度比较，先在本 realm 归一
// （Array.from(x) / structuredClone(x) / JSON 往返），或改用 assert.deepEqual。
// 只比较原始值（字符串 / 数字 / null）时不受影响，可直接用严格相等。
//
// ── 只读口径（R3 AC 19）────────────────────────────────────────────
// 本文件不做任何文件系统写入：不 import node:fs，也不经 helper 触发写入路径
//（helper 只做一次 readFileSync 并模块级缓存）。运行前后 git status --porcelain 输出条目一致。
//
// ── 运行方式（实测口径，本机 Node v24.15.0）────────────────────────
// design §11.4 与 R3 AC 3 记的命令是 `node --test tests/`。实测在 Node 24 上该形态失效：
// 位置参数被当作**测试文件路径 / glob 模式**而不是递归展开的目录，Node 会尝试把 `tests`
// 当模块加载并抛 MODULE_NOT_FOUND，以退出码 1 结束。该行为与本仓库无关（在 /tmp 的空白
// 目录上以同一 Node 复现）。等价且实测退出码 0 的两种形态：
//   node --test 'tests/**/*.test.mjs'     ← 显式 glob，推荐
//   node --test                            ← 从仓库根按默认模式发现 **/*.test.mjs
// 两者都不需要任何依赖或配置文件。此项为口径澄清，列入任务 3.8 的交付报告与 FIX_LOG.md 输入。

import test from 'node:test';
import assert from 'node:assert';
// node:vm 属 R3 AC 1 允许的五个内置模块之一。本文件只用它做一件事：
// 给沙箱装确定性随机 stub（见「任务 3.4 · AC 20」小节的注释，说明为什么必须经它）。
import vm from 'node:vm';

import { loadDataLayer } from './helpers/load-app.mjs';

/* ================================================================== *
 * fallbackPrompt 输出契约的字段清单常量（任务 3.2 · R3 AC 15）
 *
 * 实测方式：在 loadDataLayer() 沙箱中以 AWEN.DEFAULTS 为 sel 调用 fallbackPrompt，
 * 取 Object.keys 得到字段集合；nature: 'None' 分支的字段集合与之相同（已实测）。
 * AC 15 的「缺失字段数为 0」断言以这两个常量为准，用例内不重新枚举字段。
 * ================================================================== */

// 覆盖意图: fallbackPrompt 返回对象的全部顶层字段，供「缺失字段数为 0」断言逐项核对
// 来源: design.md §5.1 表格；实测（AWEN.DEFAULTS 与 nature:'None' 两组 sel）与该表一致
export const FALLBACK_PROMPT_FIELDS = ['title', 'tagline', 'suno', 'cover', 'video', 'thumb'];

// 覆盖意图: fallbackPrompt 返回对象中 suno 子对象的全部字段，Suno Recipe 的数据源
// 来源: design.md §5.1 表格；实测与该表一致
export const FALLBACK_PROMPT_SUNO_FIELDS = ['style', 'lyrics', 'key', 'motif', 'prompt', 'exclude'];

// 实测与 design §5.1 的差异（供 R7 阶段 FIX_LOG.md 引用）：
// 1. 字段集合零差异 —— 顶层 6 项与 suno 6 项均与 §5.1 表格逐项相同，无多余项、无缺失项。
// 2. §5.1 对 cover / video / thumb 记「类型未逐字段实测」，本轮实测三者均为**字符串**
//    （trim 后长度 439 / 268 / 344，sel = AWEN.DEFAULTS）。这不改变 AC 15 的断言写法：
//    仍按「字符串去空白后长度 > 0 或对象键数 > 0」双分支断言，不写入内部结构细节，
//    避免把一次实测的长度数字固化成契约。差异属「设计文档留白已被实测填上」，非契约冲突。
// 3. sel 的合法来源实测：AWEN.DEFAULTS 可直接用；按 DIMS 各维度 options[0] 构造
//    （10 个维度键 + 手动补 bpm）同样可用。本文件统一取 AWEN.DEFAULTS，少一层构造。

/* ================================================================== *
 * 失败输出（R3 AC 5）
 * 四项必备：被测函数名、触发失败的输入、期望值、实测值。
 * ================================================================== */

/** 可读化任意取值（含 undefined 与跨 realm 对象），用于失败信息。 */
function show(value) {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}

/** 组装 AC 5 要求的四项失败信息。 */
function failMessage({ fn, input, expected, actual, note }) {
  return [
    `被测函数: ${fn}`,
    `触发输入: ${show(input)}`,
    `期望值: ${expected}`,
    `实测值: ${actual}`,
    note ? `说明: ${note}` : null,
  ].filter(Boolean).join(' | ');
}

/**
 * 循环断言的失败收集器（design §10.1）：失败样本累计进数组，
 * 循环结束后一次性报出，这样一次运行能看到全部反例而不是第一个。
 */
function makeCollector() {
  const failures = [];
  return {
    check(passed, detail) {
      if (!passed) failures.push(failMessage(detail));
    },
    report(fn) {
      assert.strictEqual(
        failures.length,
        0,
        `${fn}: 失败样本数应为 0，实测 ${failures.length} 个。\n  - ${failures.join('\n  - ')}`,
      );
    },
  };
}

/** 返回结果中某个键的出现次数（0 或 1）；null 结果计 0。跨 realm 安全。 */
function keyOccurrences(result, key) {
  if (result === null || typeof result !== 'object') return 0;
  return Object.keys(result).filter((k) => k === key).length;
}

/* ================================================================== *
 * 沙箱句柄
 * loadDataLayer() 内部以 Data_Layer 块首两行注释的固定文本为签名定位块
 * （helper 导出的 DATA_LAYER_SIGNATURE），不依赖任何行号 ——
 * 任务 3.1 实测：阶段 1 的两个提交已使 3300 行之后的行号偏移，
 * Data_Layer 的 </script> 实测在行 1739（design 记录的 1738 已过期）。
 * ================================================================== */

const handle = loadDataLayer();
const AWEN = handle.AWEN;
const parseStyleString = AWEN.parseStyleString;

/** 取某维度在 DIMS 中的 options（归一到本 realm 数组，避免跨 realm 比较问题）。 */
function optionsOf(dimKey) {
  const dim = AWEN.DIMS.find((d) => d.key === dimKey);
  return dim ? Array.from(dim.options) : [];
}

test('Data_Layer 沙箱导出 parseStyleString 与 BPM.values 升序品牌值', () => {
  assert.strictEqual(
    typeof parseStyleString,
    'function',
    failMessage({
      fn: 'window.AWEN.parseStyleString',
      input: 'loadDataLayer() 句柄',
      expected: "typeof === 'function'",
      actual: typeof parseStyleString,
    }),
  );

  // 跨 realm 口径示范：先 Array.from 归一，再做深度比较。
  const bpmValues = Array.from(AWEN.BPM.values);
  assert.deepStrictEqual(
    bpmValues,
    [55, 58, 60, 62, 65, 68, 70],
    failMessage({
      fn: 'window.AWEN.BPM.values',
      input: 'loadDataLayer() 句柄',
      expected: '[55,58,60,62,65,68,70]（升序，design §5.3）',
      actual: show(bpmValues),
    }),
  );
});

/* ------------------------------------------------------------------ *
 * R3 AC 11 · 7 种入参严格等于 null（design §5.3 两条 null 路径）
 * ------------------------------------------------------------------ */

// 覆盖意图: 入口守卫两条分支（!text 与 typeof !== 'string'）+ 末尾兜底两条分支
//           （分词后无 token、有 token 但零命中），共 7 种入参
// 来源: design.md §5.3「返回 null 的两条路径」表格；对应 R3 AC 11 点名的 7 种入参
const PARSE_STYLE_NULL_INPUTS = [
  { input: null, path: "入口守卫 !text" },
  { input: undefined, path: "入口守卫 !text" },
  { input: 42, path: "入口守卫 typeof text !== 'string'" },
  { input: {}, path: "入口守卫 typeof text !== 'string'" },
  { input: '', path: "入口守卫 !text（空串 falsy）" },
  { input: '   ', path: '末尾兜底：token trim 为空串被 filter(Boolean) 过滤' },
  { input: 'zzzz', path: '末尾兜底：有 token 但无维度命中、无 BPM、无启发式命中' },
];

test('parseStyleString: 7 种入参严格等于 null（R3 AC 11）', () => {
  const c = makeCollector();
  for (const probe of PARSE_STYLE_NULL_INPUTS) {
    const actual = parseStyleString(probe.input);
    c.check(actual === null, {
      fn: 'parseStyleString',
      input: probe.input,
      expected: 'null（严格相等）',
      actual: show(actual),
      note: probe.path,
    });
  }
  c.report('parseStyleString（AC 11 · null 契约）');
});

/* ------------------------------------------------------------------ *
 * R3 AC 12 · BPM 抽取与吸附五行（design §5.3 表格）
 * 吸附用 reduce 且比较符为严格 `<`，BPM.values 升序，
 * 故等距时保留先出现（下标较小、数值较小）的候选。
 * ------------------------------------------------------------------ */

// 覆盖意图: 精确命中品牌值 1 行 + 等距取较小 2 行 + 范围外上下界 2 行，即 AC 12 的断言集合
// 来源: design.md §5.3「BPM 抽取与吸附」表格；范围判断为 n >= 40 && n <= 200
//       （同处代码注释写 40-180，该文档不一致按 R3 AC 21 记入 FIX_LOG.md，本轮不改代码）
const PARSE_STYLE_BPM_PROBES = [
  { input: '68 bpm', expectBpm: 68, why: '精确命中品牌值 68' },
  { input: '59 bpm', expectBpm: 58, why: '与 58 / 60 等距，严格 < 保留先出现的 58' },
  { input: '61 bpm', expectBpm: 60, why: '与 60 / 62 等距，保留 60' },
  { input: '30 bpm', expectBpm: null, why: '低于下界 40，bpm 键不出现' },
  { input: '220 bpm', expectBpm: null, why: '高于上界 200；3 位数字形态可匹配，是范围判断拦下的' },
];

test('parseStyleString: BPM 抽取与吸附五行（R3 AC 12）', () => {
  const c = makeCollector();
  for (const probe of PARSE_STYLE_BPM_PROBES) {
    const result = parseStyleString(probe.input);

    if (probe.expectBpm === null) {
      const occurrences = keyOccurrences(result, 'bpm');
      c.check(occurrences === 0, {
        fn: 'parseStyleString',
        input: probe.input,
        expected: "返回结果中 'bpm' 键的出现次数 = 0",
        actual: `出现次数 = ${occurrences}（返回值 ${show(result)}）`,
        note: probe.why,
      });
      continue;
    }

    const actual = result === null ? undefined : result.bpm;
    c.check(actual === probe.expectBpm, {
      fn: 'parseStyleString',
      input: probe.input,
      expected: `bpm === ${probe.expectBpm}`,
      actual: `bpm = ${show(actual)}（返回值 ${show(result)}）`,
      note: probe.why,
    });
  }
  c.report('parseStyleString（AC 12 · BPM 吸附）');
});

/* ------------------------------------------------------------------ *
 * R3 AC 13 · 大小写混合的维度选项名 → DIMS 中的原始大小写写法
 * 维度匹配双方都转小写后做双向 substring，返回值取 DIMS 里的原文。
 *
 * 取样纪律（design §5.3）：
 * - 只断言目标维度键，不断言返回对象的键集合恰为 1 —— break 只跳出当前维度的
 *   option 循环，各维度独立扫描，一个 token 可命中多个维度。
 * - 避开 1–2 字符 token —— o.includes(t) 会让极短 token 过度命中
 *   （实测 token 'a' 命中 'Library'）。下列取样最短 token 为 10 字符。
 * ------------------------------------------------------------------ */

// 覆盖意图: AC 13 点名的两个混合大小写输入，分别落在 instrument 与 style 两个维度，
//           且覆盖「含空格」与「含连字符 + 多词」两种 option 形态
// 来源: design.md §5.3「维度匹配」；期望值为 DIMS 中的原始大小写写法
const PARSE_STYLE_CASE_PROBES = [
  { input: 'FeLt PiAnO', dim: 'instrument', expected: 'Felt Piano' },
  { input: 'LO-FI HIP HOP', dim: 'style', expected: 'Lo-fi Hip Hop' },
];

test('parseStyleString: 大小写混合命中并返回 DIMS 原始写法（R3 AC 13）', () => {
  const c = makeCollector();
  for (const probe of PARSE_STYLE_CASE_PROBES) {
    const result = parseStyleString(probe.input);
    const actual = result === null ? undefined : result[probe.dim];

    c.check(actual === probe.expected, {
      fn: 'parseStyleString',
      input: probe.input,
      expected: `${probe.dim} === ${show(probe.expected)}`,
      actual: `${probe.dim} = ${show(actual)}（返回值 ${show(result)}）`,
      note: '返回值须为 DIMS 中的原始大小写写法，不是输入的大小写',
    });

    // 期望值本身必须是该维度的合法 option，否则是取样写错而不是实现出错。
    const options = optionsOf(probe.dim);
    c.check(options.includes(probe.expected), {
      fn: `window.AWEN.DIMS['${probe.dim}'].options`,
      input: probe.input,
      expected: `包含 ${show(probe.expected)}`,
      actual: show(options),
      note: '取样自检：期望值须取自 DIMS 的合法 options',
    });
  }
  c.report('parseStyleString（AC 13 · 大小写归一）');
});

/* ------------------------------------------------------------------ *
 * R3 AC 14 · 'rain' → nature 'Rain'、'night' → time 'Night'
 *
 * 这两条**不经启发式分支**（design §5.3「R3 AC 14 为什么通过」）：
 * - token 'rain' 在维度匹配阶段就命中 nature 的 option 'Rain'；
 * - token 'night' 命中 time 的 'Night'，且 'Night'（options 下标 6）先于
 *   'Midnight'（下标 7），break 保证取到 'Night'。
 * 依赖的是 option 声明顺序，不是启发式。启发式的两处非法取值
 * （'Breeze' / 'Morning'）在任务 3.5 / 3.6 单独登记。
 *
 * 实测旁证（不写成断言，只解释为什么这里不断言键集合）：
 *   parseStyleString('rain')  → environment / nature / light / palette / motif 共 5 个键
 *   parseStyleString('night') → environment / time / character / palette / motif 共 5 个键
 * ------------------------------------------------------------------ */

// 覆盖意图: AC 14 点名的两条断言，同时锚定「维度匹配先于启发式」与「option 声明顺序决定取值」
// 来源: design.md §5.3「R3 AC 14 为什么通过」
const PARSE_STYLE_HEURISTIC_LEGAL_PROBES = [
  { input: 'rain', dim: 'nature', expected: 'Rain', why: "维度匹配阶段命中 option 'Rain'，未走启发式" },
  { input: 'night', dim: 'time', expected: 'Night', why: "命中 'Night'（下标 6）先于 'Midnight'（下标 7）" },
];

test('parseStyleString: 启发式合法分支两条（R3 AC 14）', () => {
  const c = makeCollector();
  for (const probe of PARSE_STYLE_HEURISTIC_LEGAL_PROBES) {
    const result = parseStyleString(probe.input);
    const actual = result === null ? undefined : result[probe.dim];

    c.check(actual === probe.expected, {
      fn: 'parseStyleString',
      input: probe.input,
      expected: `${probe.dim} === ${show(probe.expected)}`,
      actual: `${probe.dim} = ${show(actual)}（返回值 ${show(result)}）`,
      note: probe.why,
    });

    const options = optionsOf(probe.dim);
    c.check(options.includes(probe.expected), {
      fn: `window.AWEN.DIMS['${probe.dim}'].options`,
      input: probe.input,
      expected: `包含 ${show(probe.expected)}`,
      actual: show(options),
      note: '取样自检：该取值须是合法 option（与 P14 的非法取值区分开）',
    });
  }
  c.report('parseStyleString（AC 14 · 合法分支）');
});
/* ================================================================== *
 * 任务 3.4 · fallbackPrompt / fallbackAlbum 断言与确定性 Math.random stub
 * 覆盖 R3 AC 15 / 16 / 17 / 18 / 20；设计来源 design §5.1、§5.2、§10.1。
 * ================================================================== */

/** 「非空字段」双分支判定（R3 AC 15）：字符串去空白后长度 > 0，或对象键数 > 0。 */
function isNonEmptyField(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (value !== null && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

/** 该字段实测形态的可读描述，用于 AC 5 的「实测值」一项。 */
function describeField(value) {
  if (typeof value === 'string') return `string，trim 后长度 ${value.trim().length}`;
  if (value !== null && typeof value === 'object') return `object，键数 ${Object.keys(value).length}`;
  return `${typeof value}（既非字符串也非对象）`;
}

/**
 * 跨 realm 归一（见文件头「跨 realm 比较口径」）：把沙箱返回值经 JSON 往返
 * 变成本 realm 的纯数据，之后才能安全地做 deepStrictEqual。
 * 本文件涉及的返回值（selection / recipes / fallbackAlbum 输出）全部是 JSON 安全的
 * 纯数据（含 motifMark: null），无函数、无循环引用、无 undefined 字段。
 */
function normalizeCrossRealm(value) {
  return JSON.parse(JSON.stringify(value));
}

/** 子串出现次数（不重叠计数）。用于「ambience 出现次数为 0」这类计数型断言。 */
function substringOccurrences(haystack, needle) {
  return String(haystack).split(needle).length - 1;
}

/* ------------------------------------------------------------------ *
 * R3 AC 15 · fallbackPrompt 在 nature: 'None' 下的字段完备性与非空性
 *
 * sel 取 AWEN.DEFAULTS 覆写 nature: 'None'（任务 3.2 实测：DEFAULTS 可直接用作 sel，
 * 少一层按 DIMS options[0] 手工构造）。'None' 分支使 natureClause 为空串，
 * 因此 suno.prompt 中不应出现 ambience（design §5.1）。
 *
 * 断言纪律：字段清单只取任务 3.2 定稿的两个常量，用例内不重新枚举；
 * cover / video / thumb 三项实测均为字符串，但断言仍走「字符串非空 或 对象键数 > 0」
 * 双分支，且不把实测长度数字写进断言 —— 那会把一次实测固化成契约（design §5.1 末段）。
 * ------------------------------------------------------------------ */

// 覆盖意图: AC 15 点名的 nature:'None' 分支（natureClause 为空串），同时是字段完备性的取样点
// 来源: design.md §5.1；sel 基底为 AWEN.DEFAULTS（任务 3.2 实测确认可用）
const FALLBACK_PROMPT_NATURE_NONE = 'None';

test('fallbackPrompt: nature 为 None 时字段完备且逐项非空（R3 AC 15）', () => {
  const c = makeCollector();
  const sel = Object.assign({}, AWEN.DEFAULTS, { nature: FALLBACK_PROMPT_NATURE_NONE });
  const out = AWEN.fallbackPrompt(sel);

  assert.ok(
    out !== null && typeof out === 'object',
    failMessage({
      fn: 'fallbackPrompt',
      input: sel,
      expected: '返回非 null 对象',
      actual: show(out),
    }),
  );

  // 缺失字段数为 0 —— 顶层。
  const missingTop = FALLBACK_PROMPT_FIELDS.filter((k) => !(k in out));
  c.check(missingTop.length === 0, {
    fn: 'fallbackPrompt',
    input: sel,
    expected: 'FALLBACK_PROMPT_FIELDS 的缺失字段数 = 0',
    actual: `缺失 ${missingTop.length} 项：${show(missingTop)}`,
    note: '字段清单取任务 3.2 的常量，不在用例内重新枚举',
  });

  // 缺失字段数为 0 —— suno 子对象。
  const suno = out.suno;
  const missingSuno = (suno && typeof suno === 'object')
    ? FALLBACK_PROMPT_SUNO_FIELDS.filter((k) => !(k in suno))
    : FALLBACK_PROMPT_SUNO_FIELDS.slice();
  c.check(missingSuno.length === 0, {
    fn: 'fallbackPrompt().suno',
    input: sel,
    expected: 'FALLBACK_PROMPT_SUNO_FIELDS 的缺失字段数 = 0',
    actual: `缺失 ${missingSuno.length} 项：${show(missingSuno)}`,
  });

  // 逐字段非空（双分支）。
  for (const key of FALLBACK_PROMPT_FIELDS) {
    c.check(isNonEmptyField(out[key]), {
      fn: 'fallbackPrompt',
      input: `${show(sel)} → 字段 ${key}`,
      expected: '字符串 trim 后长度 > 0，或对象键数 > 0',
      actual: describeField(out[key]),
      note: '不断言内部结构与长度数字（design §5.1 末段）',
    });
  }
  for (const key of FALLBACK_PROMPT_SUNO_FIELDS) {
    const value = (suno && typeof suno === 'object') ? suno[key] : undefined;
    c.check(isNonEmptyField(value), {
      fn: 'fallbackPrompt().suno',
      input: `${show(sel)} → 字段 suno.${key}`,
      expected: '字符串 trim 后长度 > 0，或对象键数 > 0',
      actual: describeField(value),
    });
  }

  // nature 为 'None' ⇒ natureClause 为空串 ⇒ prompt 里没有 ambience。
  const ambience = substringOccurrences(suno.prompt, 'ambience');
  c.check(ambience === 0, {
    fn: 'fallbackPrompt().suno.prompt',
    input: sel,
    expected: "'ambience' 出现次数 = 0（nature 为 'None' 时 natureClause 为空串）",
    actual: `出现次数 = ${ambience}；prompt = ${show(suno.prompt)}`,
  });

  c.report('fallbackPrompt（AC 15 · 字段完备性与非空性）');
});

/* ------------------------------------------------------------------ *
 * R3 AC 16 · suno.exclude 含 Study With Me 默认排除项全部 7 个词
 *
 * exclude 是字面量而非拼接结果（design §5.1），所以这条断言同时起到
 * 「默认排除项没被人悄悄改动」的护栏作用。
 * ------------------------------------------------------------------ */

// 覆盖意图: Study With Me 默认排除项的全部 7 个词，逐词断言出现次数 ≥ 1
// 来源: design.md §5.1 —— suno.exclude 的字面量
//       'vocals, singing, spoken word, harsh percussion, sudden dynamics, crisp, polished'
const SUNO_EXCLUDE_DEFAULT_WORDS = [
  'vocals',
  'singing',
  'spoken word',
  'harsh percussion',
  'sudden dynamics',
  'crisp',
  'polished',
];

test('fallbackPrompt: suno.exclude 含默认排除项 7 个词（R3 AC 16）', () => {
  const c = makeCollector();
  const sel = Object.assign({}, AWEN.DEFAULTS, { nature: FALLBACK_PROMPT_NATURE_NONE });
  const excludeRaw = AWEN.fallbackPrompt(sel).suno.exclude;

  // 按 `,` 拆分 → 统一转小写 → 去首尾空白。
  const words = String(excludeRaw).split(',').map((w) => w.trim().toLowerCase());

  for (const word of SUNO_EXCLUDE_DEFAULT_WORDS) {
    const occurrences = words.filter((w) => w === word).length;
    c.check(occurrences >= 1, {
      fn: 'fallbackPrompt().suno.exclude',
      input: `${show(excludeRaw)} → 查找 ${show(word)}`,
      expected: '出现次数 ≥ 1',
      actual: `出现次数 = ${occurrences}；拆分结果 ${show(words)}`,
    });
  }

  c.report('fallbackPrompt（AC 16 · 默认排除项 7 个词）');
});

/* ------------------------------------------------------------------ *
 * R3 AC 17 / AC 18 · fallbackAlbum 的 tracks 长度、专辑标题与 liner note
 *
 * recipes 直接手写数组，不经 buildAlbum —— buildAlbum 的常规用法里 base 来自
 * randomSelection（依赖 Math.random），只测 fallbackAlbum 本身时没必要引入那条路径
 * （design §5.2 末段）。经 buildAlbum 的确定性验证在下面的 AC 20 用例里单独做。
 *
 * axisKey 固定取 'day' 与 'latenight'：titles 映射表外的键会同落到 'Sessions' 后缀，
 * 两个表外键会得到相同标题、让 AC 18 的「互不相等」假失败（design §5.2 titles 表）。
 * ------------------------------------------------------------------ */

// 覆盖意图: AC 17 点名的三个长度 —— 1（单曲专辑，下边界）、2（最小多曲）、8（超出常规 EP 规模）
// 来源: design.md §5.2「tracks 长度恒等于入参 recipes.length」
const FALLBACK_ALBUM_RECIPE_LENGTHS = [1, 2, 8];

// 覆盖意图: 两个都在 titles 映射表内的 axisKey，后缀分别为 'Hours' 与 'Small Hours'
// 来源: design.md §5.2 titles 表与 AC 18 给出的例子；表外键会同落 'Sessions' 导致假失败
const FALLBACK_ALBUM_AXIS_KEYS = ['day', 'latenight'];

/**
 * 确定性 recipes 构造：以 base 为底、只改 time 维度（不调用 Math.random）。
 * time 取值来自 design §5.3 列出的 time options 原文，逐项合法。
 */
function makeRecipes(base, n) {
  const times = ['Dawn', 'Early Morning', 'Afternoon', 'Golden Hour', 'Dusk', 'Evening', 'Night', 'Midnight'];
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(Object.assign({}, base, { time: times[i % times.length] }));
  }
  return out;
}

test('fallbackAlbum: tracks 长度等于 recipes 长度（R3 AC 17）', () => {
  const c = makeCollector();
  const base = Object.assign({}, AWEN.DEFAULTS);

  for (const n of FALLBACK_ALBUM_RECIPE_LENGTHS) {
    const recipes = makeRecipes(base, n);
    const album = AWEN.fallbackAlbum('day', base, recipes);
    const actual = album && album.tracks ? album.tracks.length : undefined;

    c.check(actual === n, {
      fn: 'fallbackAlbum',
      input: `axisKey='day', recipes.length=${n}`,
      expected: `tracks.length === ${n}`,
      actual: `tracks.length = ${show(actual)}`,
      note: 'tracks 长度与 axisKey、base 无关，只由 recipes 长度决定',
    });
  }

  c.report('fallbackAlbum（AC 17 · tracks 长度）');
});

test('fallbackAlbum: 专辑标题前缀 / 两轴互异 / liner note 含曲目数（R3 AC 18）', () => {
  const c = makeCollector();
  const base = Object.assign({}, AWEN.DEFAULTS);
  const recipeCount = 2;
  const recipes = makeRecipes(base, recipeCount);

  const albumTitles = [];
  for (const axisKey of FALLBACK_ALBUM_AXIS_KEYS) {
    const album = AWEN.fallbackAlbum(axisKey, base, recipes);
    albumTitles.push({ axisKey, title: album.album });

    // 标题以 base.environment 开头。
    c.check(typeof album.album === 'string' && album.album.startsWith(base.environment), {
      fn: 'fallbackAlbum().album',
      input: `axisKey=${show(axisKey)}, base.environment=${show(base.environment)}`,
      expected: `以 ${show(base.environment)} 开头`,
      actual: show(album.album),
    });

    // liner note 两项：非空 + 含 recipes.length 的十进制数字。
    for (const key of ['description', 'descriptionZh']) {
      const value = album[key];
      c.check(typeof value === 'string' && value.trim().length > 0, {
        fn: `fallbackAlbum().${key}`,
        input: `axisKey=${show(axisKey)}, recipes.length=${recipeCount}`,
        expected: 'trim 后长度 > 0',
        actual: describeField(value),
      });
      c.check(typeof value === 'string' && value.includes(String(recipeCount)), {
        fn: `fallbackAlbum().${key}`,
        input: `axisKey=${show(axisKey)}, recipes.length=${recipeCount}`,
        expected: `包含十进制数字 ${show(String(recipeCount))}`,
        actual: show(value),
      });
    }
  }

  // 两个 axisKey 在相同 base 与 recipes 下的标题互不相等。
  c.check(albumTitles[0].title !== albumTitles[1].title, {
    fn: 'fallbackAlbum().album',
    input: `axisKey ${show(FALLBACK_ALBUM_AXIS_KEYS)}，同一 base 与 recipes`,
    expected: '两个标题互不相等',
    actual: `${show(albumTitles[0].title)} vs ${show(albumTitles[1].title)}`,
    note: "取样固定用 'day' / 'latenight'：两者都在 titles 映射表内；表外键会同落 'Sessions' 后缀导致假失败",
  });

  c.report('fallbackAlbum（AC 18 · 标题与 liner note）');
});

/* ------------------------------------------------------------------ *
 * R3 AC 20 · 依赖 Math.random 的路径先装确定性 stub，再断言两次调用深度相等
 *
 * 为什么必须经 vm.runInContext 装 stub：
 * Math 是沙箱 realm 的 intrinsic，不是 helper 传入的 sandbox 对象的自有属性，
 * 所以 handle.sandbox.Math 实测为 undefined，对它赋值会抛
 * TypeError: Cannot set properties of undefined。stub 必须在沙箱内部执行赋值。
 * runInNewContext 已把该 sandbox 对象 contextify，因此可以直接对同一对象
 * 再执行 vm.runInContext（实测可行，读回的 stub 返回 0.42）。
 *
 * 该写法同时满足 R3 AC 20 的文本口径「使 tests/ 下 Math 点 random 紧跟左括号的
 * 调用形态的出现次数保持为 0」：下面出现的只有赋值形态与取值形态。
 * 注意这条口径是**字面计数**，所以连注释里也不能写出那个调用形态
 * ——否则注释自己就会把计数顶成 1（本文件初稿实测踩过一次）。
 *
 * 用独立句柄而不是复用文件顶部的 handle：loadDataLayer() 每次新建沙箱（R3 AC 10），
 * 这样 stub 不会污染上面 parseStyleString 的那些用例。
 * ------------------------------------------------------------------ */

// 覆盖意图: 固定返回值使 rand 的下标 floor(0.42 * len) 恒定，从而让整条路径可复现
// 来源: design.md §10.1 第 3 条与 §5.2 末段；R3 AC 20 要求「返回固定值的确定性 stub」
const DETERMINISTIC_RANDOM_VALUE = 0.42;
const DETERMINISTIC_RANDOM_STUB_SOURCE = `Math.random = () => ${DETERMINISTIC_RANDOM_VALUE};`;

test('确定性 Math.random stub 下 rand / randomSelection / buildAlbum 两次调用深度相等（R3 AC 20）', () => {
  const c = makeCollector();
  const stubbed = loadDataLayer();
  const S = stubbed.AWEN;

  vm.runInContext(DETERMINISTIC_RANDOM_STUB_SOURCE, stubbed.sandbox);

  // 确认 stub 真的装上了（取值形态读回，不写调用形态）。
  const sandboxRandom = vm.runInContext('Math.random', stubbed.sandbox);
  c.check(typeof sandboxRandom === 'function' && sandboxRandom() === DETERMINISTIC_RANDOM_VALUE, {
    fn: '沙箱 Math.random（stub 自检）',
    input: DETERMINISTIC_RANDOM_STUB_SOURCE,
    expected: `函数且返回 ${DETERMINISTIC_RANDOM_VALUE}`,
    actual: typeof sandboxRandom === 'function' ? String(sandboxRandom()) : typeof sandboxRandom,
    note: 'stub 未装上时下面三条「两次相等」会因为恒相等而假通过，故先自检',
  });

  // rand(arr)：直接依赖 Math.random。
  const arr = ['a', 'b', 'c', 'd', 'e'];
  const rand1 = S.rand(arr);
  const rand2 = S.rand(arr);
  c.check(rand1 === rand2, {
    fn: 'rand',
    input: arr,
    expected: '同一入参连续两次调用返回值相等',
    actual: `${show(rand1)} vs ${show(rand2)}`,
  });

  // randomSelection()：每个维度各调一次 rand，外加 bpm。跨 realm，先归一再深度比较。
  const sel1 = normalizeCrossRealm(S.randomSelection());
  const sel2 = normalizeCrossRealm(S.randomSelection());
  try {
    assert.deepStrictEqual(sel1, sel2);
  } catch (e) {
    c.check(false, {
      fn: 'randomSelection',
      input: '无入参（连续两次调用）',
      expected: '两次返回值深度相等',
      actual: `${show(sel1)} vs ${show(sel2)}`,
    });
  }

  // buildAlbum → fallbackAlbum：常规链路上 base 来自 randomSelection，故整条路径依赖
  // Math.random。实测澄清：buildAlbum 函数体自身对 Math.random 的引用数为 0
  //（它只用 Math.max / min / abs / round），依赖来自入参 base 的来源。
  // 这条用例覆盖的是「整条链路在 stub 下可复现」，不是 buildAlbum 内部有随机性。
  const built1 = S.buildAlbum('day', S.randomSelection(), 4);
  const built2 = S.buildAlbum('day', S.randomSelection(), 4);
  const recipes1 = normalizeCrossRealm(built1.recipes);
  const recipes2 = normalizeCrossRealm(built2.recipes);
  try {
    assert.deepStrictEqual(recipes1, recipes2);
  } catch (e) {
    c.check(false, {
      fn: 'buildAlbum',
      input: "axisKey='day', base=randomSelection(), count=4",
      expected: 'recipes 深度相等',
      actual: `${show(recipes1)} vs ${show(recipes2)}`,
    });
  }

  const album1 = normalizeCrossRealm(S.fallbackAlbum('day', built1.recipes[0], built1.recipes));
  const album2 = normalizeCrossRealm(S.fallbackAlbum('day', built2.recipes[0], built2.recipes));
  try {
    assert.deepStrictEqual(album1, album2);
  } catch (e) {
    c.check(false, {
      fn: 'fallbackAlbum（经 buildAlbum 取 recipes）',
      input: "axisKey='day', recipes=buildAlbum(...).recipes",
      expected: '两次返回值深度相等',
      actual: '两次结果不等（详见 deepStrictEqual 差异）',
    });
  }

  c.report('确定性 random stub（AC 20）');
});

/* ================================================================== *
 * 任务 3.6 · Property 14 登记为已知失败（打印清单、不 assert 属性本身）
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * Property 14: parseStyleString 维度取值域
 *
 * Validates: Requirements 3.21, 3.12
 *
 * 形式化陈述：对任意输入文本 text，若 parseStyleString(text) 返回非 null 对象 out，
 * 则 out 的每个维度键 dim 满足 out[dim] ∈ DIMS[dim].options；
 * 且若 out 含 bpm 键，则 out.bpm ∈ BPM.values。
 *
 * 断言型：**否**。以「打印不合法取值清单、不 assert」的形式登记为已知失败，
 * 使该项导致 `node --test` 以非 0 退出的次数保持为 0（R3 AC 21 明文，
 * 与 R5 AC 24 观察项同口径）。本轮对 parseStyleString 产品逻辑的改动行数为 0。
 *
 * ── 任务 3.5 的实测结论（先实测后登记，design §10.3 P14「强制顺序」）──────
 * 确认触发非法分支的输入共 9 条，distinct 非法取值只有 2 个
 * （nature:'Breeze'、time:'Morning'），无第三处。下列 B 组即最小充分集 + 两条对照。
 *
 * ── 三条实测澄清（必须随登记一起留档）────────────────────────────────
 *
 * 澄清 1 · dawn 关键词分支实际不可达（死分支）。
 *   R3 AC 21 与 design §10.3 P14 写「含 morning 或 dawn 时产出 'Morning'」，
 *   但 'Dawn' 是 time.options 的下标 0 项、小写后是 4 字符 'dawn'，任何含 dawn 的
 *   token 都会在维度匹配阶段被 t.includes(o) 命中成**合法**的 'Dawn'，
 *   启发式那句 if (!out.time) 的守卫永不触发。实测 7 条 dawn 输入全部返回合法 'Dawn'
 *   （本文件 B 组保留 'pre-dawn commute through empty streets' 作为该结论的锚点）。
 *   ⇒ 能产出非法 'Morning' 的唯一路径是关键词 morning。B 组按单关键词 morning 组织，
 *     刻意不放 dawn 触发样本 —— 那会是一条永不触发的噪声。
 *
 * 澄清 2 · 触发 'Breeze' 的最短形态是 'windy'（5 字符单词），不需要多词长短语。
 *   design §5.3 / §10.3 的论证方向正确（裸 'wind' 被 'Soft Wind' 与 'Rainy Window'
 *   双向 substring 拦住），但「更长」不必是多词。启发式实测用的是 /\bwind/
 *   （**无**尾部 \b，即前缀匹配），所以 'wind' 后加任意字母即可脱离全部 option 的
 *   双向 substring 命中；而 'crosswind' 因不满足词首边界，两阶段都不命中 → null
 *   （本文件 B 组以 'crosswind gusts sweeping the tarmac' 锚定这一点）。
 *
 * 澄清 3 · BPM 注释与代码不一致已确认。
 *   docs/index.html 行 1124 注释写 `// BPM: find any number 40-180`，
 *   行 1128 代码是 `if (n >= 40 && n <= 200)`。本轮不改代码也不改注释，
 *   按 R3 AC 21 记入 FIX_LOG.md 输入（R7 阶段落地）。
 *
 * ── 唯一的弱断言及其理由 ──────────────────────────────────────────
 * 本用例只 assert 一件事：非法取值的 distinct 集合恰为
 * ['nature:Breeze', 'time:Morning'] 两项。它**不是**在 assert P14 本身
 * （P14 说「不应有非法取值」，那条仍然只打印），而是锁住「已知非法取值的集合不增长」：
 * 将来若出现第三处非法取值会变红提醒（对应 design §10.3 P14 处置 3 的登记义务），
 * 而已知的两处不会让测试失败。因此它与「不 assert」不冲突 ——
 * 前者的断言方向是「已知失败清单未扩大」，后者的断言方向是「没有失败」。
 * ------------------------------------------------------------------ */

// 覆盖意图: A 合法基准 —— 各维度 option 的原样与大小写变体 + '68 bpm'，
//           确认属性在正常输入上成立，避免清单里全是噪声
// 来源: design.md §10.3 P14 取样表 A 组
const PARSE_STYLE_DOMAIN_PROBES_A = [
  'Felt Piano',
  'Lo-fi Hip Hop',
  'FeLt PiAnO',
  'LO-FI HIP HOP',
  'rain',
  'night',
  '68 bpm',
];

// 覆盖意图: B 启发式触发候选 —— 任务 3.5 实测的最小充分集（3 条触发 + 2 条未触发对照）。
//           触发条 1 单产 nature:'Breeze'；触发条 2 单产 time:'Morning'；
//           触发条 3 同时产出两处，验证两个启发式分支互不干扰。
//           对照条 1 验证 /\bwind/ 的词首边界（crosswind 不命中 → null）；
//           对照条 2 验证 dawn 死分支（返回合法 'Dawn'，见上文澄清 1）。
// 来源: 任务 3.5 沙箱实测；design.md §10.3 P14 取样表 B 组与「强制顺序」
const PARSE_STYLE_DOMAIN_PROBES_B = [
  'windswept plains',
  'good-morning haze',
  'windswept plains, good-morning haze',
  'crosswind gusts sweeping the tarmac',
  'pre-dawn commute through empty streets',
];

// 覆盖意图: C BPM 域 —— 范围外上下界 2 项 + 等距点 2 项 + 精确命中 1 项，
//           确认 bpm 取值属于 BPM.values 或该键不出现
// 来源: design.md §10.3 P14 取样表 C 组（与 O2 共用探针，'68 bpm' 与 A 组刻意重复保留）
const PARSE_STYLE_DOMAIN_PROBES_C = [
  '30 bpm',
  '220 bpm',
  '59 bpm',
  '61 bpm',
  '68 bpm',
];

const PARSE_STYLE_DOMAIN_PROBES = [
  { group: 'A · 合法基准', inputs: PARSE_STYLE_DOMAIN_PROBES_A },
  { group: 'B · 启发式触发候选', inputs: PARSE_STYLE_DOMAIN_PROBES_B },
  { group: 'C · BPM 域', inputs: PARSE_STYLE_DOMAIN_PROBES_C },
];

// 任务 3.5 实测确认的已知非法取值集合（`维度键:取值` 形态，升序）。
const P14_KNOWN_ILLEGAL_VALUES = ['nature:Breeze', 'time:Morning'];

test('Property 14: parseStyleString 维度取值域（已知失败 · 打印清单不 assert）', () => {
  const bpmValues = Array.from(AWEN.BPM.values);
  const rows = [];
  const illegal = new Set();

  for (const { group, inputs } of PARSE_STYLE_DOMAIN_PROBES) {
    for (const input of inputs) {
      const out = parseStyleString(input);
      if (out === null) {
        rows.push({ group, input, dim: '(无)', actual: 'null', legalOptions: '(返回 null，无维度键)', legal: true });
        continue;
      }
      for (const dim of Object.keys(out)) {
        const isBpm = dim === 'bpm';
        const options = isBpm ? bpmValues : optionsOf(dim);
        const legal = options.includes(out[dim]);
        rows.push({
          group,
          input,
          dim,
          actual: show(out[dim]),
          legalOptions: isBpm ? `BPM.values = ${show(options)}` : show(options),
          legal,
        });
        if (!legal) illegal.add(`${dim}:${out[dim]}`);
      }
    }
  }

  // ── 四列清单（输入文本 / 维度键 / 实测取值 / 该维度合法 options）───────
  console.log('');
  console.log('── Property 14 · parseStyleString 维度取值域清单（已知失败登记，不 assert）──');
  console.log(`   探针 ${PARSE_STYLE_DOMAIN_PROBES.reduce((n, g) => n + g.inputs.length, 0)} 条，产出 ${rows.length} 行；`
    + `其中不合法 ${rows.filter((r) => !r.legal).length} 行。`);
  let currentGroup = '';
  for (const row of rows) {
    if (row.group !== currentGroup) {
      currentGroup = row.group;
      console.log(`   [组 ${currentGroup}]`);
    }
    console.log(`     ${row.legal ? '合法' : '不合法'} | 输入 ${show(row.input)} | 维度 ${row.dim}`
      + ` | 实测 ${row.actual} | 合法 options ${row.legalOptions}`);
  }
  const observed = Array.from(illegal).sort();
  console.log(`   distinct 不合法取值：${show(observed)}`);
  console.log('   处置：本轮不改 parseStyleString 产品逻辑（改动行数 0）；');
  console.log("   'Breeze'（nature 合法项为 'Soft Wind'）、'Morning'（time 合法项为 'Early Morning'）");
  console.log('   与「注释 40-180 / 代码 40–200」的文档不一致一并记入 FIX_LOG.md 遗留项（R7 阶段）。');
  console.log('');

  // ── 唯一的弱断言：已知非法取值集合未扩大（理由见本小节顶部注释）──────
  assert.deepStrictEqual(
    observed,
    P14_KNOWN_ILLEGAL_VALUES,
    failMessage({
      fn: 'parseStyleString（P14 已知失败集合守护）',
      input: 'PARSE_STYLE_DOMAIN_PROBES 全部三组',
      expected: `distinct 不合法取值恰为 ${show(P14_KNOWN_ILLEGAL_VALUES)}`,
      actual: show(observed),
      note: '出现第三处非法取值需按 design §10.3 P14 处置 3 记入遗留项并标注「相对 R3 AC 21 的实测新增项」；'
        + '若某处已被修复而集合变小，同样应在此更新常量并同步 FIX_LOG.md',
    }),
  );
});

/* ================================================================== *
 * 任务 3.7 · Observation 2 · BPM 吸附等距规则（打印清单、不 assert）
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * Observation 2: BPM 吸附等距规则
 *
 * Validates: Requirements 3.12
 *
 * 观察陈述：对与两个品牌值等距的 BPM 输入，记录实测吸附结果。
 * 当前实测规则为「取较小的品牌值」（'59 bpm' → 58、'61 bpm' → 60、'69 bpm' → 68）。
 *
 * 为什么它是观察项而不是断言：
 * 「取较小值」是 reduce 用严格 `<` 比较的副产物（design §5.3），
 * 不是任何需求指定的行为。R3 AC 12 字面要求的那条
 * （「与两个品牌值等距的输入返回 BPM.values 中下标较小的候选」）
 * 已在本文件上方任务 3.3 的 assert 型用例
 * 「parseStyleString: BPM 抽取与吸附五行（R3 AC 12）」中覆盖。
 * O2 额外做的事是把等距点全枚举一遍并打印实测结果，用于发现
 * 「某个等距点的行为与另一个不同」这类不一致；把它做成 assert
 * 会把一个实现副产物固化成契约，那不是本轮该做的决定。
 *
 * 与 P14 共用同一套「打印清单、不 assert」输出机制，
 * 使该项导致 `node --test` 以非 0 退出的次数保持为 0。
 * ------------------------------------------------------------------ */

// 覆盖意图: 从 BPM.values = [55,58,60,62,65,68,70] 的相邻对中枚举**全部**整数等距点。
//           相邻间距为 3 的三对（55/58、62/65、65/68）中点是 x.5，无整数等距点，故不入表；
//           间距为 2 的三对（58/60、60/62、68/70）各有一个整数等距点 → 59 / 61 / 69。
//           '30 bpm' 与 '220 bpm' 作为范围外对照留在任务 3.3 的 assert 型用例中，不在此重复。
// 来源: design.md §10.4 O2；BPM.values 升序取自 design §5.3
const BPM_EQUIDISTANT_PROBES = [
  { input: '59 bpm', candidates: [58, 60] },
  { input: '61 bpm', candidates: [60, 62] },
  { input: '69 bpm', candidates: [68, 70] },
];

test('Observation 2: BPM 吸附等距规则（观察项 · 打印清单不 assert）', () => {
  const bpmValues = Array.from(AWEN.BPM.values);
  const rows = [];

  for (const probe of BPM_EQUIDISTANT_PROBES) {
    const out = parseStyleString(probe.input);
    const actual = out === null ? undefined : out.bpm;
    rows.push({
      input: probe.input,
      actual,
      candidates: probe.candidates,
      // 「取较小」= 实测值等于两个候选中较小的那个。
      smaller: Math.min(probe.candidates[0], probe.candidates[1]),
    });
  }

  console.log('');
  console.log('── Observation 2 · BPM 吸附等距规则清单（观察项，不 assert）──');
  console.log(`   BPM.values = ${show(bpmValues)}；相邻对中整数等距点共 ${BPM_EQUIDISTANT_PROBES.length} 个。`);
  console.log('   间距为 3 的相邻对（55/58、62/65、65/68）中点为 x.5，无整数等距点，不入表。');
  for (const row of rows) {
    const verdict = row.actual === row.smaller
      ? '与「取较小」一致'
      : `与「取较小」不一致（较小候选为 ${row.smaller}）`;
    console.log(`     输入 ${show(row.input)} | 实测 bpm ${show(row.actual)}`
      + ` | 等距候选 ${show(row.candidates)} | ${verdict}`);
  }
  const deviations = rows.filter((r) => r.actual !== r.smaller);
  console.log(`   与「取较小」不一致的等距点：${deviations.length} 个`
    + `${deviations.length === 0 ? '（三个等距点全部取较小值，规则一致）' : ` → 记入 FIX_LOG.md 遗留项：${show(deviations.map((r) => r.input))}`}`);
  console.log('');

  // 观察项不 assert 吸附方向。只做一条取样自检：探针的两个等距候选必须都是品牌值，
  // 否则是取样写错（拿一个不存在的候选去谈「等距」），而不是实现出错。
  const c = makeCollector();
  for (const probe of BPM_EQUIDISTANT_PROBES) {
    for (const candidate of probe.candidates) {
      c.check(bpmValues.includes(candidate), {
        fn: 'BPM_EQUIDISTANT_PROBES（取样自检）',
        input: `${show(probe.input)} 的候选 ${candidate}`,
        expected: '候选值须取自 BPM.values',
        actual: `BPM.values = ${show(bpmValues)}`,
        note: '这条自检不涉及吸附方向，故不违反「不 assert」口径',
      });
    }
  }
  c.report('Observation 2（取样自检）');
});
