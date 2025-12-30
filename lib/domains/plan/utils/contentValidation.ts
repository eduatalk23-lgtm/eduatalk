/**
 * Content Validation Utilities
 *
 * FK 검증 및 콘텐츠 존재 확인을 위한 유틸리티 함수들
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ContentType = "book" | "lecture" | "custom";

export interface ContentExistsResult {
  exists: boolean;
  source?: "student" | "master";
  error?: string;
}

/**
 * 콘텐츠 존재 여부를 확인합니다.
 * RPC 함수 `check_content_exists`를 사용합니다.
 *
 * @param contentId 콘텐츠 ID
 * @param contentType 콘텐츠 타입 (book, lecture, custom)
 * @param studentId 학생 ID (선택적, 학생 콘텐츠 검증 시 사용)
 * @returns 존재 여부 및 소스 정보
 */
export async function checkContentExists(
  contentId: string,
  contentType: ContentType,
  studentId?: string
): Promise<ContentExistsResult> {
  // UUID 검증 (빈 문자열 방지)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!contentId || !uuidRegex.test(contentId)) {
    return { exists: false, error: "유효하지 않은 콘텐츠 ID입니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // RPC 함수 호출
    const { data, error } = await supabase.rpc("check_content_exists", {
      p_content_id: contentId,
      p_content_type: contentType,
      p_student_id: studentId ?? null,
    });

    if (error) {
      console.error("[checkContentExists] RPC 에러:", error);
      // RPC 에러 시 직접 조회로 폴백
      return await checkContentExistsDirect(supabase, contentId, contentType, studentId);
    }

    const result = data as { exists: boolean; source?: string; error?: string };
    return {
      exists: result.exists,
      source: result.source as "student" | "master" | undefined,
      error: result.error,
    };
  } catch (error) {
    console.error("[checkContentExists] 예외 발생:", error);
    return {
      exists: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * RPC 함수를 사용하지 않고 직접 콘텐츠 존재 여부를 확인합니다.
 * RPC 함수가 없는 경우의 폴백입니다.
 */
async function checkContentExistsDirect(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  contentId: string,
  contentType: ContentType,
  studentId?: string
): Promise<ContentExistsResult> {
  // UUID 검증 (빈 문자열 방지)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!contentId || !uuidRegex.test(contentId)) {
    return { exists: false, error: "유효하지 않은 콘텐츠 ID입니다." };
  }

  try {
    // 테이블 결정
    const tableName = contentType === "book"
      ? "books"
      : contentType === "lecture"
        ? "lectures"
        : "student_custom_contents";

    const masterTableName = contentType === "book"
      ? "master_books"
      : contentType === "lecture"
        ? "master_lectures"
        : null;

    // 1. 학생 콘텐츠 테이블에서 확인
    let query = supabase.from(tableName).select("id").eq("id", contentId);
    if (studentId) {
      query = query.eq("student_id", studentId);
    }
    const { data: studentContent, error: studentError } = await query.maybeSingle();

    if (studentError && studentError.code !== "PGRST116") {
      console.error(`[checkContentExistsDirect] ${tableName} 조회 실패:`, studentError);
    }

    if (studentContent) {
      return { exists: true, source: "student" };
    }

    // 2. 마스터 테이블에서 확인 (custom 제외)
    if (masterTableName) {
      const { data: masterContent, error: masterError } = await supabase
        .from(masterTableName)
        .select("id")
        .eq("id", contentId)
        .maybeSingle();

      if (masterError && masterError.code !== "PGRST116") {
        console.error(`[checkContentExistsDirect] ${masterTableName} 조회 실패:`, masterError);
      }

      if (masterContent) {
        return { exists: true, source: "master" };
      }
    }

    return { exists: false };
  } catch (error) {
    console.error("[checkContentExistsDirect] 예외 발생:", error);
    return {
      exists: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 여러 콘텐츠의 존재 여부를 일괄 확인합니다.
 *
 * @param contents 확인할 콘텐츠 배열
 * @param studentId 학생 ID (선택적)
 * @returns 존재하지 않는 콘텐츠 ID 배열
 */
export async function validateContentsExist(
  contents: Array<{ contentId: string; contentType: ContentType }>,
  studentId?: string
): Promise<{ valid: boolean; missingContentIds: string[] }> {
  if (contents.length === 0) {
    return { valid: true, missingContentIds: [] };
  }

  const missingContentIds: string[] = [];

  // 병렬로 검증 (최대 5개씩 배치)
  const batchSize = 5;
  for (let i = 0; i < contents.length; i += batchSize) {
    const batch = contents.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((c) => checkContentExists(c.contentId, c.contentType, studentId))
    );

    results.forEach((result, index) => {
      if (!result.exists) {
        missingContentIds.push(batch[index].contentId);
      }
    });
  }

  return {
    valid: missingContentIds.length === 0,
    missingContentIds,
  };
}

/**
 * Flexible Content ID (book, lecture, custom 중 하나)의 존재 여부를 확인합니다.
 * content_type이 제공되지 않은 경우 모든 테이블을 확인합니다.
 *
 * @param flexibleContentId 콘텐츠 ID
 * @param contentType 콘텐츠 타입 (선택적)
 * @param studentId 학생 ID (선택적)
 */
export async function checkFlexibleContentExists(
  flexibleContentId: string,
  contentType?: ContentType | null,
  studentId?: string
): Promise<ContentExistsResult> {
  // contentType이 지정된 경우 해당 타입만 확인
  if (contentType) {
    return checkContentExists(flexibleContentId, contentType, studentId);
  }

  // contentType이 없는 경우 모든 타입 확인 (book → lecture → custom 순서)
  const types: ContentType[] = ["book", "lecture", "custom"];
  for (const type of types) {
    const result = await checkContentExists(flexibleContentId, type, studentId);
    if (result.exists) {
      return result;
    }
  }

  return { exists: false };
}
