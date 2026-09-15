import { WorkspacePage } from '@/components/access-hub/workspace-page'
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <WorkspacePage route="afdian-order-detail" resourceId={(await params).id}/> }
