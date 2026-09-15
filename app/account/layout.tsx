import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) {
    const requestedPath = (await headers()).get('x-accesshub-request-path')
    const next = requestedPath?.startsWith('/account') && !requestedPath.startsWith('//')
      ? requestedPath
      : '/account'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }
  return <>{children}</>
}
