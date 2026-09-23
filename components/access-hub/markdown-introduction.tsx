import ReactMarkdown from 'react-markdown'

export function MarkdownIntroduction({ value }: { value: string }) {
  return <div className="space-y-3 break-words text-sm leading-7 text-slate-600">
    <ReactMarkdown components={{
      h1: ({ children }) => <h3 className="pt-2 text-xl font-semibold text-slate-800">{children}</h3>,
      h2: ({ children }) => <h4 className="pt-2 text-lg font-semibold text-slate-800">{children}</h4>,
      h3: ({ children }) => <h5 className="pt-2 font-semibold text-slate-800">{children}</h5>,
      p: ({ children }) => <p>{children}</p>,
      ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
      blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-200 pl-4 text-slate-500">{children}</blockquote>,
      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#3157d5] underline underline-offset-2">{children}</a>,
      code: ({ children }) => <code className="rounded bg-slate-100 px-1 font-mono text-xs">{children}</code>,
      pre: ({ children }) => <pre className="overflow-x-auto rounded-xl bg-slate-100 p-4 text-xs">{children}</pre>,
      img: ({ alt }) => <span className="text-slate-400">[图片：{alt || '未命名'}]</span>,
    }}>{value}</ReactMarkdown>
  </div>
}
