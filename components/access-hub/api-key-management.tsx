'use client'

import { useEffect, useState } from 'react'
import { ApiKeyManager, type ApiKeyItem } from '@/components/account/api-key-manager'
import { requestJson } from '@/lib/http-client'
import { WorkspaceSkeleton } from './workspace-shell'

type ApiKeyResponse = {
  apiKeys: ApiKeyItem[]
}

export function ApiKeyManagement() {
  const [data, setData] = useState<ApiKeyResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    requestJson<ApiKeyResponse>('/api/account/api-keys', { cache: 'no-store' })
      .then((result) => { if (active) setData(result) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '读取 API Key 失败，请稍后重试。') })
    return () => { active = false }
  }, [])

  if (error) return <div role="alert" className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
  if (!data) return <WorkspaceSkeleton/>
  return <ApiKeyManager initialKeys={data.apiKeys}/>
}
