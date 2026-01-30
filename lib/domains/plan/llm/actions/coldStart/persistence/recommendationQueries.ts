/**
 * 맞춤 추천 쿼리 함수
 *
 * 저장된 추천 메타데이터를 활용하여 학생 유형별 맞춤 콘텐츠를 조회합니다.
 *
 * 주요 기능:
 * - 대상 학생 유형별 필터링 (target_students)
 * - 리뷰 점수 기반 정렬 (review_score)
 * - 교과/난이도 필터링
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContentType, RecommendationMetadata } from "../types";
import type { Json } from "@/lib/supabase/database.types";

/**
 * 맞춤 추천 조회 옵션
 */
export interface PersonalizedRecommendationOptions {
  /** 교과 (예: 수학, 영어) */
  subjectCategory?: string;

  /** 과목 (예: 미적분, 영어독해) */
  subject?: string;

  /** 난이도 레벨 */
  difficultyLevel?: string;

  /** 콘텐츠 타입 */
  contentType?: ContentType;

  /** 대상 학생 유형 (하나라도 일치하면 포함) */
  targetStudentTypes?: string[];

  /** 최소 리뷰 점수 (5점 만점) */
  minReviewScore?: number;

  /** 최대 결과 수 */
  limit?: number;

  /** 테넌트 ID (null = 공유 카탈로그) */
  tenantId?: string | null;
}

/**
 * 추천 콘텐츠 결과 (교재)
 */
export interface RecommendedBook {
  id: string;
  title: string;
  author: string | null;
  publisherName: string | null;
  totalPages: number | null;
  subjectCategory: string | null;
  subject: string | null;
  difficultyLevel: string | null;
  reviewScore: number | null;
  reviewCount: number;
  targetStudents: string[];
  recommendationMetadata: RecommendationMetadata | null;
}

/**
 * 추천 콘텐츠 결과 (강의)
 */
export interface RecommendedLecture {
  id: string;
  title: string;
  instructorName: string | null;
  platform: string | null;
  totalEpisodes: number;
  totalDuration: number | null;
  subjectCategory: string | null;
  subject: string | null;
  difficultyLevel: string | null;
  reviewScore: number | null;
  reviewCount: number;
  targetStudents: string[];
  recommendationMetadata: RecommendationMetadata | null;
}

/**
 * 맞춤 추천 결과
 */
export interface PersonalizedRecommendationResult {
  books: RecommendedBook[];
  lectures: RecommendedLecture[];
  totalCount: number;
}

/**
 * 대상 학생 유형별 맞춤 콘텐츠 조회
 *
 * @param options - 조회 옵션
 * @returns 맞춤 추천 결과
 *
 * @example
 * // 수능 준비생을 위한 수학 심화 콘텐츠 조회
 * const result = await getPersonalizedRecommendations({
 *   subjectCategory: "수학",
 *   difficultyLevel: "심화",
 *   targetStudentTypes: ["수능 준비생"],
 *   minReviewScore: 4.0,
 *   limit: 10
 * });
 */
export async function getPersonalizedRecommendations(
  options: PersonalizedRecommendationOptions
): Promise<PersonalizedRecommendationResult> {
  const { contentType } = options;

  const supabase = await createSupabaseServerClient();

  // 병렬로 교재/강의 조회
  const [books, lectures] = await Promise.all([
    !contentType || contentType === "book"
      ? fetchBooks(supabase, options)
      : Promise.resolve([]),
    !contentType || contentType === "lecture"
      ? fetchLectures(supabase, options)
      : Promise.resolve([]),
  ]);

  return {
    books,
    lectures,
    totalCount: books.length + lectures.length,
  };
}

/**
 * 교재 조회 내부 함수
 */
