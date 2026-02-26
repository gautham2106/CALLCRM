'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/use-toast'
import { Plus, Trash2, GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react'

interface Course {
  id: string
  course_name: string
  is_active: boolean
  created_at: string
}

interface Props {
  initialCourses: Course[]
  collegeId: string
  adminId: string
}

export function CoursesClient({ initialCourses, collegeId, adminId }: Props) {
  const supabase = createClient()
  const [courses, setCourses] = useState(initialCourses)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Course | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = courseName.trim()
    if (!trimmed) return
    if (courses.some((c) => c.course_name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: 'Duplicate', description: 'A course with this name already exists.', variant: 'destructive' })
      return
    }
    setAdding(true)
    const { data, error } = await supabase
      .from('courses')
      .insert({ college_id: collegeId, course_name: trimmed, created_by: adminId })
      .select()
      .single()
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setCourses((prev) => [...prev, data as Course])
      toast({ title: 'Course added', variant: 'success' })
      setCourseName('')
      setShowAddDialog(false)
    }
    setAdding(false)
  }

  const toggleActive = async (course: Course) => {
    const { error } = await supabase
      .from('courses')
      .update({ is_active: !course.is_active })
      .eq('id', course.id)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setCourses((prev) => prev.map((c) => c.id === course.id ? { ...c, is_active: !c.is_active } : c))
    }
  }

  const handleDelete = async (course: Course) => {
    setDeletingId(course.id)
    const { error } = await supabase.from('courses').delete().eq('id', course.id)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      setCourses((prev) => prev.filter((c) => c.id !== course.id))
      toast({ title: 'Course deleted', variant: 'success' })
    }
    setDeletingId(null)
    setShowDeleteConfirm(null)
  }

  const active = courses.filter((c) => c.is_active)
  const inactive = courses.filter((c) => !c.is_active)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage the courses counsellors can assign to leads</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Course
          </Button>
        </div>

        {/* Active courses */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-blue-500" />
            <h2 className="font-semibold text-gray-800 text-sm">Active Courses</h2>
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{active.length}</span>
          </div>
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <GraduationCap className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No courses yet</p>
              <p className="text-xs mt-1">Click "Add Course" to get started</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {active.map((course) => (
                <li key={course.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="flex-1 font-medium text-gray-800 text-sm">{course.course_name}</span>
                  <button
                    onClick={() => toggleActive(course)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                    title="Hide course"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(course)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete course"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hidden/inactive courses */}
        {inactive.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-gray-500 text-sm">Hidden Courses</h2>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{inactive.length}</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {inactive.map((course) => (
                <li key={course.id} className="flex items-center gap-3 px-5 py-3.5 opacity-60">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4 text-gray-400" />
                  </div>
                  <span className="flex-1 font-medium text-gray-500 text-sm">{course.course_name}</span>
                  <button
                    onClick={() => toggleActive(course)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors opacity-100"
                    title="Show course"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(course)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-100"
                    title="Delete course"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Add Course Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Course</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="course-name">Course Name</Label>
              <Input
                id="course-name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g. B.Tech CSE, MBA, MBBS..."
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={adding || !courseName.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Course?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>"{showDeleteConfirm?.course_name}"</strong>?
            Existing leads that used this course will keep their course name but lose the course link.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!!deletingId}
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
