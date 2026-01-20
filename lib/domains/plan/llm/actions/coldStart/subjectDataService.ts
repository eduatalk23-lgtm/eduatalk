/**
 * Cold Start 교과/과목 데이터 서비스
 *
 * DB의 subject_groups/subjects 테이블에서 데이터를 조회하여
 * Cold Start 파이프라인에서 사용할 수 있는 형태로 제공합니다.
 *
 * - DB 조회 실패 시 하드코딩된 fallback 데이터 사용
 * - 캐싱을 통한 성능 최적화
 *
 * @module lib/domains/plan/llm/actions/coldStart/subjectDataService
 */

import {
  getSubjectGroups,
  getSubjectsByGroupName,
  type SubjectGroup,
  type Subject,
} from "@/lib/data/subjects";
import {
  SUPPORTED_SUBJECT_CATEGORIES,
  SUBJECTS_BY_CATEGORY,
  type SubjectCategory,
} from "./types";

// ============================================================================
// 타입 정의
// ============================================================================

export interface SubjectDataResult {
  /** 교과 목록 (DB 또는 fallback) */
  categories: string[];
  /** 교과별 과목 매핑 */
  subjectsByCategory: Record<string, string[]>;
  /** DB에서 가져왔는지 여부 */
  fromDatabase: boolean;
  /** 에러 메시지 (있는 경우) */
  error?: string;
}

// ============================================================================
// 캐시 (메모리 캐싱으로 반복 조회 최적화)
// ============================================================================

interface SubjectCache {
  categories: string[] | null;
  subjectsByCategory: Record<string, string[]> | null;
  lastFetched: number | null;
}

const cache: SubjectCache = {
  categories: null,
  subjectsByCategory: null,
  lastFetched: null,
};

// 캐시 유효 시간: 5분
const CACHE_TTL_MS = 5 * 60 * 1000;

function isCacheValid(): boolean {
  if (!cache.lastFetched) return false;
  return Date.now() - cache.lastFetched < CACHE_TTL_MS;
}

function clearCache(): void {
  cache.categories = null;
  cache.subjectsByCategory = null;
  cache.lastFetched = null;
}

// ============================================================================
// DB 교과명 → Cold Start 교과명 매핑
// ============================================================================

/**
 * DB의 교과명을 Cold Start에서 사용하는 표준 교과명으로 정규화
 *
 * DB: "사회(역사/도덕 포함)" → Cold Start: "사회"
 */
function normalizeSubjectCategory(dbName: string): string {
  // 괄호 안의 내용 제거
  const normalized = dbName.replace(/\s*\([^)]*\)\s*/g, "").trim();

  // 특수 매핑
  const mappings: Record<string, string> = {
    "사회(역사/도덕 포함)": "사회",
    사회: "사회",
  };

  return mappings[dbName] || normalized;
}

/**
 * Cold Start 교과명을 DB 교과명으로 변환
 *
 * Cold Start: "사회" → DB: "사회(역사/도덕 포함)"
 */
function denormalizeSubjectCategory(
  coldStartName: string,
  dbCategories: string[]
): string | null {
  // 정확히 일치하는 경우
  if (dbCategories.includes(coldStartName)) {
    return coldStartName;
  }

  // 정규화된 이름으로 매칭
  for (const dbName of dbCategories) {
    if (normalizeSubjectCategory(dbName) === coldStartName) {
      return dbName;
    }
  }

  return null;
}

// ============================================================================
// 메인 함수
// ============================================================================

/**
 * DB에서 교과/과목 데이터 조회
 *
 * @returns 교과 목록과 교과별 과목 매핑
 *
 * @example
 * const data = await getSubjectDataFromDB();
 * console.log(data.categories); // ["국어", "수학", "영어", ...]
 * console.log(data.subjectsByCategory["수학"]); // ["수학", "미적분", ...]
 */
