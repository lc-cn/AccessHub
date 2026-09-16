# AccessHub

AccessHub 管理 API 访问权益，并把外部购买结果转换成可核销的本地权益。

## Language

**订阅计划（Subscription Plan）**：
AccessHub 内定义的一档 API 访问权益，包含明确的阶梯顺序、分钟限速、日/周/月配额和默认计划标记。
_Avoid_: 用户组、用户分组

**计划阶梯（Plan Tier）**：
订阅计划的显式等级顺序；等级更高表示升级，等级更低表示降级，默认计划始终作为所有用户已包含的基础档。
_Avoid_: 根据名称、价格或配额自动推断等级

**额度回落（Allowance Fallback）**：
当前付费计划的任一周期配额耗尽后，请求改用独立统计的默认计划额度；默认额度也耗尽后才抵扣 Credits。
_Avoid_: 合并计划用量、订阅降级

**支付服务供应商（PSP）**：
处理商品结算、付款结果与支付事件的外部服务；爱发电、微信支付和支付宝属于 PSP。
_Avoid_: 订阅计划、SKU、购买渠道

**SKU**：
AccessHub 自己的可售权益单元；它可以授予一个订阅计划，也可以提供一组增量 Credits。
_Avoid_: 爱发电 SKU、兑换码

**PSP 商品（Provider Offer）**：
PSP 中的可结算商品；爱发电方案和爱发电 SKU 都属于爱发电 PSP 商品。
_Avoid_: AccessHub SKU、订阅计划

**商品映射（Offer Mapping）**：
一个 PSP 商品与一个 AccessHub SKU 之间的对应关系。
_Avoid_: 权益规则、订阅计划映射

**订单（Order）**：
用户购买一个 SKU 的商业意图及履约记录；支付是订单发生的资金事件。
_Avoid_: 爱发电订单、兑换码

**支付（Payment）**：
PSP 对一笔订单执行的资金交易，可处于待确认、成功、失败或退款状态。
_Avoid_: 订单、订阅

**订阅（Subscription）**：
一个用户对订阅计划的有状态商业关系，拥有独立生命周期，并由支付或人工操作推动状态转换。
_Avoid_: 订阅计划、API 权益

**计划权益（Plan Entitlement）**：
订阅激活后授予用户的 API 访问能力；它是授权结果，不承担支付或订阅生命周期。
_Avoid_: 订阅、订阅计划

**PSP 事件（Provider Event）**：
从 PSP 收到并以幂等方式处理的一条外部事实，例如付款成功、退款或续费。
_Avoid_: 活动日志

**活动日志（Activity Log）**：
系统中由用户或管理员操作产生的可追溯记录。
_Avoid_: 订单、访问用量

**个人中心（Account Center）**：
已登录用户维护自身资料、安全设置、登录身份，并查看个人权益、用量和订单的自助区域。
_Avoid_: 管理后台、Dashboard

**主邮箱（Primary Email）**：
用户已验证或等待验证的主要联系地址，也是邮箱密码登录身份使用的地址。
_Avoid_: OAuth Provider、登录账号

**登录身份（Login Identity）**：
附着于同一用户、可用于证明其身份的登录方式，例如 GitHub、爱发电或邮箱密码。
_Avoid_: 用户、主邮箱

**Credits 流水（Credit Transaction）**：
一次不可变的 Credits 余额变化记录，用于解释授予、消费、调整和期初余额。
_Avoid_: Credits 余额、API 用量

**Credits 增量包（Credits Pack）**：
一种提供补充调用额度的 SKU，在订阅计划周期配额耗尽后逐次抵扣。

**权限（Permission）**：
一项稳定、可命名的系统能力，例如 `service.qsign.invoke`；服务和其他受保护资源通过引用权限表达访问要求。
_Avoid_: 订阅计划、API Key Scope、根据计划等级临时推断的布尔值

**计划权限授予（Plan Permission Grant）**：
订阅计划与权限之间的显式授权关系。用户的有效权限是默认计划与当前所有有效计划所授予权限的并集；管理员隐式拥有全部权限。
_Avoid_: 服务白名单、计划等级比较

**服务访问要求（Service Access Requirement）**：
服务声明调用者必须拥有的一项权限；未声明时对所有已登录用户开放。服务目录展示与网关执行必须使用同一要求。
_Avoid_: 仅在前端隐藏、仅在 API Key 上限制

**API Key Scope**：
API Key 自身允许调用的服务范围，是凭据约束；它与用户权限相互独立，调用时必须同时满足。
_Avoid_: 用户权限、订阅权益
