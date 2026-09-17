# AccessHub

**把 API 服务、访问权限、调用配额和订阅权益放在同一个平台管理。**

AccessHub 是面向 API 服务提供者的可自行部署的管理平台。管理员配置上游服务、接口和访问规则，用户在工作台获取 API Key、查看权益并测试接口；请求经过统一网关进行身份校验、权限检查、配额预留和用量结算。

[部署文档](docs/cloudflare-deployment.md) · [身份接入](docs/profilehub-oidc.md) · [领域模型](CONTEXT.md) · [Issues](https://github.com/lc-cn/AccessHub/issues) · [Apache-2.0](LICENSE)

## 能做什么

| 能力       | 当前实现                                                                               |
| ---------- | -------------------------------------------------------------------------------------- |
| 服务接入   | 管理上游服务与接口、请求参数白名单；支持 HTTP 上游和 Cloudflare Worker Service Binding |
| 统一网关   | 服务端注入 Bearer、Header、Query 或 Basic Auth 凭据，统一校验用户权限                  |
| API Key    | 默认 Key、自定义 Key、撤销、浏览器测试控制台；自定义 Key 仅创建时返回明文              |
| 权限与配额 | 服务权限、计划阶梯、分钟限速、日/周/月配额及 Credits 额度回落                          |
| 商品与权益 | 本地 SKU、订单、支付记录、订阅、兑换码与权益核销                                       |
| 爱发电适配 | 商品映射、付款事件去重、兑换码履约及私信交付                                           |
| 异步运维   | 独立 Commerce Worker、Queue、Workflows、事务 Outbox、死信查看与人工重放                |
| 用户账号   | GitHub 登录、可选 OIDC 登录、邮件登录、Passkey、多因素认证及会话管理                   |

支付平台提供付款事实，AccessHub 维护本地订单、订阅与最终 API 权益。当前已接入的支付适配器是爱发电；领域模型中出现其他支付平台名称，不代表已经实现其适配器。

## 一次 API 调用如何完成

```text
客户端携带 API Key
  → 网关校验身份、权限与参数
  → 预留调用额度
  → 注入上游凭据并转发请求
  → 按响应结果结算用量
```

程序调用和浏览器测试使用同一套网关：

```bash
curl https://your-accesshub.example/api/gateway/service-code/api-code \
  -H 'Authorization: Bearer YOUR_API_KEY'

# 也可以将 API Key 作为 Query 参数传递
curl 'https://your-accesshub.example/api/gateway/service-code/api-code?key=YOUR_API_KEY'
```

实际 HTTP 方法与参数由管理员配置的接口决定。API Key 标识用户，服务访问权由用户当前权限决定。`key` 是 AccessHub 网关保留参数，不会转发给上游；上游凭据保留在服务端，不交给调用方。网关不跟随上游重定向。生产调用仍优先建议使用 Bearer Header，避免 URL 被浏览器历史、代理或访问日志记录。

当前只有上游返回 **HTTP 200** 才结算配置的调用单位；网络失败、超时和其他状态不扣除配额。计划额度按付费计划、默认计划、Credits 的顺序回落，具体规则见 [领域模型](CONTEXT.md)。

## 与 ProfileHub 一起使用

[ProfileHub](https://github.com/lc-cn/ProfileHub) 是配套的身份与权限管理项目。AccessHub 可通过 Better Auth Generic OAuth 接入 ProfileHub，使用 PKCE、Discovery 和 JWKS 验证身份，然后建立自己的会话。

两个项目可以独立使用。接入 ProfileHub 不会自动同步其组织角色，也不会自动赋予 AccessHub 的 API 权限或订阅权益。配置方式见 [OIDC 接入指南](docs/profilehub-oidc.md)。

## 本地开发

技术栈为 TypeScript、Next.js / React、Better Auth、PostgreSQL / Drizzle ORM、Tailwind CSS。Cloudflare 部署通过 vinext 构建。

准备 Node.js 24、pnpm 10 和独立的 PostgreSQL 开发数据库：

```bash
git clone https://github.com/lc-cn/AccessHub.git
cd AccessHub
pnpm install
```

**数据库初始化仍需手动准备。** 当前 `drizzle/` 保存的是从历史结构演进的增量 SQL，第一份迁移依赖已有表，尚未提供可以直接从空库运行的一键初始化流程。请结合 [当前 Schema](lib/db/schema.ts) 和 [数据库完整性说明](docs/database-integrity.md) 准备数据库；不要把全部历史 SQL 当作空库建表脚本直接执行。

在根目录创建 `.env.local`，配置自己的连接与独立随机密钥：

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/accesshub
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-random-secret
SERVICE_CREDENTIALS_KEY=replace-with-another-random-secret-at-least-32-characters
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

GitHub 登录回调为 `http://localhost:3000/api/auth/callback/github`。数据库准备完成后运行：

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。当前管理员引导逻辑会在不存在管理员时，将首次通过管理员权限检查的已登录用户提升为管理员；首次部署应在受控环境中完成该步骤，再开放注册与访问。

### 按需启用

- **邮件登录与找回密码**：配置完整的 SMTP 参数后启用，见 [邮件部署](docs/smtp-deployment.md)。
- **ProfileHub 登录**：配置 `PROFILEHUB_ISSUER_URL`、`PROFILEHUB_CLIENT_ID`、`PROFILEHUB_CLIENT_SECRET`，见 [身份接入](docs/profilehub-oidc.md)。
- **爱发电账号绑定与履约**：需要自己的 OAuth 应用、创作者凭据、Webhook Secret 和商品映射；异步履约还依赖下述 Commerce Worker。

`SERVICE_CREDENTIALS_KEY` 用于加密上游凭据及可供测试控制台读取的默认 API Key。应稳定保存，直接替换会使现有密文无法解密。环境文件及任何真实凭据均不应提交到仓库。

## 部署结构

完整的异步商业流程使用以下组件：

- **Web Worker**：管理界面、账号体系、API 网关和支付回调入口。
- **Commerce Worker**：订单履约与订阅周期处理。
- **PostgreSQL**：账号、权限、用量、订单和权益的事实存储。
- **Cloudflare Hyperdrive、KV、Queues 与 Workflows**：数据库连接、服务目录缓存和异步任务执行。

仓库中的 Wrangler 配置带有现有部署的资源名称、域名和绑定 ID。自行部署时必须替换为自己的资源，并分别配置 Web 与 Commerce Worker 的 Secret；不能直接使用这些绑定。部署步骤见 [Cloudflare 部署文档](docs/cloudflare-deployment.md)。

`pnpm dev` 可用于 Node.js 下开发页面与 HTTP 接口；Worker Service Binding、Queue 和 Workflows 需要对应的 Cloudflare 运行环境。仅启动 Next.js 不代表完整的异步履约系统已经运行。

付款事件以幂等方式记录；交付结果不明确时保留待人工核对，避免自动重发私信。死信与履约处理说明见 [运维文档](docs/operations-runbook.md)。

## 开发与贡献

| 命令                  | 用途                         |
| --------------------- | ---------------------------- |
| `pnpm dev`          | Next.js 本地开发             |
| `pnpm build`        | Next.js 生产构建             |
| `pnpm dev:vinext`   | Cloudflare 开发入口          |
| `pnpm build:vinext` | 构建 Web Worker              |
| `pnpm test`         | 业务及 Commerce Worker 测试  |
| `pnpm typecheck`    | 类型生成、检查及 vinext 构建 |

页面与接口位于 `app/`，核心业务规则位于 `lib/`，异步商业流程位于 `workers/commerce/`，数据库迁移位于 `drizzle/`。

欢迎提交 Issue 和 Pull Request。涉及配额、支付、订阅、权限或幂等性的修改，请附上行为变化与测试；数据库变更请说明迁移条件。问题报告请移除用户数据和凭据。

## 许可证

Copyright 2026 AccessHub contributors.

本项目采用 [Apache License 2.0](LICENSE)。第三方依赖遵循各自的许可证。
