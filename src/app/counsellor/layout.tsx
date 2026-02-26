import { CounsellorShell } from '@/components/layout/CounsellorShell'
import { requireCounsellor } from '@/lib/auth'

export default async function CounsellorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireCounsellor()

  return (
    <CounsellorShell>
      {children}
    </CounsellorShell>
  )
}
