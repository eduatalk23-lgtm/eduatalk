/**
 * 강사 조회 및 추천 함수
 *
 * master_instructors 테이블에서 강사 정보를 조회하고
 * 학생 유형/교과/스타일에 맞는 강사를 추천합니다.
 *
 * 주요 기능:
 * - 교과/과목별 강사 조회
 * - 강의 스타일/난이도별 필터링
 * - 리뷰 점수 기반 정렬
 * - 학생 유형별 추천
 * - 강사별 강의 목록 조회
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 강사 조회 옵션
 */
export interface InstructorQueryOptions {
  /** 교과 (예: 수학, 영어) */
  subjectCategory?: string;

  /** 과목 (예: 미적분, 영어독해) */
  subject?: string;

  /** 플랫폼 (예: 메가스터디, 이투스) */
  platform?: string;

  /** 강의 스타일 */
  teachingStyle?: "개념형" | "문풀형" | "속성형" | "심화형" | "균형형" | string;

  /** 주력 난이도 */
  difficultyFocus?: "개념" | "기본" | "심화" | "최상위" | string;

  /** 대상 학생 유형 (하나라도 일치하면 포함) */
  targetStudentTypes?: string[];

  /** 최소 리뷰 점수 (5점 만점) */
  minReviewScore?: number;

  /** 최대 결과 수 */
  limit?: number;

  /** 테넌트 ID (null = 공유 카탈로그) */
  tenantId?: string | null;

  /** 정렬 기준 */
  orderBy?: "review_score" | "review_count" | "name" | "created_at";

  /** 정렬 방향 */
  orderDirection?: "asc" | "desc";
}

/**
 * 강사 정보 결과
 */
export interface InstructorResult {
  id: string;
  name: string;
  platform: string | null;
  profileSummary: string | null;
  profileImageUrl: string | null;
  subjectCategories: string[];
  subjects: string[];
  specialty: string | null;
  teachingStyle: string | null;
  difficultyFocus: string | null;
  lecturePace: string | null;
  explanationStyle: string | null;
  reviewScore: number | null;
  reviewCount: number;
  targetStudents: string[];
  strengths: string[];
  weaknesses: string[];
  instructorMetadata: InstructorMetadata | null;
}

/**
 * 강사 메타데이터 (JSONB)
 */
export interface InstructorMetadata {
  career?: {
    years?: number;
    highlights?: string[];
  };
  reviews?: {
    positives?: string[];
    negatives?: string[];
    keywords?: string[];
  };
  statistics?: {
    totalLectures?: number;
    avgRating?: number;
  };
  recommendations?: {
    reasons?: string[];
    targetStudents?: string[];
  };
  meta?: {
    collectedAt?: string;
    sources?: string[];
    reliability?: number;
  };
}

/**
 * 강사별 강의 목록
 */
export interface InstructorWithLectures extends InstructorResult {
  lectures: Array<{
    id: string;
    title: string;
    totalEpisodes: number;
    totalDuration: number | null;
    difficultyLevel: string | null;
    reviewScore: number | null;
  }>;
}

/**
 * 강사 추천 결과
 */
export interface InstructorRecommendationResult {
  instructors: InstructorResult[];
  totalCount: number;
}

// ============================================================================
// 조회 함수
// ============================================================================

/**
 * 강사 목록 조회
 *
 * @param options - 조회 옵션
 * @returns 강사 목록
 *
 * @example
 * // 수학 개념형 강사 조회
 * const instructors = await getInstructors({
 *   subjectCategory: "수학",
 *   teachingStyle: "개념형",
 *   minReviewScore: 4.0,
 *   limit: 10
 * });
 */
export async function getInstructors(
  options: InstructorQueryOptions = {}
): Promise<InstructorRecommendationResult> {
  const supabase = await createSupabaseServerClient();

  const {
    subjectCategory,
    subject,
    platform,
    teachingStyle,
    difficultyFocus,
    targetStudentTypes,
    minReviewScore,
    limit = 20,
    tenantId,
    orderBy = "review_score",
    orderDirection = "desc",
  } = options;

  let query = supabase
    .from("master_instructors")
    .select(
      `
      id, name, platform, profile_summary, profile_image_url,
      subject_categories, subjects, specialty,
      teaching_style, difficulty_focus, lecture_pace, explanation_style,
      review_score, review_count, target_students,
      strengths, weaknesses, instructor_metadata
    `
    )
    .eq("is_active", true)
    .order(orderBy, {
      ascending: orderDirection === "asc",
      nullsFirst: false,
    });

  // 필터 적용
  if (tenantId !== undefined) {
    query = tenantId === null
      ? query.is("tenant_id", null)
      : query.eq("tenant_id", tenantId);
  }

  if (subjectCategory) {
    query = query.contains("subject_categories", [subjectCategory]);
  }

  if (subject) {
    query = query.contains("subjects", [subject]);
  }

  if (platform) {
    query = query.eq("platform", platform);
  }

  if (teachingStyle) {
    query = query.eq("teaching_style", teachingStyle);
  }

  if (difficultyFocus) {
    query = query.eq("difficulty_focus", difficultyFocus);
  }

  if (minReviewScore) {
    query = query.gte("review_score", minReviewScore);
  }

  if (targetStudentTypes && targetStudentTypes.length > 0) {
    query = query.overlaps("target_students", targetStudentTypes);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[getInstructors] query error:", error);
    return { instructors: [], totalCount: 0 };
  }

  const instructors = (data ?? []).map(mapToInstructorResult);

  return {
    instructors,
    totalCount: instructors.length,
  };
}

