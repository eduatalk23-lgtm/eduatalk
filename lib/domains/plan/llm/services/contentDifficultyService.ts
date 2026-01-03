/**
 * Content Difficulty Service
 * Phase 3.1: 교재 난이도 평가 시스템
 *
 * 콘텐츠(교재/강의)의 난이도를 AI로 분석하고 관리합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMessage } from "../client";
import {
  DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT,
  buildDifficultyAssessmentPrompt,
  parseDifficultyAssessmentResponse,
  estimateDifficultyPromptTokens,
  scoreToDifficultyLevel,
  scoreToDifficultyLabel,
  calculateDifficultyFit,
  applySubjectWeight,
  type DifficultyAssessmentRequest,
  type DifficultyAssessmentResult,
} from "../prompts/difficultyAssessment";
import { LLMCacheService, withLLMCache } from "./llmCacheService";

// ============================================
// Types
// ============================================

/**
 * 콘텐츠 타입
 */
export type ContentType = "book" | "lecture";

/**
 * 분석 상태
 */
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

/**
 * 저장된 난이도 분석 결과
 */
export interface StoredDifficultyAnalysis {
  id: string;
  contentType: ContentType;
  contentId: string;
  analysisVersion: number;
  overallDifficultyScore: number;
  difficultyConfidence: number;
  vocabularyComplexity: number;
  conceptDensity: number;
  prerequisiteDepth: number;
  mathematicalComplexity: number;
  estimatedHoursPerUnit: number;
  recommendedStudyPace: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
  prerequisiteConcepts: string[];
  keyConceptsCovered: string[];
  reasoning: string;
  analyzedAt: string;
  analyzedBy: "manual" | "ai" | "algorithm";
}

/**
 * 분석 요청 옵션
 */
export interface AnalyzeOptions {
  /** 캐시 사용 여부 (기본: true) */
  useCache?: boolean;
  /** 강제 재분석 여부 */
  forceReanalyze?: boolean;
  /** AI 모델 */
  model?: string;
}

/**
 * 분석 결과
 */
export interface AnalyzeResult {
  analysis: StoredDifficultyAnalysis;
  fromCache: boolean;
  tokensUsed?: number;
  costUsd?: number;
}

/**
 * 큐 아이템
 */
export interface QueueItem {
  id: string;
  contentType: ContentType;
  contentId: string;
  status: AnalysisStatus;
  priority: number;
  retryCount: number;
  createdAt: string;
}

/**
 * 배치 분석 결과
 */
export interface BatchAnalyzeResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    contentId: string;
    success: boolean;
    error?: string;
  }>;
}

// ============================================
// Content Difficulty Service
// ============================================

