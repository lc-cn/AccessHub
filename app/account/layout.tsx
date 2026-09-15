import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { AccountShell } from '@/components/account/account-shell'

export const metadata = {
  title: '个人中心 · AccessHub',
  description: '管理 AccessHub 账户、安全、订阅权益、API 用量和订单。',
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) {
    const requestedPath = (await headers()).get('x-accesshub-request-path')
    const next = requestedPath?.startsWith('/account') && !requestedPath.startsWith('//')
      ? requestedPath
      : '/account'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }
  return <AccountShell user={{ name: session.user.name, email: session.user.email, image: session.user.image }}>{children}</AccountShell>
}
