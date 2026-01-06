/**
 * 웹 검색 콘텐츠 서비스
 *
 * Gemini Grounding을 통해 검색된 웹 콘텐츠를 관리하고 DB에 저장하는 서비스입니다.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GroundingMetadata, WebSearchResult } from "../providers/base";

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

// ============================================
// WebSearchContentService 클래스
// ============================================

/**
 * 웹 검색 콘텐츠 서비스
 *
 * Gemini Grounding 결과를 콘텐츠 형식으로 변환하고 DB에 저장합니다.
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
   * 중복 URL은 건너뜁니다.
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

    const savedIds: string[] = [];
    const errors: string[] = [];
    let duplicateCount = 0;

    for (const content of contents) {
      try {
        // URL 기반 중복 체크 (master_books)
        const { data: existingBook } = await supabase
          .from("master_books")
          .select("id")
          .eq("source_url", content.url)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (existingBook) {
          duplicateCount++;
          continue;
        }

        // URL 기반 중복 체크 (master_lectures)
        const { data: existingLecture } = await supabase
          .from("master_lectures")
          .select("id")
          .eq("lecture_source_url", content.url)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (existingLecture) {
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
              total_episodes: 1, // 필수 필드 기본값
              is_active: true,
            })
            .select("id")
            .single();

          if (error) {
            errors.push(`강의 저장 실패 (${content.title}): ${error.message}`);
          } else {
            savedIds.push(data.id);
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
              is_active: true,
            })
            .select("id")
            .single();

          if (error) {
            errors.push(`교재 저장 실패 (${content.title}): ${error.message}`);
          } else {
            savedIds.push(data.id);
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
   * @param tenantId - 테넌트 ID
   * @param options - 조회 옵션
   * @returns 웹 검색 콘텐츠 목록
   */
  async findExistingWebContent(
    tenantId: string,
    options?: {
      subject?: string;
      limit?: number;
    }
  ) {
    const supabase = await createSupabaseAdminClient();
    if (!supabase) {
      return [];
    }

    let query = supabase
      .from("master_books")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("source", "web_search")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(options?.limit || 20);

    if (options?.subject) {
      query = query.eq("subject", options.subject);
    }

    const { data } = await query;
    return data || [];
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
