import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BookOpen,
  Boxes,
  CreditCard,
  HeartHandshake,
  History,
  LayoutDashboard,
  ReceiptText,
  Repeat2,
  Ticket,
  UserRound,
  Users,
  Webhook,
} from 'lucide-react'

export type WorkspaceRoute = 'dashboard' | 'redeem' | 'codes' | 'codes-new' | 'plans' | 'plans-new' | 'plans-edit' | 'skus' | 'skus-new' | 'skus-edit' | 'subscriptions' | 'orders' | 'order-detail' | 'payments' | 'users' | 'logs' | 'afdian' | 'afdian-new' | 'afdian-edit' | 'afdian-orders' | 'afdian-order-detail' | 'afdian-events' | 'docs'

export type WorkspaceNavItem = {
  label: string
  description: string
  href: string
  active: WorkspaceRoute[]
  icon: LucideIcon
}

export type WorkspaceNavGroup = {
  label: string
  admin?: boolean
  items: WorkspaceNavItem[]
}

export const workspaceNavGroups: WorkspaceNavGroup[] = [
  {
    label: '我的空间',
    items: [
      { label: '概览', description: '权益、用量与升级', href: '/dashboard', active: ['dashboard'], icon: LayoutDashboard },
      { label: '兑换权益', description: '核销爱发电兑换码', href: '/redeem-codes', active: ['redeem'], icon: Ticket },
      { label: '个人中心', description: '账户、安全与订单', href: '/account', active: [], icon: UserRound },
      { label: 'API 文档', description: '接口与调用示例', href: '/api-docs', active: ['docs'], icon: BookOpen },
    ],
  },
  {
    label: '商品与权益',
    admin: true,
    items: [
      { label: '订阅计划', description: '访问策略与阶梯', href: '/admin/plans', active: ['plans', 'plans-new', 'plans-edit'], icon: Activity },
      { label: 'SKU 目录', description: '统一商品定义', href: '/admin/skus', active: ['skus', 'skus-new', 'skus-edit'], icon: Boxes },
      { label: '兑换码', description: '发码与核销台账', href: '/admin/redeem-codes', active: ['codes', 'codes-new'], icon: Ticket },
    ],
  },
  {
    label: '商业中心',
    admin: true,
    items: [
      { label: '订阅', description: '订阅状态机', href: '/admin/subscriptions', active: ['subscriptions'], icon: Repeat2 },
      { label: '订单', description: '统一订单与履约', href: '/admin/orders', active: ['orders', 'order-detail'], icon: ReceiptText },
      { label: '支付', description: 'PSP 交易结果', href: '/admin/payments', active: ['payments'], icon: CreditCard },
      { label: '用户', description: '账户与角色', href: '/admin/users', active: ['users'], icon: Users },
    ],
  },
  {
    label: '支付服务商 · 爱发电',
    admin: true,
    items: [
      { label: '商品映射', description: '外部商品映射 SKU', href: '/admin/afdian/mappings', active: ['afdian', 'afdian-new', 'afdian-edit'], icon: HeartHandshake },
      { label: '渠道订单', description: '私信发码闭环', href: '/admin/afdian/orders', active: ['afdian-orders', 'afdian-order-detail'], icon: ReceiptText },
      { label: 'Webhook 事件', description: '接收与幂等处理', href: '/admin/afdian/events', active: ['afdian-events'], icon: Webhook },
    ],
  },
  {
    label: '系统',
    admin: true,
    items: [
      { label: '活动日志', description: '关键业务审计', href: '/admin/logs', active: ['logs'], icon: History },
    ],
  },
]

export const workspaceRouteMeta: Record<WorkspaceRoute, { eyebrow: string; title: string; description: string; admin?: boolean }> = {
  dashboard: { eyebrow: '我的空间', title: '概览', description: '查看账户、访问权益与今天的 API 使用情况。' },
  redeem: { eyebrow: '我的空间 / 权益', title: '兑换权益', description: '核销兑换码，权益将立即加入当前账户。' },
  codes: { eyebrow: '商品与权益 / 兑换码', title: '兑换码台账', description: '查询、筛选并追踪已经签发的兑换码。', admin: true },
  'codes-new': { eyebrow: '商品与权益 / 兑换码', title: '生成兑换码', description: '根据 SKU 签发一批订阅权益或 Credits 兑换码。', admin: true },
  plans: { eyebrow: '商品与权益 / 策略', title: '订阅计划', description: '管理访问频率、周期配额与默认兜底策略。', admin: true },
  'plans-new': { eyebrow: '商品与权益 / 订阅计划', title: '新建订阅计划', description: '创建一个新的 API 访问阶梯。', admin: true },
  'plans-edit': { eyebrow: '商品与权益 / 订阅计划', title: '编辑订阅计划', description: '调整计划能力及其在权益阶梯中的位置。', admin: true },
  skus: { eyebrow: '商品与权益 / 目录', title: 'SKU 目录', description: '维护平台可售权益；支付服务商只映射到 SKU。', admin: true },
  'skus-new': { eyebrow: '商品与权益 / SKU', title: '新增 SKU', description: '创建计划商品或 Credits 增量包。', admin: true },
  'skus-edit': { eyebrow: '商品与权益 / SKU', title: '编辑 SKU', description: '调整商品定义、权益周期与在售状态。', admin: true },
  subscriptions: { eyebrow: '商业中心 / 生命周期', title: '订阅', description: '查看独立于支付服务商的订阅状态机。', admin: true },
  orders: { eyebrow: '商业中心 / 交易', title: '订单', description: '查看各支付服务商产生的统一订单。', admin: true },
  'order-detail': { eyebrow: '商业中心 / 订单', title: '订单详情', description: '查看支付、SKU、交付和核销闭环。', admin: true },
  payments: { eyebrow: '商业中心 / 交易', title: '支付', description: '追踪各支付服务商的资金交易状态。', admin: true },
  users: { eyebrow: '商业中心 / 客户', title: '用户', description: '查看平台账户、身份和系统角色。', admin: true },
  logs: { eyebrow: '系统 / 审计', title: '活动日志', description: '审计平台内的重要业务操作。', admin: true },
  afdian: { eyebrow: '爱发电 / 商品', title: '商品映射', description: '连接爱发电方案或 SKU 与本地商品目录。', admin: true },
  'afdian-new': { eyebrow: '爱发电 / 商品映射', title: '新增映射', description: '建立一个爱发电商品到本地 SKU 的履约规则。', admin: true },
  'afdian-edit': { eyebrow: '爱发电 / 商品映射', title: '编辑映射', description: '修改现有商品映射及其启用状态。', admin: true },
  'afdian-orders': { eyebrow: '爱发电 / 履约', title: '渠道订单', description: '追踪订单、兑换码、私信送达和核销状态。', admin: true },
  'afdian-order-detail': { eyebrow: '爱发电 / 渠道订单', title: '订单详情', description: '查看爱发电订单对应的权益履约闭环。', admin: true },
  'afdian-events': { eyebrow: '爱发电 / 接入', title: 'Webhook 事件', description: '追踪事件接收、匹配和幂等处理结果。', admin: true },
  docs: { eyebrow: '开发者', title: 'API 文档', description: '查看当前可用接口、鉴权方式及接入示例。' },
}

export function visibleWorkspaceGroups(isAdmin: boolean) {
  return workspaceNavGroups.filter((group) => !group.admin || isAdmin)
}

export function activeWorkspaceGroup(route: WorkspaceRoute, isAdmin: boolean) {
  return visibleWorkspaceGroups(isAdmin).find((group) => group.items.some((item) => item.active.includes(route)))
}