export async function getSubjectDataFromDB(): Promise<SubjectDataResult> {
  // 캐시 확인
  if (isCacheValid() && cache.categories && cache.subjectsByCategory) {
    return {
      categories: cache.categories,
      subjectsByCategory: cache.subjectsByCategory,
      fromDatabase: true,
    };
  }

  try {
    // 1. 교과 그룹 조회
    const subjectGroups = await getSubjectGroups();

    if (!subjectGroups || subjectGroups.length === 0) {
      console.warn(
        "[subjectDataService] DB에서 교과 그룹을 찾을 수 없음, fallback 사용"
      );
      return getFallbackSubjectData("DB에 교과 그룹이 없습니다");
    }

    // 2. 각 교과의 과목 조회
    const categories: string[] = [];
    const subjectsByCategory: Record<string, string[]> = {};

    for (const group of subjectGroups) {
      const normalizedName = normalizeSubjectCategory(group.name);

      // Cold Start에서 지원하는 교과만 포함
      if (!isSupportedCategory(normalizedName)) {
        continue;
      }

      categories.push(normalizedName);

      // 해당 교과의 과목 조회
      const subjects = await getSubjectsByGroupName(group.name);
      subjectsByCategory[normalizedName] = subjects.map((s) => s.name);
    }

    // 3. 캐시 업데이트
    cache.categories = categories;
    cache.subjectsByCategory = subjectsByCategory;
    cache.lastFetched = Date.now();

    console.log(
      `[subjectDataService] DB에서 ${categories.length}개 교과, 총 ${Object.values(subjectsByCategory).flat().length}개 과목 로드`
    );

    return {
      categories,
      subjectsByCategory,
      fromDatabase: true,
    };
  } catch (error) {
    console.error("[subjectDataService] DB 조회 실패:", error);
    return getFallbackSubjectData(
      error instanceof Error ? error.message : "알 수 없는 오류"
    );
  }
}

/**
 * Fallback 데이터 반환 (DB 조회 실패 시)
 */
function getFallbackSubjectData(reason: string): SubjectDataResult {
  console.warn(`[subjectDataService] Fallback 사용: ${reason}`);

  return {
    categories: [...SUPPORTED_SUBJECT_CATEGORIES],
    subjectsByCategory: { ...SUBJECTS_BY_CATEGORY },
    fromDatabase: false,
    error: reason,
  };
}

/**
 * 지원하는 교과인지 확인
 */
function isSupportedCategory(name: string): boolean {
  return (SUPPORTED_SUBJECT_CATEGORIES as readonly string[]).includes(name);
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 특정 교과의 과목 목록 조회
 *
 * @param subjectCategory 교과명 (예: "수학")
 * @returns 과목 목록 (예: ["수학", "미적분", "확률과 통계", ...])
 */
export async function getSubjectsForCategory(
  subjectCategory: string
): Promise<string[]> {
  const data = await getSubjectDataFromDB();
  return data.subjectsByCategory[subjectCategory] || [];
}

/**
 * 유효한 교과인지 검증 (DB 기반)
 *
 * @param subjectCategory 검증할 교과명
 * @returns 유효 여부
 */
export async function isValidSubjectCategory(
  subjectCategory: string
): Promise<boolean> {
  const data = await getSubjectDataFromDB();
  return data.categories.includes(subjectCategory);
}

/**
 * 유효한 과목인지 검증 (DB 기반)
 *
 * @param subjectCategory 교과명
 * @param subject 과목명
 * @returns 유효 여부
 */
export async function isValidSubject(
  subjectCategory: string,
  subject: string
): Promise<boolean> {
  const subjects = await getSubjectsForCategory(subjectCategory);
  return subjects.includes(subject);
}

/**
 * UI용 교과 목록 반환
 * 드롭다운 등에서 사용
 */
export async function getSubjectCategoriesForUI(): Promise<
  Array<{ value: string; label: string }>
> {
  const data = await getSubjectDataFromDB();
  return data.categories.map((cat) => ({
    value: cat,
    label: cat,
  }));
}

/**
 * UI용 과목 목록 반환
 * 드롭다운 등에서 사용
 */
export async function getSubjectsForUI(
  subjectCategory: string
): Promise<Array<{ value: string; label: string }>> {
  const subjects = await getSubjectsForCategory(subjectCategory);
  return subjects.map((sub) => ({
    value: sub,
    label: sub,
  }));
}

/**
 * 캐시 강제 초기화 (테스트용)
 */
export function resetSubjectDataCache(): void {
  clearCache();
}

// ============================================================================
// 동기 버전 (초기 로드 전 사용)
// ============================================================================

/**
 * 동기 버전: 지원하는 교과 목록 반환
 *
 * DB 조회 없이 하드코딩된 값 반환 (빠른 초기 렌더링용)
 * 비동기 버전 사용을 권장합니다.
 */
export function getSupportedSubjectCategoriesSync(): readonly string[] {
  // 캐시가 있으면 캐시 사용
  if (cache.categories) {
    return cache.categories;
  }
  return SUPPORTED_SUBJECT_CATEGORIES;
}

/**
 * 동기 버전: 교과별 과목 매핑 반환
 *
 * DB 조회 없이 하드코딩된 값 반환 (빠른 초기 렌더링용)
 * 비동기 버전 사용을 권장합니다.
 */
export function getSubjectsByCategorySync(): Record<string, string[]> {
  // 캐시가 있으면 캐시 사용
  if (cache.subjectsByCategory) {
    return cache.subjectsByCategory;
  }
  return SUBJECTS_BY_CATEGORY;
}
