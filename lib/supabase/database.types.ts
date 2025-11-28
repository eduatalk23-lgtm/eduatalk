/**
 * Supabase Database Types
 *
 * 이 파일은 Supabase 데이터베이스 스키마를 기반으로 생성된 타입 정의입니다.
 * 마이그레이션 파일을 분석하여 수동으로 생성되었습니다.
 *
 * 자동 생성 방법:
 * npx supabase gen types typescript --project-id <project-id> > lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      // ============================================
      // 지역 테이블
      // ============================================
      regions: {
        Row: {
          id: string;
          name: string;
          parent_id: string | null;
          level: number; // 1: 시/도, 2: 시/군/구, 3: 읍/면/동
          code: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          parent_id?: string | null;
          level?: number;
          code?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          parent_id?: string | null;
          level?: number;
          code?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 중·고등학교 테이블 (school_info)
      // ============================================
      school_info: {
        Row: {
          id: number;
          district_id: number | null;
          region: string | null;
          school_code: string;
          school_name: string;
          school_level: "중" | "고";
          establishment_type: string | null;
          school_property: string | null;
          branch_flag: string | null;
          establishment_form: string | null;
          postal_code: string | null;
          addr_road: string | null;
          addr_detail: string | null;
          address_full: string | null;
          latitude: number | null;
          longitude: number | null;
          phone_number: string | null;
          fax_number: string | null;
          homepage_url: string | null;
          coeducation_type: string | null;
          closed_flag: string | null;
          closed_date: string | null;
          temporary_close_flag: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          district_id?: number | null;
          region?: string | null;
          school_code: string;
          school_name: string;
          school_level: "중" | "고";
          establishment_type?: string | null;
          school_property?: string | null;
          branch_flag?: string | null;
          establishment_form?: string | null;
          postal_code?: string | null;
          addr_road?: string | null;
          addr_detail?: string | null;
          address_full?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          phone_number?: string | null;
          fax_number?: string | null;
          homepage_url?: string | null;
          coeducation_type?: string | null;
          closed_flag?: string | null;
          closed_date?: string | null;
          temporary_close_flag?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          district_id?: number | null;
          region?: string | null;
          school_code?: string;
          school_name?: string;
          school_level?: "중" | "고";
          establishment_type?: string | null;
          school_property?: string | null;
          branch_flag?: string | null;
          establishment_form?: string | null;
          postal_code?: string | null;
          addr_road?: string | null;
          addr_detail?: string | null;
          address_full?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          phone_number?: string | null;
          fax_number?: string | null;
          homepage_url?: string | null;
          coeducation_type?: string | null;
          closed_flag?: string | null;
          closed_date?: string | null;
          temporary_close_flag?: string | null;
          created_at?: string;
        };
      };

      // ============================================
      // 대학교 테이블 (universities)
      // ============================================
      universities: {
        Row: {
          id: number;
          university_code: string;
          name_kor: string;
          name_eng: string | null;
          name_chi: string | null;
          establishment_type: string | null;
          corporation_name: string | null;
          legal_basis: string | null;
          university_type: string | null;
          status: string | null;
          homepage_url: string | null;
          president_name: string | null;
          founded_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          university_code: string;
          name_kor: string;
          name_eng?: string | null;
          name_chi?: string | null;
          establishment_type?: string | null;
          corporation_name?: string | null;
          legal_basis?: string | null;
          university_type?: string | null;
          status?: string | null;
          homepage_url?: string | null;
          president_name?: string | null;
          founded_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          university_code?: string;
          name_kor?: string;
          name_eng?: string | null;
          name_chi?: string | null;
          establishment_type?: string | null;
          corporation_name?: string | null;
          legal_basis?: string | null;
          university_type?: string | null;
          status?: string | null;
          homepage_url?: string | null;
          president_name?: string | null;
          founded_date?: string | null;
          created_at?: string;
        };
      };

      // ============================================
      // 대학교 캠퍼스 테이블 (university_campuses)
      // ============================================
      university_campuses: {
        Row: {
          id: number;
          university_id: number;
          campus_type: string | null;
          campus_name: string;
          region: string | null;
          address_kor: string | null;
          address_eng: string | null;
          address_chi: string | null;
          postal_code: string | null;
          phone_number: string | null;
          fax_number: string | null;
          campus_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          university_id: number;
          campus_type?: string | null;
          campus_name: string;
          region?: string | null;
          address_kor?: string | null;
          address_eng?: string | null;
          address_chi?: string | null;
          postal_code?: string | null;
          phone_number?: string | null;
          fax_number?: string | null;
          campus_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          university_id?: number;
          campus_type?: string | null;
          campus_name?: string;
          region?: string | null;
          address_kor?: string | null;
          address_eng?: string | null;
          address_chi?: string | null;
          postal_code?: string | null;
          phone_number?: string | null;
          fax_number?: string | null;
          campus_status?: string | null;
          created_at?: string;
        };
      };

      // ============================================
      // 테넌트 테이블
      // ============================================
      tenants: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 학생 테이블
      // ============================================
      students: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          name: string;
          school_id: string | null; // 통합 ID (SCHOOL_123 또는 UNIV_456)
          school_type: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
          grade: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          name: string;
          school_id?: string | null;
          school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
          grade?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          name?: string;
          school_id?: string | null;
          school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
          grade?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 교과 그룹 테이블
      // ============================================
      subject_groups: {
        Row: {
          id: string;
          tenant_id: string | null; // null이면 전역
          name: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          name: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          name?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 과목 테이블
      // ============================================
      subjects: {
        Row: {
          id: string;
          tenant_id: string | null;
          subject_group_id: string;
          name: string;
          display_order: number;
          subject_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          subject_group_id: string;
          name: string;
          display_order?: number;
          subject_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          subject_group_id?: string;
          name?: string;
          display_order?: number;
          subject_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 과목 구분 테이블
      // ============================================
      subject_types: {
        Row: {
          id: string;
          tenant_id: string | null;
          name: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          name: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          name?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 학생-학기 테이블 (student_terms)
      // ============================================
      student_terms: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          school_year: number; // 학년도 (예: 2024)
          grade: number; // 학년 (1~3)
          semester: number; // 학기 (1~2)
          curriculum_revision_id: string; // FK → curriculum_revisions
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          school_year: number;
          grade: number;
          semester: number;
          curriculum_revision_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          student_id?: string;
          school_year?: number;
          grade?: number;
          semester?: number;
          curriculum_revision_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 내신 성적 테이블 (정규화 버전)
      // ============================================
      student_internal_scores: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          student_term_id: string; // FK → student_terms.id
          curriculum_revision_id: string;
          subject_group_id: string;
          subject_type_id: string;
          subject_id: string;
          grade: number;
          semester: number;
          credit_hours: number;
          raw_score: number | null;
          avg_score: number | null;
          std_dev: number | null;
          rank_grade: number | null;
          total_students: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          student_term_id: string; // FK → student_terms.id
          curriculum_revision_id: string;
          subject_group_id: string;
          subject_type_id: string;
          subject_id: string;
          grade: number;
          semester: number;
          credit_hours: number;
          raw_score?: number | null;
          avg_score?: number | null;
          std_dev?: number | null;
          rank_grade?: number | null;
          total_students?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          student_id?: string;
          student_term_id?: string;
          curriculum_revision_id?: string;
          subject_group_id?: string;
          subject_type_id?: string;
          subject_id?: string;
          grade?: number;
          semester?: number;
          credit_hours?: number;
          raw_score?: number | null;
          avg_score?: number | null;
          std_dev?: number | null;
          rank_grade?: number | null;
          total_students?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 내신 성적 테이블 (레거시 - deprecated)
      // @deprecated student_internal_scores를 사용하세요
      // ============================================
      student_school_scores: {
        Row: {
          id: string;
          tenant_id: string | null;
          student_id: string;
          grade: number;
          semester: number;
          // FK 필드
          subject_group_id: string | null;
          subject_id: string | null;
          subject_type_id: string | null;
          // deprecated 텍스트 필드
          subject_group: string | null;
          subject_type: string | null;
          subject_name: string | null;
          // 성적 정보
          credit_hours: number | null;
          raw_score: number | null;
          subject_average: number | null;
          standard_deviation: number | null;
          grade_score: number | null; // 등급 (1-9)
          total_students: number | null;
          rank_grade: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          student_id: string;
          grade: number;
          semester: number;
          subject_group_id?: string | null;
          subject_id?: string | null;
          subject_type_id?: string | null;
          subject_group?: string | null;
          subject_type?: string | null;
          subject_name?: string | null;
          credit_hours?: number | null;
          raw_score?: number | null;
          subject_average?: number | null;
          standard_deviation?: number | null;
          grade_score?: number | null;
          total_students?: number | null;
          rank_grade?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          student_id?: string;
          grade?: number;
          semester?: number;
          subject_group_id?: string | null;
          subject_id?: string | null;
          subject_type_id?: string | null;
          subject_group?: string | null;
          subject_type?: string | null;
          subject_name?: string | null;
          credit_hours?: number | null;
          raw_score?: number | null;
          subject_average?: number | null;
          standard_deviation?: number | null;
          grade_score?: number | null;
          total_students?: number | null;
          rank_grade?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 모의고사 성적 테이블 (정규화 버전)
      // ============================================
      student_mock_scores: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          student_term_id: string; // FK → student_terms.id
          exam_date: string; // date 타입
          exam_title: string;
          grade: number;
          subject_id: string;
          subject_group_id: string;
          standard_score: number | null;
          percentile: number | null;
          grade_score: number | null; // 등급 (1-9)
          raw_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          student_term_id: string; // FK → student_terms.id
          exam_date: string; // date 타입
          exam_title: string;
          grade: number;
          subject_id: string;
          subject_group_id: string;
          standard_score?: number | null;
          percentile?: number | null;
          grade_score?: number | null;
          raw_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          student_id?: string;
          student_term_id?: string;
          exam_date?: string;
          exam_title?: string;
          grade?: number;
          subject_id?: string;
          subject_group_id?: string;
          standard_score?: number | null;
          percentile?: number | null;
          grade_score?: number | null;
          raw_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 플랜 그룹 테이블
      // ============================================
      plan_groups: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          name: string | null;
          plan_purpose: string | null;
          scheduler_type: string | null;
          scheduler_options: Json | null;
          period_start: string;
          period_end: string;
          target_date: string | null;
          block_set_id: string | null;
          status: string;
          deleted_at: string | null;
          daily_schedule: Json | null;
          subject_constraints: Json | null;
          additional_period_reallocation: Json | null;
          non_study_time_blocks: Json | null;
          study_hours: Json | null;
          self_study_hours: Json | null;
          // 캠프 관련
          plan_type: "individual" | "integrated" | "camp" | null;
          camp_template_id: string | null;
          camp_invitation_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          name?: string | null;
          plan_purpose?: string | null;
          scheduler_type?: string | null;
          scheduler_options?: Json | null;
          period_start: string;
          period_end: string;
          target_date?: string | null;
          block_set_id?: string | null;
          status?: string;
          deleted_at?: string | null;
          daily_schedule?: Json | null;
          subject_constraints?: Json | null;
          additional_period_reallocation?: Json | null;
          non_study_time_blocks?: Json | null;
          study_hours?: Json | null;
          self_study_hours?: Json | null;
          plan_type?: "individual" | "integrated" | "camp" | null;
          camp_template_id?: string | null;
          camp_invitation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          student_id?: string;
          name?: string | null;
          plan_purpose?: string | null;
          scheduler_type?: string | null;
          scheduler_options?: Json | null;
          period_start?: string;
          period_end?: string;
          target_date?: string | null;
          block_set_id?: string | null;
          status?: string;
          deleted_at?: string | null;
          daily_schedule?: Json | null;
          subject_constraints?: Json | null;
          additional_period_reallocation?: Json | null;
          non_study_time_blocks?: Json | null;
          study_hours?: Json | null;
          self_study_hours?: Json | null;
          plan_type?: "individual" | "integrated" | "camp" | null;
          camp_template_id?: string | null;
          camp_invitation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 학생 플랜 테이블
      // ============================================
      student_plan: {
        Row: {
          id: string;
          tenant_id: string | null;
          student_id: string;
          plan_group_id: string | null;
          plan_date: string;
          block_index: number;
          content_type: "book" | "lecture" | "custom";
          content_id: string;
          chapter: string | null;
          planned_start_page_or_time: number | null;
          planned_end_page_or_time: number | null;
          completed_amount: number | null;
          progress: number | null;
          is_reschedulable: boolean;
          start_time: string | null;
          end_time: string | null;
          actual_start_time: string | null;
          actual_end_time: string | null;
          total_duration_seconds: number | null;
          paused_duration_seconds: number | null;
          pause_count: number | null;
          plan_number: number | null;
          sequence: number | null;
          memo: string | null;
          day_type: string | null;
          week: number | null;
          day: number | null;
          is_partial: boolean | null;
          is_continued: boolean | null;
          // denormalized 필드
          content_title: string | null;
          content_subject: string | null;
          content_subject_category: string | null;
          content_category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          student_id: string;
          plan_group_id?: string | null;
          plan_date: string;
          block_index?: number;
          content_type: "book" | "lecture" | "custom";
          content_id: string;
          chapter?: string | null;
          planned_start_page_or_time?: number | null;
          planned_end_page_or_time?: number | null;
          completed_amount?: number | null;
          progress?: number | null;
          is_reschedulable?: boolean;
          start_time?: string | null;
          end_time?: string | null;
          actual_start_time?: string | null;
          actual_end_time?: string | null;
          total_duration_seconds?: number | null;
          paused_duration_seconds?: number | null;
          pause_count?: number | null;
          plan_number?: number | null;
          sequence?: number | null;
          memo?: string | null;
          day_type?: string | null;
          week?: number | null;
          day?: number | null;
          is_partial?: boolean | null;
          is_continued?: boolean | null;
          content_title?: string | null;
          content_subject?: string | null;
          content_subject_category?: string | null;
          content_category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          student_id?: string;
          plan_group_id?: string | null;
          plan_date?: string;
          block_index?: number;
          content_type?: "book" | "lecture" | "custom";
          content_id?: string;
          chapter?: string | null;
          planned_start_page_or_time?: number | null;
          planned_end_page_or_time?: number | null;
          completed_amount?: number | null;
          progress?: number | null;
          is_reschedulable?: boolean;
          start_time?: string | null;
          end_time?: string | null;
          actual_start_time?: string | null;
          actual_end_time?: string | null;
          total_duration_seconds?: number | null;
          paused_duration_seconds?: number | null;
          pause_count?: number | null;
          plan_number?: number | null;
          sequence?: number | null;
          memo?: string | null;
          day_type?: string | null;
          week?: number | null;
          day?: number | null;
          is_partial?: boolean | null;
          is_continued?: boolean | null;
          content_title?: string | null;
          content_subject?: string | null;
          content_subject_category?: string | null;
          content_category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 플랜 콘텐츠 테이블
      // ============================================
      plan_contents: {
        Row: {
          id: string;
          tenant_id: string;
          plan_group_id: string;
          content_type: "book" | "lecture" | "custom";
          content_id: string;
          master_content_id: string | null;
          start_range: number;
          end_range: number;
          start_detail_id: string | null;
          end_detail_id: string | null;
          display_order: number;
          is_auto_recommended: boolean | null;
          recommendation_source: "auto" | "admin" | "template" | null;
          recommendation_reason: string | null;
          recommendation_metadata: Json | null;
          recommended_at: string | null;
          recommended_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plan_group_id: string;
          content_type: "book" | "lecture" | "custom";
          content_id: string;
          master_content_id?: string | null;
          start_range: number;
          end_range: number;
          start_detail_id?: string | null;
          end_detail_id?: string | null;
          display_order?: number;
          is_auto_recommended?: boolean | null;
          recommendation_source?: "auto" | "admin" | "template" | null;
          recommendation_reason?: string | null;
          recommendation_metadata?: Json | null;
          recommended_at?: string | null;
          recommended_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          plan_group_id?: string;
          content_type?: "book" | "lecture" | "custom";
          content_id?: string;
          master_content_id?: string | null;
          start_range?: number;
          end_range?: number;
          start_detail_id?: string | null;
          end_detail_id?: string | null;
          display_order?: number;
          is_auto_recommended?: boolean | null;
          recommendation_source?: "auto" | "admin" | "template" | null;
          recommendation_reason?: string | null;
          recommendation_metadata?: Json | null;
          recommended_at?: string | null;
          recommended_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 플랜 제외일 테이블
      // ============================================
      plan_exclusions: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          exclusion_date: string;
          exclusion_type: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          exclusion_date: string;
          exclusion_type: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          student_id?: string;
          exclusion_date?: string;
          exclusion_type?: string;
          reason?: string | null;
          created_at?: string;
        };
      };

      // ============================================
      // 캠프 템플릿 테이블
      // ============================================
      camp_templates: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          program_type: "윈터캠프" | "썸머캠프" | "파이널캠프" | "기타" | null;
          template_data: Json;
          status: "draft" | "active" | "archived";
          camp_start_date: string | null;
          camp_end_date: string | null;
          camp_location: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          program_type?: "윈터캠프" | "썸머캠프" | "파이널캠프" | "기타" | null;
          template_data: Json;
          status?: "draft" | "active" | "archived";
          camp_start_date?: string | null;
          camp_end_date?: string | null;
          camp_location?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string | null;
          program_type?: "윈터캠프" | "썸머캠프" | "파이널캠프" | "기타" | null;
          template_data?: Json;
          status?: "draft" | "active" | "archived";
          camp_start_date?: string | null;
          camp_end_date?: string | null;
          camp_location?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 캠프 초대 테이블
      // ============================================
      camp_invitations: {
        Row: {
          id: string;
          tenant_id: string;
          camp_template_id: string;
          student_id: string;
          status: "pending" | "accepted" | "declined";
          invited_at: string;
          accepted_at: string | null;
          declined_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          camp_template_id: string;
          student_id: string;
          status?: "pending" | "accepted" | "declined";
          invited_at?: string;
          accepted_at?: string | null;
          declined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          camp_template_id?: string;
          student_id?: string;
          status?: "pending" | "accepted" | "declined";
          invited_at?: string;
          accepted_at?: string | null;
          declined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 블록 세트 테이블
      // ============================================
      block_sets: {
        Row: {
          id: string;
          tenant_id: string | null;
          student_id: string | null;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          student_id?: string | null;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          student_id?: string | null;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 블록 테이블
      // ============================================
      blocks: {
        Row: {
          id: string;
          block_set_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          block_set_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          block_set_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 학원 테이블
      // ============================================
      academies: {
        Row: {
          id: string;
          tenant_id: string | null;
          student_id: string;
          name: string;
          travel_time: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          student_id: string;
          name: string;
          travel_time?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          student_id?: string;
          name?: string;
          travel_time?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // 학원 일정 테이블
      // ============================================
      academy_schedules: {
        Row: {
          id: string;
          tenant_id: string | null;
          student_id: string;
          academy_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          subject: string | null;
          // deprecated 필드
          academy_name: string | null;
          travel_time: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          student_id: string;
          academy_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          subject?: string | null;
          academy_name?: string | null;
          travel_time?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          student_id?: string;
          academy_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          subject?: string | null;
          academy_name?: string | null;
          travel_time?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      [_ in never]: never;
    };

    Enums: {
      // 학교 유형 (통합)
      school_type_unified: "MIDDLE" | "HIGH" | "UNIVERSITY";
      // 중·고등학교 레벨
      school_level: "중" | "고";
      content_type: "book" | "lecture" | "custom";
      plan_type: "individual" | "integrated" | "camp";
      camp_program_type: "윈터캠프" | "썸머캠프" | "파이널캠프" | "기타";
      camp_template_status: "draft" | "active" | "archived";
      camp_invitation_status: "pending" | "accepted" | "declined";
    };
  };
};

// ============================================
// 헬퍼 타입
// ============================================

/**
 * 테이블 Row 타입 추출
 */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/**
 * 테이블 Insert 타입 추출
 */
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/**
 * 테이블 Update 타입 추출
 */
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/**
 * Enum 타입 추출
 */
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

