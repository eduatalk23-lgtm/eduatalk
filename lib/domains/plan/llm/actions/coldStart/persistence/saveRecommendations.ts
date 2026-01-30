/**
 * 콜드 스타트 추천 결과 DB 저장 (배치 처리)
 *
 * 추천 파이프라인에서 생성된 결과를 master_books / master_lectures 테이블에 저장합니다.
 * 배치 중복 검사 + 배치 INSERT로 쿼리 수를 최소화합니다.
 *
 * 기존: N개 항목 → 2N개 쿼리 (중복검사 N + INSERT N)
 * 개선: N개 항목 → 4개 쿼리 (교재 중복검사 + 강의 중복검사 + 교재 INSERT + 강의 INSERT)
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RecommendationItem } from "../types";
import type {
  SaveRecommendationOptions,
  SaveRecommendationsResult,
  SavedContentItem,
  ExistingContentInfo,
  UpdateReasonStats,
  SkipReasonStats,
  UpdateReason,
} from "./types";
import { mapToBookInsert, mapToLectureInsert, calculateQualityScore } from "./mappers";
import {
  checkBookDuplicatesBatchWithDetails,
  checkLectureDuplicatesBatchWithDetails,
} from "./duplicateCheck";
import { saveInstructorsAndLinkLectures } from "./instructorPersistence";

/** 보호되는 source 값 (수동 입력/검증 완료) */
const PROTECTED_SOURCES = ["manual", "verified"];

/** 품질 점수 개선 임계값 (이 값 이상 차이나면 업데이트) */
const QUALITY_IMPROVEMENT_THRESHOLD = 10;

/**
 * 추천 결과를 master 콘텐츠 테이블에 저장
 *
 * @param recommendations - 저장할 추천 항목 목록
 * @param options - 저장 옵션 (테넌트, 교과, 과목, 난이도)
 * @returns 저장 결과 (성공 항목, 스킵된 중복, 에러 목록)
 *
 * @example
 * ```typescript
 * const result = await saveRecommendationsToMasterContent(
 *   recommendations,
 *   {
 *     tenantId: null,  // 공유 카탈로그
 *     subjectCategory: '수학',
 *     subject: '미적분',
 *     difficultyLevel: '개념',
 *   }
 * );
 *
 * console.log(`새로 저장: ${result.savedItems.filter(i => i.isNew).length}개`);
 * console.log(`중복 스킵: ${result.skippedDuplicates}개`);
 * ```
 */
