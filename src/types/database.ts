export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type LeadStage =
  | 'New Enquiry'
  | 'Contacted'
  | 'Visit Scheduled'
  | 'Visit Done'
  | 'Application Started'
  | 'Enrolled'
  | 'Cold Lead'
  | 'Wrong Lead'

export type CallStage =
  | 'Call Picked'
  | 'Interested'
  | 'Not Interested'
  | 'Call Not Picked'
  | 'Call Later'

export type UserRole = 'admin' | 'team_leader' | 'counsellor'
export type FieldType = 'text' | 'number' | 'phone' | 'dropdown' | 'date' | 'checkbox' | 'textarea'
export type NotificationType = 'new_lead' | 'bulk_leads' | 'reassigned'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string | null
          name: string
          email: string
          phone: string | null
          role: UserRole
          college_id: string | null
          team_leader_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_id?: string | null
          name: string
          email: string
          phone?: string | null
          role: UserRole
          college_id?: string | null
          team_leader_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      colleges: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          logo_url: string | null
          subscription_plan: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          logo_url?: string | null
          subscription_plan?: string
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['colleges']['Insert']>
      }
      leads: {
        Row: {
          id: string
          college_id: string
          name: string
          phone: string
          email: string | null
          city: string | null
          school_name: string | null
          course_interest: string | null
          source_id: string | null
          source_name: string | null
          current_lead_stage: LeadStage
          current_call_stage: CallStage | null
          assigned_to: string | null
          visit_date: string | null
          follow_up_date: string | null
          notes: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          college_id: string
          name: string
          phone: string
          email?: string | null
          city?: string | null
          school_name?: string | null
          course_interest?: string | null
          source_id?: string | null
          source_name?: string | null
          current_lead_stage?: LeadStage
          current_call_stage?: CallStage | null
          assigned_to?: string | null
          visit_date?: string | null
          follow_up_date?: string | null
          notes?: string | null
          is_active?: boolean
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['leads']['Insert']>
      }
      call_diary: {
        Row: {
          id: string
          lead_id: string
          college_id: string
          called_by: string
          call_stage: CallStage
          lead_stage_at_time: string
          notes: string | null
          follow_up_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          college_id: string
          called_by: string
          call_stage: CallStage
          lead_stage_at_time: string
          notes?: string | null
          follow_up_date?: string | null
        }
        Update: Partial<Database['public']['Tables']['call_diary']['Insert']>
      }
      lead_assignment_history: {
        Row: {
          id: string
          lead_id: string
          college_id: string
          assigned_from: string | null
          assigned_to: string
          assigned_by: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          college_id: string
          assigned_from?: string | null
          assigned_to: string
          assigned_by: string
          reason?: string | null
        }
        Update: Partial<Database['public']['Tables']['lead_assignment_history']['Insert']>
      }
      custom_field_definitions: {
        Row: {
          id: string
          college_id: string
          field_name: string
          field_type: FieldType
          dropdown_options: Json
          is_required: boolean
          display_order: number
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          college_id: string
          field_name: string
          field_type: FieldType
          dropdown_options?: Json
          is_required?: boolean
          display_order?: number
          is_active?: boolean
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['custom_field_definitions']['Insert']>
      }
      custom_field_values: {
        Row: {
          id: string
          lead_id: string
          field_id: string
          college_id: string
          value: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          field_id: string
          college_id: string
          value?: string | null
          updated_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['custom_field_values']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          college_id: string
          type: NotificationType
          message: string
          lead_id: string | null
          bulk_count: number | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          college_id: string
          type: NotificationType
          message: string
          lead_id?: string | null
          bulk_count?: number | null
          is_read?: boolean
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      lead_sources: {
        Row: {
          id: string
          college_id: string
          source_name: string
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          college_id: string
          source_name: string
          is_active?: boolean
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['lead_sources']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Extended types with joins
export interface LeadWithDetails {
  id: string
  college_id: string
  name: string
  phone: string
  email: string | null
  city: string | null
  school_name: string | null
  course_interest: string | null
  source_name: string | null
  current_lead_stage: LeadStage
  current_call_stage: CallStage | null
  visit_date: string | null
  follow_up_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  assigned_to: string | null
  assigned_user?: {
    id: string
    name: string
    email: string
  } | null
  created_by: string | null
}

export interface UserProfile {
  id: string
  auth_id: string | null
  name: string
  email: string
  phone: string | null
  role: UserRole
  college_id: string | null
  team_leader_id: string | null
  is_active: boolean
}
