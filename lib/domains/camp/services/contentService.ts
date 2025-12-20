/**
 * 캠프 플랜 그룹 콘텐츠 서비스
 * 
 * 콘텐츠 조회, 검증, 저장 로직을 담당합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/database.types";
import type { PlanContentInsert } from "@/lib/types/plan/schema";
import type { RecommendationMetadata } from "@/lib/types/content-selection";
import { AppError, ErrorCode, logError } from "@/lib/errors";
import { createPlanContents } from "@/lib/data/planGroups";

type WizardContent = {
  content_type: string;
  content_id: string;
  start_range: number;
  end_range: number;
  master_content_id?: string | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: RecommendationMetadata | null;
};

type WizardData = {
  student_contents?: WizardContent[];
  recommended_contents?: WizardContent[];
};

type ExistingPlanContent = {
  content_type: string;
  content_id: string;
  start_range: number;
  end_range: number;
  display_order: number | null;
  master_content_id: string | null;
  is_auto_recommended: boolean | null;
  recommendation_source: "auto" | "admin" | "template" | null;
  recommendation_reason: string | null;
  recommendation_metadata: Json | null;
};

/**
 * 기존 콘텐츠를 학생 콘텐츠와 추천 콘텐츠로 분류
 */
export function classifyExistingContents(
  existingPlanContents: ExistingPlanContent[] | null
): {
  studentContents: ExistingPlanContent[];
  recommendedContents: ExistingPlanContent[];
} {
  const studentContents: ExistingPlanContent[] = [];
  const recommendedContents: ExistingPlanContent[] = [];

  if (existingPlanContents) {
    for (const content of existingPlanContents) {
      // 콘텐츠 분류:
      // - is_auto_recommended: true, recommendation_source: "auto" → Step 4에서 자동 배정된 콘텐츠
      // - is_auto_recommended: false, recommendation_source: "admin" → 관리자가 일괄 적용한 콘텐츠
      // - 둘 다 없으면 → 학생이 직접 등록한 콘텐츠
      if (content.is_auto_recommended || content.recommendation_source) {
        recommendedContents.push(content);
      } else {
        studentContents.push(content);
      }
    }
  }

  return { studentContents, recommendedContents };
}

/**
 * 콘텐츠를 PlanContentInsert 형식으로 변환
 */
function convertToPlanContentInsert(
  content: WizardContent,
  tenantId: string,
  groupId: string,
  displayOrder: number,
  isRecommended: boolean
): PlanContentInsert {
  return {
    tenant_id: tenantId,
    plan_group_id: groupId,
    content_type: content.content_type as "book" | "lecture" | "custom",
    content_id: content.content_id,
    start_range: content.start_range,
    end_range: content.end_range,
    display_order: displayOrder,
    master_content_id: content.master_content_id ?? null,
    is_auto_recommended: isRecommended ? false : false, // 관리자 추가는 항상 false
    recommendation_source: isRecommended ? ("admin" as const) : null,
    recommendation_reason: content.recommendation_reason ?? null,
    recommendation_metadata: (content.recommendation_metadata as Json | null) ?? null,
  };
}

/**
 * 기존 콘텐츠를 PlanContentInsert 형식으로 변환 (보존용)
 */
function convertExistingToPlanContentInsert(
  content: ExistingPlanContent,
  tenantId: string,
  groupId: string,
  displayOrder: number
): PlanContentInsert {
  return {
    tenant_id: tenantId,
    plan_group_id: groupId,
    content_type: content.content_type as "book" | "lecture" | "custom",
    content_id: content.content_id,
    start_range: content.start_range,
    end_range: content.end_range,
    display_order: displayOrder,
    master_content_id: content.master_content_id ?? null,
    is_auto_recommended: content.is_auto_recommended ?? false,
    recommendation_source: content.recommendation_source ?? null,
    recommendation_reason: content.recommendation_reason ?? null,
    recommendation_metadata: content.recommendation_metadata ?? null,
  };
}

