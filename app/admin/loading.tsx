export default function Loading() {
  return <div className="min-h-dvh bg-[#f3f6fb] text-[#172033]">
    <aside className="fixed inset-y-0 left-0 hidden w-[272px] border-r border-[#e3e9f3] bg-white p-6 lg:block"><div className="h-9 w-36 animate-pulse rounded-xl bg-slate-100"/><div className="mt-9 space-y-6">{[2, 3, 4].map((count) => <div key={count}><div className="mb-2 h-2 w-16 animate-pulse rounded bg-slate-100"/>{Array.from({ length: count }).map((_, index) => <div key={index} className="mb-1 h-10 animate-pulse rounded-xl bg-slate-50"/>)}</div>)}</div></aside>
    <main className="lg:pl-[272px]"><header className="h-[76px] border-b border-[#e3e9f3] bg-white"/><div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 lg:px-10"><div className="h-4 w-80 animate-pulse rounded bg-slate-200"/><div className="mt-8 grid animate-pulse gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="h-96 rounded-[22px] bg-white"/><div className="h-64 rounded-[22px] bg-white"/></div></div></main>
  </div>
}
