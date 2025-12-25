export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      academies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          student_id: string
          tenant_id: string | null
          travel_time: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          student_id: string
          tenant_id?: string | null
          travel_time?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          student_id?: string
          tenant_id?: string | null
          travel_time?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academies_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_schedules: {
        Row: {
          academy_id: string
          academy_name: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          plan_group_id: string | null
          start_time: string
          student_id: string
          subject: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          academy_name?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          plan_group_id?: string | null
          start_time: string
          student_id: string
          subject?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          academy_name?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          plan_group_id?: string | null
          start_time?: string
          student_id?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_schedules_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_schedules_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_schedules_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          role: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_qr_codes: {
        Row: {
          created_at: string | null
          created_by: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          qr_code_url: string | null
          qr_data: string
          tenant_id: string
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          qr_code_url?: string | null
          qr_data: string
          tenant_id: string
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          qr_code_url?: string | null
          qr_data?: string
          tenant_id?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_qr_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_record_history: {
        Row: {
          after_data: Json
          attendance_record_id: string
          before_data: Json
          created_at: string | null
          id: string
          modified_at: string
          modified_by: string
          reason: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          after_data: Json
          attendance_record_id: string
          before_data: Json
          created_at?: string | null
          id?: string
          modified_at?: string
          modified_by: string
          reason: string
          student_id: string
          tenant_id: string
        }
        Update: {
          after_data?: Json
          attendance_record_id?: string
          before_data?: Json
          created_at?: string | null
          id?: string
          modified_at?: string
          modified_by?: string
          reason?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_record_history_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          check_in_method: string | null
          check_in_time: string | null
          check_out_method: string | null
          check_out_time: string | null
          created_at: string | null
          id: string
          notes: string | null
          status: string | null
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          attendance_date: string
          check_in_method?: string | null
          check_in_time?: string | null
          check_out_method?: string | null
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          attendance_date?: string
          check_in_method?: string | null
          check_in_time?: string | null
          check_out_method?: string | null
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string
          actor_role: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          resource_id: string | null
          resource_name: string | null
          resource_type: string
          success: boolean
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id: string
          actor_role: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type: string
          success?: boolean
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string
          actor_role?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string
          success?: boolean
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      book_details: {
        Row: {
          book_id: string
          created_at: string | null
          display_order: number
          id: string
          major_unit: string | null
          minor_unit: string | null
          page_number: number
        }
        Insert: {
          book_id: string
          created_at?: string | null
          display_order?: number
          id?: string
          major_unit?: string | null
          minor_unit?: string | null
          page_number: number
        }
        Update: {
          book_id?: string
          created_at?: string | null
          display_order?: number
          id?: string
          major_unit?: string | null
          minor_unit?: string | null
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_details_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "master_books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_subject_mapping: {
        Row: {
          curriculum_revision_id: string | null
          id: string
          keyword: string
          subject_group_id: string
          updated_at: string | null
        }
        Insert: {
          curriculum_revision_id?: string | null
          id?: string
          keyword: string
          subject_group_id: string
          updated_at?: string | null
        }
        Update: {
          curriculum_revision_id?: string | null
          id?: string
          keyword?: string
          subject_group_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string | null
          chapter_info: Json | null
          content_category: string | null
          cover_image_url: string | null
          created_at: string | null
          curriculum_revision_id: string | null
          description: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          edition: string | null
          grade_max: number | null
          grade_min: number | null
          id: string
          is_active: boolean | null
          isbn_10: string | null
          isbn_13: string | null
          latest_version: string | null
          master_content_id: string | null
          notes: string | null
          ocr_data: Json | null
          overall_difficulty: number | null
          page_analysis: Json | null
          pdf_url: string | null
          published_date: string | null
          publisher: string | null
          publisher_id: string | null
          publisher_name: string | null
          publisher_review: string | null
          revision: string | null
          school_type: string | null
          semester: string | null
          series_name: string | null
          source: string | null
          source_product_code: string | null
          source_url: string | null
          student_id: string | null
          subject: string | null
          subject_category: string | null
          subject_group_id: string | null
          subject_id: string | null
          subtitle: string | null
          tags: string[] | null
          target_exam_type: string[] | null
          tenant_id: string
          title: string
          toc: string | null
          total_pages: number | null
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          chapter_info?: Json | null
          content_category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          edition?: string | null
          grade_max?: number | null
          grade_min?: number | null
          id?: string
          is_active?: boolean | null
          isbn_10?: string | null
          isbn_13?: string | null
          latest_version?: string | null
          master_content_id?: string | null
          notes?: string | null
          ocr_data?: Json | null
          overall_difficulty?: number | null
          page_analysis?: Json | null
          pdf_url?: string | null
          published_date?: string | null
          publisher?: string | null
          publisher_id?: string | null
          publisher_name?: string | null
          publisher_review?: string | null
          revision?: string | null
          school_type?: string | null
          semester?: string | null
          series_name?: string | null
          source?: string | null
          source_product_code?: string | null
          source_url?: string | null
          student_id?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          subtitle?: string | null
          tags?: string[] | null
          target_exam_type?: string[] | null
          tenant_id: string
          title: string
          toc?: string | null
          total_pages?: number | null
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          chapter_info?: Json | null
          content_category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          edition?: string | null
          grade_max?: number | null
          grade_min?: number | null
          id?: string
          is_active?: boolean | null
          isbn_10?: string | null
          isbn_13?: string | null
          latest_version?: string | null
          master_content_id?: string | null
          notes?: string | null
          ocr_data?: Json | null
          overall_difficulty?: number | null
          page_analysis?: Json | null
          pdf_url?: string | null
          published_date?: string | null
          publisher?: string | null
          publisher_id?: string | null
          publisher_name?: string | null
          publisher_review?: string | null
          revision?: string | null
          school_type?: string | null
          semester?: string | null
          series_name?: string | null
          source?: string | null
          source_product_code?: string | null
          source_url?: string | null
          student_id?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          subtitle?: string | null
          tags?: string[] | null
          target_exam_type?: string[] | null
          tenant_id?: string
          title?: string
          toc?: string | null
          total_pages?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_master_content_id_fkey"
            columns: ["master_content_id"]
            isOneToOne: false
            referencedRelation: "master_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_books_difficulty_level_id"
            columns: ["difficulty_level_id"]
            isOneToOne: false
            referencedRelation: "difficulty_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_invitations: {
        Row: {
          accepted_at: string | null
          camp_template_id: string
          created_at: string | null
          declined_at: string | null
          expires_at: string | null
          id: string
          invited_at: string | null
          status: string | null
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          camp_template_id: string
          created_at?: string | null
          declined_at?: string | null
          expires_at?: string | null
          id?: string
          invited_at?: string | null
          status?: string | null
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          camp_template_id?: string
          created_at?: string | null
          declined_at?: string | null
          expires_at?: string | null
          id?: string
          invited_at?: string | null
          status?: string | null
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camp_invitations_camp_template_id_fkey"
            columns: ["camp_template_id"]
            isOneToOne: false
            referencedRelation: "camp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_invitations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_template_block_sets: {
        Row: {
          camp_template_id: string
          created_at: string
          id: string
          tenant_block_set_id: string
        }
        Insert: {
          camp_template_id: string
          created_at?: string
          id?: string
          tenant_block_set_id: string
        }
        Update: {
          camp_template_id?: string
          created_at?: string
          id?: string
          tenant_block_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_template_block_sets_camp_template_id_fkey"
            columns: ["camp_template_id"]
            isOneToOne: true
            referencedRelation: "camp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_template_block_sets_tenant_block_set_id_fkey"
            columns: ["tenant_block_set_id"]
            isOneToOne: false
            referencedRelation: "tenant_block_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_templates: {
        Row: {
          camp_end_date: string | null
          camp_location: string | null
          camp_start_date: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          program_type: string | null
          reminder_settings: Json | null
          slot_templates: Json | null
          status: string | null
          template_data: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          camp_end_date?: string | null
          camp_location?: string | null
          camp_start_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          program_type?: string | null
          reminder_settings?: Json | null
          slot_templates?: Json | null
          status?: string | null
          template_data: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          camp_end_date?: string | null
          camp_location?: string | null
          camp_start_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          program_type?: string | null
          reminder_settings?: Json | null
          slot_templates?: Json | null
          status?: string | null
          template_data?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camp_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      career_fields: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_subjects: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          subject_category_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject_category_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject_category_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      curriculum_revisions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
      difficulty_levels: {
        Row: {
          content_type: string
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          content_type: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      district_office: {
        Row: {
          created_at: string | null
          district_name: string
          id: number
          office_id: number | null
        }
        Insert: {
          created_at?: string | null
          district_name: string
          id?: number
          office_id?: number | null
        }
        Update: {
          created_at?: string | null
          district_name?: string
          id?: number
          office_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "district_office_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "edu_office"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_office: {
        Row: {
          created_at: string | null
          id: number
          office_name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          office_name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          office_name?: string
        }
        Relationships: []
      }
      excluded_dates: {
        Row: {
          created_at: string | null
          date: string
          id: string
          reason: string | null
          student_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          reason?: string | null
          student_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "excluded_dates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_conversion_rules: {
        Row: {
          converted_percentile: number
          created_at: string
          curriculum_revision_id: string
          grade_level: number
          id: string
          updated_at: string
        }
        Insert: {
          converted_percentile: number
          created_at?: string
          curriculum_revision_id: string
          grade_level: number
          id?: string
          updated_at?: string
        }
        Update: {
          converted_percentile?: number
          created_at?: string
          curriculum_revision_id?: string
          grade_level?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_conversion_rules_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_episodes: {
        Row: {
          created_at: string | null
          display_order: number
          duration: number | null
          episode_number: number
          episode_title: string | null
          id: string
          lecture_id: string | null
          lecture_source_url: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          duration?: number | null
          episode_number: number
          episode_title?: string | null
          id?: string
          lecture_id?: string | null
          lecture_source_url?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          duration?: number | null
          episode_number?: number
          episode_title?: string | null
          id?: string
          lecture_id?: string | null
          lecture_source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lecture_episodes_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "master_lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          chapter_info: Json | null
          content_category: string | null
          cover_image_url: string | null
          created_at: string | null
          curriculum_revision_id: string | null
          description: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          duration: number | null
          episode_analysis: Json | null
          grade_level: string | null
          id: string
          instructor_name: string | null
          is_active: boolean | null
          latest_version: string | null
          lecture_source_url: string | null
          lecture_type: string | null
          linked_book_id: string | null
          master_content_id: string | null
          master_lecture_id: string | null
          notes: string | null
          overall_difficulty: number | null
          platform: string | null
          platform_id: string | null
          revision: string | null
          semester: string | null
          series_name: string | null
          source: string | null
          source_product_code: string | null
          student_id: string | null
          subject: string | null
          subject_category: string | null
          subject_group_id: string | null
          subject_id: string | null
          subtitle: string | null
          tags: string[] | null
          target_exam_type: string[] | null
          tenant_id: string
          title: string
          toc: string | null
          total_duration: number | null
          total_episodes: number | null
          transcript: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          chapter_info?: Json | null
          content_category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          duration?: number | null
          episode_analysis?: Json | null
          grade_level?: string | null
          id?: string
          instructor_name?: string | null
          is_active?: boolean | null
          latest_version?: string | null
          lecture_source_url?: string | null
          lecture_type?: string | null
          linked_book_id?: string | null
          master_content_id?: string | null
          master_lecture_id?: string | null
          notes?: string | null
          overall_difficulty?: number | null
          platform?: string | null
          platform_id?: string | null
          revision?: string | null
          semester?: string | null
          series_name?: string | null
          source?: string | null
          source_product_code?: string | null
          student_id?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          subtitle?: string | null
          tags?: string[] | null
          target_exam_type?: string[] | null
          tenant_id: string
          title: string
          toc?: string | null
          total_duration?: number | null
          total_episodes?: number | null
          transcript?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          chapter_info?: Json | null
          content_category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          duration?: number | null
          episode_analysis?: Json | null
          grade_level?: string | null
          id?: string
          instructor_name?: string | null
          is_active?: boolean | null
          latest_version?: string | null
          lecture_source_url?: string | null
          lecture_type?: string | null
          linked_book_id?: string | null
          master_content_id?: string | null
          master_lecture_id?: string | null
          notes?: string | null
          overall_difficulty?: number | null
          platform?: string | null
          platform_id?: string | null
          revision?: string | null
          semester?: string | null
          series_name?: string | null
          source?: string | null
          source_product_code?: string | null
          student_id?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          subtitle?: string | null
          tags?: string[] | null
          target_exam_type?: string[] | null
          tenant_id?: string
          title?: string
          toc?: string | null
          total_duration?: number | null
          total_episodes?: number | null
          transcript?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_lectures_difficulty_level_id"
            columns: ["difficulty_level_id"]
            isOneToOne: false
            referencedRelation: "difficulty_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_linked_book_id_fkey"
            columns: ["linked_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_master_content_id_fkey"
            columns: ["master_content_id"]
            isOneToOne: false
            referencedRelation: "master_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_master_lecture_id_fkey"
            columns: ["master_lecture_id"]
            isOneToOne: false
            referencedRelation: "master_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      make_scenario_logs: {
        Row: {
          error_message: string | null
          executed_at: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          scenario_type: string
          status: string
          student_id: string | null
          tenant_id: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          scenario_type: string
          status: string
          student_id?: string | null
          tenant_id: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          scenario_type?: string
          status?: string
          student_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "make_scenario_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "make_scenario_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_books: {
        Row: {
          author: string | null
          content_category: string | null
          cover_image_url: string | null
          created_at: string | null
          curriculum_revision_id: string | null
          description: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          edition: string | null
          grade_max: number | null
          grade_min: number | null
          id: string
          is_active: boolean
          isbn_10: string | null
          isbn_13: string | null
          notes: string | null
          ocr_data: Json | null
          overall_difficulty: number | null
          page_analysis: Json | null
          pdf_url: string | null
          published_date: string | null
          publisher_id: string | null
          publisher_name: string | null
          publisher_review: string | null
          revision: string | null
          school_type: string | null
          series_name: string | null
          source: string | null
          source_product_code: string | null
          source_url: string | null
          subject: string | null
          subject_category: string | null
          subject_group_id: string | null
          subject_id: string | null
          subtitle: string | null
          tags: string[] | null
          target_exam_type: string[] | null
          tenant_id: string | null
          title: string
          toc: string | null
          total_pages: number | null
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          content_category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          edition?: string | null
          grade_max?: number | null
          grade_min?: number | null
          id?: string
          is_active?: boolean
          isbn_10?: string | null
          isbn_13?: string | null
          notes?: string | null
          ocr_data?: Json | null
          overall_difficulty?: number | null
          page_analysis?: Json | null
          pdf_url?: string | null
          published_date?: string | null
          publisher_id?: string | null
          publisher_name?: string | null
          publisher_review?: string | null
          revision?: string | null
          school_type?: string | null
          series_name?: string | null
          source?: string | null
          source_product_code?: string | null
          source_url?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          subtitle?: string | null
          tags?: string[] | null
          target_exam_type?: string[] | null
          tenant_id?: string | null
          title: string
          toc?: string | null
          total_pages?: number | null
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          content_category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          edition?: string | null
          grade_max?: number | null
          grade_min?: number | null
          id?: string
          is_active?: boolean
          isbn_10?: string | null
          isbn_13?: string | null
          notes?: string | null
          ocr_data?: Json | null
          overall_difficulty?: number | null
          page_analysis?: Json | null
          pdf_url?: string | null
          published_date?: string | null
          publisher_id?: string | null
          publisher_name?: string | null
          publisher_review?: string | null
          revision?: string | null
          school_type?: string | null
          series_name?: string | null
          source?: string | null
          source_product_code?: string | null
          source_url?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          subtitle?: string | null
          tags?: string[] | null
          target_exam_type?: string[] | null
          tenant_id?: string | null
          title?: string
          toc?: string | null
          total_pages?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_master_books_difficulty_level_id"
            columns: ["difficulty_level_id"]
            isOneToOne: false
            referencedRelation: "difficulty_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_books_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_books_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_books_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_books_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_books_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_custom_contents: {
        Row: {
          content_category: string | null
          content_type: string | null
          created_at: string | null
          curriculum_revision_id: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          id: string
          notes: string | null
          revision: string | null
          subject: string | null
          subject_category: string | null
          subject_group_id: string | null
          subject_id: string | null
          tenant_id: string | null
          title: string
          total_page_or_time: number | null
          updated_at: string | null
        }
        Insert: {
          content_category?: string | null
          content_type?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          id?: string
          notes?: string | null
          revision?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          tenant_id?: string | null
          title: string
          total_page_or_time?: number | null
          updated_at?: string | null
        }
        Update: {
          content_category?: string | null
          content_type?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          id?: string
          notes?: string | null
          revision?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          tenant_id?: string | null
          title?: string
          total_page_or_time?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_master_custom_contents_difficulty_level_id"
            columns: ["difficulty_level_id"]
            isOneToOne: false
            referencedRelation: "difficulty_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_custom_contents_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_custom_contents_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_custom_contents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_custom_contents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_lectures: {
        Row: {
          content_category: string | null
          created_at: string | null
          curriculum_revision_id: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          episode_analysis: Json | null
          grade_level: string | null
          id: string
          instructor_name: string | null
          is_active: boolean
          lecture_source_url: string | null
          lecture_type: string | null
          linked_book_id: string | null
          notes: string | null
          overall_difficulty: number | null
          platform: string | null
          platform_id: string | null
          revision: string | null
          subject: string | null
          subject_category: string | null
          subject_group_id: string | null
          subject_id: string | null
          tenant_id: string | null
          title: string
          total_duration: number | null
          total_episodes: number
          transcript: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          content_category?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          episode_analysis?: Json | null
          grade_level?: string | null
          id?: string
          instructor_name?: string | null
          is_active?: boolean
          lecture_source_url?: string | null
          lecture_type?: string | null
          linked_book_id?: string | null
          notes?: string | null
          overall_difficulty?: number | null
          platform?: string | null
          platform_id?: string | null
          revision?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          tenant_id?: string | null
          title: string
          total_duration?: number | null
          total_episodes: number
          transcript?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          content_category?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          episode_analysis?: Json | null
          grade_level?: string | null
          id?: string
          instructor_name?: string | null
          is_active?: boolean
          lecture_source_url?: string | null
          lecture_type?: string | null
          linked_book_id?: string | null
          notes?: string | null
          overall_difficulty?: number | null
          platform?: string | null
          platform_id?: string | null
          revision?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          tenant_id?: string | null
          title?: string
          total_duration?: number | null
          total_episodes?: number
          transcript?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_master_lectures_difficulty_level_id"
            columns: ["difficulty_level_id"]
            isOneToOne: false
            referencedRelation: "difficulty_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lectures_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lectures_linked_book_id_fkey"
            columns: ["linked_book_id"]
            isOneToOne: false
            referencedRelation: "master_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lectures_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lectures_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lectures_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lectures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          read_at: string | null
          tenant_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          tenant_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          is_approved: boolean | null
          parent_id: string
          relation: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          parent_id: string
          relation: string
          student_id: string
          tenant_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          parent_id?: string
          relation?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_users: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          category: string
          created_at: string
          default_allowed_for_consultant: boolean
          description: string
          id: string
          permission_key: string
        }
        Insert: {
          category: string
          created_at?: string
          default_allowed_for_consultant?: boolean
          description: string
          id?: string
          permission_key: string
        }
        Update: {
          category?: string
          created_at?: string
          default_allowed_for_consultant?: boolean
          description?: string
          id?: string
          permission_key?: string
        }
        Relationships: []
      }
      plan_contents: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          display_order: number
          end_detail_id: string | null
          end_range: number
          id: string
          is_auto_recommended: boolean | null
          master_content_id: string | null
          plan_group_id: string
          recommendation_metadata: Json | null
          recommendation_reason: string | null
          recommendation_source: string | null
          recommended_at: string | null
          recommended_by: string | null
          start_detail_id: string | null
          start_range: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          display_order?: number
          end_detail_id?: string | null
          end_range: number
          id?: string
          is_auto_recommended?: boolean | null
          master_content_id?: string | null
          plan_group_id: string
          recommendation_metadata?: Json | null
          recommendation_reason?: string | null
          recommendation_source?: string | null
          recommended_at?: string | null
          recommended_by?: string | null
          start_detail_id?: string | null
          start_range: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          display_order?: number
          end_detail_id?: string | null
          end_range?: number
          id?: string
          is_auto_recommended?: boolean | null
          master_content_id?: string | null
          plan_group_id?: string
          recommendation_metadata?: Json | null
          recommendation_reason?: string | null
          recommendation_source?: string | null
          recommended_at?: string | null
          recommended_by?: string | null
          start_detail_id?: string | null
          start_range?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_contents_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_contents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_exclusions: {
        Row: {
          created_at: string | null
          exclusion_date: string
          exclusion_type: string
          id: string
          plan_group_id: string | null
          reason: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          exclusion_date: string
          exclusion_type: string
          id?: string
          plan_group_id?: string | null
          reason?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          exclusion_date?: string
          exclusion_type?: string
          id?: string
          plan_group_id?: string | null
          reason?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_exclusions_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exclusions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exclusions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_group_items: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          display_order: number | null
          id: string
          is_required: boolean | null
          is_review: boolean | null
          master_content_id: string | null
          metadata: Json | null
          plan_group_id: string
          priority: number | null
          repeat_count: number | null
          split_strategy: string | null
          target_end_page_or_time: number
          target_start_page_or_time: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          is_review?: boolean | null
          master_content_id?: string | null
          metadata?: Json | null
          plan_group_id: string
          priority?: number | null
          repeat_count?: number | null
          split_strategy?: string | null
          target_end_page_or_time?: number
          target_start_page_or_time?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          is_review?: boolean | null
          master_content_id?: string | null
          metadata?: Json | null
          plan_group_id?: string
          priority?: number | null
          repeat_count?: number | null
          split_strategy?: string | null
          target_end_page_or_time?: number
          target_start_page_or_time?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_group_items_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_group_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_groups: {
        Row: {
          additional_period_reallocation: Json | null
          block_set_id: string | null
          camp_invitation_id: string | null
          camp_template_id: string | null
          content_slots: Json | null
          created_at: string | null
          daily_schedule: Json | null
          deleted_at: string | null
          id: string
          name: string | null
          non_study_time_blocks: Json | null
          period_end: string
          period_start: string
          plan_purpose: string | null
          plan_type: string | null
          request_notes: string | null
          scheduler_options: Json | null
          scheduler_type: string | null
          status: string | null
          student_id: string
          subject_constraints: Json | null
          target_date: string | null
          tenant_id: string
          updated_at: string | null
          use_slot_mode: boolean | null
        }
        Insert: {
          additional_period_reallocation?: Json | null
          block_set_id?: string | null
          camp_invitation_id?: string | null
          camp_template_id?: string | null
          content_slots?: Json | null
          created_at?: string | null
          daily_schedule?: Json | null
          deleted_at?: string | null
          id?: string
          name?: string | null
          non_study_time_blocks?: Json | null
          period_end: string
          period_start: string
          plan_purpose?: string | null
          plan_type?: string | null
          request_notes?: string | null
          scheduler_options?: Json | null
          scheduler_type?: string | null
          status?: string | null
          student_id: string
          subject_constraints?: Json | null
          target_date?: string | null
          tenant_id: string
          updated_at?: string | null
          use_slot_mode?: boolean | null
        }
        Update: {
          additional_period_reallocation?: Json | null
          block_set_id?: string | null
          camp_invitation_id?: string | null
          camp_template_id?: string | null
          content_slots?: Json | null
          created_at?: string | null
          daily_schedule?: Json | null
          deleted_at?: string | null
          id?: string
          name?: string | null
          non_study_time_blocks?: Json | null
          period_end?: string
          period_start?: string
          plan_purpose?: string | null
          plan_type?: string | null
          request_notes?: string | null
          scheduler_options?: Json | null
          scheduler_type?: string | null
          status?: string | null
          student_id?: string
          subject_constraints?: Json | null
          target_date?: string | null
          tenant_id?: string
          updated_at?: string | null
          use_slot_mode?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_groups_block_set_id_fkey"
            columns: ["block_set_id"]
            isOneToOne: false
            referencedRelation: "student_block_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_groups_camp_invitation_id_fkey"
            columns: ["camp_invitation_id"]
            isOneToOne: true
            referencedRelation: "camp_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_groups_camp_template_id_fkey"
            columns: ["camp_template_id"]
            isOneToOne: false
            referencedRelation: "camp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_groups_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_history: {
        Row: {
          adjustment_type: string | null
          content_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          plan_data: Json
          plan_group_id: string
          plan_id: string
          reschedule_log_id: string | null
          tenant_id: string | null
        }
        Insert: {
          adjustment_type?: string | null
          content_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          plan_data: Json
          plan_group_id: string
          plan_id: string
          reschedule_log_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          adjustment_type?: string | null
          content_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          plan_data?: Json
          plan_group_id?: string
          plan_id?: string
          reschedule_log_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_plan_history_reschedule_log"
            columns: ["reschedule_log_id"]
            isOneToOne: false
            referencedRelation: "reschedule_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_history_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_timer_logs: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          event_type: string
          id: string
          note: string | null
          plan_id: string
          student_id: string
          tenant_id: string | null
          timestamp: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          event_type: string
          id?: string
          note?: string | null
          plan_id: string
          student_id: string
          tenant_id?: string | null
          timestamp?: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          event_type?: string
          id?: string
          note?: string | null
          plan_id?: string
          student_id?: string
          tenant_id?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_timer_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_timer_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_timer_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_timer_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      publishers: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recommendation_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_type: string
          setting_value: Json
          tenant_id: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_type: string
          setting_value: Json
          tenant_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_type?: string
          setting_value?: Json
          tenant_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recommended_contents: {
        Row: {
          content_id: string
          content_type: string
          id: string
          is_selected: boolean | null
          recommended_at: string | null
          recommended_reason: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          id?: string
          is_selected?: boolean | null
          recommended_at?: string | null
          recommended_reason?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          id?: string
          is_selected?: boolean | null
          recommended_at?: string | null
          recommended_reason?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommended_contents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommended_contents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          level: number
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          level?: number
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      reschedule_log: {
        Row: {
          adjusted_contents: Json
          created_at: string | null
          created_by: string | null
          id: string
          plan_group_id: string
          plans_after_count: number
          plans_before_count: number
          reason: string | null
          rolled_back_at: string | null
          status: string | null
          student_id: string
          tenant_id: string | null
        }
        Insert: {
          adjusted_contents: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          plan_group_id: string
          plans_after_count?: number
          plans_before_count?: number
          reason?: string | null
          rolled_back_at?: string | null
          status?: string | null
          student_id: string
          tenant_id?: string | null
        }
        Update: {
          adjusted_contents?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          plan_group_id?: string
          plans_after_count?: number
          plans_before_count?: number
          reason?: string | null
          rolled_back_at?: string | null
          status?: string | null
          student_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reschedule_log_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedule_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean
          permission_key: string
          role: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key: string
          role: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key?: string
          role?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      school_info: {
        Row: {
          addr_detail: string | null
          addr_road: string | null
          address_full: string | null
          branch_flag: string | null
          closed_date: string | null
          closed_flag: string | null
          coeducation_type: string | null
          created_at: string | null
          district_id: number | null
          establishment_form: string | null
          establishment_type: string | null
          fax_number: string | null
          homepage_url: string | null
          id: number
          latitude: number | null
          longitude: number | null
          phone_number: string | null
          postal_code: string | null
          region: string | null
          school_code: string | null
          school_level: string | null
          school_name: string | null
          school_property: string | null
          temporary_close_flag: string | null
        }
        Insert: {
          addr_detail?: string | null
          addr_road?: string | null
          address_full?: string | null
          branch_flag?: string | null
          closed_date?: string | null
          closed_flag?: string | null
          coeducation_type?: string | null
          created_at?: string | null
          district_id?: number | null
          establishment_form?: string | null
          establishment_type?: string | null
          fax_number?: string | null
          homepage_url?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          phone_number?: string | null
          postal_code?: string | null
          region?: string | null
          school_code?: string | null
          school_level?: string | null
          school_name?: string | null
          school_property?: string | null
          temporary_close_flag?: string | null
        }
        Update: {
          addr_detail?: string | null
          addr_road?: string | null
          address_full?: string | null
          branch_flag?: string | null
          closed_date?: string | null
          closed_flag?: string | null
          coeducation_type?: string | null
          created_at?: string | null
          district_id?: number | null
          establishment_form?: string | null
          establishment_type?: string | null
          fax_number?: string | null
          homepage_url?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          phone_number?: string | null
          postal_code?: string | null
          region?: string | null
          school_code?: string | null
          school_level?: string | null
          school_name?: string | null
          school_property?: string | null
          temporary_close_flag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_info_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "district_office"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_template_presets: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          slot_templates: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          slot_templates?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          slot_templates?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slot_template_presets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message_content: string
          recipient_id: string | null
          recipient_phone: string
          sent_at: string | null
          status: string | null
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content: string
          recipient_id?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string
          recipient_id?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_analysis: {
        Row: {
          analysis_data: Json | null
          analyzed_at: string | null
          consistency_score: number | null
          created_at: string | null
          difficulty_requirement: string | null
          id: string
          mastery_estimate: number | null
          recent_grade_trend: number | null
          risk_score: number | null
          student_id: string
          subject: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          analysis_data?: Json | null
          analyzed_at?: string | null
          consistency_score?: number | null
          created_at?: string | null
          difficulty_requirement?: string | null
          id?: string
          mastery_estimate?: number | null
          recent_grade_trend?: number | null
          risk_score?: number | null
          student_id: string
          subject: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          analysis_data?: Json | null
          analyzed_at?: string | null
          consistency_score?: number | null
          created_at?: string | null
          difficulty_requirement?: string | null
          id?: string
          mastery_estimate?: number | null
          recent_grade_trend?: number | null
          risk_score?: number | null
          student_id?: string
          subject?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_analysis_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_analysis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_block_schedule: {
        Row: {
          block_set_id: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          block_set_id?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          student_id: string
          tenant_id: string
        }
        Update: {
          block_set_id?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_block_schedule_block_set_id_fkey"
            columns: ["block_set_id"]
            isOneToOne: false
            referencedRelation: "student_block_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_schedule_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_schedule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_block_sets: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          name: string
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          name: string
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_block_sets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_block_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_book_details: {
        Row: {
          book_id: string
          created_at: string | null
          display_order: number
          id: string
          major_unit: string | null
          minor_unit: string | null
          page_number: number
        }
        Insert: {
          book_id: string
          created_at?: string | null
          display_order?: number
          id?: string
          major_unit?: string | null
          minor_unit?: string | null
          page_number: number
        }
        Update: {
          book_id?: string
          created_at?: string | null
          display_order?: number
          id?: string
          major_unit?: string | null
          minor_unit?: string | null
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_book_details_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      student_career_field_preferences: {
        Row: {
          career_field: string
          created_at: string
          id: string
          priority: number
          student_id: string
          updated_at: string
        }
        Insert: {
          career_field: string
          created_at?: string
          id?: string
          priority?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          career_field?: string
          created_at?: string
          id?: string
          priority?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_career_field_preferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_career_goals: {
        Row: {
          created_at: string
          curriculum_revision: string | null
          desired_career_field: string | null
          desired_university_ids: string[] | null
          exam_year: number | null
          id: string
          notes: string | null
          student_id: string
          target_major: string | null
          target_major_2: string | null
          target_score: Json | null
          target_university_type: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          curriculum_revision?: string | null
          desired_career_field?: string | null
          desired_university_ids?: string[] | null
          exam_year?: number | null
          id?: string
          notes?: string | null
          student_id: string
          target_major?: string | null
          target_major_2?: string | null
          target_score?: Json | null
          target_university_type?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          curriculum_revision?: string | null
          desired_career_field?: string | null
          desired_university_ids?: string[] | null
          exam_year?: number | null
          id?: string
          notes?: string | null
          student_id?: string
          target_major?: string | null
          target_major_2?: string | null
          target_score?: Json | null
          target_university_type?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_career_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_career_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_connection_codes: {
        Row: {
          connection_code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          student_id: string
          used_at: string | null
        }
        Insert: {
          connection_code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          student_id: string
          used_at?: string | null
        }
        Update: {
          connection_code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          student_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_connection_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_consulting_notes: {
        Row: {
          consultant_id: string
          created_at: string
          id: string
          note: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          consultant_id: string
          created_at?: string
          id?: string
          note: string
          student_id: string
          tenant_id: string
        }
        Update: {
          consultant_id?: string
          created_at?: string
          id?: string
          note?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_consulting_notes_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_consulting_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_consulting_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_content_progress: {
        Row: {
          completed_amount: number | null
          content_id: string | null
          content_type: string | null
          end_page_or_time: number | null
          id: string
          last_updated: string | null
          plan_id: string | null
          progress: number | null
          start_page_or_time: number | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          completed_amount?: number | null
          content_id?: string | null
          content_type?: string | null
          end_page_or_time?: number | null
          id?: string
          last_updated?: string | null
          plan_id?: string | null
          progress?: number | null
          start_page_or_time?: number | null
          student_id: string
          tenant_id: string
        }
        Update: {
          completed_amount?: number | null
          content_id?: string | null
          content_type?: string | null
          end_page_or_time?: number | null
          id?: string
          last_updated?: string | null
          plan_id?: string | null
          progress?: number | null
          start_page_or_time?: number | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_content_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_content_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_content_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_content_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_custom_contents: {
        Row: {
          chapter_info: Json | null
          content_type: string
          created_at: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          id: string
          student_id: string
          subject: string | null
          tenant_id: string
          title: string
          total_page_or_time: number | null
          updated_at: string | null
        }
        Insert: {
          chapter_info?: Json | null
          content_type: string
          created_at?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          id?: string
          student_id: string
          subject?: string | null
          tenant_id: string
          title: string
          total_page_or_time?: number | null
          updated_at?: string | null
        }
        Update: {
          chapter_info?: Json | null
          content_type?: string
          created_at?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          id?: string
          student_id?: string
          subject?: string | null
          tenant_id?: string
          title?: string
          total_page_or_time?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_student_custom_contents_difficulty_level_id"
            columns: ["difficulty_level_id"]
            isOneToOne: false
            referencedRelation: "difficulty_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_custom_contents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_custom_contents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_divisions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_goal_progress: {
        Row: {
          created_at: string | null
          goal_id: string
          id: string
          plan_id: string | null
          progress_amount: number | null
          session_id: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          goal_id: string
          id?: string
          plan_id?: string | null
          progress_amount?: number | null
          session_id?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          goal_id?: string
          id?: string
          plan_id?: string | null
          progress_amount?: number | null
          session_id?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "student_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goal_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goal_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goal_progress_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_study_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goal_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goal_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_goals: {
        Row: {
          content_id: string | null
          created_at: string | null
          description: string | null
          end_date: string
          expected_amount: number | null
          goal_type: string
          id: string
          start_date: string
          student_id: string
          subject: string | null
          target_score: number | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date: string
          expected_amount?: number | null
          goal_type: string
          id?: string
          start_date: string
          student_id: string
          subject?: string | null
          target_score?: number | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string
          expected_amount?: number | null
          goal_type?: string
          id?: string
          start_date?: string
          student_id?: string
          subject?: string | null
          target_score?: number | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_history: {
        Row: {
          created_at: string | null
          detail: Json | null
          event_type: string
          id: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          detail?: Json | null
          event_type: string
          id?: string
          student_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          detail?: Json | null
          event_type?: string
          id?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_internal_scores: {
        Row: {
          avg_score: number | null
          created_at: string | null
          credit_hours: number
          curriculum_revision_id: string
          grade: number
          id: string
          notes: string | null
          rank_grade: number | null
          raw_score: number | null
          semester: number
          std_dev: number | null
          student_id: string
          student_term_id: string | null
          subject_group_id: string
          subject_id: string
          subject_type_id: string
          tenant_id: string
          total_students: number | null
          updated_at: string | null
        }
        Insert: {
          avg_score?: number | null
          created_at?: string | null
          credit_hours: number
          curriculum_revision_id: string
          grade: number
          id?: string
          notes?: string | null
          rank_grade?: number | null
          raw_score?: number | null
          semester: number
          std_dev?: number | null
          student_id: string
          student_term_id?: string | null
          subject_group_id: string
          subject_id: string
          subject_type_id: string
          tenant_id: string
          total_students?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_score?: number | null
          created_at?: string | null
          credit_hours?: number
          curriculum_revision_id?: string
          grade?: number
          id?: string
          notes?: string | null
          rank_grade?: number | null
          raw_score?: number | null
          semester?: number
          std_dev?: number | null
          student_id?: string
          student_term_id?: string | null
          subject_group_id?: string
          subject_id?: string
          subject_type_id?: string
          tenant_id?: string
          total_students?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_internal_scores_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_internal_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_internal_scores_student_term_id_fkey"
            columns: ["student_term_id"]
            isOneToOne: false
            referencedRelation: "student_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_internal_scores_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_internal_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_internal_scores_subject_type_id_fkey"
            columns: ["subject_type_id"]
            isOneToOne: false
            referencedRelation: "subject_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_internal_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lecture_episodes: {
        Row: {
          created_at: string | null
          display_order: number
          duration: number | null
          episode_number: number
          episode_title: string | null
          id: string
          lecture_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          duration?: number | null
          episode_number: number
          episode_title?: string | null
          id?: string
          lecture_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          duration?: number | null
          episode_number?: number
          episode_title?: string | null
          id?: string
          lecture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_lecture_episodes_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      student_mock_scores: {
        Row: {
          created_at: string | null
          exam_date: string
          exam_title: string
          grade: number
          grade_score: number | null
          id: string
          notes: string | null
          percentile: number | null
          raw_score: number | null
          standard_score: number | null
          student_id: string
          student_term_id: string | null
          subject_group_id: string
          subject_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          exam_date: string
          exam_title: string
          grade: number
          grade_score?: number | null
          id?: string
          notes?: string | null
          percentile?: number | null
          raw_score?: number | null
          standard_score?: number | null
          student_id: string
          student_term_id?: string | null
          subject_group_id: string
          subject_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          exam_date?: string
          exam_title?: string
          grade?: number
          grade_score?: number | null
          id?: string
          notes?: string | null
          percentile?: number | null
          raw_score?: number | null
          standard_score?: number | null
          student_id?: string
          student_term_id?: string | null
          subject_group_id?: string
          subject_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_mock_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mock_scores_student_term_id_fkey"
            columns: ["student_term_id"]
            isOneToOne: false
            referencedRelation: "student_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mock_scores_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mock_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_mock_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_notification_preferences: {
        Row: {
          attendance_absent_enabled: boolean | null
          attendance_check_in_enabled: boolean | null
          attendance_check_out_enabled: boolean | null
          attendance_late_enabled: boolean | null
          camp_invitation_enabled: boolean | null
          camp_reminder_enabled: boolean | null
          camp_status_change_enabled: boolean | null
          created_at: string | null
          daily_goal_achieved_enabled: boolean | null
          id: string
          notification_time_end: string | null
          notification_time_start: string | null
          plan_complete_enabled: boolean | null
          plan_delay_enabled: boolean | null
          plan_delay_threshold_minutes: number | null
          plan_start_enabled: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          student_id: string
          updated_at: string | null
          weekly_report_enabled: boolean | null
        }
        Insert: {
          attendance_absent_enabled?: boolean | null
          attendance_check_in_enabled?: boolean | null
          attendance_check_out_enabled?: boolean | null
          attendance_late_enabled?: boolean | null
          camp_invitation_enabled?: boolean | null
          camp_reminder_enabled?: boolean | null
          camp_status_change_enabled?: boolean | null
          created_at?: string | null
          daily_goal_achieved_enabled?: boolean | null
          id?: string
          notification_time_end?: string | null
          notification_time_start?: string | null
          plan_complete_enabled?: boolean | null
          plan_delay_enabled?: boolean | null
          plan_delay_threshold_minutes?: number | null
          plan_start_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          student_id: string
          updated_at?: string | null
          weekly_report_enabled?: boolean | null
        }
        Update: {
          attendance_absent_enabled?: boolean | null
          attendance_check_in_enabled?: boolean | null
          attendance_check_out_enabled?: boolean | null
          attendance_late_enabled?: boolean | null
          camp_invitation_enabled?: boolean | null
          camp_reminder_enabled?: boolean | null
          camp_status_change_enabled?: boolean | null
          created_at?: string | null
          daily_goal_achieved_enabled?: boolean | null
          id?: string
          notification_time_end?: string | null
          notification_time_start?: string | null
          plan_complete_enabled?: boolean | null
          plan_delay_enabled?: boolean | null
          plan_delay_threshold_minutes?: number | null
          plan_start_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          student_id?: string
          updated_at?: string | null
          weekly_report_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "student_notification_preferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_plan: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          block_index: number
          chapter: string | null
          completed_amount: number | null
          content_category: string | null
          content_id: string
          content_subject: string | null
          content_subject_category: string | null
          content_title: string | null
          content_type: string
          created_at: string | null
          day: number | null
          day_type: string | null
          end_time: string | null
          id: string
          is_active: boolean | null
          is_continued: boolean | null
          is_partial: boolean | null
          is_reschedulable: boolean | null
          is_virtual: boolean | null
          memo: string | null
          origin_plan_item_id: string | null
          pause_count: number | null
          paused_duration_seconds: number | null
          plan_date: string
          plan_group_id: string | null
          plan_number: number | null
          planned_end_page_or_time: number | null
          planned_start_page_or_time: number | null
          progress: number | null
          sequence: number | null
          slot_index: number | null
          start_time: string | null
          status: string | null
          student_id: string
          subject_type: string | null
          tenant_id: string
          total_duration_seconds: number | null
          updated_at: string | null
          version: number | null
          version_group_id: string | null
          virtual_description: string | null
          virtual_subject_category: string | null
          week: number | null
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          block_index: number
          chapter?: string | null
          completed_amount?: number | null
          content_category?: string | null
          content_id: string
          content_subject?: string | null
          content_subject_category?: string | null
          content_title?: string | null
          content_type: string
          created_at?: string | null
          day?: number | null
          day_type?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          is_continued?: boolean | null
          is_partial?: boolean | null
          is_reschedulable?: boolean | null
          is_virtual?: boolean | null
          memo?: string | null
          origin_plan_item_id?: string | null
          pause_count?: number | null
          paused_duration_seconds?: number | null
          plan_date: string
          plan_group_id?: string | null
          plan_number?: number | null
          planned_end_page_or_time?: number | null
          planned_start_page_or_time?: number | null
          progress?: number | null
          sequence?: number | null
          slot_index?: number | null
          start_time?: string | null
          status?: string | null
          student_id: string
          subject_type?: string | null
          tenant_id: string
          total_duration_seconds?: number | null
          updated_at?: string | null
          version?: number | null
          version_group_id?: string | null
          virtual_description?: string | null
          virtual_subject_category?: string | null
          week?: number | null
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          block_index?: number
          chapter?: string | null
          completed_amount?: number | null
          content_category?: string | null
          content_id?: string
          content_subject?: string | null
          content_subject_category?: string | null
          content_title?: string | null
          content_type?: string
          created_at?: string | null
          day?: number | null
          day_type?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          is_continued?: boolean | null
          is_partial?: boolean | null
          is_reschedulable?: boolean | null
          is_virtual?: boolean | null
          memo?: string | null
          origin_plan_item_id?: string | null
          pause_count?: number | null
          paused_duration_seconds?: number | null
          plan_date?: string
          plan_group_id?: string | null
          plan_number?: number | null
          planned_end_page_or_time?: number | null
          planned_start_page_or_time?: number | null
          progress?: number | null
          sequence?: number | null
          slot_index?: number | null
          start_time?: string | null
          status?: string | null
          student_id?: string
          subject_type?: string | null
          tenant_id?: string
          total_duration_seconds?: number | null
          updated_at?: string | null
          version?: number | null
          version_group_id?: string | null
          virtual_description?: string | null
          virtual_subject_category?: string | null
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_plan_origin_plan_item_id_fkey"
            columns: ["origin_plan_item_id"]
            isOneToOne: false
            referencedRelation: "plan_group_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          address: string | null
          address_detail: string | null
          bio: string | null
          created_at: string
          emergency_contact: string | null
          emergency_contact_phone: string | null
          father_phone: string | null
          gender: string | null
          id: string
          interests: Json | null
          medical_info: string | null
          mother_phone: string | null
          phone: string | null
          postal_code: string | null
          profile_image_url: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_detail?: string | null
          bio?: string | null
          created_at?: string
          emergency_contact?: string | null
          emergency_contact_phone?: string | null
          father_phone?: string | null
          gender?: string | null
          id: string
          interests?: Json | null
          medical_info?: string | null
          mother_phone?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_image_url?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_detail?: string | null
          bio?: string | null
          created_at?: string
          emergency_contact?: string | null
          emergency_contact_phone?: string | null
          father_phone?: string | null
          gender?: string | null
          id?: string
          interests?: Json | null
          medical_info?: string | null
          mother_phone?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_image_url?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_score_analysis_cache: {
        Row: {
          internal_summary: Json | null
          mock_summary: Json | null
          strategy_summary: Json | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          internal_summary?: Json | null
          mock_summary?: Json | null
          strategy_summary?: Json | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          internal_summary?: Json | null
          mock_summary?: Json | null
          strategy_summary?: Json | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_score_analysis_cache_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_score_events: {
        Row: {
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          event_type: string
          id: string
          score_table: string
          student_id: string
        }
        Insert: {
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          event_type: string
          id?: string
          score_table: string
          student_id: string
        }
        Update: {
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          event_type?: string
          id?: string
          score_table?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_score_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_study_sessions: {
        Row: {
          content_id: string | null
          content_type: string | null
          created_at: string | null
          device_info: Json | null
          device_session_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          focus_level: number | null
          id: string
          last_heartbeat: string | null
          note: string | null
          paused_at: string | null
          paused_duration_seconds: number | null
          plan_id: string | null
          resumed_at: string | null
          started_at: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          device_info?: Json | null
          device_session_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          focus_level?: number | null
          id?: string
          last_heartbeat?: string | null
          note?: string | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          plan_id?: string | null
          resumed_at?: string | null
          started_at: string
          student_id: string
          tenant_id: string
        }
        Update: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          device_info?: Json | null
          device_session_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          focus_level?: number | null
          id?: string
          last_heartbeat?: string | null
          note?: string | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          plan_id?: string | null
          resumed_at?: string | null
          started_at?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_study_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_study_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_study_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_study_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_terms: {
        Row: {
          class_name: string | null
          created_at: string | null
          curriculum_revision_id: string
          grade: number
          homeroom_teacher: string | null
          id: string
          notes: string | null
          school_year: number
          semester: number
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          class_name?: string | null
          created_at?: string | null
          curriculum_revision_id: string
          grade: number
          homeroom_teacher?: string | null
          id?: string
          notes?: string | null
          school_year: number
          semester: number
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          class_name?: string | null
          created_at?: string | null
          curriculum_revision_id?: string
          grade?: number
          homeroom_teacher?: string | null
          id?: string
          notes?: string | null
          school_year?: number
          semester?: number
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_terms_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_terms_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_terms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active_block_set_id: string | null
          birth_date: string | null
          class: string | null
          created_at: string | null
          division: string | null
          enrolled_at: string | null
          grade: number | null
          id: string
          is_active: boolean
          memo: string | null
          name: string
          school_id: string | null
          school_type: string | null
          status: string | null
          student_number: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active_block_set_id?: string | null
          birth_date?: string | null
          class?: string | null
          created_at?: string | null
          division?: string | null
          enrolled_at?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean
          memo?: string | null
          name: string
          school_id?: string | null
          school_type?: string | null
          status?: string | null
          student_number?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active_block_set_id?: string | null
          birth_date?: string | null
          class?: string | null
          created_at?: string | null
          division?: string | null
          enrolled_at?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean
          memo?: string | null
          name?: string
          school_id?: string | null
          school_type?: string | null
          status?: string | null
          student_number?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_active_block_set_id_fkey"
            columns: ["active_block_set_id"]
            isOneToOne: false
            referencedRelation: "student_block_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_groups: {
        Row: {
          created_at: string
          curriculum_revision_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          curriculum_revision_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          curriculum_revision_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_groups_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_types: {
        Row: {
          created_at: string | null
          curriculum_revision_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_revision_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_revision_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_types_curriculum_revision_id_fkey"
            columns: ["curriculum_revision_id"]
            isOneToOne: false
            referencedRelation: "curriculum_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
          subject_group_id: string
          subject_type_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          subject_group_id: string
          subject_type_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          subject_group_id?: string
          subject_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_subject_type_id_fkey"
            columns: ["subject_type_id"]
            isOneToOne: false
            referencedRelation: "subject_types"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tenant_block_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_block_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_blocks: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          tenant_block_set_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          tenant_block_set_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          tenant_block_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_blocks_tenant_block_set_id_fkey"
            columns: ["tenant_block_set_id"]
            isOneToOne: false
            referencedRelation: "tenant_block_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_scheduler_settings: {
        Row: {
          created_at: string
          default_lunch_time: Json | null
          default_review_days: number
          default_review_scope: string | null
          default_self_study_hours: Json | null
          default_study_days: number
          default_study_hours: Json | null
          default_weak_subject_focus: string | null
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_lunch_time?: Json | null
          default_review_days?: number
          default_review_scope?: string | null
          default_self_study_hours?: Json | null
          default_study_days?: number
          default_study_hours?: Json | null
          default_weak_subject_focus?: string | null
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_lunch_time?: Json | null
          default_review_days?: number
          default_review_scope?: string | null
          default_self_study_hours?: Json | null
          default_study_days?: number
          default_study_hours?: Json | null
          default_weak_subject_focus?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_scheduler_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          attendance_sms_absent_enabled: boolean | null
          attendance_sms_check_in_enabled: boolean | null
          attendance_sms_check_out_enabled: boolean | null
          attendance_sms_late_enabled: boolean | null
          attendance_sms_recipient: string | null
          attendance_sms_show_failure_to_user: boolean | null
          attendance_sms_student_checkin_enabled: boolean | null
          created_at: string
          id: string
          location_latitude: number | null
          location_longitude: number | null
          location_radius_meters: number | null
          name: string
          qr_code_secret: string | null
          settings: Json | null
          status: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          attendance_sms_absent_enabled?: boolean | null
          attendance_sms_check_in_enabled?: boolean | null
          attendance_sms_check_out_enabled?: boolean | null
          attendance_sms_late_enabled?: boolean | null
          attendance_sms_recipient?: string | null
          attendance_sms_show_failure_to_user?: boolean | null
          attendance_sms_student_checkin_enabled?: boolean | null
          created_at?: string
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          location_radius_meters?: number | null
          name: string
          qr_code_secret?: string | null
          settings?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          attendance_sms_absent_enabled?: boolean | null
          attendance_sms_check_in_enabled?: boolean | null
          attendance_sms_check_out_enabled?: boolean | null
          attendance_sms_late_enabled?: boolean | null
          attendance_sms_recipient?: string | null
          attendance_sms_show_failure_to_user?: boolean | null
          attendance_sms_student_checkin_enabled?: boolean | null
          created_at?: string
          id?: string
          location_latitude?: number | null
          location_longitude?: number | null
          location_radius_meters?: number | null
          name?: string
          qr_code_secret?: string | null
          settings?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      terms_contents: {
        Row: {
          content: string
          content_type: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content: string
          content_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      today_plans_cache: {
        Row: {
          computed_at: string
          created_at: string
          expires_at: string
          id: string
          is_camp_mode: boolean
          payload: Json
          plan_date: string
          student_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          expires_at: string
          id?: string
          is_camp_mode?: boolean
          payload: Json
          plan_date: string
          student_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_camp_mode?: boolean
          payload?: Json
          plan_date?: string
          student_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      universities: {
        Row: {
          corporation_name: string | null
          created_at: string | null
          establishment_type: string | null
          founded_date: string | null
          homepage_url: string | null
          id: number
          legal_basis: string | null
          name_chi: string | null
          name_eng: string | null
          name_kor: string
          president_name: string | null
          status: string | null
          university_code: string | null
          university_type: string | null
        }
        Insert: {
          corporation_name?: string | null
          created_at?: string | null
          establishment_type?: string | null
          founded_date?: string | null
          homepage_url?: string | null
          id?: number
          legal_basis?: string | null
          name_chi?: string | null
          name_eng?: string | null
          name_kor: string
          president_name?: string | null
          status?: string | null
          university_code?: string | null
          university_type?: string | null
        }
        Update: {
          corporation_name?: string | null
          created_at?: string | null
          establishment_type?: string | null
          founded_date?: string | null
          homepage_url?: string | null
          id?: number
          legal_basis?: string | null
          name_chi?: string | null
          name_eng?: string | null
          name_kor?: string
          president_name?: string | null
          status?: string | null
          university_code?: string | null
          university_type?: string | null
        }
        Relationships: []
      }
      university_campuses: {
        Row: {
          address_chi: string | null
          address_eng: string | null
          address_kor: string | null
          campus_name: string | null
          campus_status: string | null
          campus_type: string | null
          created_at: string | null
          fax_number: string | null
          id: number
          phone_number: string | null
          postal_code: string | null
          region: string | null
          university_id: number | null
        }
        Insert: {
          address_chi?: string | null
          address_eng?: string | null
          address_kor?: string | null
          campus_name?: string | null
          campus_status?: string | null
          campus_type?: string | null
          created_at?: string | null
          fax_number?: string | null
          id?: number
          phone_number?: string | null
          postal_code?: string | null
          region?: string | null
          university_id?: number | null
        }
        Update: {
          address_chi?: string | null
          address_eng?: string | null
          address_kor?: string | null
          campus_name?: string | null
          campus_status?: string | null
          campus_type?: string | null
          created_at?: string | null
          fax_number?: string | null
          id?: number
          phone_number?: string | null
          postal_code?: string | null
          region?: string | null
          university_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "university_campuses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          consent_type: string
          consented: boolean
          consented_at: string
          created_at: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          consented?: boolean
          consented_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          consented?: boolean
          consented_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_name: string | null
          expires_at: string | null
          id: string
          ip_address: unknown
          is_current_session: boolean | null
          last_active_at: string | null
          location: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_current_session?: boolean | null
          last_active_at?: string | null
          location?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_current_session?: boolean | null
          last_active_at?: string | null
          location?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      all_schools_view: {
        Row: {
          address: string | null
          campus_name: string | null
          code: string | null
          created_at: string | null
          establishment_type: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          school_type: string | null
          source_id: number | null
          source_table: string | null
          university_type: string | null
          website: string | null
        }
        Relationships: []
      }
      today_plan_view: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          block_index: number | null
          chapter: string | null
          completed_amount: number | null
          content_category: string | null
          content_id: string | null
          content_subject: string | null
          content_subject_category: string | null
          content_title: string | null
          content_type: string | null
          created_at: string | null
          day: number | null
          day_type: string | null
          end_time: string | null
          id: string | null
          is_active: boolean | null
          is_continued: boolean | null
          is_partial: boolean | null
          is_reschedulable: boolean | null
          memo: string | null
          origin_plan_item_id: string | null
          pause_count: number | null
          paused_duration_seconds: number | null
          plan_date: string | null
          plan_group_id: string | null
          plan_number: number | null
          planned_end_page_or_time: number | null
          planned_start_page_or_time: number | null
          progress: number | null
          sequence: number | null
          start_time: string | null
          status: string | null
          student_id: string | null
          tenant_id: string | null
          total_duration_seconds: number | null
          updated_at: string | null
          version: number | null
          version_group_id: string | null
          view_content_category: string | null
          view_content_subject: string | null
          view_content_subject_category: string | null
          view_content_title: string | null
          week: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_plan_origin_plan_item_id_fkey"
            columns: ["origin_plan_item_id"]
            isOneToOne: false
            referencedRelation: "plan_group_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_research_science_subject_group: {
        Args: { tenant_uuid: string }
        Returns: undefined
      }
      add_research_social_subject_group: {
        Args: { tenant_uuid: string }
        Returns: undefined
      }
      add_social_subject_group: {
        Args: { tenant_uuid: string }
        Returns: undefined
      }
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      cleanup_korean_history_subjects: {
        Args: { tenant_uuid: string }
        Returns: undefined
      }
      complete_plan_atomically: {
        Args: {
          p_actual_end_time: string
          p_completed_amount: number
          p_pause_count?: number
          p_paused_duration_seconds?: number
          p_plan_ids: string[]
          p_progress: number
          p_student_id: string
          p_total_duration_seconds?: number
        }
        Returns: Json
      }
      create_admin_user: {
        Args: { user_email: string; user_role?: string }
        Returns: string
      }
      create_plan_group_atomic: {
        Args: {
          p_academy_schedules: Json
          p_additional_period_reallocation: Json
          p_block_set_id: string
          p_camp_invitation_id: string
          p_camp_template_id: string
          p_content_slots: Json
          p_contents: Json
          p_daily_schedule: Json
          p_exclusions: Json
          p_name: string
          p_non_study_time_blocks: Json
          p_period_end: string
          p_period_start: string
          p_plan_purpose: string
          p_plan_type: string
          p_scheduler_options: Json
          p_scheduler_type: string
          p_status: string
          p_student_id: string
          p_subject_constraints: Json
          p_target_date: string
          p_tenant_id: string
          p_use_slot_mode: boolean
        }
        Returns: Json
      }
      generate_plans_atomic: {
        Args: { p_group_id: string; p_plans: Json; p_update_status_to?: string }
        Returns: Json
      }
      get_user_tenant_id: { Args: never; Returns: string }
      increment_pause_count: {
        Args: { p_plan_id: string; p_student_id: string }
        Returns: number
      }
      is_super_admin: { Args: never; Returns: boolean }
      link_student_with_connection_code: {
        Args: { p_connection_code: string; p_user_id: string }
        Returns: Json
      }
      parse_device_name: { Args: { user_agent_text: string }; Returns: string }
      seed_subject_data: { Args: { tenant_uuid: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      adjustment_type_enum: "range" | "replace" | "full"
      content_type_enum: "book" | "lecture" | "custom"
      plan_status_enum: "pending" | "in_progress" | "completed" | "canceled"
      reschedule_log_status_enum:
        | "pending"
        | "completed"
        | "failed"
        | "rolled_back"
    }
    CompositeTypes: {
      academy_schedule_input: {
        day_of_week: number | null
        start_time: string | null
        end_time: string | null
        academy_name: string | null
        subject: string | null
      }
      plan_content_input: {
        content_type: string | null
        content_id: string | null
        master_content_id: string | null
        start_range: number | null
        end_range: number | null
        display_order: number | null
      }
      plan_exclusion_input: {
        exclusion_date: string | null
        exclusion_type: string | null
        reason: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      adjustment_type_enum: ["range", "replace", "full"],
      content_type_enum: ["book", "lecture", "custom"],
      plan_status_enum: ["pending", "in_progress", "completed", "canceled"],
      reschedule_log_status_enum: [
        "pending",
        "completed",
        "failed",
        "rolled_back",
      ],
    },
  },
} as const