/**
 * 강사 ID로 상세 정보 조회
 *
 * @param instructorId - 강사 ID
 * @returns 강사 정보 또는 null
 */
export async function getInstructorById(
  instructorId: string
): Promise<InstructorResult | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_instructors")
    .select(
      `
      id, name, platform, profile_summary, profile_image_url,
      subject_categories, subjects, specialty,
      teaching_style, difficulty_focus, lecture_pace, explanation_style,
      review_score, review_count, target_students,
      strengths, weaknesses, instructor_metadata
    `
    )
    .eq("id", instructorId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  return mapToInstructorResult(data);
}

/**
 * 강사별 강의 목록 조회
 *
 * @param instructorId - 강사 ID
 * @returns 강사 정보 + 강의 목록
 */
export async function getInstructorWithLectures(
  instructorId: string
): Promise<InstructorWithLectures | null> {
  const supabase = await createSupabaseServerClient();

  // 강사 정보 조회
  const instructor = await getInstructorById(instructorId);
  if (!instructor) {
    return null;
  }

  // 강의 목록 조회
  const { data: lectures, error } = await supabase
    .from("master_lectures")
    .select(
      `
      id, title, total_episodes, total_duration,
      difficulty_level, review_score
    `
    )
    .eq("instructor_id", instructorId)
    .eq("is_active", true)
    .order("review_score", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[getInstructorWithLectures] lectures query error:", error);
    return { ...instructor, lectures: [] };
  }

  return {
    ...instructor,
    lectures: (lectures ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      totalEpisodes: row.total_episodes,
      totalDuration: row.total_duration,
      difficultyLevel: row.difficulty_level,
      reviewScore: row.review_score,
    })),
  };
}

/**
 * 플랫폼별 강사 목록 조회
 *
 * @param platform - 플랫폼명
 * @param options - 추가 옵션
 * @returns 강사 목록
 */
export async function getInstructorsByPlatform(
  platform: string,
  options: Omit<InstructorQueryOptions, "platform"> = {}
): Promise<InstructorRecommendationResult> {
  return getInstructors({
    ...options,
    platform,
  });
}

/**
 * 고평점 강사 조회
 *
 * @param subjectCategory - 교과
 * @param options - 추가 옵션
 * @returns 고평점 강사 목록
 *
 * @example
 * const result = await getTopRatedInstructors("수학", {
 *   difficultyFocus: "개념",
 *   limit: 5
 * });
 */
export async function getTopRatedInstructors(
  subjectCategory: string,
  options: Omit<InstructorQueryOptions, "subjectCategory"> = {}
): Promise<InstructorRecommendationResult> {
  return getInstructors({
    ...options,
    subjectCategory,
    minReviewScore: options.minReviewScore ?? 4.0,
    orderBy: "review_score",
    orderDirection: "desc",
  });
}

/**
 * 학생 유형에 맞는 강사 추천
 *
 * @param studentType - 학생 유형 (예: "수능 준비생", "기초가 부족한 학생")
 * @param options - 추가 옵션
 * @returns 추천 강사 목록
 *
 * @example
 * const result = await getInstructorsForStudentType("기초가 부족한 학생", {
 *   subjectCategory: "수학",
 *   teachingStyle: "개념형"
 * });
 */
export async function getInstructorsForStudentType(
  studentType: string,
  options: Omit<InstructorQueryOptions, "targetStudentTypes"> = {}
): Promise<InstructorRecommendationResult> {
  return getInstructors({
    ...options,
    targetStudentTypes: [studentType],
  });
}

/**
 * 강의 스타일로 강사 검색
 *
 * @param teachingStyle - 강의 스타일
 * @param options - 추가 옵션
 * @returns 강사 목록
 */
export async function getInstructorsByStyle(
  teachingStyle: InstructorQueryOptions["teachingStyle"],
  options: Omit<InstructorQueryOptions, "teachingStyle"> = {}
): Promise<InstructorRecommendationResult> {
  return getInstructors({
    ...options,
    teachingStyle,
  });
}

