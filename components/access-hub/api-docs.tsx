import { ArrowUpRight, Braces, KeyRound, ShieldCheck } from 'lucide-react'

const endpoints = [
  { method: 'POST', path: '/api/gateway', title: '验证访问权限', description: '验证当前会话对应用户组的频率与每日配额。' },
  { method: 'POST', path: '/api/redeem', title: '核销兑换码', description: '将有效兑换码绑定到当前登录账户。' },
  { method: 'GET', path: '/api/dashboard', title: '读取工作台', description: '返回当前账户、用量、权益和用户组摘要。' },
]

export function ApiDocs() {
  return <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section><p className="text-xs font-medium tracking-wide text-[#3157d5]">API reference</p><h2 className="mt-1 text-3xl font-semibold tracking-[-.03em]">接入 AccessHub</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">所有账户级接口均使用当前 GitHub 登录会话。网关成功响应后会记入当天调用量。</p>
      <div className="mt-8 space-y-3">{endpoints.map((endpoint) => <article key={endpoint.path} className="group rounded-[18px] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(39,55,92,.07)]"><div className="flex items-start gap-4"><span className={`mt-0.5 rounded-md px-2 py-1 font-mono text-[10px] font-semibold ${endpoint.method === 'GET' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#edf2ff] text-[#3157d5]'}`}>{endpoint.method}</span><div className="min-w-0"><code className="text-sm font-semibold text-slate-700">{endpoint.path}</code><h3 className="mt-3 text-sm font-medium">{endpoint.title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{endpoint.description}</p></div><ArrowUpRight size={15} className="ml-auto text-slate-300 transition group-hover:text-[#3157d5]"/></div></article>)}</div>
    </section>
    <aside className="space-y-4"><article className="rounded-[22px] bg-[#182238] p-6 text-white"><Braces size={20} className="text-[#91a7f3]"/><h3 className="mt-5 font-semibold">请求示例</h3><pre className="mt-4 overflow-x-auto rounded-xl bg-black/15 p-4 text-xs leading-6 text-slate-300"><code>{`const response = await fetch(
  '/api/gateway',
  { method: 'POST' }
)

if (response.status === 429) {
  // 当前频率或配额已用尽
}`}</code></pre></article><article className="rounded-[20px] bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck size={17}/></span><div><h3 className="text-sm font-medium">会话安全</h3><p className="mt-0.5 text-xs text-slate-400">Cookie 由 Better Auth 管理</p></div></div></article><article className="rounded-[20px] bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3157d5]"><KeyRound size={17}/></span><div><h3 className="text-sm font-medium">身份标识</h3><p className="mt-0.5 text-xs text-slate-400">UID 可在概览页复制</p></div></div></article></aside>
  </div>
}
