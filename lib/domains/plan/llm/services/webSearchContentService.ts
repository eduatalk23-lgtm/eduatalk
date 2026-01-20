/**
 * 웹 검색 콘텐츠 서비스
 *
 * Gemini Grounding을 통해 검색된 웹 콘텐츠를 관리하고 DB에 저장하는 서비스입니다.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GroundingMetadata, WebSearchResult } from "../providers/base";
import {
  buildContentAnalysisData,
  toJsonField,
  hasValidChapters,
  type ChapterInfo,
} from "./contentStructureUtils";

// ============================================
// 타입 정의
// ============================================

/**
 * 웹 검색 콘텐츠 타입
 */
export type WebContentType = "web_book" | "web_lecture" | "web_article";

/**
 * 웹 검색을 통해 가져온 콘텐츠
 */
export interface WebSearchContent {
  /** 임시 ID (UUID) */
  id: string;
  /** 콘텐츠 제목 */
  title: string;
  /** 원본 URL */
  url: string;
  /** 검색 결과 요약/스니펫 */
  snippet?: string;
  /** 과목 */
  subject?: string;
  /** 과목 카테고리 */
  subjectCategory?: string;
  /** 콘텐츠 타입 */
  contentType: WebContentType;
  /** 소스 표시 */
  source: "web_search";
  /** 검색 쿼리 */
  searchQuery: string;
  /** 검색 일시 */
  searchDate: string;

  // ---- 구조 정보 (optional) ----
  /** 총 범위 (페이지 수 또는 에피소드 수) */
  totalRange?: number;
  /** 챕터/에피소드 정보 */
  chapters?: ChapterInfo[];
  /** 저자/강사 */
  author?: string;
  /** 출판사/플랫폼 */
  publisher?: string;
  /** 난이도 레벨 */
  difficultyLevel?: string;
}

/**
 * 웹 콘텐츠 저장 결과
 */
export interface SaveWebContentResult {
  /** 저장 성공 여부 */
  success: boolean;
  /** 저장된 콘텐츠 수 */
  savedCount: number;
  /** 저장된 콘텐츠 ID 목록 */
  savedIds: string[];
  /** 중복으로 건너뛴 콘텐츠 수 */
  duplicateCount: number;
  /** 에러 메시지 목록 */
  errors: string[];
}

/**
 * 웹 콘텐츠 변환 컨텍스트
 */
export interface TransformContext {
  /** 기본 과목 (선택적) */
  subject?: string;
  /** 기본 과목 카테고리 (선택적) */
  subjectCategory?: string;
  /** 테넌트 ID */
  tenantId: string;
}

/**
 * 기존 콘텐츠 조회 옵션
 */
export interface FindExistingContentOptions {
  /** 교과 필터 (예: 수학, 영어) */
  subjectCategory?: string;
  /** 과목 필터 (예: 미적분, 영어독해) */
  subject?: string;
  /** 난이도 필터 (예: 개념, 기본, 심화) */
  difficulty?: string;
  /** 콘텐츠 타입 필터 */
  contentType?: "book" | "lecture" | "all";
  /** 구조 정보(total_pages/episodes) 있는 것만 */
  hasStructure?: boolean;
  /** 데이터 출처 필터 */
  source?: "cold_start" | "web_search" | "all";
  /** 공유 카탈로그 포함 여부 (tenant_id IS NULL) */
  includeSharedCatalog?: boolean;
  /** 최대 조회 개수 */
  limit?: number;
}

/**
 * 통합 콘텐츠 결과 아이템
 */
export interface ExistingContentItem {
  id: string;
  title: string;
  contentType: "book" | "lecture";
  subjectCategory: string | null;
  subject: string | null;
  difficultyLevel: string | null;
  totalRange: number | null;
  source: string | null;
  createdAt: string;
}

// ============================================
// 캐시 설정
// ============================================

/** 캐시 TTL (5분) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 최대 캐시 엔트리 수 */
const MAX_CACHE_ENTRIES = 100;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * 쿼리 옵션에서 캐시 키 생성
 */
function buildCacheKey(
  tenantId: string | null,
  options?: FindExistingContentOptions
): string {
  const parts = [
    `t:${tenantId ?? "null"}`,
    `sc:${options?.subjectCategory ?? ""}`,
    `s:${options?.subject ?? ""}`,
    `d:${options?.difficulty ?? ""}`,
    `ct:${options?.contentType ?? "all"}`,
    `hs:${options?.hasStructure ?? false}`,
    `src:${options?.source ?? ""}`,
    `isc:${options?.includeSharedCatalog ?? false}`,
    `l:${options?.limit ?? 20}`,
  ];
  return parts.join("|");
}