export class ContentDifficultyService {
  private tenantId: string;
  private cacheService: LLMCacheService;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.cacheService = new LLMCacheService(tenantId);
  }

  // ============================================
  // Analysis Methods
  // ============================================

  /**
   * 콘텐츠 난이도 분석
   */
  async analyze(
    request: DifficultyAssessmentRequest & { contentId: string },
    options: AnalyzeOptions = {}
  ): Promise<AnalyzeResult> {
    const { useCache = true, forceReanalyze = false, model } = options;

    // 기존 분석 결과 확인 (강제 재분석이 아닌 경우)
    if (!forceReanalyze) {
      const existing = await this.getAnalysis(request.contentType, request.contentId);
      if (existing) {
        return { analysis: existing, fromCache: true };
      }
    }

    // 캐시 확인
    const cacheKey = LLMCacheService.buildKey("content_analysis", request.contentId);
    const requestHash = LLMCacheService.hashRequest(request);

    if (useCache) {
      const cached = await this.cacheService.get<DifficultyAssessmentResult>(
        cacheKey,
        requestHash
      );
      if (cached) {
        const stored = await this.saveAnalysis(request, cached, "ai");
        return { analysis: stored, fromCache: true };
      }
    }

    // AI 분석 실행
    const userPrompt = buildDifficultyAssessmentPrompt(request);

    const response = await createMessage({
      model: model || "claude-sonnet-4-20250514",
      maxTokens: 1000,
      systemPrompt: DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // 응답 파싱
    const result = parseDifficultyAssessmentResponse(response.content);

    // 과목별 가중치 적용
    const adjustedScore = applySubjectWeight(result.overallScore, request.subject);
    result.overallScore = adjustedScore;

    // 캐시에 저장
    if (useCache) {
      await this.cacheService.set(cacheKey, requestHash, result, "content_analysis");
    }

    // DB에 저장
    const stored = await this.saveAnalysis(request, result, "ai");

    return {
      analysis: stored,
      fromCache: false,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
      costUsd: this.estimateCost(response.usage),
    };
  }

  /**
   * 저장된 분석 결과 조회
   */
  async getAnalysis(
    contentType: ContentType,
    contentId: string,
    version?: number
  ): Promise<StoredDifficultyAnalysis | null> {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("content_difficulty_analysis")
      .select("*")
      .eq("content_type", contentType)
      .eq("content_id", contentId);

    if (version) {
      query = query.eq("analysis_version", version);
    } else {
      query = query.order("analysis_version", { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error || !data) return null;

    return this.mapToStoredAnalysis(data);
  }

  /**
   * 여러 콘텐츠의 분석 결과 조회
   */
  async getAnalyses(
    contentType: ContentType,
    contentIds: string[]
  ): Promise<Map<string, StoredDifficultyAnalysis>> {
    if (contentIds.length === 0) return new Map();

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_difficulty_analysis")
      .select("*")
      .eq("content_type", contentType)
      .in("content_id", contentIds)
      .order("analysis_version", { ascending: false });

    if (error || !data) return new Map();

    // 각 콘텐츠의 최신 분석만 유지
    const result = new Map<string, StoredDifficultyAnalysis>();
    for (const row of data) {
      if (!result.has(row.content_id)) {
        result.set(row.content_id, this.mapToStoredAnalysis(row));
      }
    }

    return result;
  }

  /**
   * 분석 결과 저장
   */
  private async saveAnalysis(
    request: DifficultyAssessmentRequest & { contentId: string },
    result: DifficultyAssessmentResult,
    analyzedBy: "manual" | "ai" | "algorithm"
  ): Promise<StoredDifficultyAnalysis> {
    const supabase = await createSupabaseServerClient();

    // 현재 최신 버전 조회
    const { data: existing } = await supabase
      .from("content_difficulty_analysis")
      .select("analysis_version")
      .eq("content_type", request.contentType)
      .eq("content_id", request.contentId)
      .order("analysis_version", { ascending: false })
      .limit(1)
      .single();

    const newVersion = (existing?.analysis_version || 0) + 1;

    const insertData = {
      content_type: request.contentType,
      content_id: request.contentId,
      analysis_version: newVersion,
      overall_difficulty_score: result.overallScore,
      difficulty_confidence: result.confidence,
      vocabulary_complexity: result.vocabularyComplexity,
      concept_density: result.conceptDensity,
      prerequisite_depth: result.prerequisiteDepth,
      mathematical_complexity: result.mathematicalComplexity,
      estimated_hours_per_unit: result.estimatedHoursPerUnit,
      recommended_study_pace: result.recommendedPace,
      prerequisite_concepts: result.prerequisiteConcepts,
      key_concepts_covered: result.keyConceptsCovered,
      reasoning: result.reasoning,
      analyzed_by: analyzedBy,
      analysis_model: "claude-sonnet-4-20250514",
      analysis_prompt_version: "1.0",
    };

    const { data, error } = await supabase
      .from("content_difficulty_analysis")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save analysis: ${error.message}`);
    }

    return this.mapToStoredAnalysis(data);
  }

  // ============================================
  // Queue Methods
  // ============================================

  /**
   * 분석 큐에 콘텐츠 추가
   */
  async addToQueue(
    contentType: ContentType,
    contentId: string,
    priority: number = 0
  ): Promise<string> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("add_to_analysis_queue", {
      p_tenant_id: this.tenantId,
      p_content_type: contentType,
      p_content_id: contentId,
      p_priority: priority,
    });

    if (error) {
      throw new Error(`Failed to add to queue: ${error.message}`);
    }

    return data;
  }

  /**
   * 여러 콘텐츠를 큐에 추가
   */
  async addBulkToQueue(
    items: Array<{ contentType: ContentType; contentId: string; priority?: number }>
  ): Promise<string[]> {
    const results: string[] = [];

    for (const item of items) {
      const id = await this.addToQueue(
        item.contentType,
        item.contentId,
        item.priority || 0
      );
      results.push(id);
    }

    return results;
  }

  /**
   * 큐에서 다음 분석 대상 가져오기
   */
  async getNextFromQueue(): Promise<QueueItem | null> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("get_next_analysis_item");

    if (error || !data || data.length === 0) return null;

    const item = data[0];
    return {
      id: item.queue_id,
      contentType: item.content_type,
      contentId: item.content_id,
      status: "processing",
      priority: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 분석 완료 처리
   */
  async completeQueueItem(queueId: string, success: boolean, errorMessage?: string): Promise<void> {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.rpc("complete_analysis", {
      p_queue_id: queueId,
      p_success: success,
      p_error_message: errorMessage,
    });

    if (error) {
      throw new Error(`Failed to complete queue item: ${error.message}`);
    }
  }

  /**
   * 큐 상태 조회
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_analysis_queue")
      .select("status")
      .eq("tenant_id", this.tenantId);

    if (error || !data) {
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const row of data) {
      stats[row.status as keyof typeof stats]++;
    }

    return stats;
  }

  // ============================================
  // Batch Processing
  // ============================================

  /**
   * 배치 분석 실행
   */
  async processBatch(limit: number = 10): Promise<BatchAnalyzeResult> {
    const results: BatchAnalyzeResult = {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };

    for (let i = 0; i < limit; i++) {
      const item = await this.getNextFromQueue();
      if (!item) break;

      results.total++;

      try {
        // 콘텐츠 정보 조회
        const contentInfo = await this.getContentInfo(item.contentType, item.contentId);
        if (!contentInfo) {
          await this.completeQueueItem(item.id, false, "Content not found");
          results.failed++;
          results.results.push({
            contentId: item.contentId,
            success: false,
            error: "Content not found",
          });
          continue;
        }

        // 분석 실행
        await this.analyze(
          {
            contentId: item.contentId,
            contentType: item.contentType,
            title: contentInfo.title,
            subject: contentInfo.subject,
            subjectCategory: contentInfo.subjectCategory,
            publisher: contentInfo.publisher,
            toc: contentInfo.toc,
            totalUnits: contentInfo.totalUnits,
          },
          { useCache: true }
        );

        await this.completeQueueItem(item.id, true);
        results.succeeded++;
        results.results.push({ contentId: item.contentId, success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await this.completeQueueItem(item.id, false, errorMessage);
        results.failed++;
        results.results.push({
          contentId: item.contentId,
          success: false,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * 콘텐츠 정보 조회
   */
  private async getContentInfo(
    contentType: ContentType,
    contentId: string
  ): Promise<{
    title: string;
    subject: string;
    subjectCategory?: string;
    publisher?: string;
    toc?: string;
    totalUnits?: number;
  } | null> {
    const supabase = await createSupabaseServerClient();

    if (contentType === "book") {
      const { data } = await supabase
        .from("master_books")
        .select("title, subject, subject_category, publisher_name, total_pages")
        .eq("id", contentId)
        .single();

      if (!data) return null;

      return {
        title: data.title,
        subject: data.subject || "",
        subjectCategory: data.subject_category,
        publisher: data.publisher_name,
        totalUnits: data.total_pages,
      };
    } else {
      const { data } = await supabase
        .from("master_lectures")
        .select("title, subject, subject_category, platform, total_episodes")
        .eq("id", contentId)
        .single();

      if (!data) return null;

      return {
        title: data.title,
        subject: data.subject || "",
        subjectCategory: data.subject_category,
        publisher: data.platform,
        totalUnits: data.total_episodes,
      };
    }
  }

  /**
   * DB 행을 StoredDifficultyAnalysis로 변환
   */
  private mapToStoredAnalysis(row: Record<string, unknown>): StoredDifficultyAnalysis {
    return {
      id: row.id as string,
      contentType: row.content_type as ContentType,
      contentId: row.content_id as string,
      analysisVersion: row.analysis_version as number,
      overallDifficultyScore: row.overall_difficulty_score as number,
      difficultyConfidence: row.difficulty_confidence as number,
      vocabularyComplexity: row.vocabulary_complexity as number,
      conceptDensity: row.concept_density as number,
      prerequisiteDepth: row.prerequisite_depth as number,
      mathematicalComplexity: row.mathematical_complexity as number,
      estimatedHoursPerUnit: row.estimated_hours_per_unit as number,
      recommendedStudyPace: row.recommended_study_pace as {
        beginner: string;
        intermediate: string;
        advanced: string;
      },
      prerequisiteConcepts: row.prerequisite_concepts as string[],
      keyConceptsCovered: row.key_concepts_covered as string[],
      reasoning: row.reasoning as string,
      analyzedAt: row.analyzed_at as string,
      analyzedBy: row.analyzed_by as "manual" | "ai" | "algorithm",
    };
  }

  /**
   * 비용 추정
   */
  private estimateCost(usage?: { input_tokens?: number; output_tokens?: number }): number {
    if (!usage) return 0;

    const inputCost = ((usage.input_tokens || 0) / 1_000_000) * 3; // $3/1M input
    const outputCost = ((usage.output_tokens || 0) / 1_000_000) * 15; // $15/1M output

    return inputCost + outputCost;
  }

  // ============================================
  // Static Utility Methods
  // ============================================

  /**
   * 점수를 난이도 레벨로 변환 (재수출)
   */
  static scoreToDifficultyLevel = scoreToDifficultyLevel;

  /**
   * 점수를 한글 라벨로 변환 (재수출)
   */
  static scoreToDifficultyLabel = scoreToDifficultyLabel;

  /**
   * 학생 수준과 콘텐츠 난이도 적합성 계산 (재수출)
   */
  static calculateDifficultyFit = calculateDifficultyFit;

  /**
   * 토큰 수 추정 (재수출)
   */
  static estimateTokens = estimateDifficultyPromptTokens;
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 콘텐츠 난이도 분석 (간편 함수)
 */
export async function analyzeContentDifficulty(
  tenantId: string,
  request: DifficultyAssessmentRequest & { contentId: string },
  options?: AnalyzeOptions
): Promise<AnalyzeResult> {
  const service = new ContentDifficultyService(tenantId);
  return service.analyze(request, options);
}

/**
 * 콘텐츠 난이도 조회 (간편 함수)
 */
export async function getContentDifficulty(
  tenantId: string,
  contentType: ContentType,
  contentId: string
): Promise<StoredDifficultyAnalysis | null> {
  const service = new ContentDifficultyService(tenantId);
  return service.getAnalysis(contentType, contentId);
}

/**
 * 캐시 래퍼를 사용한 난이도 분석
 */
export async function analyzeWithCache(
  tenantId: string,
  request: DifficultyAssessmentRequest & { contentId: string }
): Promise<DifficultyAssessmentResult> {
  return withLLMCache<DifficultyAssessmentResult>(
    tenantId,
    "content_analysis",
    request.contentId,
    request,
    async () => {
      const userPrompt = buildDifficultyAssessmentPrompt(request);

      const response = await createMessage({
        model: "claude-sonnet-4-20250514",
        maxTokens: 1000,
        systemPrompt: DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const result = parseDifficultyAssessmentResponse(response.content);
      result.overallScore = applySubjectWeight(result.overallScore, request.subject);

      return result;
    }
  );
}
