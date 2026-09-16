import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'

export const metadata = {
  title: '管理工作区 · AccessHub',
  description: '管理 AccessHub 的商品、权益、订单与支付服务商。',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect('/login?next=%2Fadmin')

  const [account] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1)
  if (account?.role !== 'admin') redirect('/dashboard')

  return children
}
