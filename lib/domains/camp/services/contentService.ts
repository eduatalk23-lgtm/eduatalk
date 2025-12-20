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
 * 
 * 플랜 그룹에 이미 저장된 콘텐츠를 두 가지 카테고리로 분류합니다:
 * - **학생 콘텐츠**: 학생이 직접 등록한 콘텐츠 (is_auto_recommended와 recommendation_source가 모두 없음)
 * - **추천 콘텐츠**: 시스템이나 관리자가 추천한 콘텐츠
 *   - `is_auto_recommended: true` 또는 `recommendation_source: "auto"` → Step 4에서 자동 배정된 콘텐츠
 *   - `recommendation_source: "admin"` → 관리자가 일괄 적용한 콘텐츠
 *   - `recommendation_source: "template"` → 템플릿에서 가져온 콘텐츠
 * 
 * 이 분류는 `prepareContentsToSave`에서 기존 콘텐츠를 보존할 때 사용됩니다.
 * 
 * @param existingPlanContents - 플랜 그룹에 저장된 기존 콘텐츠 목록 (null 가능)
 * @returns 학생 콘텐츠와 추천 콘텐츠로 분류된 객체
 * 
 * @example
 * ```typescript
 * const { studentContents, recommendedContents } = classifyExistingContents(existingContents);
 * // studentContents: 학생이 직접 등록한 콘텐츠만 포함
 * // recommendedContents: 추천된 콘텐츠만 포함
 * ```
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
 * 
 * 캠프 템플릿에서 콘텐츠를 배정할 때, 학생이 실제로 소유하지 않은 콘텐츠는
 * 플랜에 포함할 수 없습니다. 이 함수는 다음 순서로 검증합니다:
 * 
 * **교재(book)의 경우:**
 * 1. 학생 교재로 직접 조회 (content_id가 학생의 books 테이블에 존재하는지)
 * 2. 마스터 교재인지 확인 (master_books 테이블에 존재하는지)
 * 3. 마스터 교재인 경우, 해당 학생의 교재를 master_content_id로 찾기
 * 4. 학생 교재가 없으면 마스터 교재를 학생 교재로 자동 복사 (캠프 모드)
 * 
 * **강의(lecture)의 경우:**
 * 1. 학생 강의로 직접 조회
 * 2. 마스터 강의인지 확인
 * 3. 마스터 강의인 경우, 해당 학생의 강의를 master_content_id로 찾기
 * 4. 학생 강의가 없으면 마스터 강의를 학생 강의로 자동 복사
 * 
 * **커스텀 콘텐츠(custom)의 경우:**
 * - 학생 ID로 직접 조회 (student_custom_contents 테이블)
 * 
 * @param supabase - Supabase 클라이언트
 * @param content - 검증할 콘텐츠 정보 (PlanContentInsert 형식)
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID (마스터 콘텐츠 복사 시 필요)
 * @returns 검증 결과와 실제 콘텐츠 ID
 *   - `isValid: true` - 학생이 소유한 콘텐츠이며, actualContentId에 실제 ID 반환
 *   - `isValid: false` - 학생이 소유하지 않은 콘텐츠 (플랜에서 제외됨)
 * 
 * @throws 마스터 콘텐츠 복사 실패 시에도 에러를 throw하지 않고, 마스터 콘텐츠 ID를 그대로 사용
 *   (플랜 생성 시 자동 복사됨)
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
 * 
 * 캠프 템플릿 진행 시, 사용자가 특정 단계에서 콘텐츠를 선택하지 않았거나
 * 빈 배열을 전달한 경우, 기존에 저장된 콘텐츠를 보존해야 합니다.
 * 
 * **보존 로직:**
 * - `wizardData.student_contents`가 `undefined`이거나 빈 배열인 경우:
 *   → 기존 학생 콘텐츠(`existingStudentContents`)를 보존
 * - `wizardData.recommended_contents`가 `undefined`이거나 빈 배열인 경우:
 *   → 기존 추천 콘텐츠(`existingRecommendedContents`)를 보존
 * 
 * **대체 로직:**
 * - `wizardData.student_contents`에 새로운 콘텐츠가 있으면:
 *   → 기존 학생 콘텐츠를 무시하고 새로운 콘텐츠로 대체
 * - `wizardData.recommended_contents`에 새로운 콘텐츠가 있으면:
 *   → 기존 추천 콘텐츠를 무시하고 새로운 콘텐츠로 대체
 * 
 * **표시 순서:**
 * - 학생 콘텐츠가 먼저, 그 다음 추천 콘텐츠가 `display_order`에 따라 정렬됨
 * 
 * @param supabase - Supabase 클라이언트 (현재는 사용하지 않지만 향후 확장 가능)
 * @param groupId - 플랜 그룹 ID
 * @param tenantId - 테넌트 ID
 * @param wizardData - 위저드에서 전달된 콘텐츠 데이터
 *   - `student_contents`: 학생이 선택한 콘텐츠 (undefined 가능)
 *   - `recommended_contents`: 추천된 콘텐츠 (undefined 가능)
 * @param existingStudentContents - 기존에 저장된 학생 콘텐츠 목록
 * @param existingRecommendedContents - 기존에 저장된 추천 콘텐츠 목록
 * @returns 저장할 콘텐츠 목록 (PlanContentInsert 형식)
 * 
 * @example
 * ```typescript
 * // 새로운 학생 콘텐츠만 있고 추천 콘텐츠는 없는 경우
 * const contents = await prepareContentsToSave(
 *   supabase,
 *   groupId,
 *   tenantId,
 *   { student_contents: [newContent] }, // 추천 콘텐츠 없음
 *   [], // 기존 학생 콘텐츠 없음
 *   [existingRecommended] // 기존 추천 콘텐츠 보존됨
 * );
 * ```
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
 * 
 * 플랜 그룹에 콘텐츠를 저장하기 전에, 각 콘텐츠가 학생이 실제로 소유한 것인지
 * 검증하고, 마스터 콘텐츠인 경우 학생 콘텐츠로 자동 복사합니다.
 * 
 * **처리 흐름:**
 * 1. 각 콘텐츠에 대해 `validateAndResolveContent`를 호출하여 검증
 * 2. 유효한 콘텐츠만 필터링하여 `validContents` 배열에 추가
 * 3. 유효한 콘텐츠가 있으면 `createPlanContents`를 호출하여 저장
 * 4. 유효한 콘텐츠가 없으면 경고만 출력하고 에러는 발생시키지 않음
 *   (학생이 콘텐츠를 소유하지 않은 경우는 정상적인 상황일 수 있음)
 * 
 * **에러 처리:**
 * - 콘텐츠 저장 실패 시 `AppError`를 throw하여 상위에서 처리하도록 함
 * - 유효한 콘텐츠가 없는 경우는 에러가 아닌 경고로 처리
 * 
 * @param supabase - Supabase 클라이언트
 * @param groupId - 플랜 그룹 ID
 * @param tenantId - 테넌트 ID
 * @param studentId - 학생 ID
 * @param contentsToSave - 저장할 콘텐츠 목록
 * 
 * @throws {AppError} 콘텐츠 저장 실패 시
 * 
 * @example
 * ```typescript
 * await savePlanContents(
 *   supabase,
 *   groupId,
 *   tenantId,
 *   studentId,
 *   contentsToSave
 * );
 * ```
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

