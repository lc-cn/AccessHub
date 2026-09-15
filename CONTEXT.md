# AccessHub

AccessHub 管理 API 访问权益，并把外部购买结果转换成可核销的本地权益。

## Language

**订阅计划（Subscription Plan）**：
AccessHub 内定义的一档 API 访问权益，包含分钟限速、日/周/月配额和默认计划标记。
_Avoid_: 用户组、用户分组

**购买渠道（Purchase Channel）**：
承载商品展示、结算和订单通知的外部服务；爱发电是当前购买渠道。
_Avoid_: 订阅计划

**爱发电商品（Afdian Offer）**：
爱发电中的方案或 SKU，通过外部标识映射到一个订阅计划或 Credits 增量包。
_Avoid_: AccessHub 订阅计划

**Credits 增量包（Credits Pack）**：
在订阅计划周期配额耗尽后逐次抵扣的补充调用额度。
