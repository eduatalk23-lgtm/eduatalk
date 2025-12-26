"use server";

import { revalidatePath } from "next/cache";
import { revalidateCampTemplatePaths } from "@/lib/utils/revalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createCampTemplate,
  copyCampTemplate,
} from "@/lib/data/campTemplates";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import {
  AppError,
  ErrorCode,
  withErrorHandling,
  logError,
} from "@/lib/errors";
import type { CampTemplateUpdate } from "@/lib/domains/camp/types";
import {
  requireCampAdminAuth,
  requireCampTemplateAccess,
  requireCampTemplateDelete,
  requireCampPermission,
} from "@/lib/domains/camp/permissions";
import {
  linkBlockSetToTemplate,
  unlinkBlockSetFromTemplate,
} from "./blockSets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 캠프 템플릿 목록 조회
 */
export const getCampTemplates = withErrorHandling(async () => {
  // 권한 검증: 관리자/컨설턴트 + 테넌트 컨텍스트
  const { tenantId } = await requireCampAdminAuth();

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

  const { data, error } = await supabase
    .from("camp_templates")
    .select("*")
    .eq("tenant_id", tenantId)
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
    // 권한 검증: 관리자/컨설턴트 + 테넌트 컨텍스트
    const { tenantId } = await requireCampAdminAuth();

    // 템플릿 ID 검증
    if (!templateId || typeof templateId !== "string") {
      throw new AppError(
        "템플릿 ID가 올바르지 않습니다.",
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

    // tenant_id로 필터링하여 조회
    const { data: template, error: templateError } = await supabase
      .from("camp_templates")
      .select("*")
      .eq("id", templateId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (templateError) {
      // PGRST116은 결과가 0개일 때 발생하는 정상적인 에러
      if (templateError.code !== "PGRST116") {
        logError(templateError, {
          function: "getCampTemplateById",
          templateId,
          tenantId,
          errorCode: templateError.code,
        });
        throw new AppError(
          "템플릿 조회 중 오류가 발생했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true,
          {
            templateId,
            tenantId,
            originalError: templateError.message,
          }
        );
      }
    }

    if (!template) {
      throw new AppError("템플릿을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true, {
        templateId,
        tenantId,
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
    // 권한 검증: camp.create 권한 필요
    const { userId, tenantId } = await requireCampPermission("camp.create");

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
      tenant_id: tenantId,
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
    // 권한 검증: camp.create 권한 필요
    const { userId, tenantId } = await requireCampPermission("camp.create");

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
      tenant_id: tenantId,
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
        logError(linkError, {
          function: "createCampTemplateAction",
          templateId: result.templateId,
          blockSetId,
          action: "linkBlockSetToTemplate",
        });
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
    // 권한 검증: camp.update 권한 + 템플릿 접근 권한
    const { tenantId } = await requireCampTemplateAccess(templateId);

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
    const slotTemplatesJson =
      String(formData.get("slot_templates") ?? "").trim() || null;
    const allowNormalPlanActivationStr = String(
      formData.get("allow_normal_plan_activation") ?? ""
    ).trim();
    const allowNormalPlanActivation = allowNormalPlanActivationStr === "true";

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

    // slot_templates 파싱
    let slotTemplates = null;
    if (slotTemplatesJson) {
      try {
        slotTemplates = JSON.parse(slotTemplatesJson);
        if (!Array.isArray(slotTemplates)) {
          throw new AppError(
            "슬롯 템플릿 형식이 올바르지 않습니다.",
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
      } catch (e) {
        if (e instanceof AppError) throw e;
        throw new AppError(
          "슬롯 템플릿 형식이 올바르지 않습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }

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
      slot_templates: slotTemplates,
      allow_normal_plan_activation: allowNormalPlanActivation,
    };

    const { data: updatedRows, error } = await supabase
      .from("camp_templates")
      .update(updateData)
      .eq("id", templateId)
      .eq("tenant_id", tenantId)
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
        logError(linkError, {
          function: "updateCampTemplateAction",
          templateId,
          blockSetId,
          action: "linkBlockSetToTemplate",
        });
        // 연결 실패해도 템플릿 수정은 성공으로 처리
      }
    } else {
      // block_set_id가 없으면 연결 해제
      try {
        await unlinkBlockSetFromTemplate(templateId);
      } catch (unlinkError) {
        logError(unlinkError, {
          function: "updateCampTemplateAction",
          templateId,
          action: "unlinkBlockSetFromTemplate",
        });
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
    // 권한 검증: 템플릿 접근 권한
    const { tenantId } = await requireCampTemplateAccess(templateId);

    // 상태 검증
    const validStatuses = ["draft", "active", "archived"];
    if (!validStatuses.includes(status)) {
      throw new AppError(
        "올바른 상태를 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 상태 변경
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

    const { data: updatedRows, error } = await supabase
      .from("camp_templates")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("tenant_id", tenantId)
      .select();

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
 * - Admin만 삭제 가능 (camp.delete 권한 필요)
 */
export const deleteCampTemplateAction = withErrorHandling(
  async (templateId: string): Promise<{ success: boolean; error?: string }> => {
    // 권한 검증: camp.delete 권한 + 템플릿 접근 권한
    const { tenantId } = await requireCampTemplateDelete(templateId);

    // 템플릿 삭제 전에 관련된 플랜 그룹 삭제
    const { deletePlanGroupsByTemplateId } = await import(
      "@/lib/data/planGroups"
    );
    const planGroupResult = await deletePlanGroupsByTemplateId(templateId);

    if (!planGroupResult.success) {
      logError(new Error(planGroupResult.error || "플랜 그룹 삭제 실패"), {
        function: "deleteCampTemplateAction",
        templateId,
        tenantId,
        action: "deletePlanGroupsByTemplateId",
      });
      // 플랜 그룹 삭제 실패해도 템플릿 삭제는 계속 진행
      // (데이터 정합성 문제가 있을 수 있지만, 템플릿 삭제 자체는 완료)
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
      .eq("tenant_id", tenantId)
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
        tenantId,
      });
    }

    // 일반 클라이언트로 삭제 실패한 경우 Admin Client 사용
    if (!deletedSuccessfully) {
      try {
        const adminSupabase = createSupabaseAdminClient();
        if (!adminSupabase) {
          throw new AppError(
            "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
            ErrorCode.INTERNAL_ERROR,
            500,
            true
          );
        }
        const { data: adminDeletedRows, error: adminError } = await adminSupabase
          .from("camp_templates")
          .delete()
          .eq("id", templateId)
          .eq("tenant_id", tenantId)
          .select();

        if (adminError) {
          logError(adminError, {
            function: "deleteCampTemplateAction",
            templateId,
            tenantId,
            action: "adminClientDelete",
          });
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
            tenantId,
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
        logError(adminError, {
          function: "deleteCampTemplateAction",
          templateId,
          tenantId,
          action: "adminClientDelete",
        });
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
    // 권한 검증: 템플릿 접근 권한 (복사하려면 원본 접근 권한 필요)
    await requireCampTemplateAccess(templateId);

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