/**
 * 강사 검색 (이름 포함)
 *
 * @param searchTerm - 검색어 (이름에 포함)
 * @param options - 추가 옵션
 * @returns 검색 결과
 */
export async function searchInstructors(
  searchTerm: string,
  options: InstructorQueryOptions = {}
): Promise<InstructorRecommendationResult> {
  const supabase = await createSupabaseServerClient();

  const {
    subjectCategory,
    platform,
    limit = 20,
    tenantId,
  } = options;

  let query = supabase
    .from("master_instructors")
    .select(
      `
      id, name, platform, profile_summary, profile_image_url,
      subject_categories, subjects, specialty,
      teaching_style, difficulty_focus, lecture_pace, explanation_style,
      review_score, review_count, target_students,
      strengths, weaknesses, instructor_metadata
    `
    )
    .eq("is_active", true)
    .ilike("name", `%${searchTerm}%`)
    .order("review_score", { ascending: false, nullsFirst: false });

  // 필터 적용
  if (tenantId !== undefined) {
    query = tenantId === null
      ? query.is("tenant_id", null)
      : query.eq("tenant_id", tenantId);
  }

  if (subjectCategory) {
    query = query.contains("subject_categories", [subjectCategory]);
  }

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[searchInstructors] query error:", error);
    return { instructors: [], totalCount: 0 };
  }

  const instructors = (data ?? []).map(mapToInstructorResult);

  return {
    instructors,
    totalCount: instructors.length,
  };
}

/**
 * 강사 추천 이유 목록 조회 (UI 표시용)
 *
 * @param instructorId - 강사 ID
 * @returns 추천 이유 문자열 배열
 */
export async function getInstructorRecommendationReasons(
  instructorId: string
): Promise<string[]> {
  const instructor = await getInstructorById(instructorId);

  if (!instructor) {
    return [];
  }

  const reasons: string[] = [];

  // 메타데이터에서 추천 이유 추출
  if (instructor.instructorMetadata?.recommendations?.reasons) {
    reasons.push(...instructor.instructorMetadata.recommendations.reasons);
  }

  // 강점을 추천 이유로 추가
  if (instructor.strengths.length > 0) {
    reasons.push(...instructor.strengths.slice(0, 3));
  }

  return reasons;
}

/**
 * 사용 가능한 플랫폼 목록 조회
 *
 * @returns 플랫폼 이름 배열
 */
export async function getAvailablePlatforms(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_distinct_instructor_platforms");

  if (error) {
    console.error("[getAvailablePlatforms] RPC error:", error);
    return [];
  }

  return (data ?? []).map((row: { platform: string }) => row.platform);
}

/**
 * 교과별 강사 수 통계
 *
 * @returns 교과별 강사 수
 */
export async function getInstructorCountBySubject(): Promise<Map<string, number>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_instructor_count_by_subject");

  if (error) {
    console.error("[getInstructorCountBySubject] RPC error:", error);
    return new Map();
  }

  const countMap = new Map<string, number>();

  for (const row of data ?? []) {
    const { subject_category, instructor_count } = row as {
      subject_category: string;
      instructor_count: number;
    };
    countMap.set(subject_category, instructor_count);
  }

  return countMap;
}

// ============================================================================
// 내부 헬퍼 함수
// ============================================================================

/**
 * DB 행을 InstructorResult로 변환
 */
function mapToInstructorResult(row: {
  id: string;
  name: string;
  platform: string | null;
  profile_summary: string | null;
  profile_image_url: string | null;
  subject_categories: string[] | null;
  subjects: string[] | null;
  specialty: string | null;
  teaching_style: string | null;
  difficulty_focus: string | null;
  lecture_pace: string | null;
  explanation_style: string | null;
  review_score: number | null;
  review_count: number | null;
  target_students: string[] | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  instructor_metadata: Json | null;
}): InstructorResult {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    profileSummary: row.profile_summary,
    profileImageUrl: row.profile_image_url,
    subjectCategories: row.subject_categories ?? [],
    subjects: row.subjects ?? [],
    specialty: row.specialty,
    teachingStyle: row.teaching_style,
    difficultyFocus: row.difficulty_focus,
    lecturePace: row.lecture_pace,
    explanationStyle: row.explanation_style,
    reviewScore: row.review_score,
    reviewCount: row.review_count ?? 0,
    targetStudents: row.target_students ?? [],
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
    instructorMetadata: parseInstructorMetadata(row.instructor_metadata),
  };
}

/**
 * JSON 필드를 InstructorMetadata로 파싱
 */
function parseInstructorMetadata(
  json: Json | null
): InstructorMetadata | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return null;
  }

  return json as unknown as InstructorMetadata;
}
