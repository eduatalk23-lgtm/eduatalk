/**
 * 콜드 스타트 콘텐츠 중복 검사
 *
 * 동일 제목 + 교과 조합으로 중복을 검사하여
 * 이미 존재하는 콘텐츠의 재등록을 방지합니다.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DuplicateCheckResult, BatchDuplicateCheckResult } from "./types";

/**
 * 교재 중복 검사
 *
 * @param title - 교재 제목
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
export async function checkBookDuplicate(
  title: string,
  subjectCategory: string | null,
  tenantId: string | null
): Promise<DuplicateCheckResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  let query = supabase
    .from("master_books")
    .select("id")
    .ilike("title", title.trim());

  // 테넌트 조건
  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  // 교과 조건 (있는 경우)
  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query.limit(1).single();

  if (error && error.code !== "PGRST116") {
    // PGRST116: no rows returned - not an error for duplicate check
    throw new Error(`교재 중복 검사 실패: ${error.message}`);
  }

  return {
    isDuplicate: !!data,
    existingId: data?.id ?? null,
  };
}

/**
 * 강의 중복 검사
 *
 * @param title - 강의 제목
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
export async function checkLectureDuplicate(
  title: string,
  subjectCategory: string | null,
  tenantId: string | null
): Promise<DuplicateCheckResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  let query = supabase
    .from("master_lectures")
    .select("id")
    .ilike("title", title.trim());

  // 테넌트 조건
  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  // 교과 조건 (있는 경우)
  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query.limit(1).single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`강의 중복 검사 실패: ${error.message}`);
  }

  return {
    isDuplicate: !!data,
    existingId: data?.id ?? null,
  };
}

/**
 * 교재 배치 중복 검사 (한 번의 쿼리로 여러 제목 검사)
 *
 * 입력된 제목 목록만 조회하여 성능 최적화 (전체 테이블 스캔 방지)
 *
 * @param titles - 검사할 제목 목록
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
export async function checkBookDuplicatesBatch(
  titles: string[],
  subjectCategory: string | null,
  tenantId: string | null
): Promise<BatchDuplicateCheckResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  if (titles.length === 0) {
    return { existingMap: new Map(), duplicateTitles: [] };
  }

  // 제목 정규화 (trim만, lowercase는 DB 비교용으로 별도 관리)
  const trimmedTitles = titles.map((t) => t.trim());

  let query = supabase
    .from("master_books")
    .select("id, title")
    .in("title", trimmedTitles); // 입력된 제목만 조회 (전체 스캔 방지)

  // 테넌트 조건
  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  // 교과 조건 (있는 경우)
  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`교재 배치 중복 검사 실패: ${error.message}`);
  }

  // 결과를 Map으로 변환
  const existingMap = new Map<string, string>();
  const duplicateTitles: string[] = [];

  if (data) {
    // DB 결과를 lowercase 기준으로 Map 생성
    const dbTitleMap = new Map<string, string>();
    for (const row of data) {
      dbTitleMap.set(row.title.toLowerCase(), row.id);
    }

    // 입력된 제목 중 중복인 것만 추출
    for (const title of titles) {
      const normalizedTitle = title.trim().toLowerCase();
      const existingId = dbTitleMap.get(normalizedTitle);
      if (existingId) {
        existingMap.set(title, existingId);
        duplicateTitles.push(title);
      }
    }
  }

  return { existingMap, duplicateTitles };
}

/**
 * 강의 배치 중복 검사 (한 번의 쿼리로 여러 제목 검사)
 *
 * 입력된 제목 목록만 조회하여 성능 최적화 (전체 테이블 스캔 방지)
 *
 * @param titles - 검사할 제목 목록
 * @param subjectCategory - 교과 (예: 수학)
 * @param tenantId - 테넌트 ID (null = 공유 카탈로그)
 */
export async function checkLectureDuplicatesBatch(
  titles: string[],
  subjectCategory: string | null,
  tenantId: string | null
): Promise<BatchDuplicateCheckResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Admin 클라이언트 생성 실패: Service Role Key가 설정되지 않았습니다.");
  }

  if (titles.length === 0) {
    return { existingMap: new Map(), duplicateTitles: [] };
  }

  // 제목 정규화 (trim만, lowercase는 DB 비교용으로 별도 관리)
  const trimmedTitles = titles.map((t) => t.trim());

  let query = supabase
    .from("master_lectures")
    .select("id, title")
    .in("title", trimmedTitles); // 입력된 제목만 조회 (전체 스캔 방지)

  // 테넌트 조건
  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  // 교과 조건 (있는 경우)
  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`강의 배치 중복 검사 실패: ${error.message}`);
  }

  // 결과를 Map으로 변환
  const existingMap = new Map<string, string>();
  const duplicateTitles: string[] = [];

  if (data) {
    // DB 결과를 lowercase 기준으로 Map 생성
    const dbTitleMap = new Map<string, string>();
    for (const row of data) {
      dbTitleMap.set(row.title.toLowerCase(), row.id);
    }

    // 입력된 제목 중 중복인 것만 추출
    for (const title of titles) {
      const normalizedTitle = title.trim().toLowerCase();
      const existingId = dbTitleMap.get(normalizedTitle);
      if (existingId) {
        existingMap.set(title, existingId);
        duplicateTitles.push(title);
      }
    }
  }

  return { existingMap, duplicateTitles };
}
