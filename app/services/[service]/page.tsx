import { WorkspacePage } from '@/components/access-hub/workspace-page'
export default async function Page({ params }: { params: Promise<{ service: string }> }) { return <WorkspacePage route="catalog-service" resourceId={(await params).service}/> }
