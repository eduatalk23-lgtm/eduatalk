"use server";

import { revalidatePath } from "next/cache";
import { revalidateCampTemplatePaths } from "@/lib/utils/revalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getCampTemplate,
  createCampTemplate,
  getCampInvitationsForTemplate as getCampInvitationsForTemplateData,
  getCampInvitationsForTemplateWithPagination,
  copyCampTemplate,
} from "@/lib/data/campTemplates";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import {
  AppError,
  ErrorCode,
  withErrorHandling,
  getUserFacingMessage,
  logError,
} from "@/lib/errors";
import type {
  CampTemplateUpdate,
  CampInvitation,
  CampInvitationUpdate,
} from "@/lib/domains/camp/types";
import type { SchedulerOptions, PlanContentInsert } from "@/lib/types/plan";
import type { RecommendationMetadata } from "@/lib/types/content-selection";
import type { Tables } from "@/lib/supabase/database.types";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  linkBlockSetToTemplate,
  unlinkBlockSetFromTemplate,
} from "./campTemplateBlockSets";
import { getRecommendedMasterContents } from "@/lib/recommendations/masterContentRecommendation";
import { createPlanContents, getPlanContents } from "@/lib/data/planGroups";
import { timeToMinutes } from "@/lib/plan/assignPlanTimes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMasterBookById, getMasterLectureById } from "@/lib/data/contentMasters";
import { calculateRecommendedRanges, type ScheduleSummary } from "@/lib/plan/rangeRecommendation";
import { getRangeRecommendationConfig } from "@/lib/recommendations/config/configManager";
import { mergeTimeSettingsSafely } from "@/lib/utils/schedulerOptionsMerge";
import {
  validateCampTemplateId,
  validateStudentIds,
  validateInvitationIds,
  validateCampInvitationId,
  validateCampInvitationStatus,
  validateTenantContext,
  validateCampTemplateAccess,
  validateCampTemplateActive,
  validateCampInvitationAccess,
} from "@/lib/validation/campValidation";
import { buildCampInvitationStatusUpdate } from "@/lib/utils/campInvitationHelpers";
import type { PlanStatus } from "@/lib/types/plan/domain";
import type { PlanGroupSchedulerOptions } from "@/lib/types/schedulerSettings";
import type { DailyScheduleInfo } from "@/lib/types/plan/domain";

/**
 * 플랜 미리보기 데이터 타입
 */
type PreviewPlan = {
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null;
  end_time: string | null;
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  plan_number: number | null;
};

/**
 * 제외일 타입
 */
type Exclusion = {
  exclusion_date: string;
  exclusion_type: string;
  reason?: string | null;
};

/**
 * 학원 일정 타입
 */
type AcademySchedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
};

/**
 * 학생 정보 타입 (Supabase 조회 결과)
 */
type StudentInfo = {
  name: string;
};

/**
 * 캠프 템플릿 목록 조회
 */