// ============================================
// WebSearchContentService 클래스
// ============================================

/**
 * 웹 검색 콘텐츠 서비스
 *
 * Gemini Grounding 결과를 콘텐츠 형식으로 변환하고 DB에 저장합니다.
 * 인메모리 캐시를 사용하여 동일 조건의 반복 쿼리를 최적화합니다.
 *
 * @example
 * ```typescript
 * const service = getWebSearchContentService();
 * const contents = service.transformToContent(groundingMetadata, {
 *   tenantId: 'xxx',
 *   subject: '수학'
 * });
 * await service.saveToDatabase(contents, tenantId);
 * ```
 */
export class WebSearchContentService {
  /** 인메모리 캐시 */
  private cache = new Map<string, CacheEntry<ExistingContentItem[]>>();

  /** 캐시 통계 */
  private cacheStats = { hits: 0, misses: 0 };

  /**
   * 캐시 통계 조회
   */
  getCacheStats(): { hits: number; misses: number; size: number } {
    return { ...this.cacheStats, size: this.cache.size };
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheStats = { hits: 0, misses: 0 };
  }

  /**
   * 특정 조건의 캐시 무효화
   */
  invalidateCache(tenantId: string | null, subjectCategory?: string): void {
    const keysToDelete: string[] = [];
    const cacheKeys = Array.from(this.cache.keys());
    for (const key of cacheKeys) {
      if (
        key.includes(`t:${tenantId ?? "null"}`) &&
        (!subjectCategory || key.includes(`sc:${subjectCategory}`))
      ) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * 캐시에서 조회 (TTL 체크 포함)
   */
  private getFromCache(key: string): ExistingContentItem[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL 체크
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    this.cacheStats.hits++;
    return entry.data;
  }

  /**
   * 캐시에 저장 (최대 엔트리 수 제한)
   */
  private setToCache(key: string, data: ExistingContentItem[]): void {
    // 최대 엔트리 수 초과 시 가장 오래된 항목 삭제
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { data, timestamp: Date.now() });
    this.cacheStats.misses++;
  }
  /**
   * Grounding 메타데이터를 콘텐츠 형식으로 변환
   *
   * @param groundingMetadata - Gemini 응답의 grounding 메타데이터
   * @param context - 변환 컨텍스트 (subject, tenantId 등)
   * @returns 변환된 웹 콘텐츠 배열
   */
  transformToContent(
    groundingMetadata: GroundingMetadata,
    context: TransformContext
  ): WebSearchContent[] {
    return groundingMetadata.webResults
      .filter((result) => result.url && result.title) // URL과 제목이 있는 것만
      .map((result) => ({
        id: crypto.randomUUID(),
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        subject: context.subject,
        subjectCategory: context.subjectCategory,
        contentType: this.inferContentType(result.url, result.title),
        source: "web_search" as const,
        searchQuery: groundingMetadata.searchQueries.join(", "),
        searchDate: new Date().toISOString(),
      }));
  }

  /**
   * URL과 제목에서 콘텐츠 타입 추론
   *
   * @param url - 웹 페이지 URL
   * @param title - 웹 페이지 제목
   * @returns 추론된 콘텐츠 타입
   */
  private inferContentType(url: string, title: string): WebContentType {
    const lowerUrl = url.toLowerCase();
    const lowerTitle = title.toLowerCase();

    // 강의/동영상 콘텐츠 판별
    if (
      lowerUrl.includes("youtube") ||
      lowerUrl.includes("youtu.be") ||
      lowerUrl.includes("lecture") ||
      lowerUrl.includes("course") ||
      lowerUrl.includes("megastudy") ||
      lowerUrl.includes("etoos") ||
      lowerUrl.includes("ebsi") ||
      lowerTitle.includes("강의") ||
      lowerTitle.includes("강좌") ||
      lowerTitle.includes("인강") ||
      lowerTitle.includes("동영상")
    ) {
      return "web_lecture";
    }

    // 교재/문제집 콘텐츠 판별
    if (
      lowerTitle.includes("교재") ||
      lowerTitle.includes("문제집") ||
      lowerTitle.includes("기출") ||
      lowerTitle.includes("교과서") ||
      lowerTitle.includes("book") ||
      lowerTitle.includes("workbook") ||
      lowerUrl.includes("yes24") ||
      lowerUrl.includes("kyobobook") ||
      lowerUrl.includes("aladin")
    ) {
      return "web_book";
    }

    // 기본값: 일반 학습 자료/아티클
    return "web_article";
  }

  /**
   * 웹 검색 콘텐츠를 DB에 저장
   *
   * master_books 또는 master_lectures 테이블에 저장합니다.
   * P2-3: 배치 중복 검사로 최적화 (URL 및 제목 기반)
   *
   * @param contents - 저장할 웹 콘텐츠 배열
   * @param tenantId - 테넌트 ID
   * @returns 저장 결과
   */
  async saveToDatabase(
    contents: WebSearchContent[],
    tenantId: string
  ): Promise<SaveWebContentResult> {
    const supabase = await createSupabaseAdminClient();
    if (!supabase) {
      return {
        success: false,
        savedCount: 0,
        savedIds: [],
        duplicateCount: 0,
        errors: ["Supabase 클라이언트 초기화 실패"],
      };
    }

    if (contents.length === 0) {
      return {
        success: true,
        savedCount: 0,
        savedIds: [],
        duplicateCount: 0,
        errors: [],
      };
    }

    const savedIds: string[] = [];
    const errors: string[] = [];
    let duplicateCount = 0;

    // P2-3: 배치 중복 검사 - 모든 URL과 제목을 한 번에 조회
    const allUrls = contents.map((c) => c.url).filter(Boolean);

    // 기존 URL 조회 (배치)
    const existingUrlSet = new Set<string>();
    const existingTitleSet = new Set<string>();

    if (allUrls.length > 0) {
      // master_books에서 기존 URL 조회
      const { data: existingBooks } = await supabase
        .from("master_books")
        .select("source_url, title")
        .eq("tenant_id", tenantId)
        .in("source_url", allUrls);

      if (existingBooks) {
        existingBooks.forEach((b) => {
          if (b.source_url) existingUrlSet.add(b.source_url);
          if (b.title) existingTitleSet.add(b.title.toLowerCase().trim());
        });
      }

      // master_lectures에서 기존 URL 조회
      const { data: existingLectures } = await supabase
        .from("master_lectures")
        .select("lecture_source_url, title")
        .eq("tenant_id", tenantId)
        .in("lecture_source_url", allUrls);

      if (existingLectures) {
        existingLectures.forEach((l) => {
          if (l.lecture_source_url) existingUrlSet.add(l.lecture_source_url);
          if (l.title) existingTitleSet.add(l.title.toLowerCase().trim());
        });
      }
    }

    // P2-3: 제목 유사도 기반 추가 중복 검사 (URL이 다르더라도)
    const { data: similarTitleBooks } = await supabase
      .from("master_books")
      .select("title")
      .eq("tenant_id", tenantId)
      .eq("source", "web_search")
      .limit(500);

    if (similarTitleBooks) {
      similarTitleBooks.forEach((b) => {
        if (b.title) existingTitleSet.add(b.title.toLowerCase().trim());
      });
    }

    const { data: similarTitleLectures } = await supabase
      .from("master_lectures")
      .select("title")
      .eq("tenant_id", tenantId)
      .limit(500);

    if (similarTitleLectures) {
      similarTitleLectures.forEach((l) => {
        if (l.title) existingTitleSet.add(l.title.toLowerCase().trim());
      });
    }

    // 중복 필터링된 콘텐츠 저장
    for (const content of contents) {
      try {
        // URL 기반 중복 체크
        if (content.url && existingUrlSet.has(content.url)) {
          duplicateCount++;
          continue;
        }

        // 제목 기반 중복 체크 (정확히 일치하는 경우만)
        const normalizedTitle = content.title.toLowerCase().trim();
        if (existingTitleSet.has(normalizedTitle)) {
          duplicateCount++;
          continue;
        }

        // 콘텐츠 타입에 따라 적절한 테이블에 저장
        if (content.contentType === "web_lecture") {
          const { data, error } = await supabase
            .from("master_lectures")
            .insert({
              tenant_id: tenantId,
              title: content.title,
              lecture_source_url: content.url,
              subject: content.subject,
              subject_category: content.subjectCategory,
              notes: content.snippet,
              total_episodes:
                content.totalRange && content.totalRange > 0
                  ? content.totalRange
                  : 1,
              instructor_name: content.author ?? null,
              platform_name: content.publisher ?? null,
              difficulty_level: content.difficultyLevel ?? null,
              episode_analysis: hasValidChapters(content.chapters)
                ? toJsonField(
                    buildContentAnalysisData(content.chapters!, "web_search")
                  )
                : null,
              is_active: true,
            })
            .select("id")
            .single();

          if (error) {
            errors.push(`강의 저장 실패 (${content.title}): ${error.message}`);
          } else {
            savedIds.push(data.id);
            // 저장된 제목을 Set에 추가하여 동일 배치 내 중복 방지
            existingTitleSet.add(normalizedTitle);
            if (content.url) existingUrlSet.add(content.url);
          }
        } else {
          // web_book, web_article -> master_books에 저장
          const { data, error } = await supabase
            .from("master_books")
            .insert({
              tenant_id: tenantId,
              title: content.title,
              source: "web_search",
              source_url: content.url,
              subject: content.subject,
              subject_category: content.subjectCategory,
              notes: content.snippet,
              description: `웹 검색 결과 - 검색어: ${content.searchQuery}`,
              total_pages: content.totalRange ?? null,
              author: content.author ?? null,
              publisher_name: content.publisher ?? null,
              difficulty_level: content.difficultyLevel ?? null,
              page_analysis: hasValidChapters(content.chapters)
                ? toJsonField(
                    buildContentAnalysisData(content.chapters!, "web_search")
                  )
                : null,
              is_active: true,
            })
            .select("id")
            .single();

          if (error) {
            errors.push(`교재 저장 실패 (${content.title}): ${error.message}`);
          } else {
            savedIds.push(data.id);
            // 저장된 제목을 Set에 추가하여 동일 배치 내 중복 방지
            existingTitleSet.add(normalizedTitle);
            if (content.url) existingUrlSet.add(content.url);
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        errors.push(`저장 중 오류 (${content.title}): ${errMsg}`);
      }
    }

    return {
      success: errors.length === 0,
      savedCount: savedIds.length,
      savedIds,
      duplicateCount,
      errors,
    };
  }

  /**
   * 기존에 저장된 웹 검색 콘텐츠 조회
   *
   * master_books와 master_lectures 테이블에서 조건에 맞는 콘텐츠를 조회합니다.
   * cold_start 및 web_search 출처 모두 지원합니다.
   *
   * @param tenantId - 테넌트 ID (null이면 공유 카탈로그만 조회)
   * @param options - 조회 옵션 (다중 필터 지원)
   * @returns 통합 콘텐츠 목록
   *
   * @example
   * ```typescript
   * // 수학 교과의 구조 정보 있는 교재만 조회
   * const books = await service.findExistingWebContent(tenantId, {
   *   subjectCategory: '수학',
   *   contentType: 'book',
   *   hasStructure: true,
   *   source: 'cold_start',
   * });
   * ```
   */
  async findExistingWebContent(
    tenantId: string | null,
    options?: FindExistingContentOptions
  ): Promise<ExistingContentItem[]> {
    // 캐시 키 생성 및 캐시 확인
    const cacheKey = buildCacheKey(tenantId, options);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const supabase = await createSupabaseAdminClient();
    if (!supabase) {
      return [];
    }

    const limit = options?.limit ?? 20;
    const contentType = options?.contentType ?? "all";

    // 병렬 쿼리 실행으로 성능 최적화
    const queryPromises: Promise<ExistingContentItem[]>[] = [];

    if (contentType === "book" || contentType === "all") {
      queryPromises.push(this.queryBooks(supabase, tenantId, options));
    }

    if (contentType === "lecture" || contentType === "all") {
      queryPromises.push(this.queryLectures(supabase, tenantId, options));
    }

    // 병렬 실행 후 결과 병합
    const queryResults = await Promise.all(queryPromises);
    const results = queryResults.flat();

    // 생성일 기준 정렬 후 limit 적용
    const sortedResults = results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    // 캐시에 저장
    this.setToCache(cacheKey, sortedResults);

    return sortedResults;
  }

  /**
   * master_books 테이블 조회 (내부 헬퍼)
   */
  private async queryBooks(
    supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseAdminClient>>>,
    tenantId: string | null,
    options?: FindExistingContentOptions
  ): Promise<ExistingContentItem[]> {
    let query = supabase
      .from("master_books")
      .select("id, title, subject_category, subject, difficulty_level, total_pages, source, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    // 테넌트 필터
    if (options?.includeSharedCatalog && tenantId) {
      // 테넌트 + 공유 카탈로그
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    } else if (tenantId === null) {
      // 공유 카탈로그만
      query = query.is("tenant_id", null);
    } else {
      // 특정 테넌트만
      query = query.eq("tenant_id", tenantId);
    }

    // 출처 필터
    if (options?.source && options.source !== "all") {
      query = query.eq("source", options.source);
    } else if (!options?.source) {
      // 기본: cold_start 또는 web_search
      query = query.in("source", ["cold_start", "web_search"]);
    }

    // 교과 필터
    if (options?.subjectCategory) {
      query = query.eq("subject_category", options.subjectCategory);
    }

    // 과목 필터
    if (options?.subject) {
      query = query.eq("subject", options.subject);
    }

    // 난이도 필터
    if (options?.difficulty) {
      query = query.eq("difficulty_level", options.difficulty);
    }

    // 구조 정보 필터
    if (options?.hasStructure) {
      query = query.not("total_pages", "is", null);
    }

    const { data } = await query.limit(options?.limit ?? 50);

    return (data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      contentType: "book" as const,
      subjectCategory: item.subject_category,
      subject: item.subject,
      difficultyLevel: item.difficulty_level,
      totalRange: item.total_pages,
      source: item.source,
      createdAt: item.created_at ?? new Date().toISOString(),
    }));
  }

  /**
   * master_lectures 테이블 조회 (내부 헬퍼)
   */
  private async queryLectures(
    supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseAdminClient>>>,
    tenantId: string | null,
    options?: FindExistingContentOptions
  ): Promise<ExistingContentItem[]> {
    let query = supabase
      .from("master_lectures")
      .select("id, title, subject_category, subject, difficulty_level, total_episodes, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    // 테넌트 필터
    if (options?.includeSharedCatalog && tenantId) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    } else if (tenantId === null) {
      query = query.is("tenant_id", null);
    } else {
      query = query.eq("tenant_id", tenantId);
    }

    // 교과 필터
    if (options?.subjectCategory) {
      query = query.eq("subject_category", options.subjectCategory);
    }

    // 과목 필터
    if (options?.subject) {
      query = query.eq("subject", options.subject);
    }

    // 난이도 필터
    if (options?.difficulty) {
      query = query.eq("difficulty_level", options.difficulty);
    }

    // 구조 정보 필터
    if (options?.hasStructure) {
      query = query.not("total_episodes", "is", null);
    }

    const { data } = await query.limit(options?.limit ?? 50);

    return (data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      contentType: "lecture" as const,
      subjectCategory: item.subject_category,
      subject: item.subject,
      difficultyLevel: item.difficulty_level,
      totalRange: item.total_episodes,
      source: null, // master_lectures에는 source 컬럼 없음
      createdAt: item.created_at ?? new Date().toISOString(),
    }));
  }

  /**
   * WebSearchResult 배열에서 직접 WebSearchContent로 변환
   * (GroundingMetadata 없이 직접 변환할 때 사용)
   *
   * @param webResults - 웹 검색 결과 배열
   * @param context - 변환 컨텍스트
   * @param searchQuery - 검색 쿼리 (선택적)
   * @returns 변환된 웹 콘텐츠 배열
   */
  transformWebResultsToContent(
    webResults: WebSearchResult[],
    context: TransformContext,
    searchQuery?: string
  ): WebSearchContent[] {
    return webResults
      .filter((result) => result.url && result.title)
      .map((result) => ({
        id: crypto.randomUUID(),
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        subject: context.subject,
        subjectCategory: context.subjectCategory,
        contentType: this.inferContentType(result.url, result.title),
        source: "web_search" as const,
        searchQuery: searchQuery || "",
        searchDate: new Date().toISOString(),
      }));
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let serviceInstance: WebSearchContentService | null = null;

/**
 * WebSearchContentService 싱글톤 인스턴스 반환
 */
export function getWebSearchContentService(): WebSearchContentService {
  if (!serviceInstance) {
    serviceInstance = new WebSearchContentService();
  }
  return serviceInstance;
}
