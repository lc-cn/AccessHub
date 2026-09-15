# AccessHub

AccessHub 管理 API 访问权益，并把外部购买结果转换成可核销的本地权益。

## Language

**订阅计划（Subscription Plan）**：
AccessHub 内定义的一档 API 访问权益，包含分钟限速、日/周/月配额和默认计划标记。
_Avoid_: 用户组、用户分组

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

**Credits 增量包（Credits Pack）**：
一种提供补充调用额度的 SKU，在订阅计划周期配额耗尽后逐次抵扣。
