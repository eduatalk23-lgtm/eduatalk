/**
 * AI 메타데이터 추출 서비스
 *
 * 교재/강의 제목에서 메타데이터를 AI로 추론합니다.
 */

import { createMessage } from "@/lib/domains/plan/llm/client";
import type {
  ContentType,
  ExtractedMetadata,
  ExtractMetadataRequest,
  ExtractMetadataResult,
  PublisherPattern,
} from "../types";
import {
  METADATA_EXTRACTION_SYSTEM_PROMPT,
  buildMetadataExtractionPrompt,
  parseMetadataResponse,
  estimateMetadataExtractionTokens,
} from "../prompts/metadataExtraction";

// ============================================
// 출판사/플랫폼 패턴 DB
// ============================================

const PUBLISHER_PATTERNS: PublisherPattern[] = [
  // 도서 출판사
  {
    name: "좋은책신사고",
    keywords: ["신사고", "좋은책"],
    subjectHints: {
      하이탑: "hard",
      쎈: "medium",
      개념쎈: "medium",
      라이트쎈: "easy",
    },
  },
  {
    name: "비상교육",
    keywords: ["비상", "visang"],
    subjectHints: {
      완자: "medium",
      오투: "medium",
    },
  },
  {
    name: "성지출판",
    keywords: ["성지", "정석"],
    defaultDifficulty: "medium",
  },
  {
    name: "개념원리",
    keywords: ["개념원리"],
    defaultDifficulty: "medium",
  },
  {
    name: "이투스북",
    keywords: ["이투스북", "이투스"],
    defaultDifficulty: "medium",
  },
  // 강의 플랫폼
  {
    name: "메가스터디",
    keywords: ["메가스터디", "메가", "megastudy"],
    defaultDifficulty: "medium",
  },
  {
    name: "EBS",
    keywords: ["ebs", "EBS", "이비에스"],
    defaultDifficulty: "medium",
  },
  {
    name: "대성마이맥",
    keywords: ["대성", "마이맥"],
    defaultDifficulty: "medium",
  },
];

// ============================================
// AI 메타데이터 추출 서비스
// ============================================

export class AIMetadataExtractor {
  /**
   * 제목에서 메타데이터 추출
   */
  async extractFromTitle(request: ExtractMetadataRequest): Promise<ExtractMetadataResult> {
    const { title, contentType, publisher, additionalContext } = request;

    try {
      // 토큰 추정
      const tokenEstimate = estimateMetadataExtractionTokens(title, contentType, publisher);

      // AI 호출
      const result = await createMessage({
        system: METADATA_EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildMetadataExtractionPrompt(title, contentType, publisher, additionalContext),
          },
        ],
        modelTier: "fast", // 메타데이터 추출은 간단한 작업이므로 fast 티어 사용
        maxTokens: 1000,
        temperature: 0.3, // 일관성을 위해 낮은 temperature
      });

      // 응답 파싱
      const metadata = parseMetadataResponse(result.content);

      if (!metadata) {
        return {
          success: false,
          metadata: null,
          error: "AI 응답 파싱 실패",
          modelId: result.modelId,
          tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
        };
      }

      // 출판사 정보로 메타데이터 보강
      const enrichedMetadata = publisher
        ? this.enrichWithPublisherInfo(metadata, publisher, title)
        : metadata;

      const totalTokens = result.usage.inputTokens + result.usage.outputTokens;

