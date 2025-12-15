/**
 * Plan 관련 Supabase 데이터베이스 스키마 타입
 * 
 * 이 파일은 Supabase database.types.ts의 테이블 타입과 직접 매핑됩니다.
 * DB 스키마 변경 시 이 파일만 수정하면 됩니다.
 */

import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/database.types";

/**
 * plan_groups 테이블 Row 타입
 */
export type PlanGroupRow = Tables<"plan_groups">;

/**
 * plan_groups 테이블 Insert 타입
 */
export type PlanGroupInsert = TablesInsert<"plan_groups">;

/**
 * plan_groups 테이블 Update 타입
 */
export type PlanGroupUpdate = TablesUpdate<"plan_groups">;

/**
 * plan_contents 테이블 Row 타입
 */
export type PlanContentRow = Tables<"plan_contents">;

/**
 * plan_contents 테이블 Insert 타입
 */
export type PlanContentInsert = TablesInsert<"plan_contents">;

/**
 * plan_contents 테이블 Update 타입
 */
export type PlanContentUpdate = TablesUpdate<"plan_contents">;

/**
 * plan_exclusions 테이블 Row 타입
 */
export type PlanExclusionRow = Tables<"plan_exclusions">;

/**
 * plan_exclusions 테이블 Insert 타입
 */
export type PlanExclusionInsert = TablesInsert<"plan_exclusions">;

/**
 * plan_exclusions 테이블 Update 타입
 */
export type PlanExclusionUpdate = TablesUpdate<"plan_exclusions">;

/**
 * academy_schedules 테이블 Row 타입
 */
export type AcademyScheduleRow = Tables<"academy_schedules">;

/**
 * academy_schedules 테이블 Insert 타입
 */
export type AcademyScheduleInsert = TablesInsert<"academy_schedules">;

/**
 * academy_schedules 테이블 Update 타입
 */
export type AcademyScheduleUpdate = TablesUpdate<"academy_schedules">;

/**
 * student_plan 테이블 Row 타입
 */
export type StudentPlanRow = Tables<"student_plan">;

/**
 * student_plan 테이블 Insert 타입
 */
export type StudentPlanInsert = TablesInsert<"student_plan">;

/**
 * student_plan 테이블 Update 타입
 */
export type StudentPlanUpdate = TablesUpdate<"student_plan">;

/**
 * camp_templates 테이블 Row 타입
 */
export type CampTemplateRow = Tables<"camp_templates">;

/**
 * camp_templates 테이블 Insert 타입
 */
export type CampTemplateInsert = TablesInsert<"camp_templates">;

/**
 * camp_templates 테이블 Update 타입
 */
export type CampTemplateUpdate = TablesUpdate<"camp_templates">;

/**
 * camp_invitations 테이블 Row 타입
 */
export type CampInvitationRow = Tables<"camp_invitations">;

/**
 * camp_invitations 테이블 Insert 타입
 */
export type CampInvitationInsert = TablesInsert<"camp_invitations">;

/**
 * camp_invitations 테이블 Update 타입
 */
export type CampInvitationUpdate = TablesUpdate<"camp_invitations">;

/**
 * Supabase 조회 결과 타입 헬퍼
 * 
 * Supabase에서 조회한 데이터의 타입을 명시적으로 지정하기 위한 헬퍼 타입입니다.
 * 이 타입들을 사용하여 조회 결과의 타입 안전성을 보장합니다.
 */

/**
 * plan_groups 조회 결과 타입 (단일)
 */
export type PlanGroupQueryResult = PlanGroupRow;

/**
 * plan_groups 조회 결과 타입 (배열)
 */
export type PlanGroupQueryResults = PlanGroupRow[];

/**
 * plan_contents 조회 결과 타입 (단일)
 */
export type PlanContentQueryResult = PlanContentRow;

/**
 * plan_contents 조회 결과 타입 (배열)
 */
export type PlanContentQueryResults = PlanContentRow[];

/**
 * plan_exclusions 조회 결과 타입 (단일)
 */
export type PlanExclusionQueryResult = PlanExclusionRow;

/**
 * plan_exclusions 조회 결과 타입 (배열)
 */
export type PlanExclusionQueryResults = PlanExclusionRow[];

/**
 * academy_schedules 조회 결과 타입 (단일)
 */
export type AcademyScheduleQueryResult = AcademyScheduleRow;

/**
 * academy_schedules 조회 결과 타입 (배열)
 */
export type AcademyScheduleQueryResults = AcademyScheduleRow[];

/**
 * plan_groups와 관련 데이터를 함께 조회한 결과 타입
 */
export type PlanGroupWithDetails = {
  group: PlanGroupRow;
  contents: PlanContentRow[];
  exclusions: PlanExclusionRow[];
  academySchedules: AcademyScheduleRow[];
};