export async function saveRecommendationsToMasterContent(
  recommendations: RecommendationItem[],
  options: SaveRecommendationOptions = {}
): Promise<SaveRecommendationsResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      success: false,
      savedItems: [],
      skippedDuplicates: 0,
      updatedCount: 0,
      newCount: 0,
      errors: [{ title: "system", error: "Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다." }],
      updateReasons: { fillMetadata: 0, qualityImprovement: 0 },
      skipReasons: { protected: 0, noImprovement: 0 },
    };
  }

  const savedItems: SavedContentItem[] = [];
  const errors: Array<{ title: string; error: string }> = [];
  let skippedDuplicates = 0;
  let updatedCount = 0;
  let newCount = 0;

  // 통계 추적
  const updateReasons: UpdateReasonStats = { fillMetadata: 0, qualityImprovement: 0 };
  const skipReasons: SkipReasonStats = { protected: 0, noImprovement: 0 };

  const tenantId = options.tenantId ?? null;
  const subjectCategory = options.subjectCategory ?? null;

  // 1. 교재/강의 분류
  const books = recommendations.filter((r) => r.contentType === "book");
  const lectures = recommendations.filter((r) => r.contentType === "lecture");

  // 2. 확장된 배치 중복 검사 (병렬 실행 - 2개 쿼리)
  const [bookDuplicates, lectureDuplicates] = await Promise.all([
    books.length > 0
      ? checkBookDuplicatesBatchWithDetails(
          books.map((b) => b.title),
          subjectCategory,
          tenantId
        )
      : { existingMap: new Map<string, ExistingContentInfo>(), duplicateTitles: [] },
    lectures.length > 0
      ? checkLectureDuplicatesBatchWithDetails(
          lectures.map((l) => l.title),
          subjectCategory,
          tenantId
        )
      : { existingMap: new Map<string, ExistingContentInfo>(), duplicateTitles: [] },
  ]);

  // 3. 중복 항목 분류 (교재): 스킵 / 업데이트 / 신규
  const newBooks: RecommendationItem[] = [];
  const booksToUpdate: Array<{ item: RecommendationItem; existingInfo: ExistingContentInfo; reason: UpdateReason }> = [];

  for (const book of books) {
    const existingInfo = bookDuplicates.existingMap.get(book.title);
    if (!existingInfo) {
      // 신규 항목
      newBooks.push(book);
      continue;
    }

    // 조건부 업데이트 판단
    const updateDecision = shouldUpdate(book, existingInfo);
    if (updateDecision.shouldUpdate && updateDecision.reason) {
      booksToUpdate.push({ item: book, existingInfo, reason: updateDecision.reason });
      // 업데이트 이유 통계
      if (updateDecision.reason === "fill_metadata") {
        updateReasons.fillMetadata++;
      } else if (updateDecision.reason === "quality_improvement") {
        updateReasons.qualityImprovement++;
      }
    } else {
      // 스킵
      savedItems.push({
        id: existingInfo.id,
        title: book.title,
        contentType: "book",
        isNew: false,
        isUpdated: false,
        reason: updateDecision.reason,
      });
      skippedDuplicates++;
      // 스킵 이유 통계
      if (updateDecision.reason === "protected") {
        skipReasons.protected++;
      } else if (updateDecision.reason === "no_improvement") {
        skipReasons.noImprovement++;
      }
    }
  }

  // 4. 중복 항목 분류 (강의): 스킵 / 업데이트 / 신규
  const newLectures: RecommendationItem[] = [];
  const lecturesToUpdate: Array<{ item: RecommendationItem; existingInfo: ExistingContentInfo; reason: UpdateReason }> = [];

  for (const lecture of lectures) {
    const existingInfo = lectureDuplicates.existingMap.get(lecture.title);
    if (!existingInfo) {
      // 신규 항목
      newLectures.push(lecture);
      continue;
    }

    // 조건부 업데이트 판단
    const updateDecision = shouldUpdate(lecture, existingInfo);
    if (updateDecision.shouldUpdate && updateDecision.reason) {
      lecturesToUpdate.push({ item: lecture, existingInfo, reason: updateDecision.reason });
      // 업데이트 이유 통계
      if (updateDecision.reason === "fill_metadata") {
        updateReasons.fillMetadata++;
      } else if (updateDecision.reason === "quality_improvement") {
        updateReasons.qualityImprovement++;
      }
    } else {
      // 스킵
      savedItems.push({
        id: existingInfo.id,
        title: lecture.title,
        contentType: "lecture",
        isNew: false,
        isUpdated: false,
        reason: updateDecision.reason,
      });
      skippedDuplicates++;
      // 스킵 이유 통계
      if (updateDecision.reason === "protected") {
        skipReasons.protected++;
      } else if (updateDecision.reason === "no_improvement") {
        skipReasons.noImprovement++;
      }
    }
  }

  // 5. 교재 업데이트 실행
  for (const { item, existingInfo, reason } of booksToUpdate) {
    const updateData = mapToBookInsert(item, options);
    // tenant_id, title, source는 업데이트하지 않음
    const { tenant_id: _tid, title: _title, source: _source, ...updateFields } = updateData;

    // 콜드스타트 추적 필드 추가
    const fieldsWithTracking = {
      ...updateFields,
      cold_start_updated_at: new Date().toISOString(),
      cold_start_update_count: existingInfo.coldStartUpdateCount + 1,
    };

    const { error } = await supabase
      .from("master_books")
      .update(fieldsWithTracking)
      .eq("id", existingInfo.id);

    if (error) {
      errors.push({ title: item.title, error: `업데이트 실패: ${error.message}` });
    } else {
      savedItems.push({
        id: existingInfo.id,
        title: item.title,
        contentType: "book",
        isNew: false,
        isUpdated: true,
        reason,
      });
      updatedCount++;
    }
  }

  // 6. 강의 업데이트 실행
  for (const { item, existingInfo, reason } of lecturesToUpdate) {
    const updateData = mapToLectureInsert(item, options);
    // tenant_id, title은 업데이트하지 않음 (강의는 source 컬럼 없음)
    const { tenant_id: _tid, title: _title, ...updateFields } = updateData;

    // 콜드스타트 추적 필드 추가
    const fieldsWithTracking = {
      ...updateFields,
      cold_start_updated_at: new Date().toISOString(),
      cold_start_update_count: existingInfo.coldStartUpdateCount + 1,
    };

    const { error } = await supabase
      .from("master_lectures")
      .update(fieldsWithTracking)
      .eq("id", existingInfo.id);

    if (error) {
      errors.push({ title: item.title, error: `업데이트 실패: ${error.message}` });
    } else {
      savedItems.push({
        id: existingInfo.id,
        title: item.title,
        contentType: "lecture",
        isNew: false,
        isUpdated: true,
        reason,
      });
      updatedCount++;
    }
  }

  // 6. 배치 INSERT (교재 - 1개 쿼리)
  if (newBooks.length > 0) {
    const bookInserts = newBooks.map((b) => mapToBookInsert(b, options));

    const { data, error } = await supabase
      .from("master_books")
      .insert(bookInserts)
      .select("id, title");

    if (error) {
      // 배치 실패 시 개별 INSERT로 폴백
      for (const book of newBooks) {
        const { data: singleData, error: singleError } = await supabase
          .from("master_books")
          .insert(mapToBookInsert(book, options))
          .select("id, title")
          .single();

        if (singleError) {
          errors.push({ title: book.title, error: singleError.message });
        } else if (singleData) {
          savedItems.push({
            id: singleData.id,
            title: singleData.title,
            contentType: "book",
            isNew: true,
          });
          newCount++;
        }
      }
    } else if (data) {
      for (const row of data) {
        savedItems.push({
          id: row.id,
          title: row.title,
          contentType: "book",
          isNew: true,
        });
        newCount++;
      }
    }
  }

  // 7. 배치 INSERT (강의 - 1개 쿼리)
  if (newLectures.length > 0) {
    const lectureInserts = newLectures.map((l) => mapToLectureInsert(l, options));

    const { data, error } = await supabase
      .from("master_lectures")
      .insert(lectureInserts)
      .select("id, title");

    if (error) {
      // 배치 실패 시 개별 INSERT로 폴백
      for (const lecture of newLectures) {
        const { data: singleData, error: singleError } = await supabase
          .from("master_lectures")
          .insert(mapToLectureInsert(lecture, options))
          .select("id, title")
          .single();

        if (singleError) {
          errors.push({ title: lecture.title, error: singleError.message });
        } else if (singleData) {
          savedItems.push({
            id: singleData.id,
            title: singleData.title,
            contentType: "lecture",
            isNew: true,
          });
          newCount++;
        }
      }
    } else if (data) {
      for (const row of data) {
        savedItems.push({
          id: row.id,
          title: row.title,
          contentType: "lecture",
          isNew: true,
        });
        newCount++;
      }
    }
  }

  // 8. 강사 정보 저장 및 강의 연결
  let instructorStats: SaveRecommendationsResult["instructorStats"];

  // 강의 제목 → ID 맵 생성 (강사 연결에 사용)
  const savedLectureMap = new Map<string, string>();
  for (const item of savedItems) {
    if (item.contentType === "lecture") {
      savedLectureMap.set(item.title, item.id);
    }
  }

  // 강사 정보가 있는 강의가 있으면 저장
  const lecturesWithInstructor = lectures.filter((l) => l.instructorInfo?.name);
  if (lecturesWithInstructor.length > 0 && savedLectureMap.size > 0) {
    const instructorResult = await saveInstructorsAndLinkLectures(
      lectures,
      savedLectureMap,
      options
    );

    instructorStats = {
      savedCount: instructorResult.savedInstructors.length,
      newCount: instructorResult.savedInstructors.filter((i) => i.isNew).length,
      skippedDuplicates: instructorResult.skippedDuplicates,
      linkedLectures: instructorResult.linkedLectures,
    };

    // 강사 저장 에러도 전체 에러에 추가
    for (const err of instructorResult.errors) {
      errors.push({ title: `[강사] ${err.name}`, error: err.error });
    }
  }

  return {
    success: errors.length === 0,
    savedItems,
    skippedDuplicates,
    updatedCount,
    newCount,
    errors,
    updateReasons,
    skipReasons,
    instructorStats,
  };
}

