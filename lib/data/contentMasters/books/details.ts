/**
 * 마스터 교재 상세 정보 관련 함수
 */

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookDetail } from "@/lib/types/plan";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

/**
 * 교재 상세 정보 추가
 */
export async function createBookDetail(
  data: Omit<BookDetail, "id" | "created_at">
): Promise<BookDetail> {
  const supabase = await createSupabaseServerClient();

  const { data: detail, error } = await supabase
    .from("book_details")
    .insert({
      book_id: data.book_id,
      major_unit: data.major_unit,
      minor_unit: data.minor_unit,
      page_number: data.page_number,
      display_order: data.display_order,
    })
    .select()
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "createBookDetail" },
      error,
      { bookId: data.book_id }
    );
    throw new Error(error.message || "교재 상세 정보 추가에 실패했습니다.");
  }

  return detail as BookDetail;
}

/**
 * 교재 상세 정보 수정
 */
export async function updateBookDetail(
  detailId: string,
  data: Partial<Omit<BookDetail, "id" | "created_at">>
): Promise<BookDetail> {
  const supabase = await createSupabaseServerClient();

  const { data: detail, error } = await supabase
    .from("book_details")
    .update({
      major_unit: data.major_unit,
      minor_unit: data.minor_unit,
      page_number: data.page_number,
      display_order: data.display_order,
    })
    .eq("id", detailId)
    .select()
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "updateBookDetail" },
      error,
      { detailId }
    );
    throw new Error(error.message || "교재 상세 정보 수정에 실패했습니다.");
  }

  return detail as BookDetail;
}

/**
 * 교재 상세 정보 삭제
 */
export async function deleteBookDetail(detailId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("book_details")
    .delete()
    .eq("id", detailId);

  if (error) {
    logActionError(
      { domain: "data", action: "deleteBookDetail" },
      error,
      { detailId }
    );
    throw new Error(error.message || "교재 상세 정보 삭제에 실패했습니다.");
  }
}

/**
 * 교재의 모든 상세 정보 삭제
 */
export async function deleteAllBookDetails(bookId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("book_details")
    .delete()
    .eq("book_id", bookId);

  if (error) {
    logActionError(
      { domain: "data", action: "deleteAllBookDetails" },
      error,
      { bookId }
    );
    throw new Error(
      error.message || "교재 상세 정보 일괄 삭제에 실패했습니다."
    );
  }
}

/**
 * 학생 교재의 상세 정보 조회 (student_book_details)
 * @param bookId 교재 ID
 * @param studentId 학생 ID (현재는 사용되지 않음)
 * @param supabaseClient 선택적 Supabase 클라이언트 (관리자/컨설턴트의 경우 Admin 클라이언트 전달 가능)
 */
export async function getStudentBookDetails(
  bookId: string,
  studentId: string,
  supabaseClient?: SupabaseClient
): Promise<
  Array<{
    id: string;
    page_number: number;
    major_unit: string | null;
    minor_unit: string | null;
  }>
> {
  const supabase = supabaseClient || (await createSupabaseServerClient());

  const { data, error } = await supabase
    .from("student_book_details")
    .select("id, page_number, major_unit, minor_unit")
    .eq("book_id", bookId)
    .order("page_number", { ascending: true });

  if (error) {
    logActionError(
      { domain: "data", action: "getStudentBookDetails" },
      error,
      { bookId, studentId }
    );
    return [];
  }

  return (
    (data as Array<{
      id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }> | null) ?? []
  );
}

/**
 * 여러 교재의 상세 정보를 배치로 조회 (성능 최적화)
 * @param bookIds 조회할 교재 ID 배열
 * @param studentId 학생 ID
 * @returns Map<bookId, BookDetail[]> 형태로 반환
 */
export async function getStudentBookDetailsBatch(
  bookIds: string[],
  _studentId: string
): Promise<
  Map<
    string,
    Array<{
      id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }>
  >
> {
  if (bookIds.length === 0) {
    return new Map();
  }

  // RLS 정책 우회를 위해 admin 클라이언트 사용
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    logActionError(
      { domain: "data", action: "getStudentBookDetailsBatch" },
      new Error("admin 클라이언트 생성 실패")
    );
    return new Map();
  }

  // 성능 측정 시작
  const queryStart = performance.now();

  const { data, error } = await supabase
    .from("student_book_details")
    .select("id, book_id, page_number, major_unit, minor_unit")
    .in("book_id", bookIds)
    .order("book_id", { ascending: true })
    .order("page_number", { ascending: true });

  const queryTime = performance.now() - queryStart;

  if (error) {
    logActionError(
      { domain: "data", action: "getStudentBookDetailsBatch" },
      error
    );
    return new Map();
  }

  // 결과를 bookId별로 그룹화하여 Map으로 반환
  const resultMap = new Map<
    string,
    Array<{
      id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }>
  >();

  (data || []).forEach(
    (detail: {
      id: string;
      book_id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }) => {
      if (!resultMap.has(detail.book_id)) {
        resultMap.set(detail.book_id, []);
      }
      resultMap.get(detail.book_id)!.push({
        id: detail.id,
        page_number: detail.page_number,
        major_unit: detail.major_unit,
        minor_unit: detail.minor_unit,
      });
    }
  );

  // 조회 결과가 없는 bookId들도 빈 배열로 초기화
  bookIds.forEach((bookId) => {
    if (!resultMap.has(bookId)) {
      resultMap.set(bookId, []);
    }
  });

  // 성능 로깅 (개발 환경에서만)
  if (process.env.NODE_ENV === "development") {
    const resultCount = data?.length || 0;
    const emptyBookIds = bookIds.filter(
      (bookId) => !resultMap.has(bookId) || resultMap.get(bookId)!.length === 0
    );

    logActionDebug(
      { domain: "data", action: "getStudentBookDetailsBatch" },
      "쿼리 성능",
      {
        bookCount: bookIds.length,
        resultCount,
        queryTime: `${queryTime.toFixed(2)}ms`,
        avgTimePerBook:
          bookIds.length > 0
            ? `${(queryTime / bookIds.length).toFixed(2)}ms`
            : "N/A",
        emptyBookCount: emptyBookIds.length,
        emptyBookIds: emptyBookIds.length > 0 ? emptyBookIds : undefined,
      }
    );

    if (emptyBookIds.length > 0) {
      logActionDebug(
        { domain: "data", action: "getStudentBookDetailsBatch" },
        "목차가 없는 교재",
        {
          count: emptyBookIds.length,
          bookIds: emptyBookIds,
          reason:
            "student_book_details 테이블에 해당 교재의 목차 정보가 없습니다.",
        }
      );
    }
  }

  return resultMap;
}