      return {
        success: true,
        metadata: enrichedMetadata,
        modelId: result.modelId,
        tokensUsed: totalTokens,
        costUsd: this.estimateCost(totalTokens),
      };
    } catch (error) {
      console.error("[AIMetadataExtractor] Extract error:", error);
      return {
        success: false,
        metadata: null,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      };
    }
  }

  /**
   * 출판사/플랫폼 정보로 메타데이터 보강
   */
  enrichWithPublisherInfo(
    metadata: ExtractedMetadata,
    publisher: string,
    title: string
  ): ExtractedMetadata {
    const pattern = this.findPublisherPattern(publisher, title);

    if (!pattern) {
      return metadata;
    }

    const enriched = { ...metadata };

    // 난이도 보강 (subjectHints 우선)
    if (pattern.subjectHints) {
      for (const [keyword, difficulty] of Object.entries(pattern.subjectHints)) {
        if (title.includes(keyword)) {
          enriched.difficulty = difficulty as "easy" | "medium" | "hard";
          enriched.difficultyConfidence = Math.max(enriched.difficultyConfidence, 0.9);
          break;
        }
      }
    }

    // defaultDifficulty 적용 (확신도가 낮은 경우)
    if (pattern.defaultDifficulty && enriched.difficultyConfidence < 0.7) {
      enriched.difficulty = pattern.defaultDifficulty;
      enriched.difficultyConfidence = 0.75;
    }

    // 학년 보강
    if (pattern.defaultGradeLevel && enriched.gradeLevelConfidence < 0.6) {
      enriched.gradeLevel = pattern.defaultGradeLevel;
      enriched.gradeLevelConfidence = 0.65;
    }

    return enriched;
  }

  /**
   * 출판사 패턴 찾기
   */
  private findPublisherPattern(
    publisher: string,
    title: string
  ): PublisherPattern | null {
    const searchText = `${publisher} ${title}`.toLowerCase();

    for (const pattern of PUBLISHER_PATTERNS) {
      for (const keyword of pattern.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return pattern;
        }
      }
    }

    return null;
  }

  /**
   * 비용 추정 (USD)
   */
  private estimateCost(tokens: number): number {
    // Gemini Flash 기준 (fast tier): 약 $0.075 per 1M input tokens
    // 단순화된 추정
    return (tokens / 1_000_000) * 0.1;
  }

  /**
   * 여러 제목에 대해 배치 추출 (벌크 임포트용)
   */
  async extractBatch(
    requests: ExtractMetadataRequest[],
    options: { maxConcurrent?: number } = {}
  ): Promise<ExtractMetadataResult[]> {
    const maxConcurrent = options.maxConcurrent ?? 5;
    const results: ExtractMetadataResult[] = [];

    // 배치 처리 (동시성 제한)
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((req) => this.extractFromTitle(req))
      );
      results.push(...batchResults);

      // Rate limit 방지를 위한 딜레이
      if (i + maxConcurrent < requests.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let extractorInstance: AIMetadataExtractor | null = null;

export function getAIMetadataExtractor(): AIMetadataExtractor {
  if (!extractorInstance) {
    extractorInstance = new AIMetadataExtractor();
  }
  return extractorInstance;
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 메타데이터 확신도 점수 계산 (전체 품질 지표)
 */
export function calculateOverallConfidence(metadata: ExtractedMetadata): number {
  const weights = {
    subject: 0.25,
    subjectCategory: 0.15,
    difficulty: 0.25,
    gradeLevel: 0.15,
    curriculum: 0.1,
    lectureType: 0.1,
  };

  let score = 0;
  score += metadata.subjectConfidence * weights.subject;
  score += metadata.subjectCategoryConfidence * weights.subjectCategory;
  score += metadata.difficultyConfidence * weights.difficulty;
  score += metadata.gradeLevelConfidence * weights.gradeLevel;
  score += metadata.curriculumConfidence * weights.curriculum;
  score += (metadata.lectureTypeConfidence ?? 0) * weights.lectureType;

  return Math.round(score * 100) / 100;
}

/**
 * 메타데이터가 플랜 생성에 충분한지 검사
 */
export function isMetadataComplete(metadata: ExtractedMetadata): boolean {
  // 필수: subject, subjectCategory, difficulty
  return (
    metadata.subject !== null &&
    metadata.subjectConfidence >= 0.6 &&
    metadata.subjectCategory !== null &&
    metadata.subjectCategoryConfidence >= 0.6 &&
    metadata.difficulty !== null &&
    metadata.difficultyConfidence >= 0.5
  );
}