async function fetchBooks(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  options: PersonalizedRecommendationOptions
): Promise<RecommendedBook[]> {
  const {
    subjectCategory,
    subject,
    difficultyLevel,
    targetStudentTypes,
    minReviewScore,
    limit = 10,
    tenantId,
  } = options;

  let query = supabase
    .from("master_books")
    .select(
      `
      id, title, author, publisher_name, total_pages,
      subject_category, subject, difficulty_level,
      review_score, review_count, target_students,
      recommendation_metadata
    `
    )
    .eq("is_active", true)
    .order("review_score", { ascending: false, nullsFirst: false });

  // 필터 적용
  if (tenantId !== undefined) {
    query = tenantId === null
      ? query.is("tenant_id", null)
      : query.eq("tenant_id", tenantId);
  }

  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  if (subject) {
    query = query.eq("subject", subject);
  }

  if (difficultyLevel) {
    query = query.eq("difficulty_level", difficultyLevel);
  }

  if (minReviewScore) {
    query = query.gte("review_score", minReviewScore);
  }

  if (targetStudentTypes && targetStudentTypes.length > 0) {
    query = query.overlaps("target_students", targetStudentTypes);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[getPersonalizedRecommendations] book query error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    publisherName: row.publisher_name,
    totalPages: row.total_pages,
    subjectCategory: row.subject_category,
    subject: row.subject,
    difficultyLevel: row.difficulty_level,
    reviewScore: row.review_score,
    reviewCount: row.review_count ?? 0,
    targetStudents: row.target_students ?? [],
    recommendationMetadata: parseRecommendationMetadata(row.recommendation_metadata),
  }));
}

/**
 * 강의 조회 내부 함수
 */
async function fetchLectures(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  options: PersonalizedRecommendationOptions
): Promise<RecommendedLecture[]> {
  const {
    subjectCategory,
    subject,
    difficultyLevel,
    targetStudentTypes,
    minReviewScore,
    limit = 10,
    tenantId,
  } = options;

  let query = supabase
    .from("master_lectures")
    .select(
      `
      id, title, instructor_name, platform, total_episodes, total_duration,
      subject_category, subject, difficulty_level,
      review_score, review_count, target_students,
      recommendation_metadata
    `
    )
    .eq("is_active", true)
    .order("review_score", { ascending: false, nullsFirst: false });

  // 필터 적용
  if (tenantId !== undefined) {
    query = tenantId === null
      ? query.is("tenant_id", null)
      : query.eq("tenant_id", tenantId);
  }

  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  if (subject) {
    query = query.eq("subject", subject);
  }

  if (difficultyLevel) {
    query = query.eq("difficulty_level", difficultyLevel);
  }

  if (minReviewScore) {
    query = query.gte("review_score", minReviewScore);
  }

  if (targetStudentTypes && targetStudentTypes.length > 0) {
    query = query.overlaps("target_students", targetStudentTypes);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[getPersonalizedRecommendations] lecture query error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    instructorName: row.instructor_name,
    platform: row.platform,
    totalEpisodes: row.total_episodes,
    totalDuration: row.total_duration,
    subjectCategory: row.subject_category,
    subject: row.subject,
    difficultyLevel: row.difficulty_level,
    reviewScore: row.review_score,
    reviewCount: row.review_count ?? 0,
    targetStudents: row.target_students ?? [],
    recommendationMetadata: parseRecommendationMetadata(row.recommendation_metadata),
  }));
}

/**
 * 고평점 콘텐츠 조회 (리뷰 점수 기반)
 *
 * @param subjectCategory - 교과
 * @param options - 추가 옵션
 * @returns 고평점 콘텐츠 목록
 *
 * @example
 * const result = await getTopRatedContent("수학", {
 *   difficultyLevel: "기본",
 *   limit: 5
 * });
 */
export async function getTopRatedContent(
  subjectCategory: string,
  options: Omit<PersonalizedRecommendationOptions, "subjectCategory"> = {}
): Promise<PersonalizedRecommendationResult> {
  return getPersonalizedRecommendations({
    ...options,
    subjectCategory,
    minReviewScore: options.minReviewScore ?? 4.0,
  });
}

/**
 * 학생 유형에 맞는 콘텐츠 조회
 *
 * @param studentType - 학생 유형 (예: "수능 준비생", "내신 준비생")
 * @param options - 추가 옵션
 * @returns 맞춤 콘텐츠 목록
 *
 * @example
 * const result = await getContentForStudentType("수능 준비생", {
 *   subjectCategory: "영어",
 *   contentType: "lecture"
 * });
 */
