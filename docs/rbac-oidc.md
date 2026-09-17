# RBAC 统一账号登录

在 IdP（ProfileHub）中创建机密客户端，登记：

- 本地 callback：`http://localhost:3001/api/auth/callback/rbac`
- 本地 post-logout callback：`http://localhost:3001/login`
- scopes：`openid profile email offline_access`
- 启用 authorization_code 与 refresh_token

在本项目 `.env.local` 配置：

```dotenv
BETTER_AUTH_URL=http://localhost:3001
RBAC_ISSUER_URL=http://localhost:3000
RBAC_CLIENT_ID=在IdP控制台获取
RBAC_CLIENT_SECRET=在IdP控制台获取
```

IdP 必须配置 RSA PKCS8 私钥；本项目不持有该私钥，使用 Discovery/JWKS 验证 ID Token。先启动 IdP，确认 Discovery 可访问，再用 `pnpm dev --port 3001` 启动本项目。配置完整后登录页显示“使用统一账号登录”；不配置时不注册该 provider。

退出登录会清除本项目会话并跳到 IdP 确认退出，再返回 `/login`。GitHub/爱发电仍然可用。账号保持禁止隐式链接；如果 RBAC 用户邮箱与已有账号相同，应通过明确的绑定流程连接账号，不能靠修改 trustedProviders 绕过绑定。

生产配置使用 HTTPS 和真实域名，回调必须逐字登记。服务器 Secret 不得设置为 NEXT_PUBLIC_*。本次未修改原有数据库环境变量。

在 ProfileHub 仓库可运行：

```bash
L2CL_PATH=/Users/liuchunlang/l2cl pnpm run test:oauth
```

该测试加载本项目已安装的 Better Auth 1.7.4 和 `lib/rbac-oauth.ts`，使用隔离存储验证授权、PKCE/nonce、JWKS、会话、刷新与登出，不写入本项目业务数据库。HTTP fetch 被转发到 IdP Route Handler，因此还需要实际浏览器验证网络、Cookie 和数据库 hooks。

Better Auth 1.7.4 的刷新接口按账户记录的 accountId 选择账号，不接受只传 providerId。

## 生产联调（2026-09-17）

生产 IdP 为 `https://auth.liucl.cn`，本应用为 `https://l2cl.link`；Client ID 为 `l2cl-production`。三个 RBAC 配置以 Cloudflare Secret 保存。最新验收 Worker 版本为 `e3a2677f-94ba-47a0-a783-cb782571d973`。

Workers 不允许模块初始化期间发起 Discovery 网络请求，因此 `lib/auth.ts` 延迟至请求期间创建并缓存 Better Auth 实例。不要恢复模块顶层的 `betterAuth(...)` 调用，否则 Generic OAuth Provider 可能被跳过，登录返回 `PROVIDER_NOT_FOUND`。

已通过生产 HTTPS 脚本验证登录、回调、JWKS 验签、PostgreSQL 建号 hook、默认 API Key、刷新、UserInfo、RP/IdP 双端退出及 state 返回。使用独立 Cookie 容器和非管理员测试账号；测试账号及默认 API Key 已清理，IdP 测试账号已禁用并撤销刷新令牌。浏览器仅确认登录入口渲染，尚未完成完整浏览器点击式 E2E。
