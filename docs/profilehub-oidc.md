# ProfileHub 账号登录

在 IdP（ProfileHub）中创建机密客户端，登记：

- 本地 callback：`http://localhost:3001/api/auth/callback/rbac`
- 本地 post-logout callback：`http://localhost:3001/login`
- scopes：`openid profile email offline_access`
- 启用 authorization_code 与 refresh_token

在本项目 `.env.local` 配置：

```dotenv
BETTER_AUTH_URL=http://localhost:3001
PROFILEHUB_ISSUER_URL=https://profile.l2cl.link
PROFILEHUB_CLIENT_ID=在IdP控制台获取
PROFILEHUB_CLIENT_SECRET=在IdP控制台获取
```

IdP 必须配置 RSA PKCS8 私钥；本项目不持有该私钥，使用 Discovery/JWKS 验证 ID Token。先启动 IdP，确认 Discovery 可访问，再用 `pnpm dev --port 3001` 启动本项目。配置完整后登录页显示“使用 ProfileHub 登录”；不配置时不注册该 provider。

退出登录会清除本项目会话并跳到 IdP 确认退出，再返回 `/login`。GitHub/爱发电仍然可用。账号保持禁止隐式链接；如果 ProfileHub 用户邮箱与已有账号相同，应通过明确的绑定流程连接账号，不能靠修改 trustedProviders 绕过绑定。

生产配置使用 HTTPS 和真实域名，回调必须逐字登记。服务器 Secret 不得设置为 NEXT_PUBLIC_*。本次未修改原有数据库环境变量。

在 ProfileHub 仓库可运行：

```bash
L2CL_PATH=/Users/liuchunlang/l2cl pnpm run test:oauth
```

该测试加载本项目已安装的 Better Auth 1.7.4 和 `lib/profilehub-oauth.ts`（旧 `lib/rbac-oauth.ts` 入口仍兼容），使用隔离存储验证授权、PKCE/nonce、JWKS、会话、刷新与登出，不写入本项目业务数据库。HTTP fetch 被转发到 IdP Route Handler，因此还需要实际浏览器验证网络、Cookie 和数据库 hooks。

Better Auth 1.7.4 的刷新接口按账户记录的 accountId 选择账号，不接受只传 providerId。

## 域名与配置迁移

新的生产 IdP 地址为 `https://profile.l2cl.link`，Discovery 为 `https://profile.l2cl.link/.well-known/openid-configuration`。AccessHub 生产回调保持 `https://l2cl.link/api/auth/callback/rbac`，退出回调为 `https://l2cl.link/login`。完全本地联调时可将 `PROFILEHUB_ISSUER_URL` 改为 `http://localhost:3000`。

新配置使用 `PROFILEHUB_ISSUER_URL`、`PROFILEHUB_CLIENT_ID`、`PROFILEHUB_CLIENT_SECRET`。每个字段优先读取新变量，未设置才兼容对应的 `RBAC_*` 变量；显式空值不会退回旧值。迁移时建议一起设置三个新变量，验证后再删除旧变量；密钥只能保存在服务器 Secret 中。

Better Auth 的 `providerId` 与回调路径中的 `rbac` 保留：这是已有账户关联的持久标识，直接改名会让同一个 ProfileHub 账号被识别为不同提供方。产品名称、页面文案与配置名统一为 ProfileHub，无需修改已有账户记录。旧模块导出保持兼容，新增代码应使用 `getProfileHubOAuthConfig`。

生产 AccessHub 已新增 `PROFILEHUB_ISSUER_URL=https://profile.l2cl.link`；迁移期间客户端 ID 与 Secret 可以继续从旧变量读取。部署前仍须确认 ProfileHub Discovery 的 issuer 与新域名完全一致，并登记上述回调。完成线上登录验收后，再将客户端凭据迁移到 `PROFILEHUB_CLIENT_ID`、`PROFILEHUB_CLIENT_SECRET` 并删除旧变量。

## 历史生产联调（2026-09-17）

以下为旧域名时期的历史验收，不能作为新域名部署成功的证明。本应用为 `https://l2cl.link`；Client ID 为 `l2cl-production`。三个旧 RBAC 配置以 Cloudflare Secret 保存。当时验收 Worker 版本为 `e3a2677f-94ba-47a0-a783-cb782571d973`。

Workers 不允许模块初始化期间发起 Discovery 网络请求，因此 `lib/auth.ts` 延迟至请求期间创建并缓存 Better Auth 实例。不要恢复模块顶层的 `betterAuth(...)` 调用，否则 Generic OAuth Provider 可能被跳过，登录返回 `PROVIDER_NOT_FOUND`。

已通过生产 HTTPS 脚本验证登录、回调、JWKS 验签、PostgreSQL 建号 hook、默认 API Key、刷新、UserInfo、RP/IdP 双端退出及 state 返回。使用独立 Cookie 容器和非管理员测试账号；测试账号及默认 API Key 已清理，IdP 测试账号已禁用并撤销刷新令牌。浏览器仅确认登录入口渲染，尚未完成完整浏览器点击式 E2E。
