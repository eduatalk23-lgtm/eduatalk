"use server";

import type { SupabaseServerClient } from "@/lib/data/core/types";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

/**
 * 콘텐츠 타입 정의
 */
export type ContentType = "book" | "lecture" | "custom";

/**
 * 콘텐츠 총량 조회 결과 타입
 */
type BookRow = {
  id: string;
  total_pages?: number | null;
};

type LectureRow = {
  id: string;
  duration?: number | null;
  master_lecture_id?: string | null;
};

type MasterLectureRow = {
  id: string;
  total_duration?: number | null;
};

type CustomRow = {
  id: string;
  total_page_or_time?: number | null;
};

/**
 * 콘텐츠 총량 조회 함수
 * 
 * 보안 강화: student_id 필터를 통해 권한 검증
 * 하위 호환성: student_id 컬럼이 없는 경우 fallback 처리
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param studentId - 학생 ID (필수, 보안 검증용)
 * @param contentType - 콘텐츠 타입 (book, lecture, custom)
 * @param contentId - 콘텐츠 ID
 * @returns 콘텐츠 총량 (페이지 수 또는 시간), 조회 실패 시 null
 * 
 * @example
 * ```typescript
 * const totalPages = await fetchContentTotal(
 *   supabase,
 *   user.userId,
 *   "book",
 *   plan.content_id
 * );
 * ```
 */
export async function fetchContentTotal(
  supabase: SupabaseServerClient,
  studentId: string,
  contentType: ContentType,
  contentId: string
): Promise<number | null> {
  try {
    if (contentType === "book") {
      const selectBook = () =>
        supabase
          .from("books")
          .select("id,total_pages")
          .eq("id", contentId);

      // student_id 필터 추가 (보안 강화)
      let { data, error } = await selectBook()
        .eq("student_id", studentId)
        .maybeSingle<BookRow>();

      // student_id 컬럼이 없는 경우 fallback (하위 호환성)
      if (ErrorCodeCheckers.isColumnNotFound(error)) {
        console.warn("[contentTotal] books.student_id 컬럼이 없어 fallback 처리", {
          contentId,
          studentId,
          errorCode: error?.code,
        });
        ({ data, error } = await selectBook().maybeSingle<BookRow>());
      }

      if (error) {
        console.error("[contentTotal] 책 총량 조회 실패", {
          contentId,
          studentId,
          error: error.message,
          code: error.code,
        });
        throw error;
      }

      return data?.total_pages ?? null;
    }

    if (contentType === "lecture") {
      const selectLecture = () =>
        supabase
          .from("lectures")
          .select("id,duration,master_lecture_id")
          .eq("id", contentId);

      // student_id 필터 추가 (보안 강화)
      let { data, error } = await selectLecture()
        .eq("student_id", studentId)
        .maybeSingle<LectureRow>();

      // student_id 컬럼이 없는 경우 fallback (하위 호환성)
      if (ErrorCodeCheckers.isColumnNotFound(error)) {
        console.warn("[contentTotal] lectures.student_id 컬럼이 없어 fallback 처리", {
          contentId,
          studentId,
          errorCode: error?.code,
        });
        ({ data, error } = await selectLecture().maybeSingle<LectureRow>());
      }

      if (error) {
        console.error("[contentTotal] 강의 총량 조회 실패", {
          contentId,
          studentId,
          error: error.message,
          code: error.code,
        });
        throw error;
      }

      // lectures 테이블에 duration이 있으면 사용
      if (data?.duration != null && data.duration > 0) {
        return data.duration;
      }

      // duration이 없고 master_lecture_id가 있으면 master_lectures 테이블에서 조회
      if (data?.master_lecture_id) {
        const { data: masterLecture, error: masterError } = await supabase
          .from("master_lectures")
          .select("id,total_duration")
          .eq("id", data.master_lecture_id)
          .maybeSingle<MasterLectureRow>();

        if (masterError) {
          console.error("[contentTotal] 마스터 강의 총량 조회 실패", {
            contentId,
            studentId,
            masterLectureId: data.master_lecture_id,
            error: masterError.message,
            code: masterError.code,
          });
          // 마스터 강의 조회 실패는 치명적이지 않으므로 null 반환
          return null;
        }

        // total_duration이 있으면 분 단위로 반환 (초 단위일 수 있으므로 확인 필요)
        // 일반적으로 total_duration은 분 단위이지만, 확인이 필요할 수 있음
        if (masterLecture?.total_duration != null && masterLecture.total_duration > 0) {
          return masterLecture.total_duration;
        }
      }

      // duration도 없고 master_lecture_id도 없거나 master_lectures에서도 조회 실패
      console.warn("[contentTotal] 강의 총량을 찾을 수 없음", {
        contentId,
        studentId,
        hasDuration: data?.duration != null,
        masterLectureId: data?.master_lecture_id,
      });
      return null;
    }

    if (contentType === "custom") {
      const selectCustom = () =>
        supabase
          .from("student_custom_contents")
          .select("id,total_page_or_time")
          .eq("id", contentId);

      // student_id 필터 추가 (보안 강화)
      // student_custom_contents는 student_id가 필수이므로 fallback 불필요
      let { data, error } = await selectCustom()
        .eq("student_id", studentId)
        .maybeSingle<CustomRow>();

      // student_id 컬럼이 없는 경우 fallback (하위 호환성, 이론적으로 발생하지 않지만 방어적 코딩)
      if (ErrorCodeCheckers.isColumnNotFound(error)) {
        console.warn("[contentTotal] student_custom_contents.student_id 컬럼이 없어 fallback 처리", {
          contentId,
          studentId,
          errorCode: error?.code,
        });
        ({ data, error } = await selectCustom().maybeSingle<CustomRow>());
      }

      if (error) {
        console.error("[contentTotal] 커스텀 콘텐츠 총량 조회 실패", {
          contentId,
          studentId,
          error: error.message,
          code: error.code,
        });
        throw error;
      }

      return data?.total_page_or_time ?? null;
    }

    console.warn("[contentTotal] 알 수 없는 콘텐츠 타입", {
      contentType,
      contentId,
      studentId,
    });
    return null;
  } catch (error) {
    console.error("[contentTotal] 콘텐츠 총량 조회 중 예외 발생", {
      contentType,
      contentId,
      studentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