export async function getContentForStudentType(
  studentType: string,
  options: Omit<PersonalizedRecommendationOptions, "targetStudentTypes"> = {}
): Promise<PersonalizedRecommendationResult> {
  return getPersonalizedRecommendations({
    ...options,
    targetStudentTypes: [studentType],
  });
}

/**
 * 콘텐츠 ID로 추천 메타데이터 조회
 *
 * @param contentType - 콘텐츠 타입
 * @param contentId - 콘텐츠 ID
 * @returns 추천 메타데이터 또는 null
 */
export async function getRecommendationMetadataById(
  contentType: ContentType,
  contentId: string
): Promise<RecommendationMetadata | null> {
  const supabase = await createSupabaseServerClient();
  const table = contentType === "book" ? "master_books" : "master_lectures";

  const { data, error } = await supabase
    .from(table)
    .select("recommendation_metadata")
    .eq("id", contentId)
    .single();

  if (error || !data) {
    return null;
  }

  return parseRecommendationMetadata(data.recommendation_metadata);
}

/**
 * 추천 이유 목록 조회 (UI 표시용)
 *
 * @param contentType - 콘텐츠 타입
 * @param contentId - 콘텐츠 ID
 * @returns 추천 이유 문자열 배열
 */
export async function getRecommendationReasons(
  contentType: ContentType,
  contentId: string
): Promise<string[]> {
  const metadata = await getRecommendationMetadataById(contentType, contentId);

  if (!metadata?.recommendation?.reasons) {
    return [];
  }

  return metadata.recommendation.reasons.map((r) => r.text);
}

// ============================================================================
// 내부 헬퍼 함수
// ============================================================================

/**
 * JSON 필드를 RecommendationMetadata로 파싱
 */
function parseRecommendationMetadata(
  json: Json | null
): RecommendationMetadata | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return null;
  }

  // JSON 객체를 RecommendationMetadata로 타입 캐스팅
  // 런타임에서 구조 검증은 생략 (DB에서 가져온 데이터 신뢰)
  return json as unknown as RecommendationMetadata;
}

// ============================================================================
// 어드민 교재 추천 관리 조회 함수
// ============================================================================

/**
 * 교재 추천 조회 옵션 (어드민용)
 */
export interface BookRecommendationQueryOptions {
  /** 교과 */
  subjectCategory?: string;
  /** 과목 */
  subject?: string;
  /** 난이도 */
  difficultyLevel?: string;
  /** 출판사 */
  publisher?: string;
  /** 최대 결과 수 */
  limit?: number;
  /** 정렬 기준 */
  orderBy?: "review_score" | "review_count" | "title" | "created_at";
  /** 정렬 방향 */
  orderDirection?: "asc" | "desc";
}

/**
 * 교재 추천 상세 정보 (상세 페이지용)
 */
export interface BookRecommendationDetail extends RecommendedBook {
  /** 목차 정보 */
  chapters: Array<{
    title: string;
    startRange: number;
    endRange: number;
    duration?: number;
  }>;
  /** 장점 */
  strengths: string[];
  /** 단점 */
  weaknesses: string[];
  /** 생성 일시 */
  createdAt: string;
}

/**
 * 교재 추천 목록 결과
 */
export interface BookRecommendationResult {
  books: RecommendedBook[];
  totalCount: number;
}

/**
 * 교재 추천 목록 조회 (어드민용)
 *
 * @param options - 조회 옵션
 * @returns 교재 추천 목록
 */
