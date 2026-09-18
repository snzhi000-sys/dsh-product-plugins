# Harness 产品插件库

我们自己维护的 DeepSeek Harness 产品插件的**权威源码**。App 工程只是消费者，不再拥有插件源码。

## 目录与命名

```
<plugin>/            每个插件一个目录，目录名 = 包名去掉 `dsh-` 前缀
  package.json       包名必须是 `dsh-<plugin>`
  host/              Cordis host 入口（`main`）
  client/src/        client 源码
  client/dist/       构建出的 client bundle（**入库跟踪**，理由见下）
  tests/             `node --test` 测试
  README.md / README.zh.md
```

App 工程通过 `distribution/profile-manifest.json` 做位置映射：

```json
{ "productPlugins": { "dsh-file-edit": "plugins/file-edit" } }
```

映射关系是位置式的：App 树的 `plugins/<plugin>` 对应本仓库的 `<plugin>`。`desktop/scripts/prepare-profile.mjs` 会拒绝绝对路径和任何 `..` 段，所以 App 树不能直接引用本仓库——由同步步骤复制进去。

## 构建与测试

```bash
cd file-edit
npm install                # 只需一次，用于 esbuild 与 CodeMirror 开发依赖
npm run build:client       # esbuild → client/dist/client.js
npm test                   # node --test tests/*.test.mjs
```

`client/dist/client.js` 是**故意入库**的：App 打包链用 `npm pack` 归档插件，其 `files` 字段只发 `host`、`client/dist`、`README.md`，而 `package.json` 没有 `prepare` 脚本。把它留在这里，同步与打包就不依赖联网安装。改了 `client/src/` 就要重新构建再提交——同步会拒绝"比最新 client 源码还旧"的 bundle。

## App 怎么消费本仓库

```bash
cd <app-tree>/desktop
npm run sync:plugins              # 把映射里的插件复制进 App 树
npm run sync:plugins -- --check   # 只校验不写入；有漂移则非零退出
```

- App 打包链在 `prepare:profile` 之前跑 `sync:plugins`，所以 `npm run dist:dev` / `dist:stable` 打包的一定是本仓库的源码。
- App 树里的副本（`<app-tree>/plugins/<plugin>`）是**生成物且已被 git 忽略**。不要编辑它：改本仓库，然后同步。
- `DSH_PLUGIN_HOME` 可覆盖同步的读取位置，默认是 App 树旁边的 `plugins` 目录。

## 迭代流程（Runbook）

插件的每次改动都按这个顺序走。插件库是唯一权威源，App 树那份是从它生成出来的。

1. **在本仓库改源码**，不要改 App 树里那份：`npm run check:plugins` 会报漂移，`dist:dev` / `dist:stable` 也会把那份覆盖掉。
2. **在插件目录构建并测试**：`npm run build:client && npm test`。只要改动要交付，就在 `package.json` 里递增 `version`，并在提交信息里写明。
3. **落到 App 树**：`cd "<app-tree>/desktop" && npm run sync:plugins`。打包链在 `prepare:profile` 之前会自动同步，所以只有在"不想打包但需要副本存在"时才需要手动跑这一步；`npm run check:plugins` 用来证明逐字节一致。
4. **打 Dev 包**：`cd "<app-tree>/desktop" && npm run dist:dev`。通道门禁会跑 desktop 测试、`verify:source-privacy`、profile 隐私校验、产品身份校验与空 userData 隔离启动。
5. **在真实 App 上验证行为**：启动 `<app-tree>/desktop/dist/dev/mac-arm64/DeepSeek Harness Dev.app`，在测试工作区里把功能走一遍。需要"证明"而不是"肉眼看"的行为，用隔离 userData 驱动打包探针（例如 `<app-tree>/desktop/scripts/probe-edit-open-service.mjs`）。
6. **Dev 验收通过后才做 Stable**，而且要另外获得"可以动 `/Applications`"的明确批准：`npm run dist:stable`，然后由用户手动替换已安装的 App。
7. **记录改动**：在本仓库提交、信息写清范围。App 侧的改动（`distribution/profile-manifest.json` 新映射、`desktop/**`、`packages/client/ui-explorer/**`）提交在 App 树——那些文件不属于本仓库，而且 App 树不跟踪插件源码。
8. **将来有了 GitHub 远端**：插件改动推本仓库，App 改动按它自己的隔离候选流程单独推。本仓库始终是工作态的权威源，远端只是镜像。

跨两侧的功能（例如插件 + Explorer 同时改）就是**两个仓库各一次提交**，提交信息互相指名；任何一侧单独都复现不出这个功能。

### 什么内容在哪

| 内容 | 所在仓库 |
| --- | --- |
| 插件 `host/`、`client/`、`tests/`、插件 README、构建出的 client bundle | 本仓库 |
| `distribution/profile-manifest.json`、`distribution/cordis.patch.yml` | App 树 |
| `desktop/**`（产品桌面壳、打包与验证脚本） | App 树 |
| `packages/client/ui-explorer/**`（自研 Explorer，不是插件） | App 树 |
| `plugins/edit-migration-probes/**`（迁移探针，不是产品插件） | App 树 |

## 新增插件

1. 在本仓库建 `<plugin>/`，`package.json` 名为 `dsh-<plugin>`、`"type": "module"`，`files` 覆盖必须进包的内容。
2. 在 App 树的 `distribution/profile-manifest.json` 加映射 `"dsh-<plugin>": "plugins/<plugin>"`。
3. 构建 client bundle、提交，再在 App 树跑 `npm run sync:plugins`，然后打包。

## 规则

- 进包文件不得含绝对路径、本机路径、凭据或会话数据：App 的 profile 隐私门禁会拒绝。
- 所有注册走 `ctx.effect()` / `ctx.on()`；可选 Cordis 服务用 `ctx.get(name)` 读取。
- client bundle 只允许 `require()` App 暴露的平台模块，例如 `@deepseek-ai/dsh-client-ui-primitives`。
- 插件的 `README.md` / `README.zh.md` 配对要随行为同步更新。

## 许可证状态

这些插件的第三方来源与许可证确认**尚未关闭**，因此这里不授予任何许可证文件，在确认记录完成前不得对外发布。在此之前本仓库仅限本地使用。
