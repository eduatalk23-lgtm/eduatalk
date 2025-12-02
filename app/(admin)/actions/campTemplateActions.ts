"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getCampTemplate,
  createCampTemplate,
  getCampInvitationsForTemplate as getCampInvitationsForTemplateData,
} from "@/lib/data/campTemplates";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import {
  AppError,
  ErrorCode,
  withErrorHandling,
  getUserFacingMessage,
} from "@/lib/errors";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  linkBlockSetToTemplate,
  unlinkBlockSetFromTemplate,
} from "./campTemplateBlockSets";

/**
 * 캠프 템플릿 목록 조회
 */
export const getCampTemplates = withErrorHandling(async () => {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
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
    const { role } = await getCurrentUserRole();
    if (role !== "admin" && role !== "consultant") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

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

    // tenant_id로 필터링하여 조회 (RLS 정책 및 권한 검증 강화)
    const supabase = await createSupabaseServerClient();

    // 먼저 tenant_id 없이 조회하여 템플릿 존재 여부 확인 (디버깅용)
    const { data: templateWithoutTenant, error: checkError } = await supabase
      .from("camp_templates")
      .select("id, tenant_id, name")
      .eq("id", templateId)
      .maybeSingle();

    if (
      process.env.NODE_ENV === "development" &&
      checkError &&
      checkError.code !== "PGRST116"
    ) {
      console.warn("[getCampTemplateById] tenant_id 없이 조회 시도 실패", {
        templateId,
        errorCode: checkError.code,
        errorMessage: checkError.message,
      });
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

      // tenant_id 불일치인 경우와 존재하지 않는 경우를 구분
      const errorMessage =
        templateWithoutTenant &&
        templateWithoutTenant.tenant_id !== tenantContext.tenantId
          ? "다른 기관의 템플릿이거나 권한이 없습니다."
          : "템플릿을 찾을 수 없습니다.";

      throw new AppError(errorMessage, ErrorCode.NOT_FOUND, 404, true, {
        templateId,
        tenantId: tenantContext.tenantId,
        templateExists: !!templateWithoutTenant,
        templateTenantId: templateWithoutTenant?.tenant_id,
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
      description,
      program_type: programType,
      template_data: emptyTemplateData,
      created_by: userId,
      camp_start_date: campStartDate,
      camp_end_date: campEndDate,
      camp_location: campLocation,
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

    const supabase = await createSupabaseServerClient();
    const updateData: any = {
      name,
      description,
      program_type: programType,
      status: status || "draft",
      template_data: templateDataWithoutBlockSetId, // block_set_id 제거된 데이터
      updated_at: new Date().toISOString(),
    };

    // 날짜/장소 필드 추가
    if (campStartDate !== null) {
      updateData.camp_start_date = campStartDate || null;
    }
    if (campEndDate !== null) {
      updateData.camp_end_date = campEndDate || null;
    }
    if (campLocation !== null) {
      updateData.camp_location = campLocation || null;
    }

    const { error } = await supabase
      .from("camp_templates")
      .update(updateData)
      .eq("id", templateId)
      .eq("tenant_id", tenantContext.tenantId);

    if (error) {
      throw new AppError(
        "템플릿 수정에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
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

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("camp_templates")
      .delete()
      .eq("id", templateId)
      .eq("tenant_id", tenantContext.tenantId);

    if (error) {
      throw new AppError(
        "템플릿 삭제에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: error.message }
      );
    }

    return { success: true };
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
    if (!templateId || typeof templateId !== "string") {
      throw new AppError(
        "템플릿 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError(
        "최소 1명 이상의 학생을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 중복 제거
    const uniqueStudentIds = Array.from(new Set(studentIds));

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

    // 템플릿이 활성 상태인지 확인 (active 상태만 초대 가능)
    if (template.status !== "active") {
      const statusMessage =
        template.status === "archived"
          ? "보관된 템플릿에는 초대를 발송할 수 없습니다."
          : template.status === "draft"
          ? "초안 상태의 템플릿에는 초대를 발송할 수 없습니다. 템플릿을 활성화한 후 초대를 발송해주세요."
          : "활성 상태의 템플릿만 초대를 발송할 수 있습니다.";
      throw new AppError(statusMessage, ErrorCode.VALIDATION_ERROR, 400, true);
    }

    const supabase = await createSupabaseServerClient();

    // 기존 초대 확인 (중복 방지)
    const { data: existingInvitations } = await supabase
      .from("camp_invitations")
      .select("student_id")
      .eq("camp_template_id", templateId)
      .in("student_id", studentIds);

    const existingStudentIds = new Set(
      (existingInvitations || []).map((inv) => inv.student_id)
    );

    // 새로 초대할 학생만 필터링
    const newStudentIds = studentIds.filter(
      (id) => !existingStudentIds.has(id)
    );

    if (newStudentIds.length === 0) {
      return {
        success: true,
        count: 0,
        error: "모든 학생이 이미 초대되었습니다.",
      };
    }

    // 초대 생성
    const invitations = newStudentIds.map((studentId) => ({
      tenant_id: tenantContext.tenantId,
      camp_template_id: templateId,
      student_id: studentId,
      status: "pending",
    }));

    const { error } = await supabase
      .from("camp_invitations")
      .insert(invitations);

    if (error) {
      console.error("[actions/campTemplateActions] 초대 발송 실패", error);
      return { success: false, error: error.message };
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

    // 템플릿 존재 확인 (템플릿이 없어도 초대 목록은 조회 가능 - 삭제된 템플릿의 초대도 볼 수 있어야 함)
    const template = await getCampTemplate(templateId);
    if (template) {
      // 템플릿이 존재하는 경우, 권한 확인
      if (template.tenant_id !== tenantContext.tenantId) {
        throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
      }
    }
    // 템플릿이 없는 경우 (삭제된 경우 등)에도 초대 목록은 조회 가능
    // 초대 목록 자체가 tenant_id로 필터링되므로 보안 문제 없음

    // 초대 목록 조회 (tenant_id로 필터링하여 권한 확인)
    const supabase = await createSupabaseServerClient();
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
      .eq("tenant_id", tenantContext.tenantId)
      .order("invited_at", { ascending: false });

    if (error) {
      console.error("[campTemplateActions] 초대 목록 조회 실패", error);
      return { success: true, invitations: [] };
    }

    // 학생 정보를 평탄화
    const formattedInvitations = (invitations || []).map((invitation: any) => ({
      ...invitation,
      student_name: invitation.students?.name || null,
      student_grade: invitation.students?.grade || null,
      student_class: invitation.students?.class || null,
    }));

    return { success: true, invitations: formattedInvitations };
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
    if (!templateId || typeof templateId !== "string") {
      throw new AppError(
        "템플릿 ID가 올바르지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      throw new AppError(
        "재발송할 초대를 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 중복 제거
    const uniqueInvitationIds = Array.from(new Set(invitationIds));

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

    // 템플릿이 활성 상태인지 확인 (active 상태만 재발송 가능)
    if (template.status !== "active") {
      const statusMessage =
        template.status === "archived"
          ? "보관된 템플릿에는 초대를 재발송할 수 없습니다."
          : template.status === "draft"
          ? "초안 상태의 템플릿에는 초대를 재발송할 수 없습니다. 템플릿을 활성화한 후 재발송해주세요."
          : "활성 상태의 템플릿만 초대를 재발송할 수 있습니다.";
      throw new AppError(statusMessage, ErrorCode.VALIDATION_ERROR, 400, true);
    }

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

    const { role } = await getCurrentUserRole();
    if (role !== "admin" && role !== "consultant") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
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
        // scheduler_options에서 template_block_set_id 확인 (우선)
        const schedulerOptions = (result.group.scheduler_options as any) || {};
        let templateBlockSetId = schedulerOptions.template_block_set_id;

        console.log("[getCampPlanGroupForReview] 템플릿 블록 세트 ID 조회:", {
          fromSchedulerOptions: templateBlockSetId,
          schedulerOptions: JSON.stringify(schedulerOptions),
          hasTemplateData: !!template.template_data,
        });

        // scheduler_options에 없으면 template_data에서 확인
        if (!templateBlockSetId && template.template_data) {
          try {
            let templateData: any = null;
            if (typeof template.template_data === "string") {
              templateData = JSON.parse(template.template_data);
            } else {
              templateData = template.template_data;
            }

            templateBlockSetId = templateData?.block_set_id;

            console.log("[getCampPlanGroupForReview] template_data에서 조회:", {
              block_set_id: templateBlockSetId,
              templateDataKeys: templateData ? Object.keys(templateData) : [],
            });
          } catch (parseError) {
            console.error(
              "[getCampPlanGroupForReview] template_data 파싱 에러:",
              parseError
            );
          }
        }

        // 새로운 연결 테이블 방식으로 블록 세트 조회
        let tenantBlockSetId: string | null = null;
        
        // 1. 연결 테이블에서 템플릿에 연결된 블록 세트 조회
        const { data: templateBlockSetLink, error: linkError } = await supabase
          .from("camp_template_block_sets")
          .select("tenant_block_set_id")
          .eq("camp_template_id", result.group.camp_template_id)
          .maybeSingle();

        if (linkError) {
          console.error(
            "[getCampPlanGroupForReview] 템플릿 블록 세트 연결 조회 에러:",
            linkError
          );
        } else if (templateBlockSetLink) {
          tenantBlockSetId = templateBlockSetLink.tenant_block_set_id;
        } else {
          // 하위 호환성: templateBlockSetId가 이미 tenant_block_sets의 ID일 수 있음
          // 또는 template_data.block_set_id 확인 (마이그레이션 전 데이터용)
          tenantBlockSetId = templateBlockSetId;
        }

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
        const { userId } = await getCurrentUserRole();
        const { studentContents, recommendedContents } =
          await classifyPlanContents(result.contents, result.group.student_id, {
            currentUserRole: role,
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
    const { role } = await getCurrentUserRole();
    if (role !== "admin" && role !== "consultant") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
    }

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

    const supabase = await createSupabaseServerClient();

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

    // 이미 플랜이 생성된 경우 업데이트 불가
    const { data: plans } = await supabase
      .from("student_plan")
      .select("id")
      .eq("plan_group_id", groupId)
      .limit(1);

    if (plans && plans.length > 0) {
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

      // 캠프 모드에서는 block_set_id를 null로 설정
      creationData.block_set_id = null;
      creationData.plan_type = "camp";
      if (result.group.camp_template_id) {
        creationData.camp_template_id = result.group.camp_template_id;
      }
      if (result.group.camp_invitation_id) {
        creationData.camp_invitation_id = result.group.camp_invitation_id;
      }

      // time_settings를 scheduler_options에 병합
      let mergedSchedulerOptions = creationData.scheduler_options || {};
      if (creationData.time_settings) {
        mergedSchedulerOptions = {
          ...mergedSchedulerOptions,
          ...creationData.time_settings,
        };
      }

      // 플랜 그룹 메타데이터 업데이트 (관리자가 직접 Supabase 사용)
      const updatePayload: Record<string, any> = {
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

      // 콘텐츠 업데이트 (기존 삭제 후 재생성)
      if (creationData.contents !== undefined) {
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

        if (creationData.contents.length > 0) {
          // 학생이 실제로 가지고 있는 콘텐츠만 필터링
          const studentId = result.group.student_id;
          const validContents: Array<{
            content_type: string;
            content_id: string;
            start_range: number;
            end_range: number;
            display_order: number;
          }> = [];

          for (const content of creationData.contents) {
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
                    .select("id")
                    .eq("student_id", studentId)
                    .eq("master_content_id", content.content_id)
                    .maybeSingle();

                  if (studentBookByMaster) {
                    isValidContent = true;
                    actualContentId = studentBookByMaster.id;
                  } else {
                    console.warn(
                      `[campTemplateActions] 학생(${studentId})이 마스터 교재(${content.content_id})를 가지고 있지 않습니다. 콘텐츠에서 제외합니다.`
                    );
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
                    .select("id")
                    .eq("student_id", studentId)
                    .eq("master_content_id", content.content_id)
                    .maybeSingle();

                  if (studentLectureByMaster) {
                    isValidContent = true;
                    actualContentId = studentLectureByMaster.id;
                  } else {
                    console.warn(
                      `[campTemplateActions] 학생(${studentId})이 마스터 강의(${content.content_id})를 가지고 있지 않습니다. 콘텐츠에서 제외합니다.`
                    );
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
              validContents.push({
                content_type: content.content_type,
                content_id: actualContentId,
                start_range: content.start_range,
                end_range: content.end_range,
                display_order: content.display_order ?? 0,
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
          } else if (creationData.contents.length > 0) {
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

      // 학원 일정 업데이트 (학생별 전역 관리)
      if (creationData.academy_schedules !== undefined) {
        const studentId = result.group.student_id;

        // 기존 학원 일정 모두 삭제
        const { error: deleteError } = await supabase
          .from("academy_schedules")
          .delete()
          .eq("student_id", studentId)
          .eq("tenant_id", tenantContext.tenantId);

        if (deleteError) {
          console.error(
            "[campTemplateActions] 기존 학원 일정 삭제 실패",
            deleteError
          );
        }

        // 새로운 학원 일정 추가 (관리자 모드: Admin 클라이언트 사용)
        if (creationData.academy_schedules.length > 0) {
          const schedulesResult = await createStudentAcademySchedules(
            studentId,
            tenantContext.tenantId,
            creationData.academy_schedules.map((s) => ({
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
        }
      }

      // Step 6 또는 Step 7일 때 플랜 생성 (Step 6에서 Step 7로 이동하기 전에 플랜 생성)
      if (step === 6 || step === 7) {
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
        // wizardData에서 콘텐츠 확인 (플랜 생성 전이므로 plan_contents 테이블이 비어있을 수 있음)
        const studentContents = wizardData.student_contents || [];
        const recommendedContents = wizardData.recommended_contents || [];
        const totalContents = studentContents.length + recommendedContents.length;

        console.log("[campTemplateActions] Step 6 콘텐츠 검증 시작:", {
          groupId,
          studentContentsCount: studentContents.length,
          recommendedContentsCount: recommendedContents.length,
          totalContents,
          studentContents: studentContents.map((c) => ({
            content_type: c.content_type,
            content_id: c.content_id,
            master_content_id: (c as any).master_content_id,
          })),
          recommendedContents: recommendedContents.map((c) => ({
            content_type: c.content_type,
            content_id: c.content_id,
          })),
        });

        // plan_contents 테이블에 콘텐츠가 있는지 확인
        const { data: existingPlanContents } = await supabase
          .from("plan_contents")
          .select("id")
          .eq("plan_group_id", groupId)
          .limit(1);

        const hasPlanContents = existingPlanContents && existingPlanContents.length > 0;

        console.log("[campTemplateActions] Step 6 plan_contents 확인:", {
          hasPlanContents,
          existingPlanContentsCount: existingPlanContents?.length || 0,
        });

        // wizardData에 콘텐츠가 있고 plan_contents에 없으면 저장
        if (totalContents > 0 && !hasPlanContents) {
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
              
              const contentsToSave = validContents.map((c, idx) => {
                const isRecommended = recommendedContentIds.has(c.content_id) || 
                  (c.master_content_id && recommendedContentIds.has(c.master_content_id));
                
                // wizardData에서 추천 정보 가져오기
                const recommendedContent = recommendedContents.find(
                  (rc) => rc.content_id === c.content_id || rc.content_id === c.master_content_id
                );
                
                return {
                  content_type: c.content_type,
                  content_id: c.content_id,
                  start_range: c.start_range,
                  end_range: c.end_range,
                  display_order: c.display_order ?? idx,
                  master_content_id: c.master_content_id || null,
                  is_auto_recommended: (recommendedContent as any)?.is_auto_recommended ?? false,
                  recommendation_source: (recommendedContent as any)?.recommendation_source ?? (isRecommended ? "admin" : null),
                  recommendation_reason: (recommendedContent as any)?.recommendation_reason ?? null,
                  recommendation_metadata: (recommendedContent as any)?.recommendation_metadata ?? null,
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
              });
            } else {
              console.warn(
                `[campTemplateActions] 학생(${result.group.student_id})이 가지고 있는 유효한 콘텐츠가 없습니다.`,
                {
                  creationDataContentsCount: creationDataForContents.contents.length,
                  validContentsCount: validContents.length,
                }
              );
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

        // 최종 콘텐츠 검증 (plan_contents 테이블 확인)
        const { data: finalPlanContents } = await supabase
          .from("plan_contents")
          .select("id")
          .eq("plan_group_id", groupId)
          .limit(1);

        console.log("[campTemplateActions] Step 6 최종 콘텐츠 검증:", {
          finalPlanContentsCount: finalPlanContents?.length || 0,
          hasFinalPlanContents: finalPlanContents && finalPlanContents.length > 0,
        });

        if (!finalPlanContents || finalPlanContents.length === 0) {
          validationErrors.push(
            "플랜에 포함될 콘텐츠가 없습니다. Step 3 또는 Step 4에서 콘텐츠를 선택해주세요."
          );
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

            if (templateData?.template_data) {
              const templateDataObj = templateData.template_data as any;
              tenantBlockSetId = templateDataObj.block_set_id || null;
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
    const { role } = await getCurrentUserRole();
    if (role !== "admin" && role !== "consultant") {
      throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
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
      (currentGroup?.scheduler_options as any) || {};
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
      group.status as any,
      status as any
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
        group.status as any,
        status as any
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
