"use server";

/**
 * 캠프 플랜 그룹 위저드 관련 함수
 * - continueCampStepsForAdmin: 관리자용 캠프 위저드 단계 진행
 */

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  AppError,
  ErrorCode,
  withErrorHandling,
} from "@/lib/errors";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import type { Json } from "@/lib/supabase/database.types";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import type { SchedulerOptions } from "@/lib/types/plan";
import type { PlanContentInsert } from "@/lib/types/plan/schema";
import { logError } from "@/lib/errors/handler";

/**
 * 관리자용 캠프 위저드 단계 진행
 * Step 4, 5, 6에서는 데이터 저장만 수행
 * Step 7에서만 플랜 생성
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

    // tenantId를 변수에 저장하여 타입 좁히기
    const tenantId = tenantContext.tenantId;

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

    logActionDebug(
      { domain: "camp", action: "continueCampStepsForAdmin" },
      "Admin 클라이언트 사용 (RLS 우회)"
    );

    // 플랜 그룹 조회 및 권한 확인
    const { getPlanGroupWithDetailsForAdmin } = await import(
      "@/lib/data/planGroups"
    );
    const result = await getPlanGroupWithDetailsForAdmin(
      groupId,
      tenantId
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
      updatePlanGroupMetadata,
      updatePlanExclusions,
      updateAcademySchedules,
    } = await import("@/lib/domains/camp/services/updateService");
    const {
      savePlanContents,
    } = await import("@/lib/domains/camp/services/contentService");

    try {
      const creationData = syncWizardDataToCreationData(
        wizardData as WizardData
      );

      creationData.plan_type = "camp";

      // 캠프 모드에서는 block_set_id를 null로 설정
      // 템플릿의 block_set_id는 tenant_block_sets 테이블의 ID이므로
      // plan_groups.block_set_id (student_block_sets 참조)에 저장할 수 없음
      creationData.block_set_id = null;

      if (result.group.camp_template_id) {
        creationData.camp_template_id = result.group.camp_template_id;

        // 캠프 모드에서 템플릿 블록 세트 ID 조회 (공통 함수 사용)
        const { getTemplateBlockSetId } = await import("@/lib/plan/blocks");
        const schedulerOptions: SchedulerOptions = (result.group.scheduler_options as SchedulerOptions | null) ?? {};
        const tenantBlockSetId = await getTemplateBlockSetId(
          result.group.camp_template_id,
          schedulerOptions,
          tenantId
        );

        // 템플릿 블록 세트 ID를 scheduler_options에 저장
        if (tenantBlockSetId) {
          if (!creationData.scheduler_options) {
            creationData.scheduler_options = {};
          }
          type SchedulerOptionsWithTemplateBlockSet = SchedulerOptions & {
            template_block_set_id?: string;
          };
          (creationData.scheduler_options as SchedulerOptionsWithTemplateBlockSet).template_block_set_id =
            tenantBlockSetId;
          logActionDebug(
            { domain: "camp", action: "continueCampStepsForAdmin" },
            "scheduler_options에 template_block_set_id 추가",
            {
              template_block_set_id: tenantBlockSetId,
              scheduler_options: creationData.scheduler_options,
            }
          );
        } else {
          logActionDebug(
            { domain: "camp", action: "continueCampStepsForAdmin" },
            "템플릿 블록 세트 ID를 찾을 수 없습니다",
            { campTemplateId: result.group.camp_template_id }
          );
        }
      }
      if (result.group.camp_invitation_id) {
        creationData.camp_invitation_id = result.group.camp_invitation_id;
      }

      // 플랜 그룹 메타데이터 업데이트
      await updatePlanGroupMetadata(supabase, groupId, tenantId, creationData);

      // 콘텐츠 업데이트 (기존 콘텐츠 보존 로직 개선)
      // wizardData에서 student_contents와 recommended_contents를 확인하여
      // 명시적으로 전달된 경우에만 업데이트하고, 그렇지 않으면 기존 콘텐츠 보존
      const hasStudentContents = wizardData.student_contents !== undefined;
      const hasRecommendedContents = wizardData.recommended_contents !== undefined;

      logActionDebug(
        { domain: "camp", action: "continueCampStepsForAdmin" },
        "콘텐츠 업데이트 시작",
        {
          groupId,
          step,
          hasStudentContents,
          studentContentsLength: wizardData.student_contents?.length ?? 0,
          hasRecommendedContents,
          recommendedContentsLength: wizardData.recommended_contents?.length ?? 0,
          studentContentsIsEmptyArray: hasStudentContents && wizardData.student_contents?.length === 0,
          recommendedContentsIsEmptyArray: hasRecommendedContents && wizardData.recommended_contents?.length === 0,
        }
      );

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

      logActionDebug(
        { domain: "camp", action: "continueCampStepsForAdmin" },
        "기존 콘텐츠 조회 결과",
        {
          groupId,
          existingTotalCount: existingPlanContents?.length ?? 0,
          existingStudentContentsCount: existingStudentContents.length,
          existingRecommendedContentsCount: existingRecommendedContents.length,
        }
      );

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
            tenant_id: tenantId,
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
            tenant_id: tenantId,
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

          logActionDebug(
            { domain: "camp", action: "continueCampStepsForAdmin" },
            "기존 학생 콘텐츠 보존",
            {
              groupId,
              hasStudentContents,
              wizardDataStudentContentsLength: wizardData.student_contents?.length ?? 0,
              existingStudentContentsCount: existingStudentContents.length,
              preservedCount: preservedStudentContents.length,
            }
          );
        }

        // 추천 콘텐츠 처리
        if (hasRecommendedContents && wizardData.recommended_contents && wizardData.recommended_contents.length > 0) {
          // wizardData의 recommended_contents를 creationData 형식으로 변환하여 추가
          // 관리자가 추가하는 경우는 항상 is_auto_recommended: false, recommendation_source: "admin"으로 강제 설정
          const recommendedContentsForCreation: PlanContentInsert[] = wizardData.recommended_contents.map((c, idx) => ({
            tenant_id: tenantId,
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
            recommendation_metadata: (c.recommendation_metadata as unknown as Json | null) ?? null,
          }));
          contentsToSave.push(...recommendedContentsForCreation);
        } else if (
          (!hasRecommendedContents || (hasRecommendedContents && wizardData.recommended_contents && wizardData.recommended_contents.length === 0)) &&
          existingRecommendedContents.length > 0
        ) {
          // wizardData에 recommended_contents가 없거나 빈 배열인 경우 기존 추천 콘텐츠 보존
          // 빈 배열을 전달하면 hasRecommendedContents는 true이지만 length > 0이 false가 되어 보존되지 않는 문제 해결
          const preservedRecommendedContents: PlanContentInsert[] = existingRecommendedContents.map((c) => ({
            tenant_id: tenantId,
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
            recommendation_metadata: (c.recommendation_metadata as unknown as Json | null) ?? null,
          }));
          contentsToSave.push(...preservedRecommendedContents);

          logActionDebug(
            { domain: "camp", action: "continueCampStepsForAdmin" },
            "기존 추천 콘텐츠 보존",
            {
              groupId,
              hasRecommendedContents,
              wizardDataRecommendedContentsLength: wizardData.recommended_contents?.length ?? 0,
              existingRecommendedContentsCount: existingRecommendedContents.length,
              preservedCount: preservedRecommendedContents.length,
            }
          );
        }

        logActionDebug(
          { domain: "camp", action: "continueCampStepsForAdmin" },
          "저장할 콘텐츠 목록",
          {
            groupId,
            totalContentsToSave: contentsToSave.length,
            studentContentsToSave: contentsToSave.filter((c) => !c.is_auto_recommended && !c.recommendation_source).length,
            recommendedContentsToSave: contentsToSave.filter((c) => c.is_auto_recommended || c.recommendation_source).length,
          }
        );

        if (contentsToSave.length > 0) {
          // savePlanContents 함수를 사용하여 콘텐츠 저장
          // 이 함수는 validateAndResolveContent를 사용하여 학생이 실제로 가지고 있는 콘텐츠만 필터링
          const studentId = result.group.student_id;
          await savePlanContents(
            supabase,
            groupId,
            tenantId,
            studentId,
            contentsToSave
          );

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

          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "콘텐츠 병합 검증",
            {
              groupId,
              studentId,
              hasStudentContents,
              hasRecommendedContents,
              existingStudentContentsCount: existingStudentContents.length,
              existingRecommendedContentsCount: existingRecommendedContents.length,
              savedStudentContentsCount: savedStudentContents.length,
              savedRecommendedContentsCount: savedRecommendedContents.length,
              contentsToSaveCount: contentsToSave.length,
            }
          );

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
                logActionDebug(
                  { domain: "camp", action: "campTemplateActions" },
                  "기존 학생 콘텐츠 보존 검증 실패",
                  {
                    expected: existingStudentContents.length,
                    actual: preservedCount,
                    groupId,
                    studentId,
                  }
                );
              } else {
                logActionDebug(
                  { domain: "camp", action: "campTemplateActions" },
                  `기존 학생 콘텐츠 보존 검증 성공: ${preservedCount}개 보존됨`
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
                logActionDebug(
                  { domain: "camp", action: "campTemplateActions" },
                  "기존 추천 콘텐츠 보존 검증 실패",
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
                logActionDebug(
                  { domain: "camp", action: "campTemplateActions" },
                  `기존 추천 콘텐츠 보존 검증 성공: ${preservedCount}개 보존됨`
                );
              }
            }
        }
      }

      // 제외일 업데이트
      await updatePlanExclusions(
        supabase,
        groupId,
        tenantId,
        creationData.exclusions
      );

      // 학원 일정 업데이트
      await updateAcademySchedules(
        supabase,
        result.group.student_id,
        tenantId,
        creationData.academy_schedules
      );

      // Step 7에서만 플랜 생성
      // Step 4, 5, 6에서는 데이터 저장만 수행
      if (step === 7) {
        // 플랜 생성 전 필수 데이터 검증
        const validationErrors: string[] = [];

        // 1. 기간 검증
        const periodStart =
          creationData.period_start || result.group.period_start;
        const periodEnd = creationData.period_end || result.group.period_end;
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
        const { data: existingPlanContentsForStep7 } = await supabase
          .from("plan_contents")
          .select("id")
          .eq("plan_group_id", groupId)
          .limit(1);

        const hasPlanContents = existingPlanContentsForStep7 && existingPlanContentsForStep7.length > 0;

        logActionDebug(
          { domain: "camp", action: "campTemplateActions" },
          "Step 6 콘텐츠 검증 시작",
          {
            groupId,
            step,
            hasPlanContents,
            existingPlanContentsCount: existingPlanContentsForStep7?.length || 0,
            wizardDataStudentContents: wizardData.student_contents?.length ?? 0,
            wizardDataRecommendedContents: wizardData.recommended_contents?.length ?? 0,
            wizardDataStudentContentsIsUndefined: wizardData.student_contents === undefined,
            wizardDataRecommendedContentsIsUndefined: wizardData.recommended_contents === undefined,
          }
        );

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
          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "Step 6 DB에서 콘텐츠 로드",
            {
              wizardDataStudentContentsIsUndefined: wizardData.student_contents === undefined,
              wizardDataRecommendedContentsIsUndefined: wizardData.recommended_contents === undefined,
              hasPlanContents,
            }
          );

          // DB에서 콘텐츠 조회
          const dbResult = await getPlanGroupWithDetailsForAdmin(
            groupId,
            tenantId
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
          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "Step 6 DB에서 로드한 콘텐츠",
            {
              loadedStudentContentsCount: studentContents.length,
              loadedRecommendedContentsCount: recommendedContents.length,
              totalLoadedContents: studentContents.length + recommendedContents.length,
            }
          );
        }

        const totalContents = studentContents.length + recommendedContents.length;

        // DB에 콘텐츠가 있으면 저장 로직 스킵 (이미 저장되어 있음)
        if (hasPlanContents) {
          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "Step 6 콘텐츠 저장 스킵",
            {
              reason: "DB에 이미 콘텐츠가 있음",
              existingPlanContentsCount: existingPlanContentsForStep7?.length || 0,
              wizardDataTotalContents: totalContents,
            }
          );
        } else if (totalContents > 0) {
          // wizardData에 콘텐츠가 있고 plan_contents에 없으면 저장
          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "Step 6에서 콘텐츠 저장 필요",
            {
              totalContents,
              studentContents: studentContents.length,
              recommendedContents: recommendedContents.length,
            }
          );

          // creationData를 다시 생성하여 콘텐츠 저장
          const creationDataForContents = syncWizardDataToCreationData(
            wizardData as WizardData
          );

          if (creationDataForContents.contents && creationDataForContents.contents.length > 0) {
            const studentId = result.group.student_id;

            // 추천 콘텐츠 정보 추출 (wizardData에서)
            const recommendedContentIds = new Set(
              recommendedContents.map((c) => c.content_id)
            );

            // PlanContentInsert 형식으로 변환
            const contentsToSaveForStep7: PlanContentInsert[] = creationDataForContents.contents.map((content, idx) => {
              const isRecommended = recommendedContentIds.has(content.content_id) ||
                (content.master_content_id && recommendedContentIds.has(content.master_content_id));

              // wizardData에서 추천 정보 가져오기
              const recommendedContent = recommendedContents.find(
                (rc) => rc.content_id === content.content_id || rc.content_id === content.master_content_id
              );

              return {
                tenant_id: tenantId,
                plan_group_id: groupId,
                content_type: content.content_type,
                content_id: content.content_id,
                start_range: content.start_range,
                end_range: content.end_range,
                display_order: content.display_order ?? idx,
                master_content_id: content.master_content_id ?? null,
                is_auto_recommended: false, // 관리자 추가는 항상 false
                recommendation_source: (isRecommended ? "admin" : null) as "auto" | "admin" | "template" | null,
                recommendation_reason: recommendedContent?.recommendation_reason ?? null,
                recommendation_metadata: (recommendedContent?.recommendation_metadata as Json) ?? null,
              };
            });

            // savePlanContents 함수를 사용하여 콘텐츠 저장
            // 이 함수는 validateAndResolveContent를 사용하여 학생이 실제로 가지고 있는 콘텐츠만 필터링
            await savePlanContents(
              supabase,
              groupId,
              tenantId,
              studentId,
              contentsToSaveForStep7
            );

            logActionDebug(
              { domain: "camp", action: "campTemplateActions" },
              "Step 6에서 콘텐츠 저장 완료",
              {
                totalContents: creationDataForContents.contents.length,
                contentsToSaveCount: contentsToSaveForStep7.length,
              }
            );
          }
        } else {
          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "Step 6 콘텐츠 저장 스킵",
            {
              totalContents,
              hasPlanContents,
              reason:
                totalContents === 0
                  ? "wizardData에 콘텐츠가 없음"
                  : "plan_contents에 이미 콘텐츠가 있음",
            }
          );
        }

        // 최종 콘텐츠 검증
        // 위에서 로드한 콘텐츠 사용 (wizardData 또는 DB에서 로드)
        const finalStudentContents = studentContents;
        const finalRecommendedContents = recommendedContents;
        const finalTotalContents = finalStudentContents.length + finalRecommendedContents.length;

        logActionDebug(
          { domain: "camp", action: "campTemplateActions" },
          "Step 6 최종 콘텐츠 검증",
          {
            wizardDataStudentContents: finalStudentContents.length,
            wizardDataRecommendedContents: finalRecommendedContents.length,
            wizardDataTotalContents: finalTotalContents,
            hasPlanContents,
            existingPlanContentsCount: existingPlanContentsForStep7?.length || 0,
          }
        );

        // 최종적으로 plan_contents 테이블에 콘텐츠가 있는지 확인
        // (wizardData에 콘텐츠가 없어도 DB에 있으면 플랜 생성 가능)
        const { data: finalPlanContents } = await supabase
          .from("plan_contents")
          .select("id")
          .eq("plan_group_id", groupId)
          .limit(1);

        logActionDebug(
          { domain: "camp", action: "campTemplateActions" },
          "Step 6 최종 plan_contents 테이블 확인",
          {
            finalPlanContentsCount: finalPlanContents?.length || 0,
            hasFinalPlanContents: finalPlanContents && finalPlanContents.length > 0,
            wizardDataTotalContents: finalTotalContents,
            wizardDataStudentContents: finalStudentContents.length,
            wizardDataRecommendedContents: finalRecommendedContents.length,
          }
        );

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
          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "Step 6 검증: wizardData에 콘텐츠가 있지만 DB에 저장되지 않음. 콘텐츠 저장 과정을 확인하세요.",
            {
              wizardDataStudentContents: finalStudentContents.length,
              wizardDataRecommendedContents: finalRecommendedContents.length,
              wizardDataTotalContents: finalTotalContents,
            }
          );
          // 이 경우에도 플랜 생성은 가능하도록 허용 (플랜 생성 시 콘텐츠가 자동으로 처리될 수 있음)
          // 단, 경고 로그만 남기고 검증 에러는 발생시키지 않음
        } else {
          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "Step 6 최종 검증: 콘텐츠가 있어 플랜 생성 가능",
            {
              hasFinalPlanContents,
              hasWizardContents,
              finalPlanContentsCount: finalPlanContents?.length || 0,
              wizardDataTotalContents: finalTotalContents,
            }
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

          let tenantBlockSetIdForValidation: string | null = null;
          if (templateBlockSetLink) {
            tenantBlockSetIdForValidation = templateBlockSetLink.tenant_block_set_id;
          } else {
            // 하위 호환성: template_data.block_set_id 확인 (마이그레이션 전 데이터용)
            const { data: templateData } = await supabase
              .from("camp_templates")
              .select("template_data")
              .eq("id", result.group.camp_template_id)
              .maybeSingle();

            const parsedTemplateData = templateData?.template_data as Record<string, unknown> | null;
            if (parsedTemplateData?.block_set_id && typeof parsedTemplateData.block_set_id === "string") {
              tenantBlockSetIdForValidation = parsedTemplateData.block_set_id;
            }
          }

          if (tenantBlockSetIdForValidation) {
            // tenant_blocks 테이블에서 블록 조회
            const { data: templateBlocks } = await supabase
              .from("tenant_blocks")
              .select("id")
              .eq("tenant_block_set_id", tenantBlockSetIdForValidation)
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
          "@/lib/domains/plan"
        );

        try {
          await generatePlansFromGroupAction(groupId);

          // 플랜 생성 후 상태를 "saved"로 변경
          const { error: statusUpdateError } = await supabase
            .from("plan_groups")
            .update({ status: "saved", updated_at: new Date().toISOString() })
            .eq("id", groupId);

          if (statusUpdateError) {
            logError(statusUpdateError, {
              function: "continueCampStepsForAdmin",
              groupId,
              action: "updatePlanGroupStatus",
            });
            // 상태 업데이트 실패는 경고만 (플랜은 생성됨)
            logActionDebug(
              { domain: "camp", action: "campTemplateActions" },
              "플랜 그룹 상태를 saved로 변경하지 못했습니다",
              { groupId }
            );
          }

          // 플랜 생성 성공 시 학생에게 알림 발송
          try {
            if (result.group.camp_template_id && result.group.student_id) {
              const [studentData, templateData] = await Promise.all([
                supabase
                  .from("students")
                  .select("name")
                  .eq("user_id", result.group.student_id)
                  .single(),
                supabase
                  .from("camp_templates")
                  .select("name")
                  .eq("id", result.group.camp_template_id)
                  .single(),
              ]);

              if (studentData.data && templateData.data) {
                const {
                  sendPlanCreatedNotificationToStudent,
                  sendPlanCreatedNotificationToParents,
                } = await import(
                  "@/lib/services/campNotificationService"
                );
                await sendPlanCreatedNotificationToStudent({
                  studentId: result.group.student_id,
                  studentName: studentData.data.name || "학생",
                  templateId: result.group.camp_template_id,
                  templateName: templateData.data.name,
                  groupId,
                  tenantId,
                });

                // A4 개선: 학부모에게도 플랜 생성 알림 발송 (비동기)
                sendPlanCreatedNotificationToParents({
                  studentId: result.group.student_id,
                  studentName: studentData.data.name || "학생",
                  templateId: result.group.camp_template_id,
                  templateName: templateData.data.name,
                  groupId,
                  tenantId,
                }).catch((err) => {
                  logActionError(
                    { domain: "camp", action: "continueCampStepsForAdmin" },
                    err,
                    { context: "학부모 알림 발송 실패" }
                  );
                });
              }
            }
          } catch (notificationError) {
            // 알림 발송 실패는 로그만 남기고 계속 진행
            logActionError(
              { domain: "camp", action: "continueCampStepsForAdmin" },
              notificationError,
              { context: "학생 알림 발송 실패" }
            );
          }
        } catch (planError) {
          logError(planError, {
            function: "continueCampStepsForAdmin",
            groupId,
            action: "generatePlan",
          });
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
          logActionDebug(
            { domain: "camp", action: "campTemplateActions" },
            "플랜이 이미 생성되어 있어 플랜 생성 스킵",
            {
              groupId,
              existingPlansCount: existingPlans?.length || 0,
            }
          );
        }
      }
    } catch (error) {
      logError(error, {
        function: "continueCampStepsForAdmin",
        groupId,
      });
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
