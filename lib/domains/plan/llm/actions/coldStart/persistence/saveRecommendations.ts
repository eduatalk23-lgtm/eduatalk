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
} from "./types";
import { mapToBookInsert, mapToLectureInsert } from "./mappers";
import {
  checkBookDuplicatesBatch,
  checkLectureDuplicatesBatch,
} from "./duplicateCheck";

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

  // 1. 교재/강의 분류
  const books = recommendations.filter((r) => r.contentType === "book");
  const lectures = recommendations.filter((r) => r.contentType === "lecture");

  // 2. 배치 중복 검사 (병렬 실행 - 2개 쿼리)
  const [bookDuplicates, lectureDuplicates] = await Promise.all([
    books.length > 0
      ? checkBookDuplicatesBatch(
          books.map((b) => b.title),
          subjectCategory,
          tenantId
        )
      : { existingMap: new Map<string, string>(), duplicateTitles: [] },
    lectures.length > 0
      ? checkLectureDuplicatesBatch(
          lectures.map((l) => l.title),
          subjectCategory,
          tenantId
        )
      : { existingMap: new Map<string, string>(), duplicateTitles: [] },
  ]);

  // 3. 중복 항목 처리 (교재)
  for (const book of books) {
    const existingId = bookDuplicates.existingMap.get(book.title);
    if (existingId) {
      savedItems.push({
        id: existingId,
        title: book.title,
        contentType: "book",
        isNew: false,
      });
      skippedDuplicates++;
    }
  }

  // 4. 중복 항목 처리 (강의)
  for (const lecture of lectures) {
    const existingId = lectureDuplicates.existingMap.get(lecture.title);
    if (existingId) {
      savedItems.push({
        id: existingId,
        title: lecture.title,
        contentType: "lecture",
        isNew: false,
      });
      skippedDuplicates++;
    }
  }

  // 5. 신규 항목 필터링
  const newBooks = books.filter(
    (b) => !bookDuplicates.existingMap.has(b.title)
  );
  const newLectures = lectures.filter(
    (l) => !lectureDuplicates.existingMap.has(l.title)
  );

  // 6. 배치 INSERT (교재 - 1개 쿼리)
  if (newBooks.length > 0) {
    const bookInserts = newBooks.map((b) => mapToBookInsert(b, options));

    const { data, error } = await supabase
      .from("master_books")
      .insert(bookInserts)
      .select("id, title");

    if (error) {
      // 배치 실패 시 개별 에러 기록
      for (const book of newBooks) {
        errors.push({ title: book.title, error: error.message });
      }
    } else if (data) {
      for (const row of data) {
        savedItems.push({
          id: row.id,
          title: row.title,
          contentType: "book",
          isNew: true,
        });
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
      for (const lecture of newLectures) {
        errors.push({ title: lecture.title, error: error.message });
      }
    } else if (data) {
      for (const row of data) {
        savedItems.push({
          id: row.id,
          title: row.title,
          contentType: "lecture",
          isNew: true,
        });
      }
    }
  }

  return {
    success: errors.length === 0,
    savedItems,
    skippedDuplicates,
    errors,
  };
}
