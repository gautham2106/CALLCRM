import { AdminShell } from '@/components/layout/AdminShell'
import { requireAdminOrTeamLeader } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAdminOrTeamLeader()

  return (
    <AdminShell userRole={user.role}>
      {children}
    </AdminShell>
  )
}
