# 狼人杀 · 在线版

把六位房间码发给朋友，满员后由房主开局。默认随机发牌；站长可在开局前指定部分身份，座位仍然随机。游戏有九种固定板子，分为 6 人、9 人和 12 人局；也可以开「自定义房间」，自选 6–12 人和角色、上警与行动时限（不计 Elo）。另有不计 Elo 的 9 人「血月牌局」：4 点气血、金币工资、私人商店、升星、卡牌与技能，夜里狼刀和女巫毒改为扣血，受害者不会知道伤害来源。每个板子进房后会先展示角色、技能、流程和胜利条件；首页能看到进行中的对局并直接旁观，也可以让服务端按板子独立匹配。账号通过审核后也可以只旁观，不占座位。完整回放在对局结束后开放，届时才能看到旁观时看不到的狼人夜聊。

服务端裁判版基于 [legendcn/werewolf](https://github.com/legendcn/werewolf) v0.17.0（`e0101a3`）。该提交仍使用浏览器裁判；在服务端裁判版中，浏览器只提交玩家的操作，发牌、判胜和写入评分由 Supabase Edge Function `game` 负责。

## 先看页面

在本仓库根目录，使用 Node.js 22 或更高版本：

```sh
npm run preview:offline
```

打开 <http://localhost:5173>，点「规则」即可阅读[详细游戏规则](rules.html)，无需登录。离线预览不用安装 npm 依赖，也不连接 Supabase，因此不能开房。要换端口，请设置环境变量 `PORT`。

## 运行测试

```sh
npm ci
npm test
```

使用普通用户运行，不要加 `sudo`。测试会在临时目录启动独立的 PostgreSQL，结束后清理；不需要 Supabase 项目、数据库密码或 Docker。只改了裁判时可单独跑 `node --test tests/rule-audit.test.mjs`。

## 开一局真正的游戏

1. 准备自己的 Supabase 项目，按[部署与升级](DEPLOYMENT.md)迁移数据库、部署 `game` 并设置首个站长。使用快速匹配还需执行 `supabase/migration-v9.sql`。
2. 将[浏览器配置示例](examples/config.js)复制到 `js/config.js`，填入自己项目的 URL 和 **publishable / anon** key。仓库附带的 `js/config.js` 指向 v0.15.0 使用的公开项目，不是本地测试环境。数据库连接串和服务端密钥不能放在这个文件里。
3. 运行 `npm start`，在首页注册并通过审核后创建房间。朋友加入同一房间，满员后由房主开局。

发布静态站时运行 `npm run build`，只上传 `dist/` 的内容。这条命令不执行 SQL、不部署函数，也不会向 GitHub Pages 发布。只有页面、没有匹配的服务端，不能进行联机对局。

## 从哪里改

| 路径 | 用途 |
| --- | --- |
| `index.html`、`styles.css`、`js/` | 大厅、房间、旁观、回放界面和请求客户端 |
| `rules.html` | 主页直接打开的玩家手册 |
| `supabase/functions/_shared/` | 前后端共用的角色、板子和规则函数 |
| `supabase/functions/game/` | 身份校验、视图裁剪、局时、回合推进、事务结算 |
| `supabase/*.sql` | 建表、权限与升级脚本；先读部署说明再执行 |
| `tests/` | 规则、浏览器 DOM 和临时 PostgreSQL 回归测试 |

[贡献指南](CONTRIBUTING.md) · [变更记录](CHANGELOG.md) · [回归测试](tests/) · [安全问题报告](SECURITY.md)

## 许可

在上述 v0.17.0 提交中未找到游戏源码的项目级许可证，本次改动也未指定开源协议。再分发或另行授权前，请向权利人确认。随页面附带的库有各自的[第三方许可说明](THIRD_PARTY_NOTICES.md)，这些许可不覆盖游戏本身。