/**
 * 학생이 실제로 가지고 있는 콘텐츠인지 검증하고 실제 콘텐츠 ID 반환
 */
export async function validateAndResolveContent(
  supabase: SupabaseClient,
  content: PlanContentInsert,
  studentId: string,
  tenantId: string
): Promise<{ isValid: boolean; actualContentId: string }> {
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
              tenantId
            );
            isValidContent = true;
            actualContentId = bookId;
            console.log(
              `[contentService] 마스터 교재(${content.content_id})를 학생 교재(${bookId})로 복사했습니다.`
            );
          } catch (copyError) {
            logError(copyError, {
              function: "validateAndResolveContent",
              contentId: content.content_id,
              contentType: "book",
            });
            // 복사 실패 시에도 마스터 콘텐츠 ID를 사용 (플랜 생성 시 자동 복사됨)
            isValidContent = true;
            actualContentId = content.content_id;
          }
        }
      } else {
        console.warn(
          `[contentService] 교재(${content.content_id})를 찾을 수 없습니다. 콘텐츠에서 제외합니다.`
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
              tenantId
            );
            isValidContent = true;
            actualContentId = lectureId;
            console.log(
              `[contentService] 마스터 강의(${content.content_id})를 학생 강의(${lectureId})로 복사했습니다.`
            );
          } catch (copyError) {
            logError(copyError, {
              function: "validateAndResolveContent",
              message: `마스터 강의 복사 실패: ${content.content_id}`,
            });
            // 복사 실패 시에도 마스터 콘텐츠 ID를 사용 (플랜 생성 시 자동 복사됨)
            isValidContent = true;
            actualContentId = content.content_id;
          }
        }
      } else {
        console.warn(
          `[contentService] 강의(${content.content_id})를 찾을 수 없습니다. 콘텐츠에서 제외합니다.`
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
        `[contentService] 커스텀 콘텐츠(${content.content_id})를 찾을 수 없습니다. 콘텐츠에서 제외합니다.`
      );
    }
  }

  return { isValid: isValidContent, actualContentId };
}

/**
 * 콘텐츠 목록을 생성 (기존 콘텐츠 보존 로직 포함)
 */