export async function getBookRecommendations(
  options: BookRecommendationQueryOptions = {}
): Promise<BookRecommendationResult> {
  const supabase = await createSupabaseServerClient();

  const {
    subjectCategory,
    subject,
    difficultyLevel,
    publisher,
    limit = 50,
    orderBy = "review_score",
    orderDirection = "desc",
  } = options;

  let query = supabase
    .from("master_books")
    .select(
      `
      id, title, author, publisher_name, total_pages,
      subject_category, subject, difficulty_level,
      review_score, review_count, target_students,
      recommendation_metadata
    `
    )
    .eq("is_active", true)
    .not("recommendation_metadata", "is", null)
    .order(orderBy === "title" ? "title" : orderBy, {
      ascending: orderDirection === "asc",
      nullsFirst: false,
    });

  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  if (subject) {
    query = query.eq("subject", subject);
  }

  if (difficultyLevel) {
    query = query.eq("difficulty_level", difficultyLevel);
  }

  if (publisher) {
    query = query.eq("publisher_name", publisher);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[getBookRecommendations] query error:", error);
    return { books: [], totalCount: 0 };
  }

  const books = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    publisherName: row.publisher_name,
    totalPages: row.total_pages,
    subjectCategory: row.subject_category,
    subject: row.subject,
    difficultyLevel: row.difficulty_level,
    reviewScore: row.review_score,
    reviewCount: row.review_count ?? 0,
    targetStudents: row.target_students ?? [],
    recommendationMetadata: parseRecommendationMetadata(row.recommendation_metadata),
  }));

  return { books, totalCount: books.length };
}

/**
 * 교재 추천 상세 조회
 *
 * @param bookId - 교재 ID
 * @returns 교재 상세 정보
 */
export async function getBookRecommendationById(
  bookId: string
): Promise<BookRecommendationDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_books")
    .select(
      `
      id, title, author, publisher_name, total_pages,
      subject_category, subject, difficulty_level,
      review_score, review_count, target_students,
      recommendation_metadata, page_analysis, created_at
    `
    )
    .eq("id", bookId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  const metadata = parseRecommendationMetadata(data.recommendation_metadata);
  const pageAnalysis = data.page_analysis as {
    chapters?: Array<{
      title: string;
      startRange: number;
      endRange: number;
      duration?: number;
    }>;
  } | null;

  return {
    id: data.id,
    title: data.title,
    author: data.author,
    publisherName: data.publisher_name,
    totalPages: data.total_pages,
    subjectCategory: data.subject_category,
    subject: data.subject,
    difficultyLevel: data.difficulty_level,
    reviewScore: data.review_score,
    reviewCount: data.review_count ?? 0,
    targetStudents: data.target_students ?? [],
    recommendationMetadata: metadata,
    chapters: pageAnalysis?.chapters ?? [],
    strengths: metadata?.characteristics?.strengths ?? [],
    weaknesses: metadata?.characteristics?.weaknesses ?? [],
    createdAt: data.created_at,
  };
}

/**
 * 교재 검색 (어드민용)
 *
 * @param searchTerm - 검색어 (제목, 저자)
 * @param options - 추가 옵션
 * @returns 검색 결과
 */
export async function searchBookRecommendations(
  searchTerm: string,
  options: BookRecommendationQueryOptions = {}
): Promise<BookRecommendationResult> {
  const supabase = await createSupabaseServerClient();

  const {
    subjectCategory,
    difficultyLevel,
    publisher,
    limit = 50,
  } = options;

  // 검색어 이스케이프 (SQL injection 방지)
  const escapedTerm = searchTerm.replace(/[%_\\]/g, "\\$&");
  const searchPattern = `%${escapedTerm}%`;

  let query = supabase
    .from("master_books")
    .select(
      `
      id, title, author, publisher_name, total_pages,
      subject_category, subject, difficulty_level,
      review_score, review_count, target_students,
      recommendation_metadata
    `
    )
    .eq("is_active", true)
    .not("recommendation_metadata", "is", null)
    .or(`title.ilike.${searchPattern},author.ilike.${searchPattern}`)
    .order("review_score", { ascending: false, nullsFirst: false });

  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  if (difficultyLevel) {
    query = query.eq("difficulty_level", difficultyLevel);
  }

  if (publisher) {
    query = query.eq("publisher_name", publisher);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[searchBookRecommendations] query error:", error);
    return { books: [], totalCount: 0 };
  }

  const books = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    publisherName: row.publisher_name,
    totalPages: row.total_pages,
    subjectCategory: row.subject_category,
    subject: row.subject,
    difficultyLevel: row.difficulty_level,
    reviewScore: row.review_score,
    reviewCount: row.review_count ?? 0,
    targetStudents: row.target_students ?? [],
    recommendationMetadata: parseRecommendationMetadata(row.recommendation_metadata),
  }));

  return { books, totalCount: books.length };
}

