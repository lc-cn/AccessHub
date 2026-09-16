import { WorkspacePage } from '@/components/access-hub/workspace-page'
export default async function Page({ params }: { params: Promise<{ id: string; apiId: string }> }) { const value = await params; return <WorkspacePage route="service-api-edit" resourceId={`${value.id}:${value.apiId}`}/> }