export const getCampTemplates = withErrorHandling(async () => {
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("camp_templates")
    .select("*")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError(
      "템플릿 목록을 불러오는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  return { success: true, templates: data || [] };
});

/**
 * 캠프 템플릿 상세 조회
 */
export const getCampTemplateById = withErrorHandling(
  async (templateId: string) => {
    // 권한 검증
    await requireAdminOrConsultant();

    // 템플릿 ID 검증
    if (!templateId || typeof templateId !== "string") {
      throw new AppError(
        "템플릿 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // tenant_id로 필터링하여 조회
    const { data: template, error: templateError } = await supabase
      .from("camp_templates")
      .select("*")
      .eq("id", templateId)
      .eq("tenant_id", tenantContext.tenantId)
      .maybeSingle();

    if (templateError) {
      // PGRST116은 결과가 0개일 때 발생하는 정상적인 에러
      if (templateError.code !== "PGRST116") {
        console.error("[getCampTemplateById] 템플릿 조회 실패", {
          templateId,
          tenantId: tenantContext.tenantId,
          errorCode: templateError.code,
          errorMessage: templateError.message,
        });
        throw new AppError(
          "템플릿 조회 중 오류가 발생했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true,
          {
            templateId,
            tenantId: tenantContext.tenantId,
            originalError: templateError.message,
          }
        );
      }
    }

    if (!template) {
      // 디버깅 정보 포함
      if (process.env.NODE_ENV === "development") {
        const debugInfo: Record<string, unknown> = {
          templateId,
          tenantId: tenantContext.tenantId,
        };

        // tenant_id 없이 조회한 결과가 있으면 tenant_id 불일치 가능성 표시
        if (templateWithoutTenant) {
          debugInfo.templateExists = true;
          debugInfo.templateTenantId = templateWithoutTenant.tenant_id;
          debugInfo.tenantMismatch =
            templateWithoutTenant.tenant_id !== tenantContext.tenantId;
          debugInfo.templateName = templateWithoutTenant.name;
        } else {
          debugInfo.templateExists = false;
        }

        console.warn("[getCampTemplateById] 템플릿을 찾을 수 없음", debugInfo);
      }

      throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true, {
        templateId,
        tenantId: tenantContext.tenantId,
      });
    }

    return { success: true, template };
  }
);

/**
 * 캠프 템플릿 초안 생성 (최소 정보만으로 템플릿 ID 생성)
 * 템플릿 생성 시작 시 호출하여 템플릿 ID를 먼저 생성
 */
export const createCampTemplateDraftAction = withErrorHandling(
  async (
    formData: FormData
  ): Promise<{ success: boolean; templateId?: string; error?: string }> => {
    const { userId } = await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 최소 정보만 검증 (이름, 프로그램 유형)
    const name = String(formData.get("name") ?? "").trim();
    const programType = String(formData.get("program_type") ?? "").trim();

    if (!name || name.length === 0) {
      throw new AppError(
        "템플릿명은 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (name.length > 200) {
      throw new AppError(
        "템플릿명은 200자 이하여야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!programType) {
      throw new AppError(
        "프로그램 유형은 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const validProgramTypes = ["윈터캠프", "썸머캠프", "파이널캠프", "기타"];
    if (!validProgramTypes.includes(programType)) {
      throw new AppError(
        "올바른 프로그램 유형을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 추가 필드 추출 및 검증
    const description = String(formData.get("description") ?? "").trim() || null;
    const campStartDate = String(formData.get("camp_start_date") ?? "").trim() || null;
    const campEndDate = String(formData.get("camp_end_date") ?? "").trim() || null;
    const campLocation = String(formData.get("camp_location") ?? "").trim() || null;

    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (campStartDate && !dateRegex.test(campStartDate)) {
      throw new AppError(
        "캠프 시작일 형식이 올바르지 않습니다. (YYYY-MM-DD 형식)",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
    if (campEndDate && !dateRegex.test(campEndDate)) {
      throw new AppError(
        "캠프 종료일 형식이 올바르지 않습니다. (YYYY-MM-DD 형식)",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 종료일이 시작일보다 이후인지 검증
    if (campStartDate && campEndDate && campEndDate < campStartDate) {
      throw new AppError(
        "캠프 종료일은 시작일보다 이후여야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 캠프 장소 길이 검증
    if (campLocation && campLocation.length > 200) {
      throw new AppError(
        "캠프 장소는 200자 이하여야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 빈 template_data로 템플릿 생성
    const emptyTemplateData: Partial<WizardData> = {
      name,
      plan_purpose: "",
      scheduler_type: "",
      period_start: "",
      period_end: "",
      block_set_id: undefined,
      exclusions: [],
      academy_schedules: [],
      student_contents: [],
      recommended_contents: [],
    };

    // 템플릿 생성 (기본 정보 포함)
    const result = await createCampTemplate({
      tenant_id: tenantContext.tenantId,
      name,
      description: description || undefined,
      program_type: programType,
      template_data: emptyTemplateData,
      created_by: userId,
      camp_start_date: campStartDate || undefined,
      camp_end_date: campEndDate || undefined,
      camp_location: campLocation || undefined,
    });

    if (!result.success || !result.templateId) {
      throw new AppError(
        result.error || "템플릿 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return result;
  }
);

/**
 * 캠프 템플릿 생성 (전체 정보 포함)
 */
export const createCampTemplateAction = withErrorHandling(
  async (
    formData: FormData
  ): Promise<{ success: boolean; templateId?: string; error?: string }> => {
    const { userId } = await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 입력값 검증
    const name = String(formData.get("name") ?? "").trim();
    const description =
      String(formData.get("description") ?? "").trim() || null;
    const programType = String(formData.get("program_type") ?? "").trim();
    const templateDataJson = String(formData.get("template_data") ?? "");
    const campStartDate =
      String(formData.get("camp_start_date") ?? "").trim() || null;
    const campEndDate =
      String(formData.get("camp_end_date") ?? "").trim() || null;
    const campLocation =
      String(formData.get("camp_location") ?? "").trim() || null;

    if (!name || name.length === 0) {
      throw new AppError(
        "템플릿명은 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (name.length > 200) {
      throw new AppError(
        "템플릿명은 200자 이하여야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!programType) {
      throw new AppError(
        "프로그램 유형은 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const validProgramTypes = ["윈터캠프", "썸머캠프", "파이널캠프", "기타"];
    if (!validProgramTypes.includes(programType)) {
      throw new AppError(
        "올바른 프로그램 유형을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!templateDataJson) {
      throw new AppError(
        "템플릿 데이터는 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    let templateData: Partial<WizardData>;
    try {
      templateData = JSON.parse(templateDataJson);
    } catch (e) {
      throw new AppError(
        "템플릿 데이터 형식이 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // block_set_id를 추출하고 template_data에서 제거 (연결 테이블로 관리)
    const blockSetId = templateData.block_set_id && templateData.block_set_id !== "" 
      ? templateData.block_set_id 
      : null;
    
    // template_data에서 block_set_id 제거
    const { block_set_id, ...templateDataWithoutBlockSetId } = templateData;

    // 날짜 유효성 검증
    if (campStartDate && campEndDate) {
      const start = new Date(campStartDate);
      const end = new Date(campEndDate);
      if (end < start) {
        throw new AppError(
          "종료일은 시작일보다 이후여야 합니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }

    // 장소 길이 검증
    if (campLocation && campLocation.length > 200) {
      throw new AppError(
        "캠프 장소는 200자 이하여야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 템플릿 생성 (block_set_id는 template_data에서 제거됨)
    const result = await createCampTemplate({
      tenant_id: tenantContext.tenantId,
      name,
      description: description || undefined,
      program_type: programType,
      template_data: templateDataWithoutBlockSetId,
      created_by: userId,
      camp_start_date: campStartDate || undefined,
      camp_end_date: campEndDate || undefined,
      camp_location: campLocation || undefined,
    });

    if (!result.success || !result.templateId) {
      throw new AppError(
        result.error || "템플릿 생성에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 블록 세트 연결 처리
    if (blockSetId) {
      try {
        await linkBlockSetToTemplate(result.templateId, blockSetId);
      } catch (linkError) {
        console.error("[createCampTemplateAction] 블록 세트 연결 실패:", linkError);
        // 연결 실패해도 템플릿 생성은 성공으로 처리 (나중에 수동으로 연결 가능)
      }
    }

    return result;
  }
);

/**
 * 캠프 템플릿 수정
 */
export const updateCampTemplateAction = withErrorHandling(
  async (
    templateId: string,
    formData: FormData
  ): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    if (!templateId || typeof templateId !== "string") {
      throw new AppError(
        "템플릿 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 존재 및 권한 확인 (강화된 검증)
    const template = await getCampTemplate(templateId);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (template.tenant_id !== tenantContext.tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const name = String(formData.get("name") ?? "").trim();
    const description =
      String(formData.get("description") ?? "").trim() || null;
    const programType = String(formData.get("program_type") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    const templateDataJson = String(formData.get("template_data") ?? "");
    const campStartDate =
      String(formData.get("camp_start_date") ?? "").trim() || null;
    const campEndDate =
      String(formData.get("camp_end_date") ?? "").trim() || null;
    const campLocation =
      String(formData.get("camp_location") ?? "").trim() || null;

    // 입력값 검증
    if (!name || name.length === 0) {
      throw new AppError(
        "템플릿명은 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (name.length > 200) {
      throw new AppError(
        "템플릿명은 200자 이하여야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!programType) {
      throw new AppError(
        "프로그램 유형은 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const validProgramTypes = ["윈터캠프", "썸머캠프", "파이널캠프", "기타"];
    if (!validProgramTypes.includes(programType)) {
      throw new AppError(
        "올바른 프로그램 유형을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const validStatuses = ["draft", "active", "archived"];
    if (status && !validStatuses.includes(status)) {
      throw new AppError(
        "올바른 상태를 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!templateDataJson) {
      throw new AppError(
        "템플릿 데이터는 필수입니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    let templateData: Partial<WizardData>;
    try {
      templateData = JSON.parse(templateDataJson);
    } catch (e) {
      throw new AppError(
        "템플릿 데이터 형식이 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // block_set_id를 추출하고 template_data에서 제거 (연결 테이블로 관리)
    const blockSetId = templateData.block_set_id && templateData.block_set_id !== "" 
      ? templateData.block_set_id 
      : null;
    
    // template_data에서 block_set_id 제거
    const { block_set_id, ...templateDataWithoutBlockSetId } = templateData;

    // 날짜 유효성 검증
    if (campStartDate && campEndDate) {
      const start = new Date(campStartDate);
      const end = new Date(campEndDate);
      if (end < start) {
        throw new AppError(
          "종료일은 시작일보다 이후여야 합니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }

    // 장소 길이 검증
    if (campLocation && campLocation.length > 200) {
      throw new AppError(
        "캠프 장소는 200자 이하여야 합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    const updateData: CampTemplateUpdate = {
      name,
      description: description || null,
      program_type: (programType as CampTemplateUpdate["program_type"]) || null,
      status: (status || "draft") as CampTemplateUpdate["status"],
      template_data: templateDataWithoutBlockSetId as CampTemplateUpdate["template_data"], // block_set_id 제거된 데이터
      updated_at: new Date().toISOString(),
      camp_start_date: campStartDate || null,
      camp_end_date: campEndDate || null,
      camp_location: campLocation || null,
    };

    const { data: updatedRows, error } = await supabase
      .from("camp_templates")
      .update(updateData)
      .eq("id", templateId)
      .eq("tenant_id", tenantContext.tenantId)
      .select();

    if (error) {
      throw new AppError(
        "템플릿 수정에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 블록 세트 연결 처리
    if (blockSetId) {
      try {
        await linkBlockSetToTemplate(templateId, blockSetId);
      } catch (linkError) {
        console.error("[updateCampTemplateAction] 블록 세트 연결 실패:", linkError);
        // 연결 실패해도 템플릿 수정은 성공으로 처리
      }
    } else {
      // block_set_id가 없으면 연결 해제
      try {
        await unlinkBlockSetFromTemplate(templateId);
      } catch (unlinkError) {
        console.error("[updateCampTemplateAction] 블록 세트 연결 해제 실패:", unlinkError);
        // 연결 해제 실패해도 템플릿 수정은 성공으로 처리
      }
    }

    return { success: true };
  }
);

/**
 * 캠프 템플릿 상태 변경
 */
export const updateCampTemplateStatusAction = withErrorHandling(
  async (
    templateId: string,
    status: "draft" | "active" | "archived"
  ): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    if (!templateId || typeof templateId !== "string") {
      throw new AppError(
        "템플릿 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const validStatuses = ["draft", "active", "archived"];
    if (!validStatuses.includes(status)) {
      throw new AppError(
        "올바른 상태를 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 존재 및 권한 확인
    const template = await getCampTemplate(templateId);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (template.tenant_id !== tenantContext.tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    // 상태 변경
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("camp_templates")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("tenant_id", tenantContext.tenantId);

    if (error) {
      throw new AppError(
        "템플릿 상태 변경에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    return { success: true };
  }
);

/**
 * 캠프 템플릿 삭제
 */
export const deleteCampTemplateAction = withErrorHandling(
  async (templateId: string): Promise<{ success: boolean; error?: string }> => {
    // 권한 검증
    await requireAdminOrConsultant();

    // 입력값 검증
    if (!templateId || typeof templateId !== "string") {
      throw new AppError(
        "템플릿 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 존재 및 권한 확인 (강화된 검증)
    const template = await getCampTemplate(templateId);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (template.tenant_id !== tenantContext.tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    // 템플릿 삭제 전에 관련된 플랜 그룹 삭제
    const { deletePlanGroupsByTemplateId } = await import(
      "@/lib/data/planGroups"
    );
    const planGroupResult = await deletePlanGroupsByTemplateId(templateId);

    if (!planGroupResult.success) {
      console.error(
        "[campTemplateActions] 플랜 그룹 삭제 실패",
        planGroupResult.error
      );
      // 플랜 그룹 삭제 실패해도 템플릿 삭제는 계속 진행
      // (데이터 정합성 문제가 있을 수 있지만, 템플릿 삭제 자체는 완료)
      console.warn(
        "[campTemplateActions] 플랜 그룹 삭제 실패했지만 템플릿 삭제는 계속 진행합니다."
      );
    } else if (planGroupResult.deletedGroupIds && planGroupResult.deletedGroupIds.length > 0) {
      console.log(
        `[campTemplateActions] 템플릿 삭제 전 ${planGroupResult.deletedGroupIds.length}개의 플랜 그룹 삭제 완료`
      );
    }

    // 먼저 일반 클라이언트로 삭제 시도
    const supabase = await createSupabaseServerClient();
    const { data: deletedRows, error } = await supabase
      .from("camp_templates")
      .delete()
      .eq("id", templateId)
      .eq("tenant_id", tenantContext.tenantId)
      .select();

    let deletedSuccessfully = false;

    if (error) {
      console.warn("[deleteCampTemplateAction] 일반 클라이언트 삭제 실패, Admin Client로 재시도:", error);
    } else if (deletedRows && deletedRows.length > 0) {
      // 일반 클라이언트로 삭제 성공
      deletedSuccessfully = true;
      console.log("[deleteCampTemplateAction] 일반 클라이언트로 템플릿 삭제 성공:", {
        templateId,
        deletedCount: deletedRows.length,
      });
    } else {
      // 삭제된 행이 없음 (RLS 정책으로 차단되었을 가능성)
      console.warn("[deleteCampTemplateAction] 삭제된 행이 없음, Admin Client로 재시도:", {
        templateId,
        tenantId: tenantContext.tenantId,
      });
    }

    // 일반 클라이언트로 삭제 실패한 경우 Admin Client 사용
    if (!deletedSuccessfully) {
      try {
        const adminSupabase = createSupabaseAdminClient();
        const { data: adminDeletedRows, error: adminError } = await adminSupabase
          .from("camp_templates")
          .delete()
          .eq("id", templateId)
          .eq("tenant_id", tenantContext.tenantId)
          .select();

        if (adminError) {
          console.error("[deleteCampTemplateAction] Admin Client 삭제 에러:", adminError);
          throw new AppError(
            "템플릿 삭제에 실패했습니다.",
            ErrorCode.DATABASE_ERROR,
            500,
            true,
            { originalError: adminError.message }
          );
        }

        if (!adminDeletedRows || adminDeletedRows.length === 0) {
          // Admin Client로도 삭제 실패 (템플릿이 이미 삭제되었거나 존재하지 않음)
          console.warn("[deleteCampTemplateAction] Admin Client로도 삭제된 행이 없음:", {
            templateId,
            tenantId: tenantContext.tenantId,
          });
          // 이미 삭제되었을 가능성이 높으므로 성공으로 처리
          deletedSuccessfully = true;
        } else {
          deletedSuccessfully = true;
          console.log("[deleteCampTemplateAction] Admin Client로 템플릿 삭제 성공:", {
            templateId,
            deletedCount: adminDeletedRows.length,
          });
        }
      } catch (adminError) {
        console.error("[deleteCampTemplateAction] Admin Client 삭제 실패:", adminError);
        throw new AppError(
          "템플릿 삭제에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true,
          { originalError: adminError instanceof Error ? adminError.message : String(adminError) }
        );
      }
    }

    // 최종 확인: 실제로 삭제되었는지 재확인
    if (!deletedSuccessfully) {
      const { data: verifyTemplate } = await supabase
        .from("camp_templates")
        .select("id")
        .eq("id", templateId)
        .maybeSingle();

      if (verifyTemplate) {
        throw new AppError(
          "템플릿 삭제에 실패했습니다. 템플릿이 여전히 존재합니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }
    }

    // 캐시 무효화하여 목록 페이지 재렌더링 (강화)
    revalidatePath("/admin/camp-templates");
    revalidatePath("/admin/camp-templates", "layout");
    revalidatePath(`/admin/camp-templates/${templateId}`);

    return { success: true };
  }
);

/**
 * 캠프 템플릿 복사
 */
export const copyCampTemplateAction = withErrorHandling(
  async (
    templateId: string,
    newName?: string
  ): Promise<{ success: boolean; templateId?: string; error?: string }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    if (!templateId || typeof templateId !== "string") {
      throw new AppError(
        "템플릿 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 존재 및 권한 확인
    const template = await getCampTemplate(templateId);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (template.tenant_id !== tenantContext.tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    // 템플릿 복사 실행
    const result = await copyCampTemplate(templateId, newName);

    if (!result.success) {
      throw new AppError(
        result.error || "템플릿 복사에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 경로 재검증 (헬퍼 함수 사용)
    revalidateCampTemplatePaths(result.templateId);

    return {
      success: true,
      templateId: result.templateId,
    };
  }
);

/**
 * 학생 초대 발송
 */
export const sendCampInvitationsAction = withErrorHandling(
  async (
    templateId: string,
    studentIds: string[]
  ): Promise<{ success: boolean; error?: string; count?: number }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    validateStudentIds(studentIds);

    // 중복 제거
    const uniqueStudentIds = Array.from(new Set(studentIds));

    // 테넌트 컨텍스트 및 템플릿 권한 확인
    const tenantId = await validateTenantContext();
    await validateCampTemplateActive(templateId, tenantId);

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 기존 초대 확인 (중복 방지)
    const { data: existingInvitations } = await supabase
      .from("camp_invitations")
      .select("student_id")
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId)
      .in("student_id", uniqueStudentIds);

    const existingStudentIds = new Set(
      (existingInvitations || []).map((inv) => inv.student_id)
    );

    // 새로 초대할 학생만 필터링
    const newStudentIds = uniqueStudentIds.filter(
      (id) => !existingStudentIds.has(id)
    );

    if (newStudentIds.length === 0) {
      return {
        success: true,
        count: 0,
        error: "모든 학생이 이미 초대되었습니다.",
      };
    }

    // 초대 생성 (expires_at: 초대 발송 후 7일)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitations = newStudentIds.map((studentId) => ({
      tenant_id: tenantId,
      camp_template_id: templateId,
      student_id: studentId,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    }));

    const { data: insertedInvitations, error } = await supabase
      .from("camp_invitations")
      .insert(invitations)
      .select("id");

    if (error) {
      console.error("[actions/campTemplateActions] 초대 발송 실패", error);
      return { success: false, error: error.message };
    }

    // 이메일 알림 발송 (비동기, 실패해도 초대는 성공으로 처리)
    if (insertedInvitations && insertedInvitations.length > 0) {
      const { sendCampInvitationNotification } = await import(
        "@/lib/services/campNotificationService"
      );

      // 각 초대에 대해 이메일 발송 (병렬 처리)
      Promise.all(
        insertedInvitations.map((inv) =>
          sendCampInvitationNotification(inv.id).catch((err) => {
            console.error(
              `[actions/campTemplateActions] 초대 ${inv.id} 이메일 발송 실패:`,
              err
            );
          })
        )
      ).catch((err) => {
        console.error(
          "[actions/campTemplateActions] 일괄 이메일 발송 중 오류:",
          err
        );
      });
    }

    return { success: true, count: newStudentIds.length };
  }
);

/**
 * 템플릿별 캠프 초대 목록 조회
 */
export const getCampInvitationsForTemplate = withErrorHandling(
  async (templateId: string) => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    const tenantId = await validateTenantContext();

    // 템플릿 존재 확인 (템플릿이 없어도 초대 목록은 조회 가능 - 삭제된 템플릿의 초대도 볼 수 있어야 함)
    const template = await getCampTemplate(templateId);
    if (template) {
      // 템플릿이 존재하는 경우, 권한 확인
      await validateCampTemplateAccess(templateId, tenantId);
    }
    // 템플릿이 없는 경우 (삭제된 경우 등)에도 초대 목록은 조회 가능
    // 초대 목록 자체가 tenant_id로 필터링되므로 보안 문제 없음

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 초대 목록 조회 (tenant_id로 필터링하여 권한 확인)
    const { data: invitations, error } = await supabase
      .from("camp_invitations")
      .select(
        `
        *,
        students:student_id (
          name,
          grade,
          class
        )
      `
      )
      .eq("camp_template_id", templateId)
      .eq("tenant_id", tenantId)
      .order("invited_at", { ascending: false });

    if (error) {
      console.error("[campTemplateActions] 초대 목록 조회 실패", error);
      return { success: true, invitations: [] };
    }

    // 학생 정보를 평탄화
    type InvitationWithStudent = CampInvitation & {
      students?: {
        name: string | null;
        grade: number | null;
        class: string | null;
      } | null;
    };
    
    const formattedInvitations = (invitations || []).map((invitation: InvitationWithStudent) => ({
      ...invitation,
      student_name: invitation.students?.name ?? null,
      student_grade: invitation.students?.grade ?? null,
      student_class: invitation.students?.class ?? null,
    }));

    return { success: true, invitations: formattedInvitations };
  }
);

/**
 * 템플릿별 캠프 초대 목록 조회 (페이지네이션 지원, 서버 사이드 필터링)
 */
export const getCampInvitationsForTemplateWithPaginationAction = withErrorHandling(
  async (
    templateId: string,
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      search?: string;
      status?: string;
    }
  ) => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    const tenantId = await validateTenantContext();

    // 페이지네이션된 초대 목록 조회 (필터 적용)
    const result = await getCampInvitationsForTemplateWithPagination(
      templateId,
      tenantId,
      {
        page,
        pageSize,
        filters,
      }
    );

    return {
      success: true,
      invitations: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
);

/**
 * 캠프 초대 상태 수동 변경
 */
export const updateCampInvitationStatusAction = withErrorHandling(
  async (
    invitationId: string,
    status: "pending" | "accepted" | "declined"
  ): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampInvitationId(invitationId);
    validateCampInvitationStatus(status);

    // 테넌트 컨텍스트 및 초대 권한 확인
    const tenantId = await validateTenantContext();
    await validateCampInvitationAccess(invitationId, tenantId);

    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }

    // 상태 업데이트 데이터 준비
    const updateData = buildCampInvitationStatusUpdate(status);

    // 상태 업데이트
    const { data: updatedRows, error: updateError } = await supabase
      .from("camp_invitations")
      .update(updateData)
      .eq("id", invitationId)
      .eq("tenant_id", tenantId)
      .select();

    if (updateError) {
      throw new AppError(
        "초대 상태 변경에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: updateError.message }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    return { success: true };
  }
);

/**
 * 캠프 초대 삭제
 */
export const deleteCampInvitationAction = withErrorHandling(
  async (
    invitationId: string
  ): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError(
        "초대 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 초대 존재 및 권한 확인 (강화된 검증)
    const { getCampInvitation } = await import("@/lib/data/campTemplates");
    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      throw new AppError(
        "초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 권한 확인
    const template = await getCampTemplate(invitation.camp_template_id);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (template.tenant_id !== tenantContext.tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const { deleteCampInvitation } = await import("@/lib/data/campTemplates");
    const result = await deleteCampInvitation(invitationId);

    if (!result.success) {
      throw new AppError(
        result.error || "초대 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return result;
  }
);

/**
 * 캠프 초대 일괄 삭제
 */
export async function deleteCampInvitationsAction(
  invitationIds: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  if (!invitationIds || invitationIds.length === 0) {
    return { success: false, error: "삭제할 초대를 선택해주세요." };
  }

  // 모든 초대의 템플릿 권한 확인
  const { getCampInvitation } = await import("@/lib/data/campTemplates");
  const invitations = await Promise.all(
    invitationIds.map((id) => getCampInvitation(id))
  );

  const validInvitations = invitations.filter(Boolean);
  if (validInvitations.length !== invitationIds.length) {
    return { success: false, error: "일부 초대를 찾을 수 없습니다." };
  }

  // 템플릿 권한 확인
  const templateIds = new Set(
    validInvitations.map((inv) => inv!.camp_template_id)
  );
  const templates = await Promise.all(
    Array.from(templateIds).map((id) => getCampTemplate(id))
  );

  const invalidTemplates = templates.some(
    (t) => !t || t.tenant_id !== tenantContext.tenantId
  );
  if (invalidTemplates) {
    return { success: false, error: "권한이 없는 초대가 포함되어 있습니다." };
  }

  const { deleteCampInvitations } = await import("@/lib/data/campTemplates");
  const result = await deleteCampInvitations(invitationIds);

  return result;
}

/**
 * 캠프 초대 재발송
 */
export const resendCampInvitationsAction = withErrorHandling(
  async (
    templateId: string,
    invitationIds: string[]
  ): Promise<{ success: boolean; error?: string; count?: number }> => {
    await requireAdminOrConsultant();

    // 입력값 검증
    validateCampTemplateId(templateId);
    validateInvitationIds(invitationIds);

    // 중복 제거
    const uniqueInvitationIds = Array.from(new Set(invitationIds));

    // 테넌트 컨텍스트 및 템플릿 권한 확인
    const tenantId = await validateTenantContext();
    await validateCampTemplateActive(templateId, tenantId);

    // 초대 조회 및 학생 ID 추출
    const { getCampInvitation } = await import("@/lib/data/campTemplates");
    const invitations = await Promise.all(
      uniqueInvitationIds.map((id) => getCampInvitation(id))
    );

    const validInvitations = invitations.filter(Boolean);
    if (validInvitations.length === 0) {
      throw new AppError(
        "유효한 초대를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 모든 초대가 같은 템플릿인지 확인
    const allSameTemplate = validInvitations.every(
      (inv) => inv!.camp_template_id === templateId
    );
    if (!allSameTemplate) {
      throw new AppError(
        "같은 템플릿의 초대만 재발송할 수 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const studentIds = validInvitations.map((inv) => inv!.student_id);

    // 기존 초대 삭제 후 재발송
    const { deleteCampInvitations } = await import("@/lib/data/campTemplates");
    const deleteResult = await deleteCampInvitations(uniqueInvitationIds);
    if (!deleteResult.success) {
      throw new AppError(
        "기존 초대 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 재발송
    const result = await sendCampInvitationsAction(templateId, studentIds);

    return result;
  }
);

/**
 * 관리자용 캠프 플랜 그룹 조회 (검토용)
 */
export const getCampPlanGroupForReview = withErrorHandling(
  async (groupId: string) => {
    console.log("[getCampPlanGroupForReview] 함수 호출됨, groupId:", groupId);

    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    console.log(
      "[getCampPlanGroupForReview] 플랜 그룹 조회 시작, tenantId:",
      tenantContext.tenantId
    );

    const { getPlanGroupWithDetailsForAdmin } = await import(
      "@/lib/data/planGroups"
    );
    const result = await getPlanGroupWithDetailsForAdmin(
      groupId,
      tenantContext.tenantId
    );

    if (!result.group) {
      console.error(
        "[getCampPlanGroupForReview] 플랜 그룹을 찾을 수 없음, groupId:",
        groupId
      );
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    console.log("[getCampPlanGroupForReview] 플랜 그룹 조회 성공:", {
      groupId: result.group.id,
      planType: result.group.plan_type,
      campTemplateId: result.group.camp_template_id,
      schedulerOptions: JSON.stringify(result.group.scheduler_options),
    });

    // 캠프 플랜 그룹인지 확인
    if (result.group.plan_type !== "camp") {
      throw new AppError(
        "캠프 플랜 그룹이 아닙니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 템플릿 블록 정보 조회
    let templateBlocks: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];
    let templateBlockSetName: string | null = null;
    let templateBlockSetId: string | null = null;

    if (result.group.camp_template_id) {
      const supabase = await createSupabaseServerClient();

      // 템플릿 조회
      const { data: template, error: templateError } = await supabase
        .from("camp_templates")
        .select("template_data")
        .eq("id", result.group.camp_template_id)
        .maybeSingle();

      if (templateError) {
        console.error(
          "[getCampPlanGroupForReview] 템플릿 조회 에러:",
          templateError
        );
      } else if (!template) {
        console.warn(
          "[getCampPlanGroupForReview] 템플릿을 찾을 수 없음:",
          result.group.camp_template_id
        );
      } else {
        // block_set_id 찾기: 공통 함수 사용
        const { getTemplateBlockSetId } = await import("@/lib/plan/blocks");
        const schedulerOptions: SchedulerOptions = (result.group.scheduler_options as SchedulerOptions | null) ?? {};
        const tenantBlockSetId = await getTemplateBlockSetId(
          result.group.camp_template_id,
          schedulerOptions
        );

        if (tenantBlockSetId) {
          // 2. tenant_block_sets에서 블록 세트 정보 조회
          const { data: templateBlockSet, error: blockSetError } =
            await supabase
              .from("tenant_block_sets")
              .select("id, name")
              .eq("id", tenantBlockSetId)
              .eq("tenant_id", tenantContext.tenantId)
              .maybeSingle();

          if (blockSetError) {
            console.error(
              "[getCampPlanGroupForReview] 템플릿 블록 세트 조회 에러:",
              {
                error: blockSetError,
                tenantBlockSetId,
                templateId: result.group.camp_template_id,
              }
            );
          } else if (templateBlockSet) {
            templateBlockSetName = templateBlockSet.name;
            templateBlockSetId = templateBlockSet.id;

            // 3. tenant_blocks 테이블에서 블록 조회
            const { data: blocks, error: blocksError } = await supabase
              .from("tenant_blocks")
              .select("id, day_of_week, start_time, end_time")
              .eq("tenant_block_set_id", tenantBlockSetId)
              .order("day_of_week", { ascending: true })
              .order("start_time", { ascending: true });

            if (blocksError) {
              console.error(
                "[getCampPlanGroupForReview] 템플릿 블록 조회 에러:",
                {
                  error: blocksError,
                  tenantBlockSetId,
                }
              );
            } else if (blocks && blocks.length > 0) {
              templateBlocks = blocks.map((b) => ({
                id: b.id,
                day_of_week: b.day_of_week,
                start_time: b.start_time,
                end_time: b.end_time,
              }));

              console.log(
                "[getCampPlanGroupForReview] 템플릿 블록 조회 성공:",
                {
                  blockSetName: templateBlockSetName,
                  blockCount: templateBlocks.length,
                }
              );
            } else {
              console.warn("[getCampPlanGroupForReview] 템플릿 블록이 없음:", {
                tenantBlockSetId,
                templateBlockSetName,
              });
            }
          } else {
            console.warn(
              "[getCampPlanGroupForReview] 템플릿 블록 세트를 찾을 수 없음:",
              {
                tenantBlockSetId,
                templateId: result.group.camp_template_id,
              }
            );
          }
        } else {
          console.warn(
            "[getCampPlanGroupForReview] template_block_set_id를 찾을 수 없음:",
            {
              campTemplateId: result.group.camp_template_id,
              schedulerOptions: JSON.stringify(schedulerOptions),
              hasTemplateData: !!template.template_data,
            }
          );
        }
      }
    } else {
      console.warn(
        "[getCampPlanGroupForReview] camp_template_id가 없음, groupId:",
        groupId
      );
    }

    console.log("[getCampPlanGroupForReview] 최종 결과:", {
      templateBlocksCount: templateBlocks.length,
      templateBlockSetName,
      exclusionsCount: result.exclusions.length,
      academySchedulesCount: result.academySchedules.length,
    });

    // 콘텐츠 상세 정보 조회 (관리자가 학생의 추가 콘텐츠 정보를 제대로 볼 수 있도록)
    let contentsWithDetails = result.contents;
    if (result.group.student_id && result.contents.length > 0) {
      try {
        // 입력 데이터 검증 및 로그
        console.log("[getCampPlanGroupForReview] 콘텐츠 상세 정보 조회 시작:", {
          groupId: result.group.id,
          studentId: result.group.student_id,
          contentsCount: result.contents.length,
          contents: result.contents.map((c) => ({
            content_type: c.content_type,
            content_id: c.content_id,
            master_content_id: c.master_content_id,
            start_range: c.start_range,
            end_range: c.end_range,
          })),
        });

        const { classifyPlanContents } = await import(
          "@/lib/data/planContents"
        );
        // 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 역할 정보 전달 (RLS 우회)
        const { role, userId } = await getCurrentUserRole();
        // superadmin은 admin으로 매핑
        const mappedRole = role === "superadmin" ? "admin" : role;
        const { studentContents, recommendedContents } =
          await classifyPlanContents(result.contents, result.group.student_id, {
            currentUserRole: mappedRole || undefined,
            currentUserId: userId || undefined,
          });

        // 조회된 콘텐츠 개수 검증
        const totalClassifiedContents = studentContents.length + recommendedContents.length;
        const totalOriginalContents = result.contents.length;
        
        if (totalClassifiedContents !== totalOriginalContents) {
          console.warn("[getCampPlanGroupForReview] 콘텐츠 개수 불일치:", {
            groupId: result.group.id,
            studentId: result.group.student_id,
            originalCount: totalOriginalContents,
            classifiedCount: totalClassifiedContents,
            studentContentsCount: studentContents.length,
            recommendedContentsCount: recommendedContents.length,
            missingCount: totalOriginalContents - totalClassifiedContents,
          });
        }

        // 상세 페이지 형식으로 변환
        const allContents = [...studentContents, ...recommendedContents];
        const contentsMap = new Map(allContents.map((c) => [c.content_id, c]));

        // 각 타입별 누락 개수 집계
        const missingByType = {
          book: 0,
          lecture: 0,
          custom: 0,
        };

        contentsWithDetails = result.contents.map((content) => {
          const detail = contentsMap.get(content.content_id);
          if (!detail) {
            missingByType[content.content_type]++;
            console.warn(
              `[getCampPlanGroupForReview] 콘텐츠를 찾을 수 없음:`,
              {
                content_type: content.content_type,
                content_id: content.content_id,
                studentId: result.group?.student_id,
                groupId: result.group?.id,
              }
            );
            return {
              ...content,
              contentTitle: "알 수 없음",
              contentSubtitle: null,
              isRecommended: false,
            };
          }

          return {
            ...content,
            contentTitle: detail.title || "알 수 없음",
            contentSubtitle: detail.subject_category || null,
            isRecommended: detail.isRecommended,
          };
        });

        // 누락된 콘텐츠가 있는 경우 경고 로그
        const totalMissing =
          missingByType.book + missingByType.lecture + missingByType.custom;
        if (totalMissing > 0) {
          console.warn(
            "[getCampPlanGroupForReview] 누락된 콘텐츠 집계:",
            {
              groupId: result.group.id,
              studentId: result.group.student_id,
              missingByType,
              totalMissing,
              totalContents: result.contents.length,
            }
          );
        }

        console.log("[getCampPlanGroupForReview] 콘텐츠 상세 정보 조회 완료:", {
          groupId: result.group.id,
          studentId: result.group.student_id,
          originalContentsCount: result.contents.length,
          studentContentsCount: studentContents.length,
          recommendedContentsCount: recommendedContents.length,
          totalClassifiedCount: studentContents.length + recommendedContents.length,
          missingCount: totalMissing,
          missingByType,
        });
      } catch (error) {
        console.error(
          "[getCampPlanGroupForReview] 콘텐츠 상세 정보 조회 실패:",
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            groupId: result.group.id,
            studentId: result.group.student_id,
            contentsCount: result.contents.length,
            contents: result.contents.map((c) => ({
              content_type: c.content_type,
              content_id: c.content_id,
            })),
          }
        );
        // 에러가 발생해도 원본 contents 반환
      }
    }

    return {
      success: true,
      group: result.group,
      contents: contentsWithDetails,
      originalContents: result.contents, // 원본 contents (master_content_id 포함) - classifyPlanContents 호출용
      exclusions: result.exclusions,
      academySchedules: result.academySchedules,
      templateBlocks,
      templateBlockSetName,
      templateBlockSetId,
      student_id: result.group.student_id, // 관리자 모드에서 Step6FinalReview에 전달하기 위해
    };
  }
);

/**
 * 관리자용 캠프 플랜 그룹 남은 단계 진행 (Step 5, 6, 7)
 */
export const continueCampStepsForAdmin = withErrorHandling(
  async (
    groupId: string,
    wizardData: Partial<WizardData>,
    step?: number
  ): Promise<{ success: boolean; error?: string }> => {
    // 권한 검증
    await requireAdminOrConsultant();

    // 입력값 검증
    if (!groupId || typeof groupId !== "string") {
      throw new AppError(
        "플랜 그룹 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!wizardData) {
      throw new AppError(
        "참여 정보가 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 관리자용 Admin 클라이언트 사용 (RLS 우회)
    // 관리자가 다른 학생의 데이터를 조회/수정해야 하므로 Admin 클라이언트 필요
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createSupabaseAdminClient();
    
    if (!supabase) {
      throw new AppError(
        "서버 설정 오류: Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }
    
    console.log("[continueCampStepsForAdmin] Admin 클라이언트 사용 (RLS 우회)");

    // 플랜 그룹 조회 및 권한 확인
    const { getPlanGroupWithDetailsForAdmin } = await import(
      "@/lib/data/planGroups"
    );
    const result = await getPlanGroupWithDetailsForAdmin(
      groupId,
      tenantContext.tenantId
    );

    if (!result.group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 캠프 모드 확인
    if (result.group.plan_type !== "camp") {
      throw new AppError(
        "캠프 모드 플랜 그룹이 아닙니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 이미 플랜이 생성된 경우 확인
    const { data: plans } = await supabase
      .from("student_plan")
      .select("id")
      .eq("plan_group_id", groupId)
      .limit(1);

    const hasPlans = plans && plans.length > 0;

    // Step 7이 아닌 경우에만 플랜 생성 여부 확인 (Step 7에서는 플랜 생성이 목적이므로 허용)
    if (hasPlans && step !== 7) {
      throw new AppError(
        "이미 플랜이 생성된 그룹은 수정할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 플랜 그룹 업데이트 (관리자용 직접 업데이트)
    const { syncWizardDataToCreationData } = await import(
      "@/lib/utils/planGroupDataSync"
    );
    const {
      createPlanContents,
      createPlanExclusions,
      createStudentAcademySchedules,
    } = await import("@/lib/data/planGroups");

    // plan_purpose 정규화 함수 (planGroupActions에서 복사)
    const normalizePlanPurpose = (
      purpose: string | null | undefined
    ): string | null => {
      if (!purpose) return null;
      if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
      return purpose;
    };

    try {
      const creationData = syncWizardDataToCreationData(
        wizardData as WizardData
      );

      creationData.plan_type = "camp";
      if (result.group.camp_template_id) {
        creationData.camp_template_id = result.group.camp_template_id;
        
        // 캠프 모드에서 템플릿 블록 세트 ID 조회 (공통 함수 사용)
        const { getTemplateBlockSetId } = await import("@/lib/plan/blocks");
        const schedulerOptions: SchedulerOptions = (result.group.scheduler_options as SchedulerOptions | null) ?? {};
        const tenantBlockSetId = await getTemplateBlockSetId(
          result.group.camp_template_id,
          schedulerOptions
        );

        // 조회된 block_set_id 설정
        if (tenantBlockSetId) {
          creationData.block_set_id = tenantBlockSetId;
        } else {
          console.warn(
            "[continueCampStepsForAdmin] 템플릿 블록 세트 ID를 찾을 수 없습니다:",
            result.group.camp_template_id
          );
        }
      }
      if (result.group.camp_invitation_id) {
        creationData.camp_invitation_id = result.group.camp_invitation_id;
      }

      // time_settings를 scheduler_options에 안전하게 병합 (보호 필드 자동 보호)
      const mergedSchedulerOptions = mergeTimeSettingsSafely(
        creationData.scheduler_options || {},
        creationData.time_settings
      );

      // 플랜 그룹 메타데이터 업데이트 (관리자가 직접 Supabase 사용)
      const updatePayload: Partial<{
        updated_at: string;
        name: string | null;
        plan_purpose: string | null;
        scheduler_type: string | null;
        scheduler_options: PlanGroupSchedulerOptions | null;
        period_start: string;
        period_end: string;
        target_date: string | null;
        block_set_id: string | null;
        daily_schedule: DailyScheduleInfo[] | null;
        subject_constraints: unknown | null;
        additional_period_reallocation: unknown | null;
        non_study_time_blocks: unknown | null;
        plan_type: string | null;
        camp_template_id: string | null;
      }> = {
        updated_at: new Date().toISOString(),
      };

      if (creationData.name !== undefined)
        updatePayload.name = creationData.name || null;
      if (creationData.plan_purpose !== undefined)
        updatePayload.plan_purpose = normalizePlanPurpose(
          creationData.plan_purpose
        );
      if (creationData.scheduler_type !== undefined)
        updatePayload.scheduler_type = creationData.scheduler_type || null;
      if (Object.keys(mergedSchedulerOptions).length > 0) {
        updatePayload.scheduler_options = mergedSchedulerOptions;
      } else {
        updatePayload.scheduler_options = null;
      }
      if (creationData.period_start !== undefined)
        updatePayload.period_start = creationData.period_start;
      if (creationData.period_end !== undefined)
        updatePayload.period_end = creationData.period_end;
      if (creationData.target_date !== undefined)
        updatePayload.target_date = creationData.target_date || null;
      if (creationData.block_set_id !== undefined)
        updatePayload.block_set_id = creationData.block_set_id || null;
      if (creationData.daily_schedule !== undefined)
        updatePayload.daily_schedule = creationData.daily_schedule || null;
      if (creationData.subject_constraints !== undefined)
        updatePayload.subject_constraints =
          creationData.subject_constraints || null;
      if (creationData.additional_period_reallocation !== undefined)
        updatePayload.additional_period_reallocation =
          creationData.additional_period_reallocation || null;
      if (creationData.non_study_time_blocks !== undefined)
        updatePayload.non_study_time_blocks =
          creationData.non_study_time_blocks || null;
      if (creationData.plan_type !== undefined)
        updatePayload.plan_type = creationData.plan_type || null;
      if (creationData.camp_template_id !== undefined)
        updatePayload.camp_template_id = creationData.camp_template_id || null;
      if (creationData.camp_invitation_id !== undefined)
        updatePayload.camp_invitation_id =
          creationData.camp_invitation_id || null;

      const { error: updateError } = await supabase
        .from("plan_groups")
        .update(updatePayload)
        .eq("id", groupId)
        .eq("tenant_id", tenantContext.tenantId);

      if (updateError) {
        throw new AppError(
          `플랜 그룹 업데이트 실패: ${updateError.message}`,
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      // 콘텐츠 업데이트 (기존 콘텐츠 보존 로직 개선)
      // wizardData에서 student_contents와 recommended_contents를 확인하여
      // 명시적으로 전달된 경우에만 업데이트하고, 그렇지 않으면 기존 콘텐츠 보존
      const hasStudentContents = wizardData.student_contents !== undefined;
      const hasRecommendedContents = wizardData.recommended_contents !== undefined;
      
      console.log("[continueCampStepsForAdmin] 콘텐츠 업데이트 시작:", {
        groupId,
        step,
        hasStudentContents,
        studentContentsLength: wizardData.student_contents?.length ?? 0,
        hasRecommendedContents,
        recommendedContentsLength: wizardData.recommended_contents?.length ?? 0,
        studentContentsIsEmptyArray: hasStudentContents && wizardData.student_contents?.length === 0,
        recommendedContentsIsEmptyArray: hasRecommendedContents && wizardData.recommended_contents?.length === 0,
      });
      
      // 기존 콘텐츠 조회 (보존할 콘텐츠 확인용)
      const { data: existingPlanContents } = await supabase
        .from("plan_contents")
        .select("*")
        .eq("plan_group_id", groupId);

      // 기존 콘텐츠를 학생 콘텐츠와 추천 콘텐츠로 분류
      const existingStudentContents: typeof existingPlanContents = [];
      const existingRecommendedContents: typeof existingPlanContents = [];
      
      if (existingPlanContents) {
        for (const content of existingPlanContents) {
          // 콘텐츠 분류:
          // - is_auto_recommended: true, recommendation_source: "auto" → Step 4에서 자동 배정된 콘텐츠
          // - is_auto_recommended: false, recommendation_source: "admin" → 관리자가 일괄 적용한 콘텐츠
          // - 둘 다 없으면 → 학생이 직접 등록한 콘텐츠
          if (content.is_auto_recommended || content.recommendation_source) {
            existingRecommendedContents.push(content);
          } else {
            existingStudentContents.push(content);
          }
        }
      }
      
      console.log("[continueCampStepsForAdmin] 기존 콘텐츠 조회 결과:", {
        groupId,
        existingTotalCount: existingPlanContents?.length ?? 0,
        existingStudentContentsCount: existingStudentContents.length,
        existingRecommendedContentsCount: existingRecommendedContents.length,
      });

      // 콘텐츠 업데이트가 필요한 경우에만 처리
      if (hasStudentContents || hasRecommendedContents) {
        // 기존 콘텐츠 삭제
        const { error: deleteError } = await supabase
          .from("plan_contents")
          .delete()
          .eq("plan_group_id", groupId);

        if (deleteError) {
          throw new AppError(
            `기존 콘텐츠 삭제 실패: ${deleteError.message}`,
            ErrorCode.DATABASE_ERROR,
            500,
            true
          );
        }

        // 병합할 콘텐츠 목록 생성
        const contentsToSave: PlanContentInsert[] = [];
        
        // 학생 콘텐츠 처리
        if (hasStudentContents && wizardData.student_contents && wizardData.student_contents.length > 0) {
          // wizardData의 student_contents를 creationData 형식으로 변환하여 추가
          const studentContentsForCreation: PlanContentInsert[] = wizardData.student_contents.map((c, idx) => ({
            tenant_id: tenantContext.tenantId,
            plan_group_id: groupId,
            content_type: c.content_type,
            content_id: c.content_id,
            start_range: c.start_range,
            end_range: c.end_range,
            display_order: idx,
            master_content_id: c.master_content_id ?? null,
            is_auto_recommended: false, // 학생 콘텐츠는 항상 false
            recommendation_source: null,
            recommendation_reason: null,
            recommendation_metadata: null,
          }));
          contentsToSave.push(...studentContentsForCreation);
        } else if (
          (!hasStudentContents || (hasStudentContents && wizardData.student_contents && wizardData.student_contents.length === 0)) &&
          existingStudentContents.length > 0
        ) {
          // wizardData에 student_contents가 없거나 빈 배열인 경우 기존 학생 콘텐츠 보존
          // 빈 배열을 전달하면 hasStudentContents는 true이지만 length > 0이 false가 되어 보존되지 않는 문제 해결
          const preservedStudentContents: PlanContentInsert[] = existingStudentContents.map((c) => ({
            tenant_id: tenantContext.tenantId,
            plan_group_id: groupId,
            content_type: c.content_type,
            content_id: c.content_id,
            start_range: c.start_range,
            end_range: c.end_range,
            display_order: c.display_order ?? 0,
            master_content_id: c.master_content_id ?? null,
            is_auto_recommended: false, // 학생 콘텐츠는 항상 false
            recommendation_source: null,
            recommendation_reason: null,
            recommendation_metadata: null,
          }));
          contentsToSave.push(...preservedStudentContents);
          
          console.log("[continueCampStepsForAdmin] 기존 학생 콘텐츠 보존:", {
            groupId,
            hasStudentContents,
            wizardDataStudentContentsLength: wizardData.student_contents?.length ?? 0,
            existingStudentContentsCount: existingStudentContents.length,
            preservedCount: preservedStudentContents.length,
          });
        }

        // 추천 콘텐츠 처리
        if (hasRecommendedContents && wizardData.recommended_contents && wizardData.recommended_contents.length > 0) {
          // wizardData의 recommended_contents를 creationData 형식으로 변환하여 추가
          // 관리자가 추가하는 경우는 항상 is_auto_recommended: false, recommendation_source: "admin"으로 강제 설정
          const recommendedContentsForCreation: PlanContentInsert[] = wizardData.recommended_contents.map((c, idx) => ({
            tenant_id: tenantContext.tenantId,
            plan_group_id: groupId,
            content_type: c.content_type,
            content_id: c.content_id,
            start_range: c.start_range,
            end_range: c.end_range,
            display_order: contentsToSave.length + idx,
            master_content_id: (c as { master_content_id?: string | null }).master_content_id ?? null,
            is_auto_recommended: false, // 관리자 추가는 항상 false
            recommendation_source: "admin", // 관리자 추가는 항상 "admin"으로 강제 설정
            recommendation_reason: c.recommendation_reason ?? null,
            recommendation_metadata: (c.recommendation_metadata as RecommendationMetadata | null) ?? null,
          }));
          contentsToSave.push(...recommendedContentsForCreation);
        } else if (
          (!hasRecommendedContents || (hasRecommendedContents && wizardData.recommended_contents && wizardData.recommended_contents.length === 0)) &&
          existingRecommendedContents.length > 0
        ) {
          // wizardData에 recommended_contents가 없거나 빈 배열인 경우 기존 추천 콘텐츠 보존
          // 빈 배열을 전달하면 hasRecommendedContents는 true이지만 length > 0이 false가 되어 보존되지 않는 문제 해결
          const preservedRecommendedContents: PlanContentInsert[] = existingRecommendedContents.map((c) => ({
            tenant_id: tenantContext.tenantId,
            plan_group_id: groupId,
            content_type: c.content_type,
            content_id: c.content_id,
            start_range: c.start_range,
            end_range: c.end_range,
            display_order: contentsToSave.length + (c.display_order ?? 0),
            master_content_id: c.master_content_id ?? null,
            is_auto_recommended: c.is_auto_recommended ?? false,
            recommendation_source: c.recommendation_source ?? null,
            recommendation_reason: c.recommendation_reason ?? null,
            recommendation_metadata: (c.recommendation_metadata as RecommendationMetadata | null) ?? null,
          }));
          contentsToSave.push(...preservedRecommendedContents);
          
          console.log("[continueCampStepsForAdmin] 기존 추천 콘텐츠 보존:", {
            groupId,
            hasRecommendedContents,
            wizardDataRecommendedContentsLength: wizardData.recommended_contents?.length ?? 0,
            existingRecommendedContentsCount: existingRecommendedContents.length,
            preservedCount: preservedRecommendedContents.length,
          });
        }

        console.log("[continueCampStepsForAdmin] 저장할 콘텐츠 목록:", {
          groupId,
          totalContentsToSave: contentsToSave.length,
          studentContentsToSave: contentsToSave.filter((c) => !c.is_auto_recommended && !c.recommendation_source).length,
          recommendedContentsToSave: contentsToSave.filter((c) => c.is_auto_recommended || c.recommendation_source).length,
        });
        
        if (contentsToSave.length > 0) {
          // 학생이 실제로 가지고 있는 콘텐츠만 필터링
          const studentId = result.group.student_id;
          const validContents: Array<{
            content_type: string;
            content_id: string;
            start_range: number;
            end_range: number;
            display_order: number;
            master_content_id?: string | null;
            is_auto_recommended?: boolean;
            recommendation_source?: "auto" | "admin" | "template" | null;
            recommendation_reason?: string | null;
            recommendation_metadata?: RecommendationMetadata | null;
          }> = [];

          for (const content of contentsToSave) {
            let isValidContent = false;
            let actualContentId = content.content_id;

            if (content.content_type === "book") {
              // 먼저 학생 교재로 직접 조회
              const { data: studentBook } = await supabase
                .from("books")
                .select("id")
                .eq("id", content.content_id)
                .eq("student_id", studentId)
                .maybeSingle();

              if (studentBook) {
                isValidContent = true;
                actualContentId = studentBook.id;
              } else {
                // 마스터 교재인지 확인
                const { data: masterBook } = await supabase
                  .from("master_books")
                  .select("id")
                  .eq("id", content.content_id)
                  .maybeSingle();

                if (masterBook) {
                  // 마스터 교재인 경우, 해당 학생의 교재를 master_content_id로 찾기
                  const { data: studentBookByMaster } = await supabase
                    .from("books")
                    .select("id, master_content_id")
                    .eq("student_id", studentId)
                    .eq("master_content_id", content.content_id)
                    .maybeSingle();

                  if (studentBookByMaster) {
                    isValidContent = true;
                    actualContentId = studentBookByMaster.id;
                  } else {
                    // 마스터 교재를 학생 교재로 복사 (캠프 모드에서 자동 복사)
                    try {
                      const { copyMasterBookToStudent } = await import(
                        "@/lib/data/contentMasters"
                      );
                      const { bookId } = await copyMasterBookToStudent(
                        content.content_id,
                        studentId,
                        tenantContext.tenantId
                      );
                      isValidContent = true;
                      actualContentId = bookId;
                      console.log(
                        `[campTemplateActions] 마스터 교재(${content.content_id})를 학생 교재(${bookId})로 복사했습니다.`
                      );
                    } catch (copyError) {
                      console.error(
                        `[campTemplateActions] 마스터 교재 복사 실패: ${content.content_id}`,
                        copyError
                      );
                      // 복사 실패 시에도 마스터 콘텐츠 ID를 사용 (플랜 생성 시 자동 복사됨)
                      isValidContent = true;
                      actualContentId = content.content_id;
                    }
                  }
                } else {
                  console.warn(
                    `[campTemplateActions] 교재(${content.content_id})를 찾을 수 없습니다. 콘텐츠에서 제외합니다.`
                  );
                }
              }
            } else if (content.content_type === "lecture") {
              // 먼저 학생 강의로 직접 조회
              const { data: studentLecture } = await supabase
                .from("lectures")
                .select("id")
                .eq("id", content.content_id)
                .eq("student_id", studentId)
                .maybeSingle();

              if (studentLecture) {
                isValidContent = true;
                actualContentId = studentLecture.id;
              } else {
                // 마스터 강의인지 확인
                const { data: masterLecture } = await supabase
                  .from("master_lectures")
                  .select("id")
                  .eq("id", content.content_id)
                  .maybeSingle();

                if (masterLecture) {
                  // 마스터 강의인 경우, 해당 학생의 강의를 master_content_id로 찾기
                  const { data: studentLectureByMaster } = await supabase
                    .from("lectures")
                    .select("id, master_content_id")
                    .eq("student_id", studentId)
                    .eq("master_content_id", content.content_id)
                    .maybeSingle();

                  if (studentLectureByMaster) {
                    isValidContent = true;
                    actualContentId = studentLectureByMaster.id;
                  } else {
                    // 마스터 강의를 학생 강의로 복사 (캠프 모드에서 자동 복사)
                    try {
                      const { copyMasterLectureToStudent } = await import(
                        "@/lib/data/contentMasters"
                      );
                      const { lectureId } = await copyMasterLectureToStudent(
                        content.content_id,
                        studentId,
                        tenantContext.tenantId
                      );
                      isValidContent = true;
                      actualContentId = lectureId;
                      console.log(
                        `[campTemplateActions] 마스터 강의(${content.content_id})를 학생 강의(${lectureId})로 복사했습니다.`
                      );
                    } catch (copyError) {
                      console.error(
                        `[campTemplateActions] 마스터 강의 복사 실패: ${content.content_id}`,
                        copyError
                      );
                      // 복사 실패 시에도 마스터 콘텐츠 ID를 사용 (플랜 생성 시 자동 복사됨)
                      isValidContent = true;
                      actualContentId = content.content_id;
                    }
                  }
                } else {
                  console.warn(
                    `[campTemplateActions] 강의(${content.content_id})를 찾을 수 없습니다. 콘텐츠에서 제외합니다.`
                  );
                }
              }
            } else if (content.content_type === "custom") {
              // 커스텀 콘텐츠는 학생 ID로 직접 조회
              const { data: customContent } = await supabase
                .from("student_custom_contents")
                .select("id")
                .eq("id", content.content_id)
                .eq("student_id", studentId)
                .maybeSingle();

              if (customContent) {
                isValidContent = true;
                actualContentId = customContent.id;
              } else {
                console.warn(
                  `[campTemplateActions] 커스텀 콘텐츠(${content.content_id})를 찾을 수 없습니다. 콘텐츠에서 제외합니다.`
                );
              }
            }

            if (isValidContent) {
            const contentWithRecommendation = content as typeof content & {
              is_auto_recommended?: boolean;
              recommendation_source?: "auto" | "admin" | "template" | string | null;
              recommendation_reason?: string | null;
              recommendation_metadata?: RecommendationMetadata | null;
            };
              const recommendationSource = contentWithRecommendation.recommendation_source;
              const validRecommendationSource: "auto" | "admin" | "template" | null = 
                recommendationSource === "auto" || recommendationSource === "admin" || recommendationSource === "template"
                  ? recommendationSource
                  : null;
              validContents.push({
                content_type: content.content_type,
                content_id: actualContentId,
                start_range: content.start_range,
                end_range: content.end_range,
                display_order: content.display_order ?? 0,
                master_content_id: content.master_content_id || null,
                is_auto_recommended: contentWithRecommendation.is_auto_recommended ?? false,
                recommendation_source: validRecommendationSource,
                recommendation_reason: contentWithRecommendation.recommendation_reason || null,
                recommendation_metadata: contentWithRecommendation.recommendation_metadata ?? null,
              });
            }
          }

          if (validContents.length > 0) {
            const contentsResult = await createPlanContents(
              groupId,
              tenantContext.tenantId,
              validContents
            );

            if (!contentsResult.success) {
              throw new AppError(
                contentsResult.error || "콘텐츠 업데이트에 실패했습니다.",
                ErrorCode.DATABASE_ERROR,
                500,
                true
              );
            }

            // 데이터 병합 검증: 저장된 콘텐츠 확인
            const { data: savedContents } = await supabase
              .from("plan_contents")
              .select("*")
              .eq("plan_group_id", groupId);

            const savedStudentContents = savedContents?.filter(
              (c) => !c.is_auto_recommended && !c.recommendation_source
            ) || [];
            const savedRecommendedContents = savedContents?.filter(
              (c) => c.is_auto_recommended || c.recommendation_source
            ) || [];

            console.log("[campTemplateActions] 콘텐츠 병합 검증:", {
              groupId,
              studentId,
              hasStudentContents,
              hasRecommendedContents,
              existingStudentContentsCount: existingStudentContents.length,
              existingRecommendedContentsCount: existingRecommendedContents.length,
              savedStudentContentsCount: savedStudentContents.length,
              savedRecommendedContentsCount: savedRecommendedContents.length,
              validContentsCount: validContents.length,
              contentsToSaveCount: contentsToSave.length,
            });

            // 검증: 기존 학생 콘텐츠가 보존되었는지 확인
            // hasStudentContents가 false이거나 빈 배열인 경우 기존 콘텐츠가 보존되어야 함
            if (
              (!hasStudentContents || (hasStudentContents && wizardData.student_contents && wizardData.student_contents.length === 0)) &&
              existingStudentContents.length > 0
            ) {
              const preservedCount = savedStudentContents.filter((saved) =>
                existingStudentContents.some(
                  (existing) =>
                    existing.content_type === saved.content_type &&
                    existing.content_id === saved.content_id
                )
              ).length;

              if (preservedCount !== existingStudentContents.length) {
                console.warn(
                  `[campTemplateActions] 기존 학생 콘텐츠 보존 검증 실패:`,
                  {
                    expected: existingStudentContents.length,
                    actual: preservedCount,
                    groupId,
                    studentId,
                  }
                );
              } else {
                console.log(
                  `[campTemplateActions] 기존 학생 콘텐츠 보존 검증 성공: ${preservedCount}개 보존됨`
                );
              }
            }

            // 검증: 기존 추천 콘텐츠가 보존되었는지 확인
            // hasRecommendedContents가 false이거나 빈 배열인 경우 기존 콘텐츠가 보존되어야 함
            if (
              (!hasRecommendedContents || (hasRecommendedContents && wizardData.recommended_contents && wizardData.recommended_contents.length === 0)) &&
              existingRecommendedContents.length > 0
            ) {
              const preservedCount = savedRecommendedContents.filter((saved) =>
                existingRecommendedContents.some(
                  (existing) =>
                    existing.content_type === saved.content_type &&
                    existing.content_id === saved.content_id
                )
              ).length;

              if (preservedCount !== existingRecommendedContents.length) {
                console.warn(
                  `[campTemplateActions] 기존 추천 콘텐츠 보존 검증 실패:`,
                  {
                    expected: existingRecommendedContents.length,
                    actual: preservedCount,
                    groupId,
                    studentId,
                    hasRecommendedContents,
                    wizardDataRecommendedContentsLength: wizardData.recommended_contents?.length ?? 0,
                  }
                );
              } else {
                console.log(
                  `[campTemplateActions] 기존 추천 콘텐츠 보존 검증 성공: ${preservedCount}개 보존됨`
                );
              }
            }
          } else if (contentsToSave.length > 0) {
            // 유효한 콘텐츠가 없는 경우 경고만 출력 (에러는 발생시키지 않음)
            console.warn(
              `[campTemplateActions] 학생(${studentId})이 가지고 있는 유효한 콘텐츠가 없습니다.`
            );
          }
        }
      }

      // 제외일 업데이트 (기존 삭제 후 재생성)
      if (creationData.exclusions !== undefined) {
        const { error: deleteError } = await supabase
          .from("plan_exclusions")
          .delete()
          .eq("plan_group_id", groupId);

        if (deleteError) {
          console.error(
            "[campTemplateActions] 기존 제외일 삭제 실패",
            deleteError
          );
        }

        if (creationData.exclusions.length > 0) {
          const exclusionsResult = await createPlanExclusions(
            groupId,
            tenantContext.tenantId,
            creationData.exclusions.map((e) => ({
              exclusion_date: e.exclusion_date,
              exclusion_type: e.exclusion_type,
              reason: e.reason || null,
            }))
          );

          if (!exclusionsResult.success) {
            throw new AppError(
              exclusionsResult.error || "제외일 업데이트에 실패했습니다.",
              ErrorCode.DATABASE_ERROR,
              500,
              true
            );
          }
        }
      }

      // 학원 일정 업데이트 (학생별 전역 관리, UPSERT 방식)
      if (creationData.academy_schedules !== undefined) {
        const studentId = result.group.student_id;

        // 기존 학원 일정 조회 (중복 체크용)
        const { getStudentAcademySchedules } = await import("@/lib/data/planGroups");
        const existingSchedules = await getStudentAcademySchedules(studentId, tenantContext.tenantId);
        
        // 기존 학원 일정을 키로 매핑 (요일:시작시간:종료시간:학원명:과목)
        const existingKeys = new Set(
          existingSchedules.map((s) => 
            `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`
          )
        );

        // 새로운 학원 일정 중 중복되지 않은 것만 필터링
        const newSchedules = creationData.academy_schedules.filter((s) => {
          const key = `${s.day_of_week}:${s.start_time}:${s.end_time}:${s.academy_name || ""}:${s.subject || ""}`;
          return !existingKeys.has(key);
        });

        console.log("[campTemplateActions] 학원 일정 업데이트:", {
          studentId,
          totalSchedules: creationData.academy_schedules.length,
          existingSchedulesCount: existingSchedules.length,
          newSchedulesCount: newSchedules.length,
          skippedCount: creationData.academy_schedules.length - newSchedules.length,
        });

        // 중복되지 않은 새로운 학원 일정만 추가 (관리자 모드: Admin 클라이언트 사용)
        if (newSchedules.length > 0) {
          const schedulesResult = await createStudentAcademySchedules(
            studentId,
            tenantContext.tenantId,
            newSchedules.map((s) => ({
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
              academy_name: s.academy_name || null,
              subject: s.subject || null,
            })),
            true // 관리자 모드: Admin 클라이언트 사용 (RLS 우회)
          );

          if (!schedulesResult.success) {
            throw new AppError(
              schedulesResult.error || "학원 일정 업데이트에 실패했습니다.",
              ErrorCode.DATABASE_ERROR,
              500,
              true
            );
          }
        } else if (creationData.academy_schedules.length > 0) {
          // 모든 학원 일정이 이미 존재하는 경우 로그만 출력
          console.log("[campTemplateActions] 모든 학원 일정이 이미 존재합니다.");
        }
      }

      // Step 7에서만 플랜 생성
      // Step 4, 5, 6에서는 데이터 저장만 수행
      if (step === 7) {
        // 플랜 생성 전 필수 데이터 검증
        const validationErrors: string[] = [];

        // 1. 기간 검증
        const periodStart =
          updatePayload.period_start || result.group.period_start;
        const periodEnd = updatePayload.period_end || result.group.period_end;
        if (!periodStart || !periodEnd) {
          validationErrors.push("학습 기간이 설정되지 않았습니다.");
        } else {
          const start = new Date(periodStart);
          const end = new Date(periodEnd);
          if (start >= end) {
            validationErrors.push("시작일은 종료일보다 이전이어야 합니다.");
          }
        }

        // 2. 콘텐츠 검증 및 저장 보장
        // plan_contents 테이블에 콘텐츠가 있는지 먼저 확인 (DB 우선 확인)
        const { data: existingPlanContents } = await supabase
          .from("plan_contents")
          .select("id")
          .eq("plan_group_id", groupId)
          .limit(1);

        const hasPlanContents = existingPlanContents && existingPlanContents.length > 0;

        console.log("[campTemplateActions] Step 6 콘텐츠 검증 시작:", {
          groupId,
          step,
          hasPlanContents,
          existingPlanContentsCount: existingPlanContents?.length || 0,
          wizardDataStudentContents: wizardData.student_contents?.length ?? 0,
          wizardDataRecommendedContents: wizardData.recommended_contents?.length ?? 0,
          wizardDataStudentContentsIsUndefined: wizardData.student_contents === undefined,
          wizardDataRecommendedContentsIsUndefined: wizardData.recommended_contents === undefined,
        });

        // wizardData에서 콘텐츠 확인 (플랜 생성 전이므로 plan_contents 테이블이 비어있을 수 있음)
        // wizardData가 undefined이면 DB에서 콘텐츠를 로드하여 wizardData에 채움
        // continue/page.tsx에서 빈 배열을 undefined로 변환하여 전달하므로, undefined인 경우 DB에서 로드 필요
        let studentContents = wizardData.student_contents;
        let recommendedContents = wizardData.recommended_contents;
        
        // wizardData에 콘텐츠가 없고(undefined) DB에 콘텐츠가 있으면 DB에서 로드
        // 또는 wizardData에 콘텐츠가 빈 배열이고 DB에 콘텐츠가 있으면 DB에서 로드
        const hasWizardDataContents = 
          (wizardData.student_contents !== undefined && wizardData.student_contents.length > 0) ||
          (wizardData.recommended_contents !== undefined && wizardData.recommended_contents.length > 0);
        
        if (
          (!hasWizardDataContents && hasPlanContents) ||
          (wizardData.student_contents === undefined || wizardData.recommended_contents === undefined)
        ) {
          console.log("[campTemplateActions] Step 6 DB에서 콘텐츠 로드:", {
            wizardDataStudentContentsIsUndefined: wizardData.student_contents === undefined,
            wizardDataRecommendedContentsIsUndefined: wizardData.recommended_contents === undefined,
            hasPlanContents,
          });
          
          // DB에서 콘텐츠 조회
          const { getPlanGroupWithDetailsForAdmin } = await import(
            "@/lib/data/planGroups"
          );
          const dbResult = await getPlanGroupWithDetailsForAdmin(
            groupId,
            tenantContext.tenantId
          );
          
          if (dbResult.contents && dbResult.contents.length > 0) {
            // DB 콘텐츠를 wizardData 형식으로 변환
            const { syncCreationDataToWizardData } = await import(
              "@/lib/utils/planGroupDataSync"
            );
            const dbWizardData = syncCreationDataToWizardData({
              group: result.group,
              contents: dbResult.contents,
              exclusions: dbResult.exclusions || [],
              academySchedules: dbResult.academySchedules || [],
            });
            
            // wizardData에 채움 (undefined인 경우만)
            if (wizardData.student_contents === undefined) {
              studentContents = dbWizardData.student_contents || [];
            }
            if (wizardData.recommended_contents === undefined) {
              recommendedContents = dbWizardData.recommended_contents || [];
            }
          }
        }
        
        // undefined인 경우 빈 배열로 변환 (계산을 위해)
        if (studentContents === undefined) studentContents = [];
        if (recommendedContents === undefined) recommendedContents = [];
        
        // DB에서 로드한 콘텐츠 로그 (undefined 체크 이후)
        if (hasPlanContents) {
          console.log("[campTemplateActions] Step 6 DB에서 로드한 콘텐츠:", {
            loadedStudentContentsCount: studentContents.length,
            loadedRecommendedContentsCount: recommendedContents.length,
            totalLoadedContents: studentContents.length + recommendedContents.length,
          });
        }
        
        const totalContents = studentContents.length + recommendedContents.length;

        // DB에 콘텐츠가 있으면 저장 로직 스킵 (이미 저장되어 있음)
        if (hasPlanContents) {
          console.log("[campTemplateActions] Step 6 콘텐츠 저장 스킵:", {
            reason: "DB에 이미 콘텐츠가 있음",
            existingPlanContentsCount: existingPlanContents?.length || 0,
            wizardDataTotalContents: totalContents,
          });
        } else if (totalContents > 0) {
          // wizardData에 콘텐츠가 있고 plan_contents에 없으면 저장
          console.log("[campTemplateActions] Step 6에서 콘텐츠 저장 필요:", {
            totalContents,
            studentContents: studentContents.length,
            recommendedContents: recommendedContents.length,
          });

          // creationData를 다시 생성하여 콘텐츠 저장
          const creationDataForContents = syncWizardDataToCreationData(
            wizardData as WizardData
          );

          if (creationDataForContents.contents && creationDataForContents.contents.length > 0) {
            const studentId = result.group.student_id;
            const validContents: Array<{
              content_type: string;
              content_id: string;
              start_range: number;
              end_range: number;
              display_order: number;
              master_content_id?: string | null;
            }> = [];

            for (const content of creationDataForContents.contents) {
              let isValidContent = false;
              let actualContentId = content.content_id;
              let masterContentId: string | null = null;

              if (content.content_type === "book") {
                // 먼저 학생 교재로 직접 조회
                const { data: studentBook } = await supabase
                  .from("books")
                  .select("id, master_content_id")
                  .eq("id", content.content_id)
                  .eq("student_id", studentId)
                  .maybeSingle();

                if (studentBook) {
                  isValidContent = true;
                  actualContentId = studentBook.id;
                  masterContentId = studentBook.master_content_id || null;
                } else {
                  // 마스터 교재인지 확인
                  const { data: masterBook } = await supabase
                    .from("master_books")
                    .select("id")
                    .eq("id", content.content_id)
                    .maybeSingle();

                  if (masterBook) {
                    // 마스터 교재인 경우, 해당 학생의 교재를 master_content_id로 찾기
                    const { data: studentBookByMaster } = await supabase
                      .from("books")
                      .select("id, master_content_id")
                      .eq("student_id", studentId)
                      .eq("master_content_id", content.content_id)
                      .maybeSingle();

                    if (studentBookByMaster) {
                      isValidContent = true;
                      actualContentId = studentBookByMaster.id;
                      masterContentId = content.content_id; // 원본 마스터 콘텐츠 ID
                    } else {
                      // 마스터 교재를 학생 교재로 복사 (캠프 모드에서 자동 복사)
                      try {
                        const { copyMasterBookToStudent } = await import(
                          "@/lib/data/contentMasters"
                        );
                        const { bookId } = await copyMasterBookToStudent(
                          content.content_id,
                          studentId,
                          tenantContext.tenantId
                        );
                        isValidContent = true;
                        actualContentId = bookId;
                        masterContentId = content.content_id; // 원본 마스터 콘텐츠 ID
                        console.log(
                          `[campTemplateActions] 마스터 교재(${content.content_id})를 학생 교재(${bookId})로 복사했습니다.`
                        );
                      } catch (copyError) {
                        console.error(
                          `[campTemplateActions] 마스터 교재 복사 실패: ${content.content_id}`,
                          copyError
                        );
                        // 복사 실패 시에도 마스터 콘텐츠 ID를 사용 (플랜 생성 시 자동 복사됨)
                        isValidContent = true;
                        actualContentId = content.content_id;
                        masterContentId = content.content_id;
                      }
                    }
                  }
                }
              } else if (content.content_type === "lecture") {
                // 먼저 학생 강의로 직접 조회
                const { data: studentLecture } = await supabase
                  .from("lectures")
                  .select("id, master_content_id")
                  .eq("id", content.content_id)
                  .eq("student_id", studentId)
                  .maybeSingle();

                if (studentLecture) {
                  isValidContent = true;
                  actualContentId = studentLecture.id;
                  masterContentId = studentLecture.master_content_id || null;
                } else {
                  // 마스터 강의인지 확인
                  const { data: masterLecture } = await supabase
                    .from("master_lectures")
                    .select("id")
                    .eq("id", content.content_id)
                    .maybeSingle();

                  if (masterLecture) {
                    // 마스터 강의인 경우, 해당 학생의 강의를 master_content_id로 찾기
                    const { data: studentLectureByMaster } = await supabase
                      .from("lectures")
                      .select("id, master_content_id")
                      .eq("student_id", studentId)
                      .eq("master_content_id", content.content_id)
                      .maybeSingle();

                    if (studentLectureByMaster) {
                      isValidContent = true;
                      actualContentId = studentLectureByMaster.id;
                      masterContentId = content.content_id; // 원본 마스터 콘텐츠 ID
                    } else {
                      // 마스터 강의를 학생 강의로 복사 (캠프 모드에서 자동 복사)
                      try {
                        const { copyMasterLectureToStudent } = await import(
                          "@/lib/data/contentMasters"
                        );
                        const { lectureId } = await copyMasterLectureToStudent(
                          content.content_id,
                          studentId,
                          tenantContext.tenantId
                        );
                        isValidContent = true;
                        actualContentId = lectureId;
                        masterContentId = content.content_id; // 원본 마스터 콘텐츠 ID
                        console.log(
                          `[campTemplateActions] 마스터 강의(${content.content_id})를 학생 강의(${lectureId})로 복사했습니다.`
                        );
                      } catch (copyError) {
                        console.error(
                          `[campTemplateActions] 마스터 강의 복사 실패: ${content.content_id}`,
                          copyError
                        );
                        // 복사 실패 시에도 마스터 콘텐츠 ID를 사용 (플랜 생성 시 자동 복사됨)
                        isValidContent = true;
                        actualContentId = content.content_id;
                        masterContentId = content.content_id;
                      }
                    }
                  }
                }
              } else if (content.content_type === "custom") {
                // 커스텀 콘텐츠는 학생 ID로 직접 조회
                const { data: customContent } = await supabase
                  .from("student_custom_contents")
                  .select("id")
                  .eq("id", content.content_id)
                  .eq("student_id", studentId)
                  .maybeSingle();

                if (customContent) {
                  isValidContent = true;
                  actualContentId = customContent.id;
                }
              }

              if (isValidContent) {
                validContents.push({
                  content_type: content.content_type,
                  content_id: actualContentId,
                  start_range: content.start_range,
                  end_range: content.end_range,
                  display_order: content.display_order ?? 0,
                  master_content_id: masterContentId,
                });
              }
            }

            if (validContents.length > 0) {
              // 추천 콘텐츠 정보 추출 (wizardData에서)
              const recommendedContentIds = new Set(
                recommendedContents.map((c) => c.content_id)
              );
              
              const contentsToSave: Array<{
                content_type: string;
                content_id: string;
                start_range: number;
                end_range: number;
                display_order: number;
                master_content_id: string | null;
                is_auto_recommended: boolean;
                recommendation_source: "auto" | "admin" | "template" | null;
                recommendation_reason: string | null;
                recommendation_metadata: RecommendationMetadata | null;
              }> = validContents.map((c, idx) => {
                const isRecommended = recommendedContentIds.has(c.content_id) || 
                  (c.master_content_id && recommendedContentIds.has(c.master_content_id));
                
                // wizardData에서 추천 정보 가져오기
                const recommendedContent = recommendedContents.find(
                  (rc) => rc.content_id === c.content_id || rc.content_id === c.master_content_id
                );
                
                // 관리자가 추가하는 경우는 항상 is_auto_recommended: false, recommendation_source: "admin"으로 강제 설정
                return {
                  content_type: c.content_type,
                  content_id: c.content_id,
                  start_range: c.start_range,
                  end_range: c.end_range,
                  display_order: c.display_order ?? idx,
                  master_content_id: c.master_content_id || null,
                  is_auto_recommended: false, // 관리자 추가는 항상 false
                  recommendation_source: (isRecommended ? "admin" : null) as "auto" | "admin" | "template" | null, // 관리자 추가는 항상 "admin"으로 강제 설정
                  recommendation_reason: recommendedContent?.recommendation_reason ?? null,
                  recommendation_metadata: (recommendedContent?.recommendation_metadata as RecommendationMetadata | null) ?? null,
                };
              });

              const contentsResult = await createPlanContents(
                groupId,
                tenantContext.tenantId,
                contentsToSave
              );

              if (!contentsResult.success) {
                throw new AppError(
                  contentsResult.error || "콘텐츠 저장에 실패했습니다.",
                  ErrorCode.DATABASE_ERROR,
                  500,
                  true
                );
              }

              console.log("[campTemplateActions] Step 6에서 콘텐츠 저장 완료:", {
                savedCount: validContents.length,
                totalContents: creationDataForContents.contents.length,
              });
            } else {
              // 콘텐츠 저장 실패: 모든 콘텐츠가 필터링됨
              console.error(
                `[campTemplateActions] 학생(${result.group.student_id})이 가지고 있는 유효한 콘텐츠가 없습니다.`,
                {
                  creationDataContentsCount: creationDataForContents.contents.length,
                  validContentsCount: validContents.length,
                  wizardDataStudentContents: studentContents.length,
                  wizardDataRecommendedContents: recommendedContents.length,
                  reason: "콘텐츠 저장 과정에서 모든 콘텐츠가 필터링되었습니다. 학생이 해당 콘텐츠를 가지고 있지 않거나, 콘텐츠 ID가 유효하지 않을 수 있습니다.",
                }
              );
              // 이 경우에도 플랜 생성은 가능하도록 허용 (플랜 생성 시 콘텐츠가 자동으로 처리될 수 있음)
              // 단, 경고 로그만 남기고 검증 에러는 발생시키지 않음
            }
          } else {
            console.warn(
              "[campTemplateActions] Step 6에서 creationDataForContents.contents가 비어있습니다.",
              {
                wizardDataStudentContents: studentContents.length,
                wizardDataRecommendedContents: recommendedContents.length,
              }
            );
          }
        } else {
          console.log("[campTemplateActions] Step 6 콘텐츠 저장 스킵:", {
            totalContents,
            hasPlanContents,
            reason:
              totalContents === 0
                ? "wizardData에 콘텐츠가 없음"
                : "plan_contents에 이미 콘텐츠가 있음",
          });
        }

        // 최종 콘텐츠 검증
        // 위에서 로드한 콘텐츠 사용 (wizardData 또는 DB에서 로드)
        const finalStudentContents = studentContents;
        const finalRecommendedContents = recommendedContents;
        const finalTotalContents = finalStudentContents.length + finalRecommendedContents.length;

        console.log("[campTemplateActions] Step 6 최종 콘텐츠 검증:", {
          wizardDataStudentContents: finalStudentContents.length,
          wizardDataRecommendedContents: finalRecommendedContents.length,
          wizardDataTotalContents: finalTotalContents,
          hasPlanContents,
          existingPlanContentsCount: existingPlanContents?.length || 0,
        });

        // 최종적으로 plan_contents 테이블에 콘텐츠가 있는지 확인
        // (wizardData에 콘텐츠가 없어도 DB에 있으면 플랜 생성 가능)
        const { data: finalPlanContents } = await supabase
          .from("plan_contents")
          .select("id")
          .eq("plan_group_id", groupId)
          .limit(1);

        console.log("[campTemplateActions] Step 6 최종 plan_contents 테이블 확인:", {
          finalPlanContentsCount: finalPlanContents?.length || 0,
          hasFinalPlanContents: finalPlanContents && finalPlanContents.length > 0,
          wizardDataTotalContents: finalTotalContents,
          wizardDataStudentContents: finalStudentContents.length,
          wizardDataRecommendedContents: finalRecommendedContents.length,
        });

        // 검증: DB에 콘텐츠가 없고 wizardData에도 콘텐츠가 없는 경우에만 에러
        const hasFinalPlanContents = finalPlanContents && finalPlanContents.length > 0;
        const hasWizardContents = finalTotalContents > 0;

        if (!hasFinalPlanContents && !hasWizardContents) {
          // DB에 콘텐츠가 없고 wizardData에도 콘텐츠가 없는 경우
          validationErrors.push(
            "플랜에 포함될 콘텐츠가 없습니다. Step 3 또는 Step 4에서 콘텐츠를 선택해주세요."
          );
        } else if (!hasFinalPlanContents && hasWizardContents) {
          // wizardData에 콘텐츠가 있지만 DB에 저장되지 않은 경우
          // (콘텐츠 저장 과정에서 모든 콘텐츠가 필터링되었을 수 있음)
          console.warn(
            "[campTemplateActions] Step 6 검증: wizardData에 콘텐츠가 있지만 DB에 저장되지 않음. 콘텐츠 저장 과정을 확인하세요.",
            {
              wizardDataStudentContents: finalStudentContents.length,
              wizardDataRecommendedContents: finalRecommendedContents.length,
              wizardDataTotalContents: finalTotalContents,
            }
          );
          // 이 경우에도 플랜 생성은 가능하도록 허용 (플랜 생성 시 콘텐츠가 자동으로 처리될 수 있음)
          // 단, 경고 로그만 남기고 검증 에러는 발생시키지 않음
        } else {
          console.log("[campTemplateActions] Step 6 최종 검증: 콘텐츠가 있어 플랜 생성 가능:", {
            hasFinalPlanContents,
            hasWizardContents,
            finalPlanContentsCount: finalPlanContents?.length || 0,
            wizardDataTotalContents: finalTotalContents,
          });
        }

        // 3. 템플릿 블록 세트 검증 (캠프 모드)
        if (result.group.camp_template_id) {
          // 새로운 연결 테이블 방식으로 블록 세트 조회
          const { data: templateBlockSetLink } = await supabase
            .from("camp_template_block_sets")
            .select("tenant_block_set_id")
            .eq("camp_template_id", result.group.camp_template_id)
            .maybeSingle();

          let tenantBlockSetId: string | null = null;
          if (templateBlockSetLink) {
            tenantBlockSetId = templateBlockSetLink.tenant_block_set_id;
          } else {
            // 하위 호환성: template_data.block_set_id 확인 (마이그레이션 전 데이터용)
            const { data: templateData } = await supabase
              .from("camp_templates")
              .select("template_data")
              .eq("id", result.group.camp_template_id)
              .maybeSingle();

            if (templateData?.template_data?.block_set_id) {
              tenantBlockSetId = templateData.template_data.block_set_id;
            }
          }

          if (tenantBlockSetId) {
            // tenant_blocks 테이블에서 블록 조회
            const { data: templateBlocks } = await supabase
              .from("tenant_blocks")
              .select("id")
              .eq("tenant_block_set_id", tenantBlockSetId)
              .limit(1);

            if (!templateBlocks || templateBlocks.length === 0) {
              validationErrors.push(
                "템플릿 블록 세트에 블록이 없습니다. 관리자에게 문의해주세요."
              );
            }
          } else {
            validationErrors.push(
              "템플릿 블록 세트가 설정되지 않았습니다. 관리자에게 문의해주세요."
            );
          }
        }

        // 검증 실패 시 에러 발생
        if (validationErrors.length > 0) {
          throw new AppError(
            `플랜 생성 전 검증 실패:\n${validationErrors.join("\n")}`,
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }

        // 플랜이 이미 생성되어 있는지 확인
        const { data: existingPlans } = await supabase
          .from("student_plan")
          .select("id")
          .eq("plan_group_id", groupId)
          .limit(1);

        const plansAlreadyExist = existingPlans && existingPlans.length > 0;

        // 플랜이 이미 생성되어 있으면 플랜 생성 스킵
        if (!plansAlreadyExist) {
        // generatePlansFromGroupAction은 verifyPlanGroupAccess를 사용하여
        // Admin/Consultant 권한도 지원합니다 (planGroupAuth.ts 참조)
        const { generatePlansFromGroupAction } = await import(
          "@/app/(student)/actions/planGroupActions"
        );

        try {
          await generatePlansFromGroupAction(groupId);

          // 플랜 생성 후 상태를 "saved"로 변경
          const { error: statusUpdateError } = await supabase
            .from("plan_groups")
            .update({ status: "saved", updated_at: new Date().toISOString() })
            .eq("id", groupId);

          if (statusUpdateError) {
            console.error(
              "[campTemplateActions] 플랜 그룹 상태 업데이트 실패:",
              statusUpdateError
            );
            // 상태 업데이트 실패는 경고만 (플랜은 생성됨)
            console.warn(
              "[campTemplateActions] 플랜 그룹 상태를 saved로 변경하지 못했습니다."
            );
          }
        } catch (planError) {
          console.error("[campTemplateActions] 플랜 생성 실패:", planError);
          throw new AppError(
            planError instanceof Error
              ? planError.message
              : "플랜 생성에 실패했습니다.",
            ErrorCode.DATABASE_ERROR,
            500,
            true
          );
          }
        } else {
          console.log("[campTemplateActions] 플랜이 이미 생성되어 있어 플랜 생성 스킵:", {
            groupId,
            existingPlansCount: existingPlans?.length || 0,
          });
        }
      }
    } catch (error) {
      console.error("[campTemplateActions] 캠프 남은 단계 진행 실패:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "플랜 그룹 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    return {
      success: true,
    };
  }
);

/**
 * 관리자용 캠프 플랜 그룹 subject_allocations 업데이트
 */
export const updateCampPlanGroupSubjectAllocations = withErrorHandling(
  async (
    groupId: string,
    subjectAllocations: Array<{
      subject_id: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }> | null
  ) => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 존재 및 권한 확인
    const { data: group, error: groupError } = await supabase
      .from("plan_groups")
      .select("id, plan_type, tenant_id")
      .eq("id", groupId)
      .eq("tenant_id", tenantContext.tenantId)
      .maybeSingle();

    if (groupError || !group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (group.plan_type !== "camp") {
      throw new AppError(
        "캠프 플랜 그룹이 아닙니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // scheduler_options 업데이트 (subject_allocations 포함)
    const { data: currentGroup } = await supabase
      .from("plan_groups")
      .select("scheduler_options")
      .eq("id", groupId)
      .maybeSingle();

    const currentSchedulerOptions =
      (currentGroup?.scheduler_options as PlanGroupSchedulerOptions | null) || {};
    const updatedSchedulerOptions = {
      ...currentSchedulerOptions,
      subject_allocations: subjectAllocations,
    };

    const { error: updateError } = await supabase
      .from("plan_groups")
      .update({
        scheduler_options: updatedSchedulerOptions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (updateError) {
      throw new AppError(
        "전략과목/취약과목 설정 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: updateError.message }
      );
    }

    return { success: true };
  }
);

/**
 * 관리자용 캠프 플랜 그룹 상태 변경 (단일)
 */
export const updateCampPlanGroupStatus = withErrorHandling(
  async (
    groupId: string,
    status: string
  ): Promise<{ success: boolean; error?: string }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 그룹 존재 및 권한 확인
    const { data: group, error: groupError } = await supabase
      .from("plan_groups")
      .select("id, student_id, plan_type, tenant_id, status, camp_template_id")
      .eq("id", groupId)
      .eq("tenant_id", tenantContext.tenantId)
      .maybeSingle();

    if (groupError || !group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (group.plan_type !== "camp") {
      throw new AppError(
        "캠프 플랜 그룹이 아닙니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 상태 전이 검증
    const { PlanValidator } = await import("@/lib/validation/planValidator");
    const statusValidation = PlanValidator.validateStatusTransition(
      group.status as PlanStatus,
      status as PlanStatus
    );
    if (!statusValidation.valid) {
      throw new AppError(
        statusValidation.errors.join(", ") || "상태 전이가 불가능합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // active로 변경 시 플랜 생성 여부 확인
    if (status === "active") {
      const { count, error: plansError } = await supabase
        .from("student_plan")
        .select("*", { count: "exact", head: true })
        .eq("plan_group_id", groupId);

      if (plansError) {
        console.error("[campTemplateActions] 플랜 개수 확인 실패", plansError);
        throw new AppError(
          "플랜 개수 확인에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      if ((count ?? 0) === 0) {
        throw new AppError(
          "플랜이 생성되지 않은 플랜 그룹은 활성화할 수 없습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }

      // 활성화 시 같은 모드(캠프 모드)의 다른 활성 플랜 그룹만 비활성화
      // 일반 모드와 캠프 모드는 각각 1개씩 활성화 가능
      // 이 함수는 캠프 플랜 그룹 활성화이므로, 캠프 모드 활성 플랜 그룹만 비활성화
      const { data: allActiveGroups, error: activeGroupsError } = await supabase
        .from("plan_groups")
        .select("id, plan_type, camp_template_id, camp_invitation_id")
        .eq("student_id", group.student_id)
        .eq("status", "active")
        .neq("id", groupId)
        .is("deleted_at", null);

      if (activeGroupsError) {
        console.error(
          "[campTemplateActions] 활성 플랜 그룹 조회 실패",
          activeGroupsError
        );
      } else if (allActiveGroups && allActiveGroups.length > 0) {
        // 캠프 모드 활성 플랜 그룹만 필터링
        const campModeGroups = allActiveGroups.filter(
          (g) =>
            g.plan_type === "camp" ||
            g.camp_template_id !== null ||
            g.camp_invitation_id !== null
        );

        if (campModeGroups.length > 0) {
          // 같은 모드(캠프 모드)의 다른 활성 플랜 그룹들을 "saved" 상태로 변경
          const activeGroupIds = campModeGroups.map((g) => g.id);
          const { error: deactivateError } = await supabase
            .from("plan_groups")
            .update({ status: "saved", updated_at: new Date().toISOString() })
            .in("id", activeGroupIds);

          if (deactivateError) {
            console.error(
              "[campTemplateActions] 같은 모드(캠프 모드)의 다른 활성 플랜 그룹 비활성화 실패",
              deactivateError
            );
            // 비활성화 실패해도 계속 진행 (경고만)
          }
        }
      }
    }

    // 상태 업데이트
    const { error: updateError } = await supabase
      .from("plan_groups")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupId);

    if (updateError) {
      throw new AppError(
        "플랜 그룹 상태 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: updateError.message }
      );
    }

    return { success: true };
  }
);

/**
 * 관리자용 캠프 플랜 그룹 상태 일괄 변경
 */
export const batchUpdateCampPlanGroupStatus = withErrorHandling(
  async (
    groupIds: string[],
    status: string
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ groupId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      throw new AppError(
        "플랜 그룹을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 중복 제거
    const uniqueGroupIds = Array.from(new Set(groupIds));

    const supabase = await createSupabaseServerClient();

    // 모든 플랜 그룹 조회 및 권한 확인
    const { data: groups, error: groupsError } = await supabase
      .from("plan_groups")
      .select("id, student_id, plan_type, tenant_id, status, camp_template_id")
      .in("id", uniqueGroupIds)
      .eq("tenant_id", tenantContext.tenantId);

    if (groupsError) {
      throw new AppError(
        "플랜 그룹 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: groupsError.message }
      );
    }

    if (!groups || groups.length === 0) {
      throw new AppError(
        "선택한 플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 캠프 플랜 그룹인지 확인
    const invalidGroups = groups.filter((g) => g.plan_type !== "camp");
    if (invalidGroups.length > 0) {
      throw new AppError(
        "캠프 플랜 그룹이 아닌 항목이 포함되어 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // active로 변경 시 플랜 생성 여부 일괄 확인
    if (status === "active") {
      const { data: plansData, error: plansError } = await supabase
        .from("student_plan")
        .select("plan_group_id")
        .in("plan_group_id", uniqueGroupIds);

      if (plansError) {
        console.error(
          "[campTemplateActions] 플랜 개수 일괄 확인 실패",
          plansError
        );
        throw new AppError(
          "플랜 개수 확인에 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true
        );
      }

      // 플랜 그룹별 플랜 존재 여부 매핑
      const plansMap = new Set((plansData || []).map((p) => p.plan_group_id));
      const groupsWithoutPlans = groups.filter((g) => !plansMap.has(g.id));

      if (groupsWithoutPlans.length > 0) {
        throw new AppError(
          `플랜이 생성되지 않은 플랜 그룹이 ${groupsWithoutPlans.length}개 있습니다.`,
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }

      // 활성화 시 각 학생별로 다른 활성 플랜 그룹 비활성화
      const studentIds = Array.from(new Set(groups.map((g) => g.student_id)));
      for (const studentId of studentIds) {
        const studentGroups = groups.filter((g) => g.student_id === studentId);
        const studentGroupIds = new Set(studentGroups.map((g) => g.id));

        // 해당 학생의 모든 활성 플랜 그룹 조회
        const { data: allActiveGroups } = await supabase
          .from("plan_groups")
          .select("id")
          .eq("student_id", studentId)
          .eq("status", "active")
          .is("deleted_at", null);

        if (allActiveGroups && allActiveGroups.length > 0) {
          // 현재 선택한 그룹을 제외한 다른 활성 플랜 그룹들만 필터링
          const otherActiveGroupIds = allActiveGroups
            .map((g) => g.id)
            .filter((id) => !studentGroupIds.has(id));

          if (otherActiveGroupIds.length > 0) {
            // 다른 활성 플랜 그룹들을 "saved" 상태로 변경
            await supabase
              .from("plan_groups")
              .update({ status: "saved", updated_at: new Date().toISOString() })
              .in("id", otherActiveGroupIds);
            // 에러는 무시 (경고만)
          }
        }
      }
    }

    // 각 그룹에 대한 상태 전이 검증 및 일괄 업데이트
    const { PlanValidator } = await import("@/lib/validation/planValidator");
    const errors: Array<{ groupId: string; error: string }> = [];
    const successGroupIds: string[] = [];

    for (const group of groups) {
      const statusValidation = PlanValidator.validateStatusTransition(
        group.status as PlanStatus,
        status as PlanStatus
      );

      if (!statusValidation.valid) {
        errors.push({
          groupId: group.id,
          error:
            statusValidation.errors.join(", ") || "상태 전이가 불가능합니다.",
        });
        continue;
      }

      successGroupIds.push(group.id);
    }

    // 성공한 그룹들만 일괄 업데이트
    let successCount = 0;
    if (successGroupIds.length > 0) {
      const { error: updateError } = await supabase
        .from("plan_groups")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .in("id", successGroupIds);

      if (updateError) {
        // 일괄 업데이트 실패 시 개별 업데이트 시도
        console.error(
          "[campTemplateActions] 일괄 상태 업데이트 실패, 개별 업데이트 시도",
          updateError
        );

        for (const groupId of successGroupIds) {
          const { error: individualError } = await supabase
            .from("plan_groups")
            .update({
              status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", groupId);

          if (individualError) {
            errors.push({
              groupId,
              error: individualError.message || "상태 업데이트에 실패했습니다.",
            });
          } else {
            successCount++;
          }
        }
      } else {
        successCount = successGroupIds.length;
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * 다수 학생에게 추천 콘텐츠 일괄 적용
 */
export const bulkApplyRecommendedContents = withErrorHandling(
  async (
    templateId: string,
    groupIds: string[],
    subjectCountsMap: Record<string, Record<string, number>>, // groupId -> (subject -> count)
    options?: {
      replaceExisting?: boolean; // 기존 추천 콘텐츠 교체 여부 (기본값: false, 유지)
    }
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ groupId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 존재 및 권한 확인
    const template = await getCampTemplate(templateId);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (template.tenant_id !== tenantContext.tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();
    const errors: Array<{ groupId: string; error: string }> = [];
    let successCount = 0;

    // 각 플랜 그룹에 대해 추천 콘텐츠 적용
    for (const groupId of groupIds) {
      try {
        // 플랜 그룹 정보 조회
        const { data: group, error: groupError } = await supabase
          .from("plan_groups")
          .select("id, student_id, tenant_id")
          .eq("id", groupId)
          .eq("tenant_id", tenantContext.tenantId)
          .maybeSingle();

        if (groupError || !group) {
          errors.push({
            groupId,
            error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
          });
          continue;
        }

        // 학생 ID 조회
        const studentId = group.student_id;
        if (!studentId) {
          errors.push({
            groupId,
            error: "학생 ID를 찾을 수 없습니다.",
          });
          continue;
        }

        // 해당 그룹의 교과/수량 설정 조회
        const subjectCounts = subjectCountsMap[groupId];
        if (!subjectCounts || Object.keys(subjectCounts).length === 0) {
          // 수량 설정이 없으면 스킵
          continue;
        }

        // Map으로 변환
        const requestedSubjectCounts = new Map<string, number>();
        for (const [subject, count] of Object.entries(subjectCounts)) {
          if (count > 0) {
            requestedSubjectCounts.set(subject, count);
          }
        }

        if (requestedSubjectCounts.size === 0) {
          continue;
        }

        // 추천 콘텐츠 조회
        const recommendations = await getRecommendedMasterContents(
          supabase,
          studentId,
          tenantContext.tenantId,
          requestedSubjectCounts
        );

        if (recommendations.length === 0) {
          console.warn(
            `[bulkApplyRecommendedContents] 추천 콘텐츠가 없습니다. groupId: ${groupId}, studentId: ${studentId}`
          );
          continue;
        }

        // 기존 추천 콘텐츠 처리
        if (options?.replaceExisting) {
          // 기존 추천 콘텐츠 삭제 (is_auto_recommended가 true이거나 recommendation_source가 있는 것만)
          const existingContents = await getPlanContents(
            groupId,
            tenantContext.tenantId
          );

          if (existingContents && existingContents.length > 0) {
            const recommendedContentIds = existingContents
              .filter(
                (c) =>
                  c.is_auto_recommended || c.recommendation_source !== null
              )
              .map((c) => c.id);

            if (recommendedContentIds.length > 0) {
              const { error: deleteError } = await supabase
                .from("plan_contents")
                .delete()
                .in("id", recommendedContentIds);

              if (deleteError) {
                console.error(
                  `[bulkApplyRecommendedContents] 기존 추천 콘텐츠 삭제 실패:`,
                  deleteError
                );
              }
            }
          }
        }

        // 학생이 실제로 가지고 있는 콘텐츠만 필터링
        const validContents: Array<{
          content_type: "book" | "lecture";
          content_id: string;
          start_range: number;
          end_range: number;
          display_order: number;
          master_content_id: string | null;
          is_auto_recommended: boolean;
          recommendation_source: "admin" | null;
        }> = [];

        for (const rec of recommendations) {
          let actualContentId: string | null = null;
          let isValidContent = false;

          // 학생 콘텐츠 조회
          if (rec.contentType === "book") {
            const { data: book } = await supabase
              .from("books")
              .select("id, master_content_id")
              .eq("student_id", studentId)
              .eq("master_content_id", rec.id)
              .maybeSingle();

            if (book) {
              actualContentId = book.id;
              isValidContent = true;
            }
          } else if (rec.contentType === "lecture") {
            const { data: lecture } = await supabase
              .from("lectures")
              .select("id, master_content_id")
              .eq("student_id", studentId)
              .eq("master_content_id", rec.id)
              .maybeSingle();

            if (lecture) {
              actualContentId = lecture.id;
              isValidContent = true;
            }
          }

          if (isValidContent && actualContentId) {
            // 콘텐츠 상세 정보 조회하여 범위 설정
            let startRange = 1;
            let endRange = 100;

            try {
              if (rec.contentType === "book") {
                const { data: bookDetails } = await supabase
                  .from("book_details")
                  .select("page_number")
                  .eq("book_id", actualContentId)
                  .order("page_number", { ascending: true })
                  .limit(1);

                if (bookDetails && bookDetails.length > 0) {
                  startRange = bookDetails[0].page_number || 1;
                }

                const { data: totalData } = await supabase
                  .from("books")
                  .select("total_pages")
                  .eq("id", actualContentId)
                  .maybeSingle();

                if (totalData?.total_pages) {
                  endRange = totalData.total_pages;
                }
              } else if (rec.contentType === "lecture") {
                const { data: lectureDetails } = await supabase
                  .from("lecture_episodes")
                  .select("episode_number")
                  .eq("lecture_id", actualContentId)
                  .order("episode_number", { ascending: true })
                  .limit(1);

                if (lectureDetails && lectureDetails.length > 0) {
                  startRange = lectureDetails[0].episode_number || 1;
                }

                const { data: totalData } = await supabase
                  .from("lectures")
                  .select("total_episodes")
                  .eq("id", actualContentId)
                  .maybeSingle();

                if (totalData?.total_episodes) {
                  endRange = totalData.total_episodes;
                }
              }
            } catch (infoError) {
              // 상세 정보 조회 실패는 무시 (기본값 사용)
            }

            validContents.push({
              content_type: rec.contentType,
              content_id: actualContentId,
              start_range: startRange,
              end_range: endRange,
              display_order: validContents.length,
              master_content_id: rec.id,
              is_auto_recommended: false, // 관리자 추가는 항상 false
              recommendation_source: "admin", // 관리자 추가는 항상 "admin"
            });
          }
        }

        // 학생당 최대 9개 제한 검증
        const existingPlanContents = await getPlanContents(
          groupId,
          tenantContext.tenantId
        );
        const currentCount = existingPlanContents?.length || 0;
        const newCount = validContents.length;
        const totalCount = options?.replaceExisting
          ? currentCount -
              (existingPlanContents?.filter(
                (c) => c.is_auto_recommended || c.recommendation_source !== null
              ).length || 0) +
              newCount
          : currentCount + newCount;

        if (totalCount > 9) {
          errors.push({
            groupId,
            error: `최대 콘텐츠 수(9개)를 초과합니다. 현재: ${currentCount}개, 추가 예정: ${newCount}개, 총합: ${totalCount}개`,
          });
          continue;
        }

        // 추천 콘텐츠 저장
        if (validContents.length > 0) {
          const contentsResult = await createPlanContents(
            groupId,
            tenantContext.tenantId,
            validContents.map((c) => ({
              content_type: c.content_type,
              content_id: c.content_id,
              start_range: c.start_range,
              end_range: c.end_range,
              display_order: c.display_order,
              master_content_id: c.master_content_id,
              is_auto_recommended: c.is_auto_recommended,
              recommendation_source: c.recommendation_source,
            }))
          );

          if (!contentsResult.success) {
            errors.push({
              groupId,
              error: contentsResult.error || "콘텐츠 저장에 실패했습니다.",
            });
            continue;
          }

          successCount++;
        }
      } catch (error) {
        console.error(
          `[bulkApplyRecommendedContents] 그룹 ${groupId} 처리 실패:`,
          error
        );
        errors.push({
          groupId,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * 다수 학생에게 플랜 그룹 일괄 생성
 */
export const bulkCreatePlanGroupsForCamp = withErrorHandling(
  async (
    templateId: string,
    invitationIds: string[]
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ invitationId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 템플릿 존재 및 권한 확인
    const template = await getCampTemplate(templateId);
    if (!template) {
      throw new AppError(
        "템플릿을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // tenantId를 변수에 저장하여 타입 좁히기
    const tenantId = tenantContext.tenantId;

    if (template.tenant_id !== tenantId) {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

    const supabase = await createSupabaseServerClient();
    const errors: Array<{ invitationId: string; error: string }> = [];
    let successCount = 0;

    // 템플릿 데이터 준비
    const templateData = template.template_data as Partial<WizardData>;

    // 연결 테이블에서 템플릿에 연결된 블록 세트 조회
    let templateBlockSetId: string | null = null;
    const { data: templateBlockSetLink } = await supabase
      .from("camp_template_block_sets")
      .select("tenant_block_set_id")
      .eq("camp_template_id", template.id)
      .maybeSingle();

    if (templateBlockSetLink) {
      templateBlockSetId = templateBlockSetLink.tenant_block_set_id;
    } else if (templateData.block_set_id) {
      templateBlockSetId = templateData.block_set_id;
    }

    // 템플릿 제외일과 학원 일정에 source, is_locked 필드 추가
    const templateExclusions = (templateData.exclusions || []).map((exclusion: Exclusion) => ({
      ...exclusion,
      source: "template" as const,
      is_locked: true,
    }));

    const templateAcademySchedules = (templateData.academy_schedules || []).map((schedule: AcademySchedule) => ({
      ...schedule,
      source: "template" as const,
      is_locked: true,
    }));

    // 병렬 처리 함수 (최대 동시 처리 수 제한)
    const MAX_CONCURRENT = 5;
    const processInvitation = async (invitationId: string): Promise<{
      success: boolean;
      invitationId: string;
      studentId?: string;
      groupId?: string;
      error?: string;
    }> => {
      try {
        // 초대 정보 조회
        const { data: invitation, error: invitationError } = await supabase
          .from("camp_invitations")
          .select("id, student_id, camp_template_id, status")
          .eq("id", invitationId)
          .maybeSingle();

        if (invitationError || !invitation) {
          return {
            success: false,
            invitationId,
            error: invitationError?.message || "초대를 찾을 수 없습니다.",
          };
        }

        // 이미 플랜 그룹이 있는지 확인
        const { data: existingGroup } = await supabase
          .from("plan_groups")
          .select("id")
          .eq("camp_invitation_id", invitationId)
          .is("deleted_at", null)
          .maybeSingle();

        if (existingGroup) {
          // 이미 플랜 그룹이 있으면 스킵
          return {
            success: true,
            invitationId,
            studentId: invitation.student_id,
            groupId: existingGroup.id,
          };
        }

        // 템플릿 기본값으로 병합된 데이터 생성
        const mergedData: Partial<WizardData> = {
          ...templateData,
          name: templateData.name || "",
          plan_purpose: templateData.plan_purpose || "",
          scheduler_type: templateData.scheduler_type || "1730_timetable",
          period_start: templateData.period_start || "",
          period_end: templateData.period_end || "",
          block_set_id: templateBlockSetId || "",
          academy_schedules: templateAcademySchedules,
          student_contents: [],
          recommended_contents: [],
          exclusions: templateExclusions,
          subject_allocations: undefined,
          student_level: templateData.student_level || undefined,
          time_settings: templateData.time_settings,
          scheduler_options: templateData.scheduler_options,
          study_review_cycle: templateData.study_review_cycle,
        };

        // 플랜 그룹 생성 데이터 변환
        const { syncWizardDataToCreationData } = await import(
          "@/lib/utils/planGroupDataSync"
        );
        const creationData = syncWizardDataToCreationData(mergedData as WizardData);

        // 플랜 그룹 생성
        const { createPlanGroup } = await import("@/lib/data/planGroups");
        const groupResult = await createPlanGroup({
          tenant_id: tenantId,
          student_id: invitation.student_id,
          name: creationData.name || null,
          plan_purpose: creationData.plan_purpose || null,
          scheduler_type: creationData.scheduler_type,
          scheduler_options: creationData.scheduler_options || null,
          period_start: creationData.period_start,
          period_end: creationData.period_end,
          target_date: creationData.target_date || null,
          block_set_id: creationData.block_set_id || null,
          status: "draft",
          subject_constraints: creationData.subject_constraints || null,
          additional_period_reallocation: creationData.additional_period_reallocation || null,
          non_study_time_blocks: creationData.non_study_time_blocks || null,
          daily_schedule: creationData.daily_schedule || null,
          plan_type: "camp",
          camp_template_id: templateId,
          camp_invitation_id: invitationId,
        });

        if (!groupResult.success || !groupResult.groupId) {
          return {
            success: false,
            invitationId,
            studentId: invitation.student_id,
            error: groupResult.error || "플랜 그룹 생성에 실패했습니다.",
          };
        }

        const groupId = groupResult.groupId;

        // 제외일 생성
        if (creationData.exclusions && creationData.exclusions.length > 0) {
          const { createPlanExclusions } = await import("@/lib/data/planGroups");
          await createPlanExclusions(
            groupId,
            tenantId,
            creationData.exclusions.map((e) => ({
              exclusion_date: e.exclusion_date,
              exclusion_type: e.exclusion_type,
              reason: e.reason || null,
            }))
          );
        }

        // 학원 일정 생성
        if (creationData.academy_schedules && creationData.academy_schedules.length > 0) {
          const { createStudentAcademySchedules } = await import("@/lib/data/planGroups");
          await createStudentAcademySchedules(
            invitation.student_id,
            tenantId,
            creationData.academy_schedules.map((s) => ({
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
              academy_name: s.academy_name || null,
              subject: s.subject || null,
            })),
            true // 관리자 모드: Admin 클라이언트 사용
          );
        }

        return {
          success: true,
          invitationId,
          studentId: invitation.student_id,
          groupId,
        };
      } catch (error) {
        console.error(
          `[bulkCreatePlanGroupsForCamp] 초대 ${invitationId} 처리 실패:`,
          error
        );
        return {
          success: false,
          invitationId,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        };
      }
    };

    // 병렬 처리 실행 (배치 단위로 처리)
    const batches: string[][] = [];
    for (let i = 0; i < invitationIds.length; i += MAX_CONCURRENT) {
      batches.push(invitationIds.slice(i, i + MAX_CONCURRENT));
    }

    const results: Array<{
      success: boolean;
      invitationId: string;
      studentId?: string;
      groupId?: string;
      error?: string;
    }> = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((invitationId) => processInvitation(invitationId))
      );
      results.push(...batchResults);
    }

    // 결과 집계
    for (const result of results) {
      if (result.success) {
        successCount++;
        // 플랜 생성 완료 알림 발송 (비동기)
        if (result.studentId && result.groupId) {
          const { sendInAppNotification } = await import(
            "@/lib/services/inAppNotificationService"
          );
          sendInAppNotification(
            result.studentId,
            "plan_created",
            "캠프 플랜이 생성되었습니다",
            `${template.name} 캠프의 학습 플랜이 생성되었습니다. 확인해주세요.`,
            {
              invitationId: result.invitationId,
              templateId,
              groupId: result.groupId,
            }
          ).catch((err) => {
            console.error(
              `[bulkCreatePlanGroupsForCamp] 초대 ${result.invitationId} 알림 발송 실패:`,
              err
            );
          });
        }
      } else {
        errors.push({
          invitationId: result.invitationId,
          error: result.error || "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * 플랜 그룹 콘텐츠 범위 일괄 조절
 */
export const bulkAdjustPlanRanges = withErrorHandling(
  async (
    groupIds: string[],
    rangeAdjustments: Record<string, Array<{
      contentId: string;
      contentType: "book" | "lecture";
      startRange?: number;
      endRange?: number;
    }>>
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ groupId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const errors: Array<{ groupId: string; error: string }> = [];
    let successCount = 0;

    for (const groupId of groupIds) {
      try {
        // 플랜 그룹 존재 및 권한 확인
        const { data: group, error: groupError } = await supabase
          .from("plan_groups")
          .select("id, tenant_id")
          .eq("id", groupId)
          .eq("tenant_id", tenantContext.tenantId)
          .maybeSingle();

        if (groupError || !group) {
          errors.push({
            groupId,
            error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
          });
          continue;
        }

        // 해당 그룹의 범위 조절 정보 조회
        const adjustments = rangeAdjustments[groupId];
        if (!adjustments || adjustments.length === 0) {
          // 조절할 내용이 없으면 스킵
          successCount++;
          continue;
        }

        // 각 콘텐츠의 범위 업데이트
        for (const adjustment of adjustments) {
          const updateData: {
            start_range?: number;
            end_range?: number;
            updated_at: string;
          } = {
            updated_at: new Date().toISOString(),
          };

          if (adjustment.startRange !== undefined) {
            updateData.start_range = adjustment.startRange;
          }
          if (adjustment.endRange !== undefined) {
            updateData.end_range = adjustment.endRange;
          }

          // 범위 유효성 검증
          if (
            updateData.start_range !== undefined &&
            updateData.end_range !== undefined &&
            updateData.start_range >= updateData.end_range
          ) {
            errors.push({
              groupId,
              error: `콘텐츠 ${adjustment.contentId}의 범위가 유효하지 않습니다 (시작 >= 종료).`,
            });
            continue;
          }

          const { error: updateError } = await supabase
            .from("plan_contents")
            .update(updateData)
            .eq("plan_group_id", groupId)
            .eq("content_id", adjustment.contentId)
            .eq("content_type", adjustment.contentType);

          if (updateError) {
            console.error(
              `[bulkAdjustPlanRanges] 콘텐츠 범위 업데이트 실패:`,
              {
                groupId,
                contentId: adjustment.contentId,
                error: updateError.message,
              }
            );
            errors.push({
              groupId,
              error: `콘텐츠 ${adjustment.contentId} 범위 업데이트 실패: ${updateError.message}`,
            });
          }
        }

        // 에러가 없으면 성공으로 카운트
        if (!errors.some((e) => e.groupId === groupId)) {
          successCount++;
        }
      } catch (error) {
        console.error(
          `[bulkAdjustPlanRanges] 그룹 ${groupId} 처리 실패:`,
          error
        );
        errors.push({
          groupId,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * 플랜 그룹 콘텐츠 및 스케줄 정보 조회 (클라이언트 컴포넌트용)
 */
export const getPlanGroupContentsForRangeAdjustment = withErrorHandling(
  async (
    groupId: string
  ): Promise<{
    success: boolean;
    contents?: Array<{
      contentId: string;
      contentType: "book" | "lecture";
      title: string;
      totalAmount: number;
      currentStartRange: number;
      currentEndRange: number;
    }>;
    scheduleSummary?: {
      total_study_days: number;
      total_study_hours: number;
    } | null;
    recommendedRanges?: Record<string, { start: number; end: number; reason: string }>;
    unavailableReasons?: Record<string, string>;
    error?: string;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const adminSupabase = await createSupabaseAdminClient();

    if (!adminSupabase) {
      return {
        success: false,
        error: "Admin 클라이언트를 생성할 수 없습니다.",
      };
    }

    try {
      // 플랜 그룹 정보 조회 (period_start, period_end, daily_schedule 포함)
      const { data: group, error: groupError } = await supabase
        .from("plan_groups")
        .select("id, period_start, period_end, daily_schedule")
        .eq("id", groupId)
        .eq("tenant_id", tenantContext.tenantId)
        .maybeSingle();

      if (groupError || !group) {
        return {
          success: false,
          error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
        };
      }

      // 콘텐츠 조회
      const contents = await getPlanContents(groupId, tenantContext.tenantId);

      // 콘텐츠 상세 정보 조회 (총량 정보 포함)
      // Admin 클라이언트를 사용하여 RLS 정책 우회
      const contentInfos: Array<{
        contentId: string;
        contentType: "book" | "lecture";
        title: string;
        totalAmount: number;
        currentStartRange: number;
        currentEndRange: number;
      }> = [];

      for (const content of contents) {
        // custom 콘텐츠는 범위 조절 대상이 아니므로 제외
        if (content.content_type === "custom") {
          continue;
        }

        try {
          let totalAmount = 0;
          let title = "알 수 없음";

          if (content.content_type === "book") {
            // Admin 클라이언트를 사용하여 학생 교재 조회 (RLS 우회)
            const { data: book } = await adminSupabase
              .from("books")
              .select("title, master_content_id")
              .eq("id", content.content_id)
              .maybeSingle();

            if (book) {
              title = book.title || "알 수 없음";

              // 마스터 콘텐츠 정보 조회
              if (book.master_content_id) {
                try {
                  const { book: masterBook } = await getMasterBookById(book.master_content_id);
                  if (masterBook) {
                    totalAmount = masterBook.total_pages || 0;
                  } else {
                    // 마스터 교재 조회 실패 시 Admin 클라이언트로 직접 조회 시도
                    const { data: bookInfo } = await adminSupabase
                      .from("master_books")
                      .select("total_pages")
                      .eq("id", book.master_content_id)
                      .maybeSingle();
                    totalAmount = bookInfo?.total_pages || 0;
                  }
                } catch (error) {
                  console.error(`마스터 교재 ${book.master_content_id} 조회 실패:`, error);
                  // 마스터 교재 조회 실패 시 Admin 클라이언트로 직접 조회 시도
                  const { data: bookInfo } = await adminSupabase
                    .from("master_books")
                    .select("total_pages")
                    .eq("id", book.master_content_id)
                    .maybeSingle();
                  totalAmount = bookInfo?.total_pages || 0;
                }
              } else {
                // 마스터 콘텐츠 ID가 없으면 직접 조회 시도
                const { data: bookInfo } = await adminSupabase
                  .from("master_books")
                  .select("total_pages")
                  .eq("id", content.content_id)
                  .maybeSingle();
                totalAmount = bookInfo?.total_pages || 0;
              }
            }
          } else if (content.content_type === "lecture") {
            // Admin 클라이언트를 사용하여 학생 강의 조회 (RLS 우회)
            const { data: lecture } = await adminSupabase
              .from("lectures")
              .select("title, master_content_id")
              .eq("id", content.content_id)
              .maybeSingle();

            if (lecture) {
              title = lecture.title || "알 수 없음";

              // 마스터 콘텐츠 정보 조회
              if (lecture.master_content_id) {
                try {
                  const { lecture: masterLecture } = await getMasterLectureById(lecture.master_content_id);
                  if (masterLecture) {
                    totalAmount = masterLecture.total_episodes || 0;
                  } else {
                    // 마스터 강의 조회 실패 시 Admin 클라이언트로 직접 조회 시도
                    const { data: lectureInfo } = await adminSupabase
                      .from("master_lectures")
                      .select("total_episodes")
                      .eq("id", lecture.master_content_id)
                      .maybeSingle();
                    totalAmount = lectureInfo?.total_episodes || 0;
                  }
                } catch (error) {
                  console.error(`마스터 강의 ${lecture.master_content_id} 조회 실패:`, error);
                  // 마스터 강의 조회 실패 시 Admin 클라이언트로 직접 조회 시도
                  const { data: lectureInfo } = await adminSupabase
                    .from("master_lectures")
                    .select("total_episodes")
                    .eq("id", lecture.master_content_id)
                    .maybeSingle();
                  totalAmount = lectureInfo?.total_episodes || 0;
                }
              } else {
                // 마스터 콘텐츠 ID가 없으면 직접 조회 시도
                const { data: lectureInfo } = await adminSupabase
                  .from("master_lectures")
                  .select("total_episodes")
                  .eq("id", content.content_id)
                  .maybeSingle();
                totalAmount = lectureInfo?.total_episodes || 0;
              }
            }
          }

          contentInfos.push({
            contentId: content.content_id,
            contentType: content.content_type,
            title,
            totalAmount,
            currentStartRange: content.start_range,
            currentEndRange: content.end_range,
          });
        } catch (error) {
          console.error(`콘텐츠 ${content.content_id} 정보 조회 실패:`, error);
        }
      }

      // 스케줄 요약 정보 계산
      let scheduleSummary: {
        total_study_days: number;
        total_study_hours: number;
      } | null = null;
      
      if (group.period_start && group.period_end) {
        let totalStudyDays = 0;
        let totalHours = 0;
        
        // daily_schedule이 있으면 그것을 기반으로 계산
        if (group.daily_schedule && Array.isArray(group.daily_schedule)) {
          const dailySchedule = group.daily_schedule as DailyScheduleInfo[];
          
          dailySchedule.forEach((day) => {
            // 학습일만 카운트
            if (day.day_type === "학습일" || day.day_type === "복습일") {
              totalStudyDays++;
            }
            
            // study_hours가 있으면 합산
            if (typeof day.study_hours === "number") {
              totalHours += day.study_hours;
            } else if (day.time_slots && Array.isArray(day.time_slots)) {
              // time_slots가 있으면 그것을 기반으로 계산
              day.time_slots.forEach((slot) => {
                if (slot.type === "학습시간" && slot.start && slot.end) {
                  try {
                    const startMinutes = timeToMinutes(slot.start);
                    const endMinutes = timeToMinutes(slot.end);
                    const hours = (endMinutes - startMinutes) / 60;
                    totalHours += hours;
                  } catch (error) {
                    // 시간 파싱 실패 시 무시
                  }
                }
              });
            }
          });
        }
        
        // daily_schedule이 없거나 비어있으면 기간 기반으로 기본값 계산
        if (totalStudyDays === 0 || totalHours === 0) {
          const startDate = new Date(group.period_start);
          const endDate = new Date(group.period_end);
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // 시작일과 종료일 포함
          
          totalStudyDays = diffDays;
          totalHours = diffDays * 3; // 기본값: 하루 3시간
        }
        
        scheduleSummary = {
          total_study_days: totalStudyDays,
          total_study_hours: totalHours,
        };
      }

      // 범위 추천 계산 (서버에서만 실행)
      let recommendedRanges: Map<string, { start: number; end: number; reason: string }> = new Map();
      let unavailableReasons: Map<string, string> = new Map();

      if (scheduleSummary && contentInfos.length > 0) {
        try {
          // 테넌트별 설정 조회
          const config = await getRangeRecommendationConfig(tenantContext.tenantId);
          
          const recommendationResult = await calculateRecommendedRanges(
            scheduleSummary,
            contentInfos.map((c) => ({
              content_id: c.contentId,
              content_type: c.contentType,
              total_amount: c.totalAmount,
            })),
            { config }
          );

          recommendedRanges = recommendationResult.ranges;
          unavailableReasons = recommendationResult.unavailableReasons;
        } catch (error) {
          logError(error, {
            context: "[getPlanGroupContentsForRangeAdjustment]",
            operation: "범위 추천 계산",
            groupId,
          });
          // 범위 추천 실패해도 기본 정보는 반환
        }
      }

      return {
        success: true,
        contents: contentInfos,
        scheduleSummary,
        recommendedRanges: Object.fromEntries(recommendedRanges),
        unavailableReasons: Object.fromEntries(unavailableReasons),
      };
    } catch (error) {
      logError(error, {
        context: "[getPlanGroupContentsForRangeAdjustment]",
        operation: "그룹 처리",
        groupId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      };
    }
  }
);

/**
 * 플랜 일괄 미리보기
 */
export const bulkPreviewPlans = withErrorHandling(
  async (
    groupIds: string[]
  ): Promise<{
    success: boolean;
      previews: Array<{
        groupId: string;
        studentName: string;
        planCount: number;
        previewData?: PreviewPlan[];
        error?: string;
      }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const { previewPlansFromGroupAction } = await import(
      "@/app/(student)/actions/planGroupActions"
    );

    const previews: Array<{
      groupId: string;
      studentName: string;
      planCount: number;
      previewData?: PreviewPlan[];
      error?: string;
    }> = [];

    for (const groupId of groupIds) {
      try {
        // 플랜 그룹 및 학생 정보 조회
        const { data: group, error: groupError } = await supabase
          .from("plan_groups")
          .select("id, student_id, tenant_id, students:student_id(name)")
          .eq("id", groupId)
          .eq("tenant_id", tenantContext.tenantId)
          .maybeSingle();

        if (groupError || !group) {
          previews.push({
            groupId,
            studentName: "알 수 없음",
            planCount: 0,
            error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
          });
          continue;
        }

        const studentName = (group.students as StudentInfo | null)?.name || "알 수 없음";

        // 플랜 미리보기 실행
        try {
          const result = await previewPlansFromGroupAction(groupId);
          previews.push({
            groupId,
            studentName,
            planCount: result.plans.length,
            previewData: result.plans,
          });
        } catch (previewError) {
          previews.push({
            groupId,
            studentName,
            planCount: 0,
            error:
              previewError instanceof Error
                ? previewError.message
                : "플랜 미리보기에 실패했습니다.",
          });
        }
      } catch (error) {
        logError(error, {
          context: "[bulkPreviewPlans]",
          operation: "플랜 미리보기",
          groupId,
        });
        previews.push({
          groupId,
          studentName: "알 수 없음",
          planCount: 0,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: true,
      previews,
    };
  }
);

/**
 * 플랜 일괄 생성
 */
export const bulkGeneratePlans = withErrorHandling(
  async (
    groupIds: string[]
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors?: Array<{ groupId: string; error: string }>;
  }> => {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();
    const { generatePlansFromGroupAction } = await import(
      "@/app/(student)/actions/planGroupActions"
    );

    const errors: Array<{ groupId: string; error: string }> = [];
    let successCount = 0;

    for (const groupId of groupIds) {
      try {
        // 플랜 그룹 존재 및 권한 확인
        const { data: group, error: groupError } = await supabase
          .from("plan_groups")
          .select("id, tenant_id")
          .eq("id", groupId)
          .eq("tenant_id", tenantContext.tenantId)
          .maybeSingle();

        if (groupError || !group) {
          errors.push({
            groupId,
            error: groupError?.message || "플랜 그룹을 찾을 수 없습니다.",
          });
          continue;
        }

        // 플랜 생성 실행
        try {
          await generatePlansFromGroupAction(groupId);
          successCount++;
        } catch (generateError) {
          console.error(
            `[bulkGeneratePlans] 그룹 ${groupId} 플랜 생성 실패:`,
            generateError
          );
          errors.push({
            groupId,
            error:
              generateError instanceof Error
                ? generateError.message
                : "플랜 생성에 실패했습니다.",
          });
        }
      } catch (error) {
        console.error(
          `[bulkGeneratePlans] 그룹 ${groupId} 처리 실패:`,
          error
        );
        errors.push({
          groupId,
          error:
            error instanceof Error
              ? error.message
              : "알 수 없는 오류가 발생했습니다.",
        });
      }
    }

    return {
      success: errors.length === 0,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);
