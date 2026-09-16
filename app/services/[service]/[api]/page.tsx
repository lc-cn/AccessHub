import { WorkspacePage } from '@/components/access-hub/workspace-page'
export default async function Page({ params }: { params: Promise<{ service: string; api: string }> }) { const value = await params; return <WorkspacePage route="catalog-api" resourceId={`${value.service}:${value.api}`}/> }
