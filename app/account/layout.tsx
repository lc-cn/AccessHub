import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { AccountShell } from '@/components/account/account-shell'

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