/**
 * 추천 교재의 출판사 목록 조회
 */
export async function getAvailablePublishersForRecommendations(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_books")
    .select("publisher_name")
    .eq("is_active", true)
    .not("recommendation_metadata", "is", null)
    .not("publisher_name", "is", null);

  if (error) {
    console.error("[getAvailablePublishersForRecommendations] query error:", error);
    return [];
  }

  const publishers = new Set<string>();
  for (const row of data ?? []) {
    if (row.publisher_name) {
      publishers.add(row.publisher_name);
    }
  }

  return Array.from(publishers).sort();
}

// ============================================================================
// 어드민 강의 추천 관리 조회 함수
// ============================================================================

/**
 * 강의 추천 조회 옵션 (어드민용)
 */
export interface LectureRecommendationQueryOptions {
  /** 교과 */
  subjectCategory?: string;
  /** 과목 */
  subject?: string;
  /** 난이도 */
  difficultyLevel?: string;
  /** 플랫폼 */
  platform?: string;
  /** 최대 결과 수 */
  limit?: number;
  /** 정렬 기준 */
  orderBy?: "review_score" | "review_count" | "title" | "created_at";
  /** 정렬 방향 */
  orderDirection?: "asc" | "desc";
}

/**
 * 강의 추천 상세 정보 (상세 페이지용)
 */
export interface LectureRecommendationDetail extends RecommendedLecture {
  /** 강사 ID */
  instructorId: string | null;
  /** 에피소드 목록 */
  episodes: Array<{
    title: string;
    episodeNumber: number;
    duration?: number;
  }>;
  /** 장점 */
  strengths: string[];
  /** 단점 */
  weaknesses: string[];
  /** 생성 일시 */
  createdAt: string;
}

/**
 * 강의 추천 목록 결과
 */
export interface LectureRecommendationResult {
  lectures: RecommendedLecture[];
  totalCount: number;
}

/**
 * 강의 추천 목록 조회 (어드민용)
 *
 * @param options - 조회 옵션
 * @returns 강의 추천 목록
 */
export async function getLectureRecommendations(
  options: LectureRecommendationQueryOptions = {}
): Promise<LectureRecommendationResult> {
  const supabase = await createSupabaseServerClient();

  const {
    subjectCategory,
    subject,
    difficultyLevel,
    platform,
    limit = 50,
    orderBy = "review_score",
    orderDirection = "desc",
  } = options;

  let query = supabase
    .from("master_lectures")
    .select(
      `
      id, title, instructor_name, platform, total_episodes, total_duration,
      subject_category, subject, difficulty_level,
      review_score, review_count, target_students,
      recommendation_metadata
    `
    )
    .eq("is_active", true)
    .not("recommendation_metadata", "is", null)
    .order(orderBy === "title" ? "title" : orderBy, {
      ascending: orderDirection === "asc",
      nullsFirst: false,
    });

  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  if (subject) {
    query = query.eq("subject", subject);
  }

  if (difficultyLevel) {
    query = query.eq("difficulty_level", difficultyLevel);
  }

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[getLectureRecommendations] query error:", error);
    return { lectures: [], totalCount: 0 };
  }

  const lectures = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    instructorName: row.instructor_name,
    platform: row.platform,
    totalEpisodes: row.total_episodes,
    totalDuration: row.total_duration,
    subjectCategory: row.subject_category,
    subject: row.subject,
    difficultyLevel: row.difficulty_level,
    reviewScore: row.review_score,
    reviewCount: row.review_count ?? 0,
    targetStudents: row.target_students ?? [],
    recommendationMetadata: parseRecommendationMetadata(row.recommendation_metadata),
  }));

  return { lectures, totalCount: lectures.length };
}

/**
 * 강의 추천 상세 조회
 *
 * @param lectureId - 강의 ID
 * @returns 강의 상세 정보
 */
