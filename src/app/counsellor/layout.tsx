import { CounsellorSidebar } from '@/components/layout/CounsellorSidebar'
import { requireCounsellor } from '@/lib/auth'

export default async function CounsellorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireCounsellor()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <CounsellorSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
