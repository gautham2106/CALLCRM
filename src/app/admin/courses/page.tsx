import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CoursesClient } from '@/components/admin/CoursesClient'

export default async function CoursesPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('id, course_name, is_active, created_at')
    .eq('college_id', user.college_id!)
    .order('created_at')

  return (
    <CoursesClient
      initialCourses={courses || []}
      collegeId={user.college_id!}
      adminId={user.id}
    />
  )
}