// ============================================================================
// 조건부 업데이트 판단 로직
// ============================================================================

interface UpdateDecision {
  shouldUpdate: boolean;
  reason?: "fill_metadata" | "quality_improvement" | "protected" | "no_improvement";
}

/**
 * 기존 콘텐츠를 새 데이터로 업데이트할지 판단
 *
 * 업데이트 조건:
 * 1. source가 'manual' 또는 'verified'면 → 보호 (업데이트 안 함)
 * 2. 기존에 recommendation_metadata가 없으면 → 채우기 (업데이트)
 * 3. 새 품질 점수가 기존보다 10점 이상 높으면 → 품질 개선 (업데이트)
 * 4. 그 외 → 업데이트 안 함
 */
function shouldUpdate(
  newItem: RecommendationItem,
  existingInfo: ExistingContentInfo
): UpdateDecision {
  // 1. 보호된 source는 업데이트하지 않음
  if (existingInfo.source && PROTECTED_SOURCES.includes(existingInfo.source)) {
    return { shouldUpdate: false, reason: "protected" };
  }

  // 2. 기존에 metadata가 없으면 채우기
  if (!existingInfo.hasRecommendationMetadata) {
    return { shouldUpdate: true, reason: "fill_metadata" };
  }

  // 3. 품질 점수 비교
  const newQualityScore = calculateQualityScore(newItem);
  const qualityDiff = newQualityScore - existingInfo.qualityScore;

  if (qualityDiff >= QUALITY_IMPROVEMENT_THRESHOLD) {
    return { shouldUpdate: true, reason: "quality_improvement" };
  }

  // 4. 그 외는 업데이트하지 않음
  return { shouldUpdate: false, reason: "no_improvement" };
}