export async function getLectureRecommendationById(
  lectureId: string
): Promise<LectureRecommendationDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_lectures")
    .select(
      `
      id, title, instructor_name, instructor_id, platform, total_episodes, total_duration,
      subject_category, subject, difficulty_level,
      review_score, review_count, target_students,
      recommendation_metadata, episode_analysis, created_at
    `
    )
    .eq("id", lectureId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  const metadata = parseRecommendationMetadata(data.recommendation_metadata);
  const episodeAnalysis = data.episode_analysis as {
    chapters?: Array<{
      title: string;
      startRange: number;
      endRange: number;
      duration?: number;
    }>;
  } | null;

  // 에피소드 목록으로 변환
  const episodes = (episodeAnalysis?.chapters ?? []).map((ch) => ({
    title: ch.title,
    episodeNumber: ch.startRange,
    duration: ch.duration,
  }));

  return {
    id: data.id,
    title: data.title,
    instructorName: data.instructor_name,
    platform: data.platform,
    totalEpisodes: data.total_episodes,
    totalDuration: data.total_duration,
    subjectCategory: data.subject_category,
    subject: data.subject,
    difficultyLevel: data.difficulty_level,
    reviewScore: data.review_score,
    reviewCount: data.review_count ?? 0,
    targetStudents: data.target_students ?? [],
    recommendationMetadata: metadata,
    instructorId: data.instructor_id,
    episodes,
    strengths: metadata?.characteristics?.strengths ?? [],
    weaknesses: metadata?.characteristics?.weaknesses ?? [],
    createdAt: data.created_at,
  };
}

/**
 * 강의 검색 (어드민용)
 *
 * @param searchTerm - 검색어 (제목, 강사명)
 * @param options - 추가 옵션
 * @returns 검색 결과
 */
export async function searchLectureRecommendations(
  searchTerm: string,
  options: LectureRecommendationQueryOptions = {}
): Promise<LectureRecommendationResult> {
  const supabase = await createSupabaseServerClient();

  const {
    subjectCategory,
    difficultyLevel,
    platform,
    limit = 50,
  } = options;

  // 검색어 이스케이프 (SQL injection 방지)
  const escapedTerm = searchTerm.replace(/[%_\\]/g, "\\$&");
  const searchPattern = `%${escapedTerm}%`;

  let query = supabase
    .from("master_lectures")
    .select(
      `
      id, title, instructor_name, platform, total_episodes, total_duration,
      subject_category, subject, difficulty_level,
      review_score, review_count, target_students,
      recommendation_metadata
    `
    )
    .eq("is_active", true)
    .not("recommendation_metadata", "is", null)
    .or(`title.ilike.${searchPattern},instructor_name.ilike.${searchPattern}`)
    .order("review_score", { ascending: false, nullsFirst: false });

  if (subjectCategory) {
    query = query.eq("subject_category", subjectCategory);
  }

  if (difficultyLevel) {
    query = query.eq("difficulty_level", difficultyLevel);
  }

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[searchLectureRecommendations] query error:", error);
    return { lectures: [], totalCount: 0 };
  }

  const lectures = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    instructorName: row.instructor_name,
    platform: row.platform,
    totalEpisodes: row.total_episodes,
    totalDuration: row.total_duration,
    subjectCategory: row.subject_category,
    subject: row.subject,
    difficultyLevel: row.difficulty_level,
    reviewScore: row.review_score,
    reviewCount: row.review_count ?? 0,
    targetStudents: row.target_students ?? [],
    recommendationMetadata: parseRecommendationMetadata(row.recommendation_metadata),
  }));

  return { lectures, totalCount: lectures.length };
}

/**
 * 추천 강의의 플랫폼 목록 조회
 */
export async function getAvailablePlatformsForRecommendations(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_lectures")
    .select("platform")
    .eq("is_active", true)
    .not("recommendation_metadata", "is", null)
    .not("platform", "is", null);

  if (error) {
    console.error("[getAvailablePlatformsForRecommendations] query error:", error);
    return [];
  }

  const platforms = new Set<string>();
  for (const row of data ?? []) {
    if (row.platform) {
      platforms.add(row.platform);
    }
  }

  return Array.from(platforms).sort();
}
