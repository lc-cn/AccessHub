import { WorkspacePage } from '@/components/access-hub/workspace-page'
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <WorkspacePage route="service-api-new" resourceId={(await params).id}/> }
