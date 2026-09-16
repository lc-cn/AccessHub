import { WorkspacePage } from '@/components/access-hub/workspace-page'

export default async function PermissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorkspacePage route="permissions-edit" resourceId={id}/>
}
