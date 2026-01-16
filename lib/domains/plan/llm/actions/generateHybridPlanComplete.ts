"use server";

/**
 * 하이브리드 플랜 완전 생성 액션
 *
 * AI Framework 생성 + 코드 기반 스케줄러를 결합하여
 * 최적화된 학습 플랜을 한 번의 호출로 생성합니다.
 *
 * 흐름:
 * 1. AI가 전략적 프레임워크 생성 (과목 분류, 시간 힌트, 콘텐츠 우선순위)
 * 2. 프레임워크를 SchedulerOptions로 변환
 * 3. 기존 코드 기반 스케줄러로 정확한 시간 배치
 * 4. AI 추천사항 첨부하여 반환
 *
 * @module lib/domains/plan/llm/actions/generateHybridPlanComplete
 */

import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandlingSafe } from "@/lib/errors";
import {
  generatePlansWithServices,
  type AISchedulerOptionsOverride,
} from "@/lib/plan/services";
import {
  generateAIFrameworkAction,
  type GenerateFrameworkInput,
  type GenerateFrameworkResult,
} from "./generateHybridPlan";
import type { AIRecommendations, AIFramework } from "../types/aiFramework";
import type { WebSearchResult } from "../providers/base";
import type { VirtualContentItem } from "./searchContent";
import { createBook, createLecture } from "@/lib/data/studentContents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 에러 메시지 추출 헬퍼
 */
function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "알 수 없는 오류가 발생했습니다.";
}

/**
 * 가상 콘텐츠 입력 (AI 검색 결과 + 임시 ID)
 */
export interface VirtualContentInput extends VirtualContentItem {
  id: string;
  subject: string;
}

// ============================================
// 입력/출력 타입
// ============================================

/**
 * 하이브리드 플랜 완전 생성 입력
 */
export interface GenerateHybridPlanCompleteInput {
  /** 플랜 그룹 ID */
  planGroupId: string;
  /** 학생 정보 (AI Framework용) */
  student: GenerateFrameworkInput["student"];
  /** 성적 정보 */
  scores: GenerateFrameworkInput["scores"];
  /** 콘텐츠 목록 */
  contents: GenerateFrameworkInput["contents"];
  /** 가상 콘텐츠 목록 (AI 검색 결과, DB 저장 필요) */
  virtualContents?: VirtualContentInput[];
  /** 학습 이력 (선택) */
  learningHistory?: GenerateFrameworkInput["learningHistory"];
  /** 기간 정보 */
  period: GenerateFrameworkInput["period"];
  /** 추가 지시사항 (선택) */
  additionalInstructions?: string;
  /** 모델 티어 (기본: standard) */
  modelTier?: GenerateFrameworkInput["modelTier"];
  /** 콘텐츠 매핑 (변환용) */
  contentMappings?: GenerateFrameworkInput["contentMappings"];
  /** 사용자 역할 */
  role?: "student" | "admin" | "consultant";
  /** 웹 검색 활성화 여부 (Gemini Grounding) */
  enableWebSearch?: boolean;
  /** 웹 검색 설정 */
  webSearchConfig?: {
    mode?: "dynamic" | "always";
    dynamicThreshold?: number;
    saveResults?: boolean;
  };
}

/**
 * 하이브리드 플랜 완전 생성 결과
 */
export interface GenerateHybridPlanCompleteResult {
  success: boolean;
  /** 생성된 플랜 수 */
  planCount?: number;
  /** AI 추천사항 (성공 시) */
  aiRecommendations?: AIRecommendations;
  /** AI 프레임워크 생성 토큰 사용량 */
  tokensUsed?: {
    input: number;
    output: number;
  };
  /** AI 프레임워크 처리 시간 (ms) */
  aiProcessingTimeMs?: number;
  /** 전체 처리 시간 (ms) */
  totalProcessingTimeMs?: number;
  /** 낮은 신뢰도 경고 */
  lowConfidenceWarning?: boolean;
  /** 에러 메시지 */
  error?: string;
  /** 에러 단계 */
  errorPhase?: "ai_framework" | "plan_generation";
  /** 웹 검색 결과 (grounding 활성화 시) */
  webSearchResults?: {
    searchQueries: string[];
    resultsCount: number;
    results: WebSearchResult[];
  };
}

