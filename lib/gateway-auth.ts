export const GATEWAY_API_KEY_QUERY_PARAM = 'key'

export function getGatewayApiKey(request: Request) {
  const authorization = request.headers.get('authorization')
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearer) return bearer
  const queryKey = new URL(request.url).searchParams.get(GATEWAY_API_KEY_QUERY_PARAM)?.trim()
  return queryKey || null
}