export async function prepareContentsToSave(
  supabase: SupabaseClient,
  groupId: string,
  tenantId: string,
  wizardData: WizardData,
  existingStudentContents: ExistingPlanContent[],
  existingRecommendedContents: ExistingPlanContent[]
): Promise<PlanContentInsert[]> {
  const hasStudentContents = wizardData.student_contents !== undefined;
  const hasRecommendedContents = wizardData.recommended_contents !== undefined;

  const contentsToSave: PlanContentInsert[] = [];

  // 학생 콘텐츠 처리
  if (
    hasStudentContents &&
    wizardData.student_contents &&
    wizardData.student_contents.length > 0
  ) {
    // wizardData의 student_contents를 creationData 형식으로 변환하여 추가
    const studentContentsForCreation: PlanContentInsert[] =
      wizardData.student_contents.map((c, idx) =>
        convertToPlanContentInsert(c, tenantId, groupId, idx, false)
      );
    contentsToSave.push(...studentContentsForCreation);
  } else if (
    (!hasStudentContents ||
      (hasStudentContents &&
        wizardData.student_contents &&
        wizardData.student_contents.length === 0)) &&
    existingStudentContents.length > 0
  ) {
    // wizardData에 student_contents가 없거나 빈 배열인 경우 기존 학생 콘텐츠 보존
    const preservedStudentContents: PlanContentInsert[] =
      existingStudentContents.map((c) =>
        convertExistingToPlanContentInsert(c, tenantId, groupId, c.display_order ?? 0)
      );
    contentsToSave.push(...preservedStudentContents);

    console.log("[contentService] 기존 학생 콘텐츠 보존:", {
      groupId,
      hasStudentContents,
      wizardDataStudentContentsLength: wizardData.student_contents?.length ?? 0,
      existingStudentContentsCount: existingStudentContents.length,
      preservedCount: preservedStudentContents.length,
    });
  }

  // 추천 콘텐츠 처리
  if (
    hasRecommendedContents &&
    wizardData.recommended_contents &&
    wizardData.recommended_contents.length > 0
  ) {
    // wizardData의 recommended_contents를 creationData 형식으로 변환하여 추가
    const recommendedContentsForCreation: PlanContentInsert[] =
      wizardData.recommended_contents.map((c, idx) =>
        convertToPlanContentInsert(
          c,
          tenantId,
          groupId,
          contentsToSave.length + idx,
          true
        )
      );
    contentsToSave.push(...recommendedContentsForCreation);
  } else if (
    (!hasRecommendedContents ||
      (hasRecommendedContents &&
        wizardData.recommended_contents &&
        wizardData.recommended_contents.length === 0)) &&
    existingRecommendedContents.length > 0
  ) {
    // wizardData에 recommended_contents가 없거나 빈 배열인 경우 기존 추천 콘텐츠 보존
    const preservedRecommendedContents: PlanContentInsert[] =
      existingRecommendedContents.map((c) =>
        convertExistingToPlanContentInsert(
          c,
          tenantId,
          groupId,
          contentsToSave.length + (c.display_order ?? 0)
        )
      );
    contentsToSave.push(...preservedRecommendedContents);

    console.log("[contentService] 기존 추천 콘텐츠 보존:", {
      groupId,
      hasRecommendedContents,
      wizardDataRecommendedContentsLength:
        wizardData.recommended_contents?.length ?? 0,
      existingRecommendedContentsCount: existingRecommendedContents.length,
      preservedCount: preservedRecommendedContents.length,
    });
  }

  return contentsToSave;
}

/**
 * 콘텐츠 저장 (학생이 실제로 가지고 있는 콘텐츠만 필터링)
 */
export async function savePlanContents(
  supabase: SupabaseClient,
  groupId: string,
  tenantId: string,
  studentId: string,
  contentsToSave: PlanContentInsert[]
): Promise<void> {
  if (contentsToSave.length === 0) return;

  // 학생이 실제로 가지고 있는 콘텐츠만 필터링
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
    const { isValid, actualContentId } = await validateAndResolveContent(
      supabase,
      content,
      studentId,
      tenantId
    );

    if (isValid) {
      const contentWithRecommendation = content as typeof content & {
        is_auto_recommended?: boolean;
        recommendation_source?: "auto" | "admin" | "template" | string | null;
        recommendation_reason?: string | null;
        recommendation_metadata?: RecommendationMetadata | null;
      };
      const recommendationSource = contentWithRecommendation.recommendation_source;
      const validRecommendationSource:
        | "auto"
        | "admin"
        | "template"
        | null =
        recommendationSource === "auto" ||
        recommendationSource === "admin" ||
        recommendationSource === "template"
          ? recommendationSource
          : null;
      validContents.push({
        content_type: content.content_type,
        content_id: actualContentId,
        start_range: content.start_range,
        end_range: content.end_range,
        display_order: content.display_order ?? 0,
        master_content_id: content.master_content_id || null,
        is_auto_recommended:
          contentWithRecommendation.is_auto_recommended ?? false,
        recommendation_source: validRecommendationSource,
        recommendation_reason:
          contentWithRecommendation.recommendation_reason || null,
        recommendation_metadata:
          contentWithRecommendation.recommendation_metadata ?? null,
      });
    }
  }

  if (validContents.length > 0) {
    const contentsResult = await createPlanContents(
      groupId,
      tenantId,
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
  } else if (contentsToSave.length > 0) {
    // 유효한 콘텐츠가 없는 경우 경고만 출력 (에러는 발생시키지 않음)
    console.warn(
      `[contentService] 학생(${studentId})이 가지고 있는 유효한 콘텐츠가 없습니다.`
    );
  }
}

