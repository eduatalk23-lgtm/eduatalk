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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          department: string | null
          id: string
          is_active: boolean
          is_owner: boolean
          job_title: string | null
          name: string
          phone: string | null
          profile_image_url: string | null
          role: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          id: string
          is_active?: boolean
          is_owner?: boolean
          job_title?: string | null
          name: string
          phone?: string | null
          profile_image_url?: string | null
          role: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          is_active?: boolean
          is_owner?: boolean
          job_title?: string | null
          name?: string
          phone?: string | null
          profile_image_url?: string | null
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
      calendar_events: {
        Row: {
          calendar_id: string
          color: string | null
          container_type: string | null
          created_at: string | null
          created_by: string | null
          creator_role: string
          deleted_at: string | null
          description: string | null
          end_at: string | null
          end_date: string | null
          event_subtype: string | null
          event_type: string
          exdates: string[] | null
          ical_uid: string | null
          icon: string | null
          id: string
          is_all_day: boolean | null
          is_exception: boolean | null
          is_exclusion: boolean
          is_task: boolean
          label: string
          location: string | null
          metadata: Json | null
          order_index: number | null
          original_start_at: string | null
          plan_group_id: string | null
          priority: number | null
          recurring_event_id: string | null
          reminder_minutes: number[] | null
          rrule: string | null
          sequence: number | null
          source: string | null
          start_at: string | null
          start_date: string | null
          status: string
          student_id: string
          tags: string[] | null
          tenant_id: string
          timezone: string | null
          title: string
          transparency: string
          updated_at: string | null
          visibility: string
        }
        Insert: {
          calendar_id: string
          color?: string | null
          container_type?: string | null
          created_at?: string | null
          created_by?: string | null
          creator_role?: string
          deleted_at?: string | null
          description?: string | null
          end_at?: string | null
          end_date?: string | null
          event_subtype?: string | null
          event_type: string
          exdates?: string[] | null
          ical_uid?: string | null
          icon?: string | null
          id?: string
          is_all_day?: boolean | null
          is_exception?: boolean | null
          is_exclusion?: boolean
          is_task?: boolean
          label: string
          location?: string | null
          metadata?: Json | null
          order_index?: number | null
          original_start_at?: string | null
          plan_group_id?: string | null
          priority?: number | null
          recurring_event_id?: string | null
          reminder_minutes?: number[] | null
          rrule?: string | null
          sequence?: number | null
          source?: string | null
          start_at?: string | null
          start_date?: string | null
          status?: string
          student_id: string
          tags?: string[] | null
          tenant_id: string
          timezone?: string | null
          title: string
          transparency?: string
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          calendar_id?: string
          color?: string | null
          container_type?: string | null
          created_at?: string | null
          created_by?: string | null
          creator_role?: string
          deleted_at?: string | null
          description?: string | null
          end_at?: string | null
          end_date?: string | null
          event_subtype?: string | null
          event_type?: string
          exdates?: string[] | null
          ical_uid?: string | null
          icon?: string | null
          id?: string
          is_all_day?: boolean | null
          is_exception?: boolean | null
          is_exclusion?: boolean
          is_task?: boolean
          label?: string
          location?: string | null
          metadata?: Json | null
          order_index?: number | null
          original_start_at?: string | null
          plan_group_id?: string | null
          priority?: number | null
          recurring_event_id?: string | null
          reminder_minutes?: number[] | null
          rrule?: string | null
          sequence?: number | null
          source?: string | null
          start_at?: string | null
          start_date?: string | null
          status?: string
          student_id?: string
          tags?: string[] | null
          tenant_id?: string
          timezone?: string | null
          title?: string
          transparency?: string
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_recurring_event_id_fkey"
            columns: ["recurring_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_list: {
        Row: {
          access_role: string
          calendar_id: string
          color_override: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_visible: boolean | null
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_role?: string
          calendar_id: string
          color_override?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_visible?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_role?: string
          calendar_id?: string
          color_override?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_visible?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_list_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          admin_memo: string | null
          block_set_id: string | null
          created_at: string | null
          created_by: string | null
          default_color: string | null
          default_scheduler_options: Json | null
          default_scheduler_type: string | null
          deleted_at: string | null
          description: string | null
          external_id: string | null
          id: string
          is_primary: boolean | null
          is_student_primary: boolean | null
          location: string | null
          non_study_time_blocks: Json | null
          owner_id: string
          owner_type: string
          period_end: string | null
          period_start: string | null
          self_study_hours: Json | null
          source_type: string
          status: string | null
          study_hours: Json | null
          summary: string
          target_date: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          admin_memo?: string | null
          block_set_id?: string | null
          created_at?: string | null
          created_by?: string | null
          default_color?: string | null
          default_scheduler_options?: Json | null
          default_scheduler_type?: string | null
          deleted_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          is_primary?: boolean | null
          is_student_primary?: boolean | null
          location?: string | null
          non_study_time_blocks?: Json | null
          owner_id: string
          owner_type: string
          period_end?: string | null
          period_start?: string | null
          self_study_hours?: Json | null
          source_type?: string
          status?: string | null
          study_hours?: Json | null
          summary: string
          target_date?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_memo?: string | null
          block_set_id?: string | null
          created_at?: string | null
          created_by?: string | null
          default_color?: string | null
          default_scheduler_options?: Json | null
          default_scheduler_type?: string | null
          deleted_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          is_primary?: boolean | null
          is_student_primary?: boolean | null
          location?: string | null
          non_study_time_blocks?: Json | null
          owner_id?: string
          owner_type?: string
          period_end?: string | null
          period_start?: string | null
          self_study_hours?: Json | null
          source_type?: string
          status?: string | null
          study_hours?: Json | null
          summary?: string
          target_date?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendars_block_set_id_fkey"
            columns: ["block_set_id"]
            isOneToOne: false
            referencedRelation: "student_block_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendars_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_invitations: {
        Row: {
          accepted_at: string | null
          camp_template_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          decline_reason: string | null
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
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          decline_reason?: string | null
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
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          decline_reason?: string | null
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
          allow_normal_plan_activation: boolean | null
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
          allow_normal_plan_activation?: boolean | null
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
          allow_normal_plan_activation?: boolean | null
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
      chat_attachment_hidden: {
        Row: {
          attachment_id: string
          hidden_at: string
          id: string
          user_id: string
        }
        Insert: {
          attachment_id: string
          hidden_at?: string
          id?: string
          user_id: string
        }
        Update: {
          attachment_id?: string
          hidden_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachment_hidden_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "chat_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          file_name: string
          file_size: number
          height: number | null
          id: string
          message_id: string | null
          mime_type: string
          public_url: string
          room_id: string
          scheduled_message_id: string | null
          sender_id: string
          storage_path: string
          thumbnail_storage_path: string | null
          thumbnail_url: string | null
          width: number | null
        }
        Insert: {
          attachment_type?: string
          created_at?: string
          file_name: string
          file_size: number
          height?: number | null
          id?: string
          message_id?: string | null
          mime_type: string
          public_url: string
          room_id: string
          scheduled_message_id?: string | null
          sender_id: string
          storage_path: string
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          width?: number | null
        }
        Update: {
          attachment_type?: string
          created_at?: string
          file_name?: string
          file_size?: number
          height?: number | null
          id?: string
          message_id?: string | null
          mime_type?: string
          public_url?: string
          room_id?: string
          scheduled_message_id?: string | null
          sender_id?: string
          storage_path?: string
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_blocks: {
        Row: {
          blocked_id: string
          blocked_type: string
          blocker_id: string
          blocker_type: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocked_type: string
          blocker_id: string
          blocker_type: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocked_type?: string
          blocker_id?: string
          blocker_type?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      chat_link_previews: {
        Row: {
          description: string | null
          fetched_at: string
          id: string
          image_url: string | null
          message_id: string
          site_name: string | null
          title: string | null
          url: string
        }
        Insert: {
          description?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          message_id: string
          site_name?: string | null
          title?: string | null
          url: string
        }
        Update: {
          description?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          message_id?: string
          site_name?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_link_previews_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          message_type: string | null
          metadata: Json | null
          reply_to_id: string | null
          room_id: string
          sender_id: string
          sender_name: string | null
          sender_profile_url: string | null
          sender_type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          reply_to_id?: string | null
          room_id: string
          sender_id: string
          sender_name?: string | null
          sender_profile_url?: string | null
          sender_type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          reply_to_id?: string | null
          room_id?: string
          sender_id?: string
          sender_name?: string | null
          sender_profile_url?: string | null
          sender_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_pinned_messages: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          pin_order: number
          pinned_by: string
          pinned_by_type: string
          room_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          pin_order?: number
          pinned_by: string
          pinned_by_type: string
          room_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          pin_order?: number
          pinned_by?: string
          pinned_by_type?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_pinned_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reports: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          reason: string
          reported_message_id: string | null
          reported_user_id: string | null
          reported_user_type: string | null
          reporter_id: string
          reporter_type: string
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          reason: string
          reported_message_id?: string | null
          reported_user_id?: string | null
          reported_user_type?: string | null
          reporter_id: string
          reporter_type: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: string
          reported_message_id?: string | null
          reported_user_id?: string | null
          reported_user_type?: string | null
          reporter_id?: string
          reporter_type?: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_reports_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_members: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_muted: boolean | null
          last_read_at: string | null
          left_at: string | null
          role: string | null
          room_id: string
          updated_at: string | null
          user_id: string
          user_type: string
          visible_from: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_muted?: boolean | null
          last_read_at?: string | null
          left_at?: string | null
          role?: string | null
          room_id: string
          updated_at?: string | null
          user_id: string
          user_type: string
          visible_from?: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_muted?: boolean | null
          last_read_at?: string | null
          left_at?: string | null
          role?: string | null
          room_id?: string
          updated_at?: string | null
          user_id?: string
          user_type?: string
          visible_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          announcement: string | null
          announcement_at: string | null
          announcement_by: string | null
          announcement_by_type: string | null
          archived_at: string | null
          category: string
          created_at: string | null
          created_by: string
          created_by_type: string
          history_visible: boolean
          id: string
          is_active: boolean | null
          last_message_at: string | null
          last_message_content: string | null
          last_message_sender_id: string | null
          last_message_sender_name: string | null
          last_message_type: string | null
          name: string | null
          status: string
          tenant_id: string
          topic: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          announcement?: string | null
          announcement_at?: string | null
          announcement_by?: string | null
          announcement_by_type?: string | null
          archived_at?: string | null
          category?: string
          created_at?: string | null
          created_by: string
          created_by_type: string
          history_visible?: boolean
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_sender_id?: string | null
          last_message_sender_name?: string | null
          last_message_type?: string | null
          name?: string | null
          status?: string
          tenant_id: string
          topic?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          announcement?: string | null
          announcement_at?: string | null
          announcement_by?: string | null
          announcement_by_type?: string | null
          archived_at?: string | null
          category?: string
          created_at?: string | null
          created_by?: string
          created_by_type?: string
          history_visible?: boolean
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_sender_id?: string | null
          last_message_sender_name?: string | null
          last_message_type?: string | null
          name?: string | null
          status?: string
          tenant_id?: string
          topic?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_titles: {
        Row: {
          created_at: string
          id: string
          required_days: number
          sort_order: number
          title: string
          title_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          required_days: number
          sort_order?: number
          title: string
          title_type: string
        }
        Update: {
          created_at?: string
          id?: string
          required_days?: number
          sort_order?: number
          title?: string
          title_type?: string
        }
        Relationships: []
      }
      cold_start_logs: {
        Row: {
          books_count: number | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_params: Json
          items_count: number | null
          lectures_count: number | null
          new_items_count: number | null
          output_result: Json | null
          raw_response_sample: string | null
          skipped_items_count: number | null
          success: boolean
          updated_items_count: number | null
        }
        Insert: {
          books_count?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_params: Json
          items_count?: number | null
          lectures_count?: number | null
          new_items_count?: number | null
          output_result?: Json | null
          raw_response_sample?: string | null
          skipped_items_count?: number | null
          success: boolean
          updated_items_count?: number | null
        }
        Update: {
          books_count?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_params?: Json
          items_count?: number | null
          lectures_count?: number | null
          new_items_count?: number | null
          output_result?: Json | null
          raw_response_sample?: string | null
          skipped_items_count?: number | null
          success?: boolean
          updated_items_count?: number | null
        }
        Relationships: []
      }
      consultant_assignments: {
        Row: {
          consultant_id: string
          created_at: string | null
          created_by: string | null
          enrollment_id: string | null
          id: string
          notes: string | null
          role: string
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          consultant_id: string
          created_at?: string | null
          created_by?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          role?: string
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          consultant_id?: string
          created_at?: string | null
          created_by?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          role?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_assignments_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_assignments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_event_data: {
        Row: {
          consultant_id: string
          consultation_mode: string
          created_at: string | null
          enrollment_id: string | null
          event_id: string
          google_calendar_event_id: string | null
          google_shared_calendar_event_id: string | null
          google_sync_status: string | null
          id: string
          meeting_link: string | null
          notification_sent: boolean | null
          notification_sent_at: string | null
          notification_targets: string[]
          program_name: string | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          schedule_status: string
          session_type: string
          student_id: string
          updated_at: string | null
          visitor: string | null
        }
        Insert: {
          consultant_id: string
          consultation_mode?: string
          created_at?: string | null
          enrollment_id?: string | null
          event_id: string
          google_calendar_event_id?: string | null
          google_shared_calendar_event_id?: string | null
          google_sync_status?: string | null
          id?: string
          meeting_link?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          notification_targets?: string[]
          program_name?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          schedule_status?: string
          session_type?: string
          student_id: string
          updated_at?: string | null
          visitor?: string | null
        }
        Update: {
          consultant_id?: string
          consultation_mode?: string
          created_at?: string | null
          enrollment_id?: string | null
          event_id?: string
          google_calendar_event_id?: string | null
          google_shared_calendar_event_id?: string | null
          google_sync_status?: string | null
          id?: string
          meeting_link?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          notification_targets?: string[]
          program_name?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          schedule_status?: string
          session_type?: string
          student_id?: string
          updated_at?: string | null
          visitor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_event_data_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_event_data_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_event_data_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_event_data_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ai_extraction_logs: {
        Row: {
          confidence_scores: Json | null
          content_id: string | null
          content_type: string
          cost_usd: number | null
          created_at: string | null
          created_by: string | null
          extracted_metadata: Json
          final_metadata: Json | null
          id: string
          input_publisher: string | null
          input_title: string
          model_id: string | null
          tenant_id: string
          tokens_used: number | null
          user_modified: boolean | null
        }
        Insert: {
          confidence_scores?: Json | null
          content_id?: string | null
          content_type: string
          cost_usd?: number | null
          created_at?: string | null
          created_by?: string | null
          extracted_metadata?: Json
          final_metadata?: Json | null
          id?: string
          input_publisher?: string | null
          input_title: string
          model_id?: string | null
          tenant_id: string
          tokens_used?: number | null
          user_modified?: boolean | null
        }
        Update: {
          confidence_scores?: Json | null
          content_id?: string | null
          content_type?: string
          cost_usd?: number | null
          created_at?: string | null
          created_by?: string | null
          extracted_metadata?: Json
          final_metadata?: Json | null
          id?: string
          input_publisher?: string | null
          input_title?: string
          model_id?: string | null
          tenant_id?: string
          tokens_used?: number | null
          user_modified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ai_extraction_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_analysis_queue: {
        Row: {
          completed_at: string | null
          content_id: string
          content_type: string
          created_at: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          priority: number | null
          request_context: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          content_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          priority?: number | null
          request_context?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          content_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          priority?: number | null
          request_context?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_analysis_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_concept_mappings: {
        Row: {
          concept_id: string | null
          content_id: string
          content_type: string
          coverage_depth: number | null
          created_at: string | null
          episode_range: unknown
          id: string
          page_range: unknown
        }
        Insert: {
          concept_id?: string | null
          content_id: string
          content_type: string
          coverage_depth?: number | null
          created_at?: string | null
          episode_range?: unknown
          id?: string
          page_range?: unknown
        }
        Update: {
          concept_id?: string | null
          content_id?: string
          content_type?: string
          coverage_depth?: number | null
          created_at?: string | null
          episode_range?: unknown
          id?: string
          page_range?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "content_concept_mappings_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "content_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_concepts: {
        Row: {
          created_at: string | null
          curriculum_revision: string | null
          description: string | null
          difficulty_level: number | null
          grade_level: number[] | null
          id: string
          keywords: string[] | null
          name: string
          name_en: string | null
          prerequisites: string[] | null
          subject_category: string | null
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_revision?: string | null
          description?: string | null
          difficulty_level?: number | null
          grade_level?: number[] | null
          id?: string
          keywords?: string[] | null
          name: string
          name_en?: string | null
          prerequisites?: string[] | null
          subject_category?: string | null
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_revision?: string | null
          description?: string | null
          difficulty_level?: number | null
          grade_level?: number[] | null
          id?: string
          keywords?: string[] | null
          name?: string
          name_en?: string | null
          prerequisites?: string[] | null
          subject_category?: string | null
          subject_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_concepts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          dependent_content_id: string
          dependent_content_type: string
          id: string
          note: string | null
          plan_group_id: string | null
          prerequisite_content_id: string
          prerequisite_content_type: string
          scope: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dependent_content_id: string
          dependent_content_type: string
          id?: string
          note?: string | null
          plan_group_id?: string | null
          prerequisite_content_id: string
          prerequisite_content_type: string
          scope?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dependent_content_id?: string
          dependent_content_type?: string
          id?: string
          note?: string | null
          plan_group_id?: string | null
          prerequisite_content_id?: string
          prerequisite_content_type?: string
          scope?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_dependencies_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_dependencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_difficulty_analysis: {
        Row: {
          analysis_model: string | null
          analysis_prompt_version: string | null
          analysis_version: number | null
          analyzed_at: string | null
          analyzed_by: string | null
          concept_density: number | null
          content_id: string
          content_type: string
          created_at: string | null
          difficulty_confidence: number | null
          estimated_hours_per_unit: number | null
          id: string
          key_concepts_covered: Json | null
          mathematical_complexity: number | null
          overall_difficulty_score: number | null
          prerequisite_concepts: Json | null
          prerequisite_depth: number | null
          reasoning: string | null
          recommended_study_pace: Json | null
          updated_at: string | null
          vocabulary_complexity: number | null
        }
        Insert: {
          analysis_model?: string | null
          analysis_prompt_version?: string | null
          analysis_version?: number | null
          analyzed_at?: string | null
          analyzed_by?: string | null
          concept_density?: number | null
          content_id: string
          content_type: string
          created_at?: string | null
          difficulty_confidence?: number | null
          estimated_hours_per_unit?: number | null
          id?: string
          key_concepts_covered?: Json | null
          mathematical_complexity?: number | null
          overall_difficulty_score?: number | null
          prerequisite_concepts?: Json | null
          prerequisite_depth?: number | null
          reasoning?: string | null
          recommended_study_pace?: Json | null
          updated_at?: string | null
          vocabulary_complexity?: number | null
        }
        Update: {
          analysis_model?: string | null
          analysis_prompt_version?: string | null
          analysis_version?: number | null
          analyzed_at?: string | null
          analyzed_by?: string | null
          concept_density?: number | null
          content_id?: string
          content_type?: string
          created_at?: string | null
          difficulty_confidence?: number | null
          estimated_hours_per_unit?: number | null
          id?: string
          key_concepts_covered?: Json | null
          mathematical_complexity?: number | null
          overall_difficulty_score?: number | null
          prerequisite_concepts?: Json | null
          prerequisite_depth?: number | null
          reasoning?: string | null
          recommended_study_pace?: Json | null
          updated_at?: string | null
          vocabulary_complexity?: number | null
        }
        Relationships: []
      }
      content_partner_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_log: Json | null
          id: string
          items_created: number | null
          items_failed: number | null
          items_processed: number | null
          items_updated: number | null
          partner_id: string | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_log?: Json | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_processed?: number | null
          items_updated?: number | null
          partner_id?: string | null
          started_at: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_log?: Json | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_processed?: number | null
          items_updated?: number | null
          partner_id?: string | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_partner_sync_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "content_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      content_partners: {
        Row: {
          api_config: Json | null
          content_type: string
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string | null
          display_name: string
          field_mapping: Json | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          partner_type: string
          sync_status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_config?: Json | null
          content_type: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          display_name: string
          field_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          partner_type: string
          sync_status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_config?: Json | null
          content_type?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          display_name?: string
          field_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          partner_type?: string
          sync_status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      custom_content_templates: {
        Row: {
          created_at: string | null
          default_color: string | null
          default_difficulty: string | null
          default_estimated_minutes: number | null
          default_range_type: string | null
          default_range_unit: string | null
          default_subject: string | null
          default_subject_category: string | null
          description: string | null
          id: string
          name: string
          student_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_color?: string | null
          default_difficulty?: string | null
          default_estimated_minutes?: number | null
          default_range_type?: string | null
          default_range_unit?: string | null
          default_subject?: string | null
          default_subject_category?: string | null
          description?: string | null
          id?: string
          name: string
          student_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_color?: string | null
          default_difficulty?: string | null
          default_estimated_minutes?: number | null
          default_range_type?: string | null
          default_range_unit?: string | null
          default_subject?: string | null
          default_subject_category?: string | null
          description?: string | null
          id?: string
          name?: string
          student_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_content_templates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_content_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_check_ins: {
        Row: {
          check_date: string
          checked_at: string
          created_at: string
          id: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          check_date?: string
          checked_at?: string
          created_at?: string
          id?: string
          student_id: string
          tenant_id: string
        }
        Update: {
          check_date?: string
          checked_at?: string
          created_at?: string
          id?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_check_ins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_check_ins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      enrollments: {
        Row: {
          auto_end_on_expiry: boolean | null
          consultant_id: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          expiry_notified_at: Json | null
          id: string
          notes: string | null
          price: number | null
          price_note: string | null
          program_id: string
          start_date: string
          status: string
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auto_end_on_expiry?: boolean | null
          consultant_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          expiry_notified_at?: Json | null
          id?: string
          notes?: string | null
          price?: number | null
          price_note?: string | null
          program_id: string
          start_date?: string
          status?: string
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auto_end_on_expiry?: boolean | null
          consultant_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          expiry_notified_at?: Json | null
          id?: string
          notes?: string | null
          price?: number | null
          price_note?: string | null
          program_id?: string
          start_date?: string
          status?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_study_data: {
        Row: {
          actual_minutes: number | null
          chapter: string | null
          completed_amount: number | null
          content_id: string | null
          content_title: string | null
          content_type: string | null
          done: boolean
          done_at: string | null
          done_by: string | null
          estimated_minutes: number | null
          event_id: string
          flexible_content_id: string | null
          id: string
          master_content_id: string | null
          memo: string | null
          origin_plan_item_id: string | null
          pause_count: number | null
          paused_at: string | null
          paused_duration_seconds: number | null
          planned_end_page: number | null
          planned_start_page: number | null
          progress: number | null
          started_at: string | null
          subject_category: string | null
          subject_name: string | null
        }
        Insert: {
          actual_minutes?: number | null
          chapter?: string | null
          completed_amount?: number | null
          content_id?: string | null
          content_title?: string | null
          content_type?: string | null
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          estimated_minutes?: number | null
          event_id: string
          flexible_content_id?: string | null
          id?: string
          master_content_id?: string | null
          memo?: string | null
          origin_plan_item_id?: string | null
          pause_count?: number | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          planned_end_page?: number | null
          planned_start_page?: number | null
          progress?: number | null
          started_at?: string | null
          subject_category?: string | null
          subject_name?: string | null
        }
        Update: {
          actual_minutes?: number | null
          chapter?: string | null
          completed_amount?: number | null
          content_id?: string | null
          content_title?: string | null
          content_type?: string | null
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          estimated_minutes?: number | null
          event_id?: string
          flexible_content_id?: string | null
          id?: string
          master_content_id?: string | null
          memo?: string | null
          origin_plan_item_id?: string | null
          pause_count?: number | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          planned_end_page?: number | null
          planned_start_page?: number | null
          progress?: number | null
          started_at?: string | null
          subject_category?: string | null
          subject_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_study_data_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      file_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      file_contexts: {
        Row: {
          context_id: string | null
          context_type: string
          created_at: string
          file_id: string
          id: string
        }
        Insert: {
          context_id?: string | null
          context_type: string
          created_at?: string
          file_id: string
          id?: string
        }
        Update: {
          context_id?: string | null
          context_type?: string
          created_at?: string
          file_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_contexts_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_distributions: {
        Row: {
          created_at: string
          description: string | null
          distributed_by: string
          downloaded_at: string | null
          expires_at: string
          file_id: string
          id: string
          student_id: string
          tenant_id: string
          title: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          distributed_by: string
          downloaded_at?: string | null
          expires_at: string
          file_id: string
          id?: string
          student_id: string
          tenant_id: string
          title: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          distributed_by?: string
          downloaded_at?: string | null
          expires_at?: string
          file_id?: string
          id?: string
          student_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_distributions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_distributions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_distributions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      file_requests: {
        Row: {
          allowed_mime_types: string[] | null
          approved_file_id: string | null
          calendar_event_id: string | null
          category: string
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          rejection_reason: string | null
          status: string
          student_id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          approved_file_id?: string | null
          calendar_event_id?: string | null
          category: string
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          student_id: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          approved_file_id?: string | null
          calendar_event_id?: string | null
          category?: string
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          student_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_requests_approved_file_id_fkey"
            columns: ["approved_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_requests_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          category: string
          created_at: string
          expires_at: string
          id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          student_id: string | null
          tenant_id: string
          uploaded_by: string
          uploaded_by_role: string
          version_group_id: string
          version_number: number
        }
        Insert: {
          category: string
          created_at?: string
          expires_at: string
          id?: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          student_id?: string | null
          tenant_id: string
          uploaded_by: string
          uploaded_by_role: string
          version_group_id?: string
          version_number?: number
        }
        Update: {
          category?: string
          created_at?: string
          expires_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          student_id?: string | null
          tenant_id?: string
          uploaded_by?: string
          uploaded_by_role?: string
          version_group_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "files_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      flexible_contents: {
        Row: {
          archived_at: string | null
          color: string | null
          content_type: string
          created_at: string | null
          created_by: string | null
          curriculum: string | null
          description: string | null
          estimated_minutes: number | null
          icon: string | null
          id: string
          is_archived: boolean | null
          is_template: boolean | null
          item_type: string | null
          master_book_id: string | null
          master_custom_content_id: string | null
          master_lecture_id: string | null
          range_end: string | null
          range_start: string | null
          range_type: string | null
          range_unit: string | null
          student_id: string | null
          subject: string | null
          subject_area: string | null
          subject_id: string | null
          tags: string[] | null
          tenant_id: string
          title: string
          total_volume: number | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          content_type: string
          created_at?: string | null
          created_by?: string | null
          curriculum?: string | null
          description?: string | null
          estimated_minutes?: number | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_template?: boolean | null
          item_type?: string | null
          master_book_id?: string | null
          master_custom_content_id?: string | null
          master_lecture_id?: string | null
          range_end?: string | null
          range_start?: string | null
          range_type?: string | null
          range_unit?: string | null
          student_id?: string | null
          subject?: string | null
          subject_area?: string | null
          subject_id?: string | null
          tags?: string[] | null
          tenant_id: string
          title: string
          total_volume?: number | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          content_type?: string
          created_at?: string | null
          created_by?: string | null
          curriculum?: string | null
          description?: string | null
          estimated_minutes?: number | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_template?: boolean | null
          item_type?: string | null
          master_book_id?: string | null
          master_custom_content_id?: string | null
          master_lecture_id?: string | null
          range_end?: string | null
          range_start?: string | null
          range_type?: string | null
          range_unit?: string | null
          student_id?: string | null
          subject?: string | null
          subject_area?: string | null
          subject_id?: string | null
          tags?: string[] | null
          tenant_id?: string
          title?: string
          total_volume?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flexible_contents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_contents_master_book_id_fkey"
            columns: ["master_book_id"]
            isOneToOne: false
            referencedRelation: "master_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_contents_master_custom_content_id_fkey"
            columns: ["master_custom_content_id"]
            isOneToOne: false
            referencedRelation: "master_custom_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_contents_master_lecture_id_fkey"
            columns: ["master_lecture_id"]
            isOneToOne: false
            referencedRelation: "master_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_contents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_contents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_contents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_sync_queue: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          retry_count: number | null
          schedule_id: string
          status: string
          target: string
          tenant_id: string
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          retry_count?: number | null
          schedule_id: string
          status?: string
          target: string
          tenant_id: string
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          retry_count?: number | null
          schedule_id?: string
          status?: string
          target?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_queue_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_sync_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          admin_user_id: string
          calendar_id: string
          connected_at: string | null
          created_at: string | null
          google_email: string | null
          id: string
          last_sync_at: string | null
          refresh_token: string
          scope: string
          sync_enabled: boolean | null
          tenant_id: string
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          admin_user_id: string
          calendar_id?: string
          connected_at?: string | null
          created_at?: string | null
          google_email?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token: string
          scope: string
          sync_enabled?: boolean | null
          tenant_id: string
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          admin_user_id?: string
          calendar_id?: string
          connected_at?: string | null
          created_at?: string | null
          google_email?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string
          scope?: string
          sync_enabled?: boolean | null
          tenant_id?: string
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_tokens_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: true
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_oauth_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      habit_logs: {
        Row: {
          completed_count: number | null
          created_at: string | null
          habit_id: string
          id: string
          is_completed: boolean | null
          log_date: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          completed_count?: number | null
          created_at?: string | null
          habit_id: string
          id?: string
          is_completed?: boolean | null
          log_date: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_count?: number | null
          created_at?: string | null
          habit_id?: string
          id?: string
          is_completed?: boolean | null
          log_date?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string | null
          current_streak: number | null
          description: string | null
          frequency_days: number[] | null
          frequency_type: string
          icon: string | null
          id: string
          longest_streak: number | null
          order_index: number | null
          status: string | null
          student_id: string
          target_count: number | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          current_streak?: number | null
          description?: string | null
          frequency_days?: number[] | null
          frequency_type?: string
          icon?: string | null
          id?: string
          longest_streak?: number | null
          order_index?: number | null
          status?: string | null
          student_id: string
          target_count?: number | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          current_streak?: number | null
          description?: string | null
          frequency_days?: number[] | null
          frequency_type?: string
          icon?: string | null
          id?: string
          longest_streak?: number | null
          order_index?: number | null
          status?: string | null
          student_id?: string
          target_count?: number | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          action_name: string
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          request_hash: string | null
          response: Json | null
          status: string
          user_id: string
        }
        Insert: {
          action_name: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          request_hash?: string | null
          response?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          action_name?: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          request_hash?: string | null
          response?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          delivered_at: string | null
          delivery_method: string
          delivery_status: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          legacy_code: string | null
          phone: string | null
          relation: string | null
          status: string
          student_id: string | null
          target_role: string
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          delivery_status?: string
          email?: string | null
          expires_at: string
          id?: string
          invited_by: string
          legacy_code?: string | null
          phone?: string | null
          relation?: string | null
          status?: string
          student_id?: string | null
          target_role: string
          tenant_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          delivery_status?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          legacy_code?: string | null
          phone?: string | null
          relation?: string | null
          status?: string
          student_id?: string | null
          target_role?: string
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          relation: string | null
          student_id: string
          target_role: string
          tenant_id: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          relation?: string | null
          student_id: string
          target_role: string
          tenant_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          relation?: string | null
          student_id?: string
          target_role?: string
          tenant_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_date: string
          activity_type: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          metadata: Json | null
          new_status: string | null
          performed_by: string
          previous_status: string | null
          tenant_id: string
          title: string | null
        }
        Insert: {
          activity_date?: string
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          new_status?: string | null
          performed_by: string
          previous_status?: string | null
          tenant_id: string
          title?: string | null
        }
        Update: {
          activity_date?: string
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          new_status?: string | null
          performed_by?: string
          previous_status?: string | null
          tenant_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_logs: {
        Row: {
          created_at: string
          delta: number
          id: string
          lead_id: string
          new_score: number
          previous_score: number
          reason: string
          score_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          lead_id: string
          new_score: number
          previous_score: number
          reason: string
          score_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          lead_id?: string
          new_score?: number
          previous_score?: number
          reason?: string
          score_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_score_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          is_auto_created: boolean
          is_overdue: boolean
          lead_id: string
          priority: string
          status: string
          task_type: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          is_auto_created?: boolean
          is_overdue?: boolean
          lead_id: string
          priority?: string
          status?: string
          task_type: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          is_auto_created?: boolean
          is_overdue?: boolean
          lead_id?: string
          priority?: string
          status?: string
          task_type?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      llm_response_cache: {
        Row: {
          cache_key: string
          cost_usd: number | null
          created_at: string | null
          expires_at: string
          hit_count: number | null
          id: string
          last_hit_at: string | null
          model_id: string | null
          operation_type: string
          request_hash: string
          response_data: Json
          tenant_id: string | null
          token_usage: Json | null
        }
        Insert: {
          cache_key: string
          cost_usd?: number | null
          created_at?: string | null
          expires_at: string
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          model_id?: string | null
          operation_type: string
          request_hash: string
          response_data: Json
          tenant_id?: string | null
          token_usage?: Json | null
        }
        Update: {
          cache_key?: string
          cost_usd?: number | null
          created_at?: string | null
          expires_at?: string
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          model_id?: string | null
          operation_type?: string
          request_hash?: string
          response_data?: Json
          tenant_id?: string | null
          token_usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_response_cache_tenant_id_fkey"
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
          cold_start_update_count: number | null
          cold_start_updated_at: string | null
          content_category: string | null
          cover_image_url: string | null
          created_at: string | null
          curriculum_revision_id: string | null
          description: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          edition: string | null
          estimated_hours: number | null
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
          recommendation_metadata: Json | null
          review_count: number | null
          review_score: number | null
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
          target_students: string[] | null
          tenant_id: string | null
          title: string
          toc: string | null
          total_pages: number | null
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          cold_start_update_count?: number | null
          cold_start_updated_at?: string | null
          content_category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          edition?: string | null
          estimated_hours?: number | null
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
          recommendation_metadata?: Json | null
          review_count?: number | null
          review_score?: number | null
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
          target_students?: string[] | null
          tenant_id?: string | null
          title: string
          toc?: string | null
          total_pages?: number | null
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          cold_start_update_count?: number | null
          cold_start_updated_at?: string | null
          content_category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          edition?: string | null
          estimated_hours?: number | null
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
          recommendation_metadata?: Json | null
          review_count?: number | null
          review_score?: number | null
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
          target_students?: string[] | null
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
      master_instructors: {
        Row: {
          created_at: string | null
          difficulty_focus: string | null
          explanation_style: string | null
          id: string
          instructor_metadata: Json | null
          is_active: boolean | null
          lecture_pace: string | null
          name: string
          platform: string | null
          profile_image_url: string | null
          profile_summary: string | null
          review_count: number | null
          review_score: number | null
          source: string | null
          specialty: string | null
          strengths: string[] | null
          subject_categories: string[] | null
          subjects: string[] | null
          target_students: string[] | null
          teaching_style: string | null
          tenant_id: string | null
          updated_at: string | null
          weaknesses: string[] | null
        }
        Insert: {
          created_at?: string | null
          difficulty_focus?: string | null
          explanation_style?: string | null
          id?: string
          instructor_metadata?: Json | null
          is_active?: boolean | null
          lecture_pace?: string | null
          name: string
          platform?: string | null
          profile_image_url?: string | null
          profile_summary?: string | null
          review_count?: number | null
          review_score?: number | null
          source?: string | null
          specialty?: string | null
          strengths?: string[] | null
          subject_categories?: string[] | null
          subjects?: string[] | null
          target_students?: string[] | null
          teaching_style?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          weaknesses?: string[] | null
        }
        Update: {
          created_at?: string | null
          difficulty_focus?: string | null
          explanation_style?: string | null
          id?: string
          instructor_metadata?: Json | null
          is_active?: boolean | null
          lecture_pace?: string | null
          name?: string
          platform?: string | null
          profile_image_url?: string | null
          profile_summary?: string | null
          review_count?: number | null
          review_score?: number | null
          source?: string | null
          specialty?: string | null
          strengths?: string[] | null
          subject_categories?: string[] | null
          subjects?: string[] | null
          target_students?: string[] | null
          teaching_style?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "master_instructors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_lectures: {
        Row: {
          cold_start_update_count: number | null
          cold_start_updated_at: string | null
          content_category: string | null
          created_at: string | null
          curriculum_revision_id: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          episode_analysis: Json | null
          estimated_hours: number | null
          grade_level: string | null
          id: string
          instructor_id: string | null
          instructor_name: string | null
          is_active: boolean
          lecture_source_url: string | null
          lecture_type: string | null
          linked_book_id: string | null
          notes: string | null
          overall_difficulty: number | null
          platform: string | null
          platform_id: string | null
          recommendation_metadata: Json | null
          review_count: number | null
          review_score: number | null
          revision: string | null
          subject: string | null
          subject_category: string | null
          subject_group_id: string | null
          subject_id: string | null
          target_students: string[] | null
          tenant_id: string | null
          title: string
          total_duration: number | null
          total_episodes: number
          transcript: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          cold_start_update_count?: number | null
          cold_start_updated_at?: string | null
          content_category?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          episode_analysis?: Json | null
          estimated_hours?: number | null
          grade_level?: string | null
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          is_active?: boolean
          lecture_source_url?: string | null
          lecture_type?: string | null
          linked_book_id?: string | null
          notes?: string | null
          overall_difficulty?: number | null
          platform?: string | null
          platform_id?: string | null
          recommendation_metadata?: Json | null
          review_count?: number | null
          review_score?: number | null
          revision?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          target_students?: string[] | null
          tenant_id?: string | null
          title: string
          total_duration?: number | null
          total_episodes: number
          transcript?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          cold_start_update_count?: number | null
          cold_start_updated_at?: string | null
          content_category?: string | null
          created_at?: string | null
          curriculum_revision_id?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          episode_analysis?: Json | null
          estimated_hours?: number | null
          grade_level?: string | null
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          is_active?: boolean
          lecture_source_url?: string | null
          lecture_type?: string | null
          linked_book_id?: string | null
          notes?: string | null
          overall_difficulty?: number | null
          platform?: string | null
          platform_id?: string | null
          recommendation_metadata?: Json | null
          review_count?: number | null
          review_score?: number | null
          revision?: string | null
          subject?: string | null
          subject_category?: string | null
          subject_group_id?: string | null
          subject_id?: string | null
          target_students?: string[] | null
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
            foreignKeyName: "master_lectures_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "master_instructors"
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
      notification_log: {
        Row: {
          body: string
          channel: string
          clicked: boolean | null
          clicked_at: string | null
          delivered: boolean | null
          id: string
          reference_id: string | null
          sent_at: string | null
          skipped_reason: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          channel: string
          clicked?: boolean | null
          clicked_at?: string | null
          delivered?: boolean | null
          id?: string
          reference_id?: string | null
          sent_at?: string | null
          skipped_reason?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          clicked?: boolean | null
          clicked_at?: string | null
          delivered?: boolean | null
          id?: string
          reference_id?: string | null
          sent_at?: string | null
          skipped_reason?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          id: string
          parent_id: string
          relation: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          relation: string
          student_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          profile_image_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          name: string
          phone?: string | null
          profile_image_url?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          profile_image_url?: string | null
          tenant_id?: string
          updated_at?: string
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
      payment_links: {
        Row: {
          academy_name: string
          amount: number
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_method: string | null
          delivery_status: string
          due_date: string | null
          expires_at: string
          id: string
          last_viewed_at: string | null
          memo: string | null
          paid_at: string | null
          payment_record_id: string
          program_name: string
          recipient_phone: string | null
          status: string
          student_id: string
          student_name: string
          tenant_id: string
          token: string
          toss_payment_key: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          academy_name: string
          amount: number
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_method?: string | null
          delivery_status?: string
          due_date?: string | null
          expires_at: string
          id?: string
          last_viewed_at?: string | null
          memo?: string | null
          paid_at?: string | null
          payment_record_id: string
          program_name: string
          recipient_phone?: string | null
          status?: string
          student_id: string
          student_name: string
          tenant_id: string
          token: string
          toss_payment_key?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          academy_name?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_method?: string | null
          delivery_status?: string
          due_date?: string | null
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          memo?: string | null
          paid_at?: string | null
          payment_record_id?: string
          program_name?: string
          recipient_phone?: string | null
          status?: string
          student_id?: string
          student_name?: string
          tenant_id?: string
          token?: string
          toss_payment_key?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          status: string
          tenant_id: string
          toss_approved_at: string | null
          toss_method: string | null
          toss_order_id: string
          toss_payment_key: string | null
          toss_raw_response: Json | null
          toss_receipt_url: string | null
          toss_requested_at: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          status?: string
          tenant_id: string
          toss_approved_at?: string | null
          toss_method?: string | null
          toss_order_id: string
          toss_payment_key?: string | null
          toss_raw_response?: Json | null
          toss_receipt_url?: string | null
          toss_requested_at?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          status?: string
          tenant_id?: string
          toss_approved_at?: string | null
          toss_method?: string | null
          toss_order_id?: string
          toss_payment_key?: string | null
          toss_raw_response?: Json | null
          toss_receipt_url?: string | null
          toss_requested_at?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          billing_period: string | null
          cash_receipt_key: string | null
          cash_receipt_type: string | null
          cash_receipt_url: string | null
          created_at: string
          created_by: string | null
          discount_type: string | null
          discount_value: number | null
          due_date: string | null
          enrollment_id: string
          id: string
          memo: string | null
          original_amount: number | null
          paid_amount: number
          paid_date: string | null
          payment_method: string | null
          payment_order_id: string | null
          reminder_sent_at: Json | null
          status: string
          student_id: string
          tenant_id: string
          toss_approved_at: string | null
          toss_method: string | null
          toss_order_id: string | null
          toss_payment_key: string | null
          toss_raw_response: Json | null
          toss_receipt_url: string | null
          toss_requested_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_period?: string | null
          cash_receipt_key?: string | null
          cash_receipt_type?: string | null
          cash_receipt_url?: string | null
          created_at?: string
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          enrollment_id: string
          id?: string
          memo?: string | null
          original_amount?: number | null
          paid_amount?: number
          paid_date?: string | null
          payment_method?: string | null
          payment_order_id?: string | null
          reminder_sent_at?: Json | null
          status?: string
          student_id: string
          tenant_id: string
          toss_approved_at?: string | null
          toss_method?: string | null
          toss_order_id?: string | null
          toss_payment_key?: string | null
          toss_raw_response?: Json | null
          toss_receipt_url?: string | null
          toss_requested_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period?: string | null
          cash_receipt_key?: string | null
          cash_receipt_type?: string | null
          cash_receipt_url?: string | null
          created_at?: string
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          enrollment_id?: string
          id?: string
          memo?: string | null
          original_amount?: number | null
          paid_amount?: number
          paid_date?: string | null
          payment_method?: string | null
          payment_order_id?: string | null
          reminder_sent_at?: Json | null
          status?: string
          student_id?: string
          tenant_id?: string
          toss_approved_at?: string | null
          toss_method?: string | null
          toss_order_id?: string | null
          toss_payment_key?: string | null
          toss_raw_response?: Json | null
          toss_receipt_url?: string | null
          toss_requested_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_tenant_id_fkey"
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
          content_name: string | null
          content_scheduler_options: Json | null
          content_type: string
          created_at: string | null
          custom_study_days: number[] | null
          display_order: number
          end_detail_id: string | null
          end_range: number
          generation_status: string | null
          id: string
          individual_schedule: Json | null
          is_auto_recommended: boolean | null
          is_paused: boolean | null
          master_content_id: string | null
          paused_until: string | null
          plan_group_id: string
          priority: string | null
          recommendation_metadata: Json | null
          recommendation_reason: string | null
          recommendation_source: string | null
          recommended_at: string | null
          recommended_by: string | null
          scheduler_mode: string | null
          start_detail_id: string | null
          start_range: number
          subject_category: string | null
          subject_name: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          content_id: string
          content_name?: string | null
          content_scheduler_options?: Json | null
          content_type: string
          created_at?: string | null
          custom_study_days?: number[] | null
          display_order?: number
          end_detail_id?: string | null
          end_range: number
          generation_status?: string | null
          id?: string
          individual_schedule?: Json | null
          is_auto_recommended?: boolean | null
          is_paused?: boolean | null
          master_content_id?: string | null
          paused_until?: string | null
          plan_group_id: string
          priority?: string | null
          recommendation_metadata?: Json | null
          recommendation_reason?: string | null
          recommendation_source?: string | null
          recommended_at?: string | null
          recommended_by?: string | null
          scheduler_mode?: string | null
          start_detail_id?: string | null
          start_range: number
          subject_category?: string | null
          subject_name?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          content_id?: string
          content_name?: string | null
          content_scheduler_options?: Json | null
          content_type?: string
          created_at?: string | null
          custom_study_days?: number[] | null
          display_order?: number
          end_detail_id?: string | null
          end_range?: number
          generation_status?: string | null
          id?: string
          individual_schedule?: Json | null
          is_auto_recommended?: boolean | null
          is_paused?: boolean | null
          master_content_id?: string | null
          paused_until?: string | null
          plan_group_id?: string
          priority?: string | null
          recommendation_metadata?: Json | null
          recommendation_reason?: string | null
          recommendation_source?: string | null
          recommended_at?: string | null
          recommended_by?: string | null
          scheduler_mode?: string | null
          start_detail_id?: string | null
          start_range?: number
          subject_category?: string | null
          subject_name?: string | null
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
      plan_creation_history: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          creation_method: string
          failed_count: number
          id: string
          results: Json
          settings_snapshot: Json
          skipped_count: number
          started_at: string | null
          status: string
          success_count: number
          target_student_ids: string[]
          template_id: string | null
          tenant_id: string
          total_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_method: string
          failed_count?: number
          id?: string
          results?: Json
          settings_snapshot?: Json
          skipped_count?: number
          started_at?: string | null
          status?: string
          success_count?: number
          target_student_ids?: string[]
          template_id?: string | null
          tenant_id: string
          total_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_method?: string
          failed_count?: number
          id?: string
          results?: Json
          settings_snapshot?: Json
          skipped_count?: number
          started_at?: string | null
          status?: string
          success_count?: number
          target_student_ids?: string[]
          template_id?: string | null
          tenant_id?: string
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_creation_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plan_creation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_creation_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_creation_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          creation_method: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          settings: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          creation_method: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          settings?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          creation_method?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          settings?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_creation_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_type: string
          ad_hoc_plan_id: string | null
          causation_id: string | null
          correlation_id: string | null
          event_category: string
          event_type: string
          id: string
          ip_address: unknown
          new_state: Json | null
          occurred_at: string
          payload: Json
          plan_group_id: string | null
          previous_state: Json | null
          student_id: string
          student_plan_id: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          ad_hoc_plan_id?: string | null
          causation_id?: string | null
          correlation_id?: string | null
          event_category: string
          event_type: string
          id?: string
          ip_address?: unknown
          new_state?: Json | null
          occurred_at?: string
          payload?: Json
          plan_group_id?: string | null
          previous_state?: Json | null
          student_id: string
          student_plan_id?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          ad_hoc_plan_id?: string | null
          causation_id?: string | null
          correlation_id?: string | null
          event_category?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          new_state?: Json | null
          occurred_at?: string
          payload?: Json
          plan_group_id?: string | null
          previous_state?: Json | null
          student_id?: string
          student_plan_id?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_events_plan_group_id_fkey"
            columns: ["plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_events_student_plan_id_fkey"
            columns: ["student_plan_id"]
            isOneToOne: false
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_events_student_plan_id_fkey"
            columns: ["student_plan_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_events_student_plan_id_fkey"
            columns: ["student_plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_events_student_plan_id_fkey"
            columns: ["student_plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan_completion_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_events_student_plan_id_fkey"
            columns: ["student_plan_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_execution_logs: {
        Row: {
          created_at: string
          elapsed_seconds: number | null
          event_type: string
          id: string
          log_date: string | null
          metadata: Json | null
          new_value: Json | null
          plan_id: string
          previous_value: Json | null
          progress_percent: number | null
          status: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          elapsed_seconds?: number | null
          event_type: string
          id?: string
          log_date?: string | null
          metadata?: Json | null
          new_value?: Json | null
          plan_id: string
          previous_value?: Json | null
          progress_percent?: number | null
          status?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          elapsed_seconds?: number | null
          event_type?: string
          id?: string
          log_date?: string | null
          metadata?: Json | null
          new_value?: Json | null
          plan_id?: string
          previous_value?: Json | null
          progress_percent?: number | null
          status?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_execution_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_execution_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_execution_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_execution_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan_completion_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_execution_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_execution_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_execution_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_group_backups: {
        Row: {
          backup_data: Json
          created_at: string | null
          deleted_by: string | null
          id: string
          plan_group_id: string
          planner_id: string | null
          restored_at: string | null
          restored_by: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          backup_data: Json
          created_at?: string | null
          deleted_by?: string | null
          id?: string
          plan_group_id: string
          planner_id?: string | null
          restored_at?: string | null
          restored_by?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          backup_data?: Json
          created_at?: string | null
          deleted_by?: string | null
          id?: string
          plan_group_id?: string
          planner_id?: string | null
          restored_at?: string | null
          restored_by?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_plan_group_backups_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_plan_group_backups_tenant"
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
          admin_memo: string | null
          admin_modified_at: string | null
          admin_stats: Json | null
          block_set_id: string | null
          calendar_id: string | null
          camp_invitation_id: string | null
          camp_template_id: string | null
          consultation_status: string | null
          content_id: string | null
          content_slots: Json | null
          content_status: string | null
          content_type: string | null
          created_at: string | null
          creation_mode: string | null
          daily_schedule: Json | null
          default_scheduler_options: Json | null
          deleted_at: string | null
          end_detail_id: string | null
          end_range: number | null
          id: string
          is_calendar_only: boolean | null
          is_locked: boolean | null
          is_single_content: boolean | null
          is_single_day: boolean | null
          is_timezone_only: boolean | null
          last_admin_id: string | null
          lunch_time: Json | null
          master_content_id: string | null
          migrated_from_adhoc_id: string | null
          modification_history: Json | null
          name: string | null
          non_study_time_blocks: Json | null
          period_end: string
          period_start: string
          plan_mode: string | null
          plan_purpose: string | null
          plan_type: string | null
          request_notes: string | null
          schedule_generated_at: string | null
          scheduler_options: Json | null
          scheduler_type: string | null
          self_study_hours: Json | null
          start_detail_id: string | null
          start_range: number | null
          status: string | null
          strategy_days_per_week: number | null
          student_id: string
          student_permissions: Json | null
          study_hours: Json | null
          study_type: string | null
          subject_constraints: Json | null
          target_date: string | null
          template_plan_group_id: string | null
          tenant_id: string
          timezone_status: string | null
          unlock_request_memo: string | null
          unlock_requested: boolean | null
          updated_at: string | null
          use_slot_mode: boolean | null
        }
        Insert: {
          additional_period_reallocation?: Json | null
          admin_memo?: string | null
          admin_modified_at?: string | null
          admin_stats?: Json | null
          block_set_id?: string | null
          calendar_id?: string | null
          camp_invitation_id?: string | null
          camp_template_id?: string | null
          consultation_status?: string | null
          content_id?: string | null
          content_slots?: Json | null
          content_status?: string | null
          content_type?: string | null
          created_at?: string | null
          creation_mode?: string | null
          daily_schedule?: Json | null
          default_scheduler_options?: Json | null
          deleted_at?: string | null
          end_detail_id?: string | null
          end_range?: number | null
          id?: string
          is_calendar_only?: boolean | null
          is_locked?: boolean | null
          is_single_content?: boolean | null
          is_single_day?: boolean | null
          is_timezone_only?: boolean | null
          last_admin_id?: string | null
          lunch_time?: Json | null
          master_content_id?: string | null
          migrated_from_adhoc_id?: string | null
          modification_history?: Json | null
          name?: string | null
          non_study_time_blocks?: Json | null
          period_end: string
          period_start: string
          plan_mode?: string | null
          plan_purpose?: string | null
          plan_type?: string | null
          request_notes?: string | null
          schedule_generated_at?: string | null
          scheduler_options?: Json | null
          scheduler_type?: string | null
          self_study_hours?: Json | null
          start_detail_id?: string | null
          start_range?: number | null
          status?: string | null
          strategy_days_per_week?: number | null
          student_id: string
          student_permissions?: Json | null
          study_hours?: Json | null
          study_type?: string | null
          subject_constraints?: Json | null
          target_date?: string | null
          template_plan_group_id?: string | null
          tenant_id: string
          timezone_status?: string | null
          unlock_request_memo?: string | null
          unlock_requested?: boolean | null
          updated_at?: string | null
          use_slot_mode?: boolean | null
        }
        Update: {
          additional_period_reallocation?: Json | null
          admin_memo?: string | null
          admin_modified_at?: string | null
          admin_stats?: Json | null
          block_set_id?: string | null
          calendar_id?: string | null
          camp_invitation_id?: string | null
          camp_template_id?: string | null
          consultation_status?: string | null
          content_id?: string | null
          content_slots?: Json | null
          content_status?: string | null
          content_type?: string | null
          created_at?: string | null
          creation_mode?: string | null
          daily_schedule?: Json | null
          default_scheduler_options?: Json | null
          deleted_at?: string | null
          end_detail_id?: string | null
          end_range?: number | null
          id?: string
          is_calendar_only?: boolean | null
          is_locked?: boolean | null
          is_single_content?: boolean | null
          is_single_day?: boolean | null
          is_timezone_only?: boolean | null
          last_admin_id?: string | null
          lunch_time?: Json | null
          master_content_id?: string | null
          migrated_from_adhoc_id?: string | null
          modification_history?: Json | null
          name?: string | null
          non_study_time_blocks?: Json | null
          period_end?: string
          period_start?: string
          plan_mode?: string | null
          plan_purpose?: string | null
          plan_type?: string | null
          request_notes?: string | null
          schedule_generated_at?: string | null
          scheduler_options?: Json | null
          scheduler_type?: string | null
          self_study_hours?: Json | null
          start_detail_id?: string | null
          start_range?: number | null
          status?: string | null
          strategy_days_per_week?: number | null
          student_id?: string
          student_permissions?: Json | null
          study_hours?: Json | null
          study_type?: string | null
          subject_constraints?: Json | null
          target_date?: string | null
          template_plan_group_id?: string | null
          tenant_id?: string
          timezone_status?: string | null
          unlock_request_memo?: string | null
          unlock_requested?: boolean | null
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
            foreignKeyName: "plan_groups_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
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
            foreignKeyName: "plan_groups_last_admin_id_fkey"
            columns: ["last_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
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
            foreignKeyName: "plan_groups_template_plan_group_id_fkey"
            columns: ["template_plan_group_id"]
            isOneToOne: false
            referencedRelation: "plan_groups"
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
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
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
            referencedRelation: "student_plan_completion_status"
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
      plan_reminder_logs: {
        Row: {
          id: string
          plan_count: number | null
          reminder_date: string
          reminder_type: string
          sent_at: string | null
          student_id: string
        }
        Insert: {
          id?: string
          plan_count?: number | null
          reminder_date: string
          reminder_type: string
          sent_at?: string | null
          student_id: string
        }
        Update: {
          id?: string
          plan_count?: number | null
          reminder_date?: string
          reminder_type?: string
          sent_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_reminder_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_satisfaction_ratings: {
        Row: {
          actual_duration: number | null
          completion_rate: number | null
          content_type: string | null
          created_at: string
          estimated_duration: number | null
          feedback: string | null
          id: string
          plan_id: string
          rating: number
          student_id: string
          subject_type: string | null
          tags: string[] | null
          tenant_id: string | null
        }
        Insert: {
          actual_duration?: number | null
          completion_rate?: number | null
          content_type?: string | null
          created_at?: string
          estimated_duration?: number | null
          feedback?: string | null
          id?: string
          plan_id: string
          rating: number
          student_id: string
          subject_type?: string | null
          tags?: string[] | null
          tenant_id?: string | null
        }
        Update: {
          actual_duration?: number | null
          completion_rate?: number | null
          content_type?: string | null
          created_at?: string
          estimated_duration?: number | null
          feedback?: string | null
          id?: string
          plan_id?: string
          rating?: number
          student_id?: string
          subject_type?: string | null
          tags?: string[] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_satisfaction_ratings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_satisfaction_ratings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_satisfaction_ratings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_satisfaction_ratings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "student_plan_completion_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_satisfaction_ratings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_satisfaction_ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_satisfaction_ratings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          items: Json
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          items?: Json
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          items?: Json
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_views: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          settings: Json | null
          student_id: string
          tenant_id: string
          updated_at: string | null
          view_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          settings?: Json | null
          student_id: string
          tenant_id: string
          updated_at?: string | null
          view_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          settings?: Json | null
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_views_tenant_id_fkey"
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
      programs: {
        Row: {
          billing_type: string
          code: string
          created_at: string
          description: string | null
          display_order: number
          duration_months: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          price_unit: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_type?: string
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_months?: number | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          price_unit?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_type?: string
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_months?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          price_unit?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      push_dlq: {
        Row: {
          created_at: string | null
          error_code: number | null
          error_message: string | null
          id: string
          payload: Json
          resolved_at: string | null
          resolved_by: string | null
          retry_count: number | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_code?: number | null
          error_message?: string | null
          id?: string
          payload: Json
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number | null
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_code?: number | null
          error_message?: string | null
          id?: string
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_push_dlq_subscription"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          device_label: string | null
          endpoint: string
          id: string
          is_active: boolean | null
          keys_auth: string
          keys_p256dh: string
          subscription: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_label?: string | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          keys_auth: string
          keys_p256dh: string
          subscription: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_label?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          keys_auth?: string
          keys_p256dh?: string
          subscription?: Json
          updated_at?: string | null
          user_id?: string
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
      request_templates: {
        Row: {
          allowed_mime_types: string[] | null
          category: string
          created_at: string
          created_by: string
          deadline_days: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          category: string
          created_at?: string
          created_by: string
          deadline_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          category?: string
          created_at?: string
          created_by?: string
          deadline_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      sales_leads: {
        Row: {
          assigned_to: string | null
          contact_name: string
          contact_phone: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          engagement_score: number
          fit_score: number
          id: string
          inquiry_date: string
          inquiry_type: string | null
          is_spam: boolean
          lead_source: string
          lead_source_detail: string | null
          notes: string | null
          pipeline_status: string
          program_id: string | null
          quality_level: string
          region: string | null
          registration_checklist: Json
          score_updated_at: string | null
          spam_reason: string | null
          student_grade: number | null
          student_id: string | null
          student_name: string | null
          student_school_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_name: string
          contact_phone?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          engagement_score?: number
          fit_score?: number
          id?: string
          inquiry_date?: string
          inquiry_type?: string | null
          is_spam?: boolean
          lead_source: string
          lead_source_detail?: string | null
          notes?: string | null
          pipeline_status?: string
          program_id?: string | null
          quality_level?: string
          region?: string | null
          registration_checklist?: Json
          score_updated_at?: string | null
          spam_reason?: string | null
          student_grade?: number | null
          student_id?: string | null
          student_name?: string | null
          student_school_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_name?: string
          contact_phone?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          engagement_score?: number
          fit_score?: number
          id?: string
          inquiry_date?: string
          inquiry_type?: string | null
          is_spam?: boolean
          lead_source?: string
          lead_source_detail?: string | null
          notes?: string | null
          pipeline_status?: string
          program_id?: string | null
          quality_level?: string
          region?: string | null
          registration_checklist?: Json
          score_updated_at?: string | null
          spam_reason?: string | null
          student_grade?: number | null
          student_id?: string | null
          student_name?: string | null
          student_school_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          attempts: number
          content: string
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          message_type: string
          metadata: Json | null
          reply_to_id: string | null
          room_id: string
          scheduled_at: string
          sender_id: string
          sender_name_snapshot: string
          sender_profile_url_snapshot: string | null
          sender_type: string
          sent_at: string | null
          sent_message_id: string | null
          status: string
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          content: string
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          message_type?: string
          metadata?: Json | null
          reply_to_id?: string | null
          room_id: string
          scheduled_at: string
          sender_id: string
          sender_name_snapshot?: string
          sender_profile_url_snapshot?: string | null
          sender_type: string
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          content?: string
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          message_type?: string
          metadata?: Json | null
          reply_to_id?: string | null
          room_id?: string
          scheduled_at?: string
          sender_id?: string
          sender_name_snapshot?: string
          sender_profile_url_snapshot?: string | null
          sender_type?: string
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_sent_message_id_fkey"
            columns: ["sent_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_tenant_id_fkey"
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
          alimtalk_template_code: string | null
          channel: string | null
          consultation_schedule_id: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          is_fallback: boolean | null
          message_content: string
          message_key: string | null
          notification_target: string | null
          ppurio_result_code: string | null
          recipient_id: string | null
          recipient_phone: string
          ref_key: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          alimtalk_template_code?: string | null
          channel?: string | null
          consultation_schedule_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          is_fallback?: boolean | null
          message_content: string
          message_key?: string | null
          notification_target?: string | null
          ppurio_result_code?: string | null
          recipient_id?: string | null
          recipient_phone: string
          ref_key?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id: string
        }
        Update: {
          alimtalk_template_code?: string | null
          channel?: string | null
          consultation_schedule_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          is_fallback?: boolean | null
          message_content?: string
          message_key?: string | null
          notification_target?: string | null
          ppurio_result_code?: string | null
          recipient_id?: string | null
          recipient_phone?: string
          ref_key?: string | null
          scheduled_at?: string | null
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
      student_connection_history: {
        Row: {
          action: string
          auth_user_id: string
          created_at: string
          id: string
          performed_by: string
          reason: string | null
          student_id: string
        }
        Insert: {
          action: string
          auth_user_id: string
          created_at?: string
          id?: string
          performed_by: string
          reason?: string | null
          student_id: string
        }
        Update: {
          action?: string
          auth_user_id?: string
          created_at?: string
          id?: string
          performed_by?: string
          reason?: string | null
          student_id?: string
        }
        Relationships: []
      }
      student_consulting_notes: {
        Row: {
          consultant_id: string
          consultation_schedule_id: string | null
          created_at: string
          enrollment_id: string | null
          follow_up_date: string | null
          id: string
          is_visible_to_parent: boolean | null
          next_action: string | null
          note: string
          session_date: string | null
          session_duration: number | null
          session_type: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          consultant_id: string
          consultation_schedule_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          follow_up_date?: string | null
          id?: string
          is_visible_to_parent?: boolean | null
          next_action?: string | null
          note: string
          session_date?: string | null
          session_duration?: number | null
          session_type?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          consultant_id?: string
          consultation_schedule_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          follow_up_date?: string | null
          id?: string
          is_visible_to_parent?: boolean | null
          next_action?: string | null
          note?: string
          session_date?: string | null
          session_duration?: number | null
          session_type?: string | null
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
            foreignKeyName: "student_consulting_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
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
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_content_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "student_plan_completion_status"
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
          color: string | null
          content_type: string
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          difficulty_level_id: string | null
          estimated_minutes: number | null
          id: string
          is_template: boolean | null
          range_end: number | null
          range_start: number | null
          range_type: string | null
          range_unit: string | null
          status: string | null
          student_id: string
          subject: string | null
          subject_category: string | null
          tags: string[] | null
          template_name: string | null
          tenant_id: string
          title: string
          total_page_or_time: number | null
          updated_at: string | null
        }
        Insert: {
          chapter_info?: Json | null
          color?: string | null
          content_type: string
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          estimated_minutes?: number | null
          id?: string
          is_template?: boolean | null
          range_end?: number | null
          range_start?: number | null
          range_type?: string | null
          range_unit?: string | null
          status?: string | null
          student_id: string
          subject?: string | null
          subject_category?: string | null
          tags?: string[] | null
          template_name?: string | null
          tenant_id: string
          title: string
          total_page_or_time?: number | null
          updated_at?: string | null
        }
        Update: {
          chapter_info?: Json | null
          color?: string | null
          content_type?: string
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          difficulty_level_id?: string | null
          estimated_minutes?: number | null
          id?: string
          is_template?: boolean | null
          range_end?: number | null
          range_start?: number | null
          range_type?: string | null
          range_unit?: string | null
          status?: string | null
          student_id?: string
          subject?: string | null
          subject_category?: string | null
          tags?: string[] | null
          template_name?: string | null
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
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goal_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
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
            referencedRelation: "student_plan_completion_status"
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
          achievement_level: string | null
          achievement_ratio_a: number | null
          achievement_ratio_b: number | null
          achievement_ratio_c: number | null
          achievement_ratio_d: number | null
          achievement_ratio_e: number | null
          adjusted_grade: number | null
          avg_score: number | null
          class_rank: number | null
          converted_grade_9: number | null
          created_at: string | null
          credit_hours: number
          curriculum_revision_id: string
          estimated_percentile: number | null
          estimated_std_dev: number | null
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
          achievement_level?: string | null
          achievement_ratio_a?: number | null
          achievement_ratio_b?: number | null
          achievement_ratio_c?: number | null
          achievement_ratio_d?: number | null
          achievement_ratio_e?: number | null
          adjusted_grade?: number | null
          avg_score?: number | null
          class_rank?: number | null
          converted_grade_9?: number | null
          created_at?: string | null
          credit_hours: number
          curriculum_revision_id: string
          estimated_percentile?: number | null
          estimated_std_dev?: number | null
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
          achievement_level?: string | null
          achievement_ratio_a?: number | null
          achievement_ratio_b?: number | null
          achievement_ratio_c?: number | null
          achievement_ratio_d?: number | null
          achievement_ratio_e?: number | null
          adjusted_grade?: number | null
          avg_score?: number | null
          class_rank?: number | null
          converted_grade_9?: number | null
          created_at?: string | null
          credit_hours?: number
          curriculum_revision_id?: string
          estimated_percentile?: number | null
          estimated_std_dev?: number | null
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
      student_milestone_logs: {
        Row: {
          achieved_at: string | null
          id: string
          milestone_type: string
          milestone_value: number | null
          plan_id: string | null
          student_id: string
        }
        Insert: {
          achieved_at?: string | null
          id?: string
          milestone_type: string
          milestone_value?: number | null
          plan_id?: string | null
          student_id: string
        }
        Update: {
          achieved_at?: string | null
          id?: string
          milestone_type?: string
          milestone_value?: number | null
          plan_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_milestone_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_milestone_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_milestone_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_milestone_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_plan_completion_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_milestone_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_milestone_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_milestone_settings: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          milestone_type: string
          sound_enabled: boolean | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          milestone_type: string
          sound_enabled?: boolean | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          milestone_type?: string
          sound_enabled?: boolean | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_milestone_settings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
          achievement_push_enabled: boolean | null
          attendance_absent_enabled: boolean | null
          attendance_check_in_enabled: boolean | null
          attendance_check_out_enabled: boolean | null
          attendance_late_enabled: boolean | null
          camp_invitation_enabled: boolean | null
          camp_reminder_enabled: boolean | null
          camp_status_change_enabled: boolean | null
          chat_group_push_enabled: boolean | null
          chat_push_enabled: boolean | null
          chat_read_receipt_enabled: boolean
          chat_sound_enabled: boolean
          chat_vibrate_enabled: boolean
          created_at: string | null
          daily_goal_achieved_enabled: boolean | null
          event_reminder_push_enabled: boolean | null
          id: string
          notification_time_end: string | null
          notification_time_start: string | null
          plan_complete_enabled: boolean | null
          plan_delay_enabled: boolean | null
          plan_delay_threshold_minutes: number | null
          plan_start_enabled: boolean | null
          plan_update_push_enabled: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          student_id: string
          study_reminder_push_enabled: boolean | null
          updated_at: string | null
          weekly_report_enabled: boolean | null
        }
        Insert: {
          achievement_push_enabled?: boolean | null
          attendance_absent_enabled?: boolean | null
          attendance_check_in_enabled?: boolean | null
          attendance_check_out_enabled?: boolean | null
          attendance_late_enabled?: boolean | null
          camp_invitation_enabled?: boolean | null
          camp_reminder_enabled?: boolean | null
          camp_status_change_enabled?: boolean | null
          chat_group_push_enabled?: boolean | null
          chat_push_enabled?: boolean | null
          chat_read_receipt_enabled?: boolean
          chat_sound_enabled?: boolean
          chat_vibrate_enabled?: boolean
          created_at?: string | null
          daily_goal_achieved_enabled?: boolean | null
          event_reminder_push_enabled?: boolean | null
          id?: string
          notification_time_end?: string | null
          notification_time_start?: string | null
          plan_complete_enabled?: boolean | null
          plan_delay_enabled?: boolean | null
          plan_delay_threshold_minutes?: number | null
          plan_start_enabled?: boolean | null
          plan_update_push_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          student_id: string
          study_reminder_push_enabled?: boolean | null
          updated_at?: string | null
          weekly_report_enabled?: boolean | null
        }
        Update: {
          achievement_push_enabled?: boolean | null
          attendance_absent_enabled?: boolean | null
          attendance_check_in_enabled?: boolean | null
          attendance_check_out_enabled?: boolean | null
          attendance_late_enabled?: boolean | null
          camp_invitation_enabled?: boolean | null
          camp_reminder_enabled?: boolean | null
          camp_status_change_enabled?: boolean | null
          chat_group_push_enabled?: boolean | null
          chat_push_enabled?: boolean | null
          chat_read_receipt_enabled?: boolean
          chat_sound_enabled?: boolean
          chat_vibrate_enabled?: boolean
          created_at?: string | null
          daily_goal_achieved_enabled?: boolean | null
          event_reminder_push_enabled?: boolean | null
          id?: string
          notification_time_end?: string | null
          notification_time_start?: string | null
          plan_complete_enabled?: boolean | null
          plan_delay_enabled?: boolean | null
          plan_delay_threshold_minutes?: number | null
          plan_start_enabled?: boolean | null
          plan_update_push_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          student_id?: string
          study_reminder_push_enabled?: boolean | null
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
          actual_minutes: number | null
          actual_start_time: string | null
          adhoc_source_id: string | null
          block_index: number
          carryover_count: number | null
          carryover_from_date: string | null
          chapter: string | null
          color: string | null
          completed_amount: number | null
          completed_at: string | null
          container_type: string | null
          content_category: string | null
          content_id: string | null
          content_subject: string | null
          content_subject_category: string | null
          content_title: string | null
          content_type: string
          created_at: string | null
          created_by: string | null
          custom_range_display: string | null
          custom_title: string | null
          cycle_day_number: number | null
          date_type: string | null
          day: number | null
          day_type: string | null
          deleted_at: string | null
          description: string | null
          end_time: string | null
          estimated_minutes: number | null
          flexible_content_id: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_adhoc: boolean | null
          is_continued: boolean | null
          is_locked: boolean | null
          is_partial: boolean | null
          is_recurring: boolean | null
          is_reschedulable: boolean | null
          is_virtual: boolean | null
          memo: string | null
          order_index: number | null
          origin_plan_item_id: string | null
          original_volume: number | null
          pause_count: number | null
          paused_at: string | null
          paused_duration_seconds: number | null
          plan_date: string
          plan_group_id: string | null
          plan_number: number | null
          planned_end_page_or_time: number | null
          planned_start_page_or_time: number | null
          priority: number | null
          progress: number | null
          recurrence_parent_id: string | null
          recurrence_rule: Json | null
          review_group_id: string | null
          review_source_content_ids: string[] | null
          sequence: number | null
          slot_index: number | null
          start_time: string | null
          started_at: string | null
          status: string | null
          student_id: string
          subject_type: string | null
          tags: string[] | null
          tenant_id: string
          time_slot_type: string | null
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
          actual_minutes?: number | null
          actual_start_time?: string | null
          adhoc_source_id?: string | null
          block_index: number
          carryover_count?: number | null
          carryover_from_date?: string | null
          chapter?: string | null
          color?: string | null
          completed_amount?: number | null
          completed_at?: string | null
          container_type?: string | null
          content_category?: string | null
          content_id?: string | null
          content_subject?: string | null
          content_subject_category?: string | null
          content_title?: string | null
          content_type: string
          created_at?: string | null
          created_by?: string | null
          custom_range_display?: string | null
          custom_title?: string | null
          cycle_day_number?: number | null
          date_type?: string | null
          day?: number | null
          day_type?: string | null
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          estimated_minutes?: number | null
          flexible_content_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_adhoc?: boolean | null
          is_continued?: boolean | null
          is_locked?: boolean | null
          is_partial?: boolean | null
          is_recurring?: boolean | null
          is_reschedulable?: boolean | null
          is_virtual?: boolean | null
          memo?: string | null
          order_index?: number | null
          origin_plan_item_id?: string | null
          original_volume?: number | null
          pause_count?: number | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          plan_date: string
          plan_group_id?: string | null
          plan_number?: number | null
          planned_end_page_or_time?: number | null
          planned_start_page_or_time?: number | null
          priority?: number | null
          progress?: number | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          review_group_id?: string | null
          review_source_content_ids?: string[] | null
          sequence?: number | null
          slot_index?: number | null
          start_time?: string | null
          started_at?: string | null
          status?: string | null
          student_id: string
          subject_type?: string | null
          tags?: string[] | null
          tenant_id: string
          time_slot_type?: string | null
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
          actual_minutes?: number | null
          actual_start_time?: string | null
          adhoc_source_id?: string | null
          block_index?: number
          carryover_count?: number | null
          carryover_from_date?: string | null
          chapter?: string | null
          color?: string | null
          completed_amount?: number | null
          completed_at?: string | null
          container_type?: string | null
          content_category?: string | null
          content_id?: string | null
          content_subject?: string | null
          content_subject_category?: string | null
          content_title?: string | null
          content_type?: string
          created_at?: string | null
          created_by?: string | null
          custom_range_display?: string | null
          custom_title?: string | null
          cycle_day_number?: number | null
          date_type?: string | null
          day?: number | null
          day_type?: string | null
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          estimated_minutes?: number | null
          flexible_content_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_adhoc?: boolean | null
          is_continued?: boolean | null
          is_locked?: boolean | null
          is_partial?: boolean | null
          is_recurring?: boolean | null
          is_reschedulable?: boolean | null
          is_virtual?: boolean | null
          memo?: string | null
          order_index?: number | null
          origin_plan_item_id?: string | null
          original_volume?: number | null
          pause_count?: number | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          plan_date?: string
          plan_group_id?: string | null
          plan_number?: number | null
          planned_end_page_or_time?: number | null
          planned_start_page_or_time?: number | null
          priority?: number | null
          progress?: number | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          review_group_id?: string | null
          review_source_content_ids?: string[] | null
          sequence?: number | null
          slot_index?: number | null
          start_time?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string
          subject_type?: string | null
          tags?: string[] | null
          tenant_id?: string
          time_slot_type?: string | null
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
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "student_plan_completion_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_flexible_content_id_fkey"
            columns: ["flexible_content_id"]
            isOneToOne: false
            referencedRelation: "flexible_contents"
            referencedColumns: ["id"]
          },
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
      student_plan_progress_backup: {
        Row: {
          actual_end_time: string | null
          completed_amount: number | null
          id: string | null
          progress: number | null
          status: string | null
        }
        Insert: {
          actual_end_time?: string | null
          completed_amount?: number | null
          id?: string | null
          progress?: number | null
          status?: string | null
        }
        Update: {
          actual_end_time?: string | null
          completed_amount?: number | null
          id?: string | null
          progress?: number | null
          status?: string | null
        }
        Relationships: []
      }
      student_reminder_settings: {
        Row: {
          created_at: string | null
          delayed_plan_threshold: number | null
          delayed_plan_warning_enabled: boolean | null
          id: string
          incomplete_reminder_enabled: boolean | null
          incomplete_reminder_time: string | null
          student_id: string
          updated_at: string | null
          weekly_summary_day: number | null
          weekly_summary_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          delayed_plan_threshold?: number | null
          delayed_plan_warning_enabled?: boolean | null
          id?: string
          incomplete_reminder_enabled?: boolean | null
          incomplete_reminder_time?: string | null
          student_id: string
          updated_at?: string | null
          weekly_summary_day?: number | null
          weekly_summary_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          delayed_plan_threshold?: number | null
          delayed_plan_warning_enabled?: boolean | null
          id?: string
          incomplete_reminder_enabled?: boolean | null
          incomplete_reminder_time?: string | null
          student_id?: string
          updated_at?: string | null
          weekly_summary_day?: number | null
          weekly_summary_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "student_reminder_settings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
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
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_study_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "student_plan_completion_status"
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
          address: string | null
          address_detail: string | null
          bio: string | null
          birth_date: string | null
          career_notes: string | null
          class: string | null
          created_at: string | null
          curriculum_revision: string | null
          desired_career_field: string | null
          desired_university_ids: string[] | null
          division: string | null
          emergency_contact: string | null
          emergency_contact_phone: string | null
          enrolled_at: string | null
          exam_year: number | null
          father_phone: string | null
          gender: string | null
          grade: number | null
          id: string
          interests: Json | null
          is_active: boolean
          lead_source: string | null
          medical_info: string | null
          memo: string | null
          mother_phone: string | null
          name: string
          phone: string | null
          postal_code: string | null
          profile_image_url: string | null
          program_id: string | null
          school_id: string | null
          school_name: string | null
          school_type: string | null
          status: string | null
          student_number: string | null
          target_major: string | null
          target_major_2: string | null
          target_score: Json | null
          target_university_type: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active_block_set_id?: string | null
          address?: string | null
          address_detail?: string | null
          bio?: string | null
          birth_date?: string | null
          career_notes?: string | null
          class?: string | null
          created_at?: string | null
          curriculum_revision?: string | null
          desired_career_field?: string | null
          desired_university_ids?: string[] | null
          division?: string | null
          emergency_contact?: string | null
          emergency_contact_phone?: string | null
          enrolled_at?: string | null
          exam_year?: number | null
          father_phone?: string | null
          gender?: string | null
          grade?: number | null
          id?: string
          interests?: Json | null
          is_active?: boolean
          lead_source?: string | null
          medical_info?: string | null
          memo?: string | null
          mother_phone?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          profile_image_url?: string | null
          program_id?: string | null
          school_id?: string | null
          school_name?: string | null
          school_type?: string | null
          status?: string | null
          student_number?: string | null
          target_major?: string | null
          target_major_2?: string | null
          target_score?: Json | null
          target_university_type?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active_block_set_id?: string | null
          address?: string | null
          address_detail?: string | null
          bio?: string | null
          birth_date?: string | null
          career_notes?: string | null
          class?: string | null
          created_at?: string | null
          curriculum_revision?: string | null
          desired_career_field?: string | null
          desired_university_ids?: string[] | null
          division?: string | null
          emergency_contact?: string | null
          emergency_contact_phone?: string | null
          enrolled_at?: string | null
          exam_year?: number | null
          father_phone?: string | null
          gender?: string | null
          grade?: number | null
          id?: string
          interests?: Json | null
          is_active?: boolean
          lead_source?: string | null
          medical_info?: string | null
          memo?: string | null
          mother_phone?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          profile_image_url?: string | null
          program_id?: string | null
          school_id?: string | null
          school_name?: string | null
          school_type?: string | null
          status?: string | null
          student_number?: string | null
          target_major?: string | null
          target_major_2?: string | null
          target_score?: Json | null
          target_university_type?: string | null
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
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
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
          is_achievement_only: boolean
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_revision_id: string
          id?: string
          is_achievement_only?: boolean
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_revision_id?: string
          id?: string
          is_achievement_only?: boolean
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
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          status?: string
          tenant_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          address: string | null
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
          representative_phone: string | null
          settings: Json | null
          status: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
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
          representative_phone?: string | null
          settings?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
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
          representative_phone?: string | null
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
      time_slots: {
        Row: {
          color: string | null
          created_at: string | null
          end_time: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          slot_order: number
          slot_type: string
          start_time: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          slot_order: number
          slot_type?: string
          start_time: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          slot_order?: number
          slot_type?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      user_presence: {
        Row: {
          current_chat_room_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_chat_room_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_chat_room_id?: string | null
          status?: string
          updated_at?: string
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
      active_student_plan: {
        Row: {
          actual_end_time: string | null
          actual_minutes: number | null
          actual_start_time: string | null
          adhoc_source_id: string | null
          block_index: number | null
          carryover_count: number | null
          carryover_from_date: string | null
          chapter: string | null
          color: string | null
          completed_amount: number | null
          completed_at: string | null
          container_type: string | null
          content_category: string | null
          content_id: string | null
          content_subject: string | null
          content_subject_category: string | null
          content_title: string | null
          content_type: string | null
          created_at: string | null
          created_by: string | null
          custom_range_display: string | null
          custom_title: string | null
          cycle_day_number: number | null
          date_type: string | null
          day: number | null
          day_type: string | null
          deleted_at: string | null
          description: string | null
          end_time: string | null
          estimated_minutes: number | null
          flexible_content_id: string | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          is_adhoc: boolean | null
          is_continued: boolean | null
          is_locked: boolean | null
          is_partial: boolean | null
          is_recurring: boolean | null
          is_reschedulable: boolean | null
          is_virtual: boolean | null
          memo: string | null
          order_index: number | null
          origin_plan_item_id: string | null
          original_volume: number | null
          pause_count: number | null
          paused_at: string | null
          paused_duration_seconds: number | null
          plan_date: string | null
          plan_group_id: string | null
          plan_number: number | null
          planned_end_page_or_time: number | null
          planned_start_page_or_time: number | null
          priority: number | null
          progress: number | null
          recurrence_parent_id: string | null
          recurrence_rule: Json | null
          review_group_id: string | null
          review_source_content_ids: string[] | null
          sequence: number | null
          slot_index: number | null
          start_time: string | null
          started_at: string | null
          status: string | null
          student_id: string | null
          subject_type: string | null
          tags: string[] | null
          tenant_id: string | null
          time_slot_type: string | null
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
          actual_minutes?: number | null
          actual_start_time?: string | null
          adhoc_source_id?: string | null
          block_index?: number | null
          carryover_count?: number | null
          carryover_from_date?: string | null
          chapter?: string | null
          color?: string | null
          completed_amount?: number | null
          completed_at?: string | null
          container_type?: string | null
          content_category?: string | null
          content_id?: string | null
          content_subject?: string | null
          content_subject_category?: string | null
          content_title?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_range_display?: string | null
          custom_title?: string | null
          cycle_day_number?: number | null
          date_type?: string | null
          day?: number | null
          day_type?: string | null
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          estimated_minutes?: number | null
          flexible_content_id?: string | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          is_adhoc?: boolean | null
          is_continued?: boolean | null
          is_locked?: boolean | null
          is_partial?: boolean | null
          is_recurring?: boolean | null
          is_reschedulable?: boolean | null
          is_virtual?: boolean | null
          memo?: string | null
          order_index?: number | null
          origin_plan_item_id?: string | null
          original_volume?: number | null
          pause_count?: number | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          plan_date?: string | null
          plan_group_id?: string | null
          plan_number?: number | null
          planned_end_page_or_time?: number | null
          planned_start_page_or_time?: number | null
          priority?: number | null
          progress?: number | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          review_group_id?: string | null
          review_source_content_ids?: string[] | null
          sequence?: number | null
          slot_index?: number | null
          start_time?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          subject_type?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          time_slot_type?: string | null
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
          actual_minutes?: number | null
          actual_start_time?: string | null
          adhoc_source_id?: string | null
          block_index?: number | null
          carryover_count?: number | null
          carryover_from_date?: string | null
          chapter?: string | null
          color?: string | null
          completed_amount?: number | null
          completed_at?: string | null
          container_type?: string | null
          content_category?: string | null
          content_id?: string | null
          content_subject?: string | null
          content_subject_category?: string | null
          content_title?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_range_display?: string | null
          custom_title?: string | null
          cycle_day_number?: number | null
          date_type?: string | null
          day?: number | null
          day_type?: string | null
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          estimated_minutes?: number | null
          flexible_content_id?: string | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          is_adhoc?: boolean | null
          is_continued?: boolean | null
          is_locked?: boolean | null
          is_partial?: boolean | null
          is_recurring?: boolean | null
          is_reschedulable?: boolean | null
          is_virtual?: boolean | null
          memo?: string | null
          order_index?: number | null
          origin_plan_item_id?: string | null
          original_volume?: number | null
          pause_count?: number | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          plan_date?: string | null
          plan_group_id?: string | null
          plan_number?: number | null
          planned_end_page_or_time?: number | null
          planned_start_page_or_time?: number | null
          priority?: number | null
          progress?: number | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          review_group_id?: string | null
          review_source_content_ids?: string[] | null
          sequence?: number | null
          slot_index?: number | null
          start_time?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          subject_type?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          time_slot_type?: string | null
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
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "student_plan_completion_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_flexible_content_id_fkey"
            columns: ["flexible_content_id"]
            isOneToOne: false
            referencedRelation: "flexible_contents"
            referencedColumns: ["id"]
          },
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
      cold_start_parse_failures: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          failed_at: string | null
          id: string | null
          input_params: Json | null
          raw_response_sample: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          failed_at?: never
          id?: string | null
          input_params?: Json | null
          raw_response_sample?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          failed_at?: never
          id?: string | null
          input_params?: Json | null
          raw_response_sample?: string | null
        }
        Relationships: []
      }
      deleted_student_plan: {
        Row: {
          actual_end_time: string | null
          actual_minutes: number | null
          actual_start_time: string | null
          adhoc_source_id: string | null
          block_index: number | null
          carryover_count: number | null
          carryover_from_date: string | null
          chapter: string | null
          color: string | null
          completed_amount: number | null
          completed_at: string | null
          container_type: string | null
          content_category: string | null
          content_id: string | null
          content_subject: string | null
          content_subject_category: string | null
          content_title: string | null
          content_type: string | null
          created_at: string | null
          created_by: string | null
          custom_range_display: string | null
          custom_title: string | null
          cycle_day_number: number | null
          date_type: string | null
          day: number | null
          day_type: string | null
          deleted_at: string | null
          description: string | null
          end_time: string | null
          estimated_minutes: number | null
          flexible_content_id: string | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          is_adhoc: boolean | null
          is_continued: boolean | null
          is_locked: boolean | null
          is_partial: boolean | null
          is_recurring: boolean | null
          is_reschedulable: boolean | null
          is_virtual: boolean | null
          memo: string | null
          order_index: number | null
          origin_plan_item_id: string | null
          original_volume: number | null
          pause_count: number | null
          paused_at: string | null
          paused_duration_seconds: number | null
          plan_date: string | null
          plan_group_id: string | null
          plan_number: number | null
          planned_end_page_or_time: number | null
          planned_start_page_or_time: number | null
          priority: number | null
          progress: number | null
          recurrence_parent_id: string | null
          recurrence_rule: Json | null
          review_group_id: string | null
          review_source_content_ids: string[] | null
          sequence: number | null
          slot_index: number | null
          start_time: string | null
          started_at: string | null
          status: string | null
          student_id: string | null
          subject_type: string | null
          tags: string[] | null
          tenant_id: string | null
          time_slot_type: string | null
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
          actual_minutes?: number | null
          actual_start_time?: string | null
          adhoc_source_id?: string | null
          block_index?: number | null
          carryover_count?: number | null
          carryover_from_date?: string | null
          chapter?: string | null
          color?: string | null
          completed_amount?: number | null
          completed_at?: string | null
          container_type?: string | null
          content_category?: string | null
          content_id?: string | null
          content_subject?: string | null
          content_subject_category?: string | null
          content_title?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_range_display?: string | null
          custom_title?: string | null
          cycle_day_number?: number | null
          date_type?: string | null
          day?: number | null
          day_type?: string | null
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          estimated_minutes?: number | null
          flexible_content_id?: string | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          is_adhoc?: boolean | null
          is_continued?: boolean | null
          is_locked?: boolean | null
          is_partial?: boolean | null
          is_recurring?: boolean | null
          is_reschedulable?: boolean | null
          is_virtual?: boolean | null
          memo?: string | null
          order_index?: number | null
          origin_plan_item_id?: string | null
          original_volume?: number | null
          pause_count?: number | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          plan_date?: string | null
          plan_group_id?: string | null
          plan_number?: number | null
          planned_end_page_or_time?: number | null
          planned_start_page_or_time?: number | null
          priority?: number | null
          progress?: number | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          review_group_id?: string | null
          review_source_content_ids?: string[] | null
          sequence?: number | null
          slot_index?: number | null
          start_time?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          subject_type?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          time_slot_type?: string | null
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
          actual_minutes?: number | null
          actual_start_time?: string | null
          adhoc_source_id?: string | null
          block_index?: number | null
          carryover_count?: number | null
          carryover_from_date?: string | null
          chapter?: string | null
          color?: string | null
          completed_amount?: number | null
          completed_at?: string | null
          container_type?: string | null
          content_category?: string | null
          content_id?: string | null
          content_subject?: string | null
          content_subject_category?: string | null
          content_title?: string | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_range_display?: string | null
          custom_title?: string | null
          cycle_day_number?: number | null
          date_type?: string | null
          day?: number | null
          day_type?: string | null
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          estimated_minutes?: number | null
          flexible_content_id?: string | null
          icon?: string | null
          id?: string | null
          is_active?: boolean | null
          is_adhoc?: boolean | null
          is_continued?: boolean | null
          is_locked?: boolean | null
          is_partial?: boolean | null
          is_recurring?: boolean | null
          is_reschedulable?: boolean | null
          is_virtual?: boolean | null
          memo?: string | null
          order_index?: number | null
          origin_plan_item_id?: string | null
          original_volume?: number | null
          pause_count?: number | null
          paused_at?: string | null
          paused_duration_seconds?: number | null
          plan_date?: string | null
          plan_group_id?: string | null
          plan_number?: number | null
          planned_end_page_or_time?: number | null
          planned_start_page_or_time?: number | null
          priority?: number | null
          progress?: number | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          review_group_id?: string | null
          review_source_content_ids?: string[] | null
          sequence?: number | null
          slot_index?: number | null
          start_time?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          subject_type?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          time_slot_type?: string | null
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
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "active_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "deleted_student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "student_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "student_plan_completion_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student_plan_recurrence_parent"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "today_plan_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_flexible_content_id_fkey"
            columns: ["flexible_content_id"]
            isOneToOne: false
            referencedRelation: "flexible_contents"
            referencedColumns: ["id"]
          },
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
      llm_cache_stats: {
        Row: {
          active_entries: number | null
          avg_input_tokens: number | null
          avg_output_tokens: number | null
          last_cache_at: string | null
          operation_type: string | null
          tenant_id: string | null
          total_cost_saved: number | null
          total_entries: number | null
          total_hits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_response_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          avg_score: number | null
          created_at: string | null
          exam_date: string | null
          exam_title: string | null
          grade: number | null
          id: string | null
          percentile: number | null
          rank_grade: number | null
          score: number | null
          score_type: string | null
          semester: number | null
          standard_score: number | null
          std_dev: number | null
          student_id: string | null
          subject: string | null
          subject_group_id: string | null
          subject_id: string | null
          tenant_id: string | null
          total_students: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      student_plan_completion_status: {
        Row: {
          actual_end_time: string | null
          id: string | null
          is_completed: boolean | null
          legacy_completed_amount: number | null
          legacy_progress: number | null
          plan_date: string | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          actual_end_time?: string | null
          id?: string | null
          is_completed?: never
          legacy_completed_amount?: number | null
          legacy_progress?: number | null
          plan_date?: string | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          actual_end_time?: string | null
          id?: string | null
          is_completed?: never
          legacy_completed_amount?: number | null
          legacy_progress?: number | null
          plan_date?: string | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_plan_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
      add_to_analysis_queue: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_context?: Json
          p_priority?: number
          p_tenant_id: string
        }
        Returns: string
      }
      batch_update_plan_times: {
        Args: { plan_updates: Json }
        Returns: undefined
      }
      check_email_exists: { Args: { target_email: string }; Returns: boolean }
      check_idempotency: {
        Args: {
          p_action: string
          p_key: string
          p_request_hash?: string
          p_user_id: string
        }
        Returns: Json
      }
      claim_pending_scheduled_messages: {
        Args: { batch_limit?: number }
        Returns: {
          attempts: number
          content: string
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          message_type: string
          metadata: Json | null
          reply_to_id: string | null
          room_id: string
          scheduled_at: string
          sender_id: string
          sender_name_snapshot: string
          sender_profile_url_snapshot: string | null
          sender_type: string
          sent_at: string | null
          sent_message_id: string | null
          status: string
          tenant_id: string
          timezone: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduled_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      cleanup_expired_llm_cache: { Args: never; Returns: number }
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      cleanup_korean_history_subjects: {
        Args: { tenant_uuid: string }
        Returns: undefined
      }
      complete_analysis: {
        Args: {
          p_error_message?: string
          p_queue_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      complete_idempotency: {
        Args: { p_key_id: string; p_response: Json; p_success?: boolean }
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
      confirm_batch_payment: { Args: { p_order_id: string }; Returns: number }
      count_unread_by_room_ids: {
        Args: {
          p_membership_data: Json
          p_room_ids: string[]
          p_user_id: string
        }
        Returns: {
          room_id: string
          unread_count: number
        }[]
      }
      create_admin_user: {
        Args: { user_email: string; user_role?: string }
        Returns: string
      }
      create_default_time_slots: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      create_plan_group_atomic: {
        Args: {
          p_contents?: Json
          p_exclusions?: Json
          p_plan_group: Json
          p_schedules?: Json
          p_student_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      delete_calendar_cascade: {
        Args: { p_calendar_id: string; p_tenant_id?: string }
        Returns: Database["public"]["CompositeTypes"]["delete_calendar_result"]
        SetofOptions: {
          from: "*"
          to: "delete_calendar_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_student_custom_contents: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      expire_old_invitations: { Args: never; Returns: undefined }
      expire_old_invitations_unified: { Args: never; Returns: undefined }
      extract_school_id_number: {
        Args: { school_id_str: string }
        Returns: number
      }
      find_existing_members_batch: {
        Args: {
          p_member_ids: string[]
          p_member_types: string[]
          p_room_id: string
        }
        Returns: {
          user_id: string
          user_type: string
        }[]
      }
      generate_plans_atomic: {
        Args: { p_group_id: string; p_plans: Json; p_update_status_to?: string }
        Returns: Json
      }
      get_chat_messages_since: {
        Args: { p_limit?: number; p_room_id: string; p_since: string }
        Returns: {
          content: string
          created_at: string
          deleted_at: string
          id: string
          is_deleted: boolean
          message_type: string
          reply_to_id: string
          room_id: string
          sender_id: string
          sender_type: string
          updated_at: string
        }[]
      }
      get_chat_storage_usage: { Args: { p_sender_id: string }; Returns: number }
      get_distinct_instructor_platforms: {
        Args: never
        Returns: {
          platform: string
        }[]
      }
      get_instructor_count_by_subject: {
        Args: never
        Returns: {
          instructor_count: number
          subject_category: string
        }[]
      }
      get_last_messages_by_room_ids: {
        Args: { p_room_ids: string[] }
        Returns: {
          content: string
          created_at: string
          deleted_at: string
          id: string
          is_deleted: boolean
          message_type: string
          reply_to_id: string
          room_id: string
          sender_id: string
          sender_type: string
          updated_at: string
        }[]
      }
      get_message_read_counts: {
        Args: {
          p_message_ids: string[]
          p_room_id: string
          p_sender_id: string
        }
        Returns: {
          message_id: string
          unread_count: number
        }[]
      }
      get_monthly_revenue: {
        Args: {
          p_end: string
          p_program_id?: string
          p_start: string
          p_tenant_id: string
        }
        Returns: {
          billed: number
          month: string
          paid: number
          rate: number
          unpaid: number
        }[]
      }
      get_next_analysis_item: {
        Args: never
        Returns: {
          content_id: string
          content_type: string
          queue_id: string
          request_context: Json
        }[]
      }
      get_plan_group_counts: {
        Args: { p_planner_ids: string[] }
        Returns: {
          group_count: number
          planner_id: string
        }[]
      }
      get_program_revenue: {
        Args: { p_end: string; p_start: string; p_tenant_id: string }
        Returns: {
          enrollment_count: number
          pct: number
          program_id: string
          program_name: string
          total_billed: number
          total_paid: number
        }[]
      }
      get_revenue_summary: {
        Args: {
          p_consultant_id?: string
          p_end: string
          p_program_id?: string
          p_start: string
          p_tenant_id: string
        }
        Returns: {
          collection_rate: number
          payment_count: number
          student_count: number
          total_billed: number
          total_paid: number
          total_unpaid: number
        }[]
      }
      get_senders_by_ids: {
        Args: { p_admin_ids: string[]; p_student_ids: string[] }
        Returns: {
          id: string
          name: string
          profile_image_url: string
          user_type: string
        }[]
      }
      get_user_tenant_id: { Args: never; Returns: string }
      increment_cache_hit_count: {
        Args: { cache_id: string }
        Returns: undefined
      }
      increment_pause_count: {
        Args: { p_plan_id: string; p_student_id: string }
        Returns: number
      }
      increment_payment_link_view: {
        Args: { link_id: string }
        Returns: undefined
      }
      is_admin_or_consultant: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      parse_device_name: { Args: { user_agent_text: string }; Returns: string }
      rls_check_admin_full_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      rls_check_admin_member: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      rls_check_admin_only_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      rls_check_admin_or_superadmin_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      rls_check_admin_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      rls_check_block_set_admin: {
        Args: { p_block_set_id: string }
        Returns: boolean
      }
      rls_check_block_set_member: {
        Args: { p_block_set_id: string }
        Returns: boolean
      }
      rls_check_calendar_admin: {
        Args: { p_calendar_id: string }
        Returns: boolean
      }
      rls_check_calendar_parent: {
        Args: { p_calendar_id: string }
        Returns: boolean
      }
      rls_check_camp_template_admin: {
        Args: { p_template_id: string }
        Returns: boolean
      }
      rls_check_camp_template_member: {
        Args: { p_template_id: string }
        Returns: boolean
      }
      rls_check_chat_member: { Args: { p_room_id: string }; Returns: boolean }
      rls_check_chat_message_member: {
        Args: { p_message_id: string }
        Returns: boolean
      }
      rls_check_chat_not_blocked: {
        Args: { p_sender_id: string }
        Returns: boolean
      }
      rls_check_chat_room_admin: {
        Args: { p_room_id: string }
        Returns: boolean
      }
      rls_check_event_admin: { Args: { p_event_id: string }; Returns: boolean }
      rls_check_event_student: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      rls_check_file_access: { Args: { p_file_id: string }; Returns: boolean }
      rls_check_file_distribution_select: {
        Args: { p_file_id: string }
        Returns: boolean
      }
      rls_check_file_owner_or_admin: {
        Args: { p_file_id: string }
        Returns: boolean
      }
      rls_check_is_admin: { Args: never; Returns: boolean }
      rls_check_is_admin_or_consultant: { Args: never; Returns: boolean }
      rls_check_is_superadmin: { Args: never; Returns: boolean }
      rls_check_parent_student: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      rls_check_partner_admin: {
        Args: { p_partner_id: string }
        Returns: boolean
      }
      rls_check_payment_order_parent: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      rls_check_plan_group_access: {
        Args: { p_plan_group_id: string }
        Returns: boolean
      }
      rls_check_student_tenant_admin: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      rls_check_tenant_member: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      seed_subject_data: { Args: { tenant_uuid: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transfer_student_identity: {
        Args: { new_id: string; old_id: string }
        Returns: undefined
      }
      upsert_plan_contents_atomic: {
        Args: { p_contents: Json; p_group_id: string; p_tenant_id: string }
        Returns: Json
      }
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
      delete_calendar_result: {
        success: boolean | null
        calendar_id: string | null
        deleted_plan_groups_count: number | null
        deleted_student_plans_count: number | null
        deleted_events_count: number | null
        error: string | null
        error_code: string | null
      }
      delete_planner_result: {
        success: boolean | null
        planner_id: string | null
        deleted_plan_groups_count: number | null
        deleted_student_plans_count: number | null
        deleted_exclusions_count: number | null
        deleted_academy_schedules_count: number | null
        error: string | null
        error_code: string | null
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
