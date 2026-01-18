/**
 * 콜드 스타트 추천 결과 DB 저장
 *
 * 추천 파이프라인에서 생성된 결과를 master_books / master_lectures 테이블에 저장합니다.
 * 중복 검사를 수행하여 이미 존재하는 콘텐츠는 스킵합니다.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RecommendationItem } from "../types";
import type {
  SaveRecommendationOptions,
  SaveRecommendationsResult,
  SavedContentItem,
} from "./types";
import { mapToBookInsert, mapToLectureInsert } from "./mappers";
import { checkBookDuplicate, checkLectureDuplicate } from "./duplicateCheck";

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
      errors: [{ title: "system", error: "Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다." }],
    };
  }

  const savedItems: SavedContentItem[] = [];
  const errors: Array<{ title: string; error: string }> = [];
  let skippedDuplicates = 0;

  const tenantId = options.tenantId ?? null;
  const subjectCategory = options.subjectCategory ?? null;

  for (const item of recommendations) {
    try {
      if (item.contentType === "book") {
        // 교재 중복 검사
        const duplicateCheck = await checkBookDuplicate(
          item.title,
          subjectCategory,
          tenantId
        );

        if (duplicateCheck.isDuplicate && duplicateCheck.existingId) {
          // 중복인 경우 기존 ID 반환
          savedItems.push({
            id: duplicateCheck.existingId,
            title: item.title,
            contentType: "book",
            isNew: false,
          });
          skippedDuplicates++;
          continue;
        }

        // 새 교재 생성
        const insertData = mapToBookInsert(item, options);
        const { data, error } = await supabase
          .from("master_books")
          .insert(insertData)
          .select("id")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        savedItems.push({
          id: data.id,
          title: item.title,
          contentType: "book",
          isNew: true,
        });
      } else {
        // 강의 중복 검사
        const duplicateCheck = await checkLectureDuplicate(
          item.title,
          subjectCategory,
          tenantId
        );

        if (duplicateCheck.isDuplicate && duplicateCheck.existingId) {
          savedItems.push({
            id: duplicateCheck.existingId,
            title: item.title,
            contentType: "lecture",
            isNew: false,
          });
          skippedDuplicates++;
          continue;
        }

        // 새 강의 생성
        const insertData = mapToLectureInsert(item, options);
        const { data, error } = await supabase
          .from("master_lectures")
          .insert(insertData)
          .select("id")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        savedItems.push({
          id: data.id,
          title: item.title,
          contentType: "lecture",
          isNew: true,
        });
      }
    } catch (err) {
      errors.push({
        title: item.title,
        error: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  return {
    success: errors.length === 0,
    savedItems,
    skippedDuplicates,
    errors,
  };
}