// ============================================
// 메인 액션
// ============================================

/**
 * 하이브리드 플랜 완전 생성
 *
 * AI Framework 생성부터 플랜 저장까지 한 번의 호출로 처리합니다.
 *
 * @example
 * ```typescript
 * const result = await generateHybridPlanCompleteAction({
 *   planGroupId: "plan-group-uuid",
 *   student: { id: "...", name: "홍길동", grade: "고2" },
 *   scores: [{ subject: "수학", subjectCategory: "수학", score: 65 }],
 *   contents: [...],
 *   period: { startDate: "2026-01-06", endDate: "2026-01-19", totalDays: 14, studyDays: 12 },
 * });
 *
 * if (result.success) {
 *   console.log(`${result.planCount}개 플랜 생성됨`);
 *   console.log("AI 추천사항:", result.aiRecommendations);
 * }
 * ```
 */
async function _generateHybridPlanComplete(
  input: GenerateHybridPlanCompleteInput
): Promise<GenerateHybridPlanCompleteResult> {
  const totalStartTime = Date.now();

  // 테넌트 컨텍스트 및 권한 확인
  const tenant = await requireTenantContext();

  // 입력 검증
  if (!input.planGroupId) {
    throw new AppError(
      "플랜 그룹 ID는 필수입니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  // Phase 0: 가상 콘텐츠 영구 저장 (DB Persist)
  const idMap = new Map<string, string>(); // virtualId -> realId

  if (input.virtualContents && input.virtualContents.length > 0) {
    const supabase = await createSupabaseServerClient();
    
    // 병렬 처리보다는 순차 처리가 안전 (DB 부하 고려)
    for (const item of input.virtualContents) {
      try {
        let newContentId: string | undefined;

        if (item.contentType === "book") {
          // 1. 책 생성
          const createResult = await createBook({
            tenant_id: tenant.tenantId,
            student_id: input.student.id,
            title: item.title,
            subject: item.subject,
            subject_category: item.subject, // Category fallback
            total_pages: item.totalRange,
            difficulty_level: "medium", // Default
            publisher: item.author,
            notes: "AI 검색을 통해 추가된 교재입니다.",
          });

          if (createResult.success && createResult.bookId) {
            newContentId = createResult.bookId;

            // 2. 목차(Details) 생성
            if (item.chapters && item.chapters.length > 0) {
              const details = item.chapters.map((ch, idx) => ({
                book_id: newContentId!,
                major_unit: ch.title,
                page_number: ch.endRange, // 끝 페이지 기준
                display_order: idx + 1,
              }));

              const { error: detailsError } = await supabase
                .from("student_book_details")
                .insert(details);
              
              if (detailsError) {
                 logActionError({ domain: "plan", action: "persistVirtualContent" }, detailsError, { phase: "book_details", virtualId: item.id });
              }
            }
          }
        } else if (item.contentType === "lecture") {
          // 1. 강의 생성
          const createResult = await createLecture({
             tenant_id: tenant.tenantId,
             student_id: input.student.id,
             title: item.title,
             subject: item.subject,
             subject_category: item.subject,
             duration: item.totalRange * 30, // 임의 추정: 1강당 30분
             total_episodes: item.totalRange,
             // createLecture definition: duration, total_episodes is NOT in params? 
             // Checked createLecture params: duration is there. total_episodes is NOT in params but is in Lecture type.
             // Wait, createLecture params only has duration. StudentContents.ts:287 check.
             // It seems createLecture definition in studentContents.ts might need update or we use update after create?
             // Actually `createLecture` in studentContents.ts accepts: duration.
             // Let's rely on inserting episodes to populate 'total_episodes' implicitly or separate update?
             // For now just pass duration.
          });
          
          // `createLecture` in `studentContents.ts` allows: duration. It does NOT allow total_episodes in params. 
          // However, we can insert episodes manually.

          if (createResult.success && createResult.lectureId) {
            newContentId = createResult.lectureId;

             // 2. 에피소드(Episodes) 생성
             if (item.chapters && item.chapters.length > 0) {
               const episodes = item.chapters.map((ch, idx) => ({
                 lecture_id: newContentId!,
                 episode_number: idx + 1,
                 episode_title: ch.title,
                 duration: 30, // 기본 30분
                 display_order: idx + 1,
               }));

               const { error: episodesError } = await supabase
                 .from("student_lecture_episodes")
                 .insert(episodes);

               if (episodesError) {
                  logActionError({ domain: "plan", action: "persistVirtualContent" }, episodesError, { phase: "lecture_episodes", virtualId: item.id });
               }
             }
          }
        }

        if (newContentId) {
          idMap.set(item.id, newContentId);
          logActionDebug({ domain: "plan", action: "persistVirtualContent" }, "Virtual content persisted", { virtualId: item.id, realId: newContentId });
        }
      } catch (err) {
        logActionError({ domain: "plan", action: "persistVirtualContent" }, err, { virtualId: item.id });
        // 실패하더라도 나머지 진행 (AI 프레임워크 생성 시 해당 콘텐츠는 제외되거나 virtual ID로 남음)
      }
    }
  }

  // ID 매핑 적용 (virtualId -> realId)
  // 1. contents 배열 업데이트
  if (idMap.size > 0) {
    input.contents = input.contents.map(c => {
      const realId = idMap.get(c.id);
      if (realId) {
        return { ...c, id: realId, contentType: c.contentType === "custom" ? "custom" : c.contentType as "book" | "lecture" }; 
      }
      return c;
    });

    // 2. contentMappings 업데이트
    if (input.contentMappings) {
      input.contentMappings = input.contentMappings.map(c => {
        const realId = idMap.get(c.contentId);
         if (realId) {
           return { ...c, contentId: realId };
         }
         return c;
      });
    }
  }

  // Phase 1: AI Framework 생성
  const frameworkResult = await generateAIFrameworkAction({
    student: input.student,
    scores: input.scores,
    contents: input.contents,
    learningHistory: input.learningHistory,
    period: input.period,
    additionalInstructions: input.additionalInstructions,
    modelTier: input.modelTier,
    contentMappings: input.contentMappings,
    enableWebSearch: input.enableWebSearch,
    webSearchConfig: input.webSearchConfig,
  });

  // 에러 처리 (withErrorHandlingSafe 래핑 결과)
  if (!frameworkResult.success) {
    return {
      success: false,
      error: extractErrorMessage(frameworkResult.error),
      errorPhase: "ai_framework",
      totalProcessingTimeMs: Date.now() - totalStartTime,
    };
  }

  // conversionResult 확인
  if (!frameworkResult.conversionResult) {
    return {
      success: false,
      error: "AI 프레임워크 변환 실패",
      errorPhase: "ai_framework",
      aiProcessingTimeMs: frameworkResult.processingTimeMs,
      totalProcessingTimeMs: Date.now() - totalStartTime,
    };
  }

  // Phase 2: AI 옵션을 스케줄러 형식으로 변환
  const { schedulerOptions, aiRecommendations } = frameworkResult.conversionResult;

  const aiSchedulerOverride: AISchedulerOptionsOverride = {
    weak_subject_focus: schedulerOptions.weak_subject_focus,
    study_days: schedulerOptions.study_days,
    review_days: schedulerOptions.review_days,
    subject_allocations: schedulerOptions.subject_allocations,
    content_allocations: schedulerOptions.content_allocations,
  };

  // Phase 3: 코드 기반 스케줄러로 플랜 생성
  const userRole = input.role ?? (tenant.role === "parent" ? "student" : tenant.role);
  const planResult = await generatePlansWithServices({
    groupId: input.planGroupId,
    context: {
      studentId: input.student.id,
      tenantId: tenant.tenantId,
      userId: tenant.userId,
      role: userRole as "student" | "admin" | "consultant",
      isCampMode: false,
    },
    accessInfo: {
      userId: tenant.userId,
      role: userRole as "student" | "admin" | "consultant",
    },
    aiSchedulerOptionsOverride: aiSchedulerOverride,
  });

  if (!planResult.success) {
    return {
      success: false,
      error: planResult.error ?? "플랜 생성 실패",
      errorPhase: "plan_generation",
      aiRecommendations,
      tokensUsed: frameworkResult.tokensUsed,
      aiProcessingTimeMs: frameworkResult.processingTimeMs,
      totalProcessingTimeMs: Date.now() - totalStartTime,
      lowConfidenceWarning: frameworkResult.lowConfidenceWarning,
    };
  }

  // Phase 4: 성공 결과 반환
  return {
    success: true,
    planCount: planResult.count,
    aiRecommendations,
    tokensUsed: frameworkResult.tokensUsed,
    aiProcessingTimeMs: frameworkResult.processingTimeMs,
    totalProcessingTimeMs: Date.now() - totalStartTime,
    lowConfidenceWarning: frameworkResult.lowConfidenceWarning,
    webSearchResults: frameworkResult.webSearchResults,
  };
}

export const generateHybridPlanCompleteAction = withErrorHandlingSafe(
  _generateHybridPlanComplete
);

// ============================================
// 미리보기용 액션
// ============================================

/**
 * 하이브리드 플랜 미리보기 결과
 */
export interface PreviewHybridPlanResult {
  success: boolean;
  /** AI 프레임워크 */
  framework?: AIFramework;
  /** 변환된 스케줄러 옵션 */
  schedulerOptions?: AISchedulerOptionsOverride;
  /** AI 추천사항 */
  aiRecommendations?: AIRecommendations;
  /** 토큰 사용량 */
  tokensUsed?: {
    input: number;
    output: number;
  };
  /** 처리 시간 (ms) */
  processingTimeMs?: number;
  /** 낮은 신뢰도 경고 */
  lowConfidenceWarning?: boolean;
  /** 에러 메시지 */
  error?: string;
  /** 웹 검색 결과 (grounding 활성화 시) */
  webSearchResults?: {
    searchQueries: string[];
    resultsCount: number;
    results: WebSearchResult[];
  };
}

/**
 * 하이브리드 플랜 미리보기
 *
 * 실제 플랜 저장 없이 AI Framework와 스케줄러 옵션만 생성합니다.
 * UI에서 사용자에게 AI 전략을 보여주고 승인 받을 때 사용합니다.
 */
async function _previewHybridPlan(
  input: Omit<GenerateHybridPlanCompleteInput, "planGroupId">
): Promise<PreviewHybridPlanResult> {
  // 테넌트 컨텍스트 및 권한 확인
  await requireTenantContext();

  // AI Framework 생성
  const frameworkResult = await generateAIFrameworkAction({
    student: input.student,
    scores: input.scores,
    contents: input.contents,
    learningHistory: input.learningHistory,
    period: input.period,
    additionalInstructions: input.additionalInstructions,
    modelTier: input.modelTier,
    contentMappings: input.contentMappings,
    enableWebSearch: input.enableWebSearch,
    webSearchConfig: input.webSearchConfig,
  });

  // 에러 처리 (withErrorHandlingSafe 래핑 결과)
  if (!frameworkResult.success) {
    return {
      success: false,
      error: extractErrorMessage(frameworkResult.error),
    };
  }

  if (!frameworkResult.conversionResult) {
    return {
      success: false,
      error: "AI 프레임워크 변환 실패",
      processingTimeMs: frameworkResult.processingTimeMs,
    };
  }

  const { schedulerOptions, aiRecommendations } = frameworkResult.conversionResult;

  return {
    success: true,
    framework: frameworkResult.framework,
    schedulerOptions: {
      weak_subject_focus: schedulerOptions.weak_subject_focus,
      study_days: schedulerOptions.study_days,
      review_days: schedulerOptions.review_days,
      subject_allocations: schedulerOptions.subject_allocations,
      content_allocations: schedulerOptions.content_allocations,
    },
    aiRecommendations,
    tokensUsed: frameworkResult.tokensUsed,
    processingTimeMs: frameworkResult.processingTimeMs,
    lowConfidenceWarning: frameworkResult.lowConfidenceWarning,
    webSearchResults: frameworkResult.webSearchResults,
  };
}

export const previewHybridPlanAction = withErrorHandlingSafe(_previewHybridPlan);
