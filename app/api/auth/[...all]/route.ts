import { auth } from '@/lib/auth'
import { getRbacOAuthConfig } from '@/lib/rbac-oauth'
import { toNextJsHandler } from 'better-auth/next-js'
const handlers = toNextJsHandler(auth)
export const GET = handlers.GET
export async function POST(request: Request) {
  if (new URL(request.url).pathname.endsWith('/sign-in/social')) {
    const config = getRbacOAuthConfig()
    const context = await auth.$context
    console.info('RBAC request diagnostics', { configured: Boolean(config), plugins: auth.options.plugins?.map(p => p.id), providers: context.socialProviders.map(p => p.id) })
    if (config?.discoveryUrl) {
      const response = await fetch(config.discoveryUrl)
      console.info('RBAC discovery diagnostics', { status: response.status, type: response.headers.get('content-type') })
    }
  }
  return handlers.POST(request)
}
