import { WorkspacePage } from '@/components/access-hub/workspace-page'
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <WorkspacePage route="order-detail" resourceId={(await params).id}/> }
