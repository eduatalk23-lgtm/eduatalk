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

import { logActionError, logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandlingSafe } from "@/lib/errors";
import { MetricsBuilder, logRecommendationError } from "../metrics";
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
import { getOrCreateDefaultPlannerAction } from "@/lib/domains/plan/actions/planners/autoCreate";

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
 * 콘텐츠 타입 안전 검증 헬퍼
 * 타입 어서션 대신 런타임 검증으로 타입 안전성 강화
 */
function safeContentType(type: string): "book" | "lecture" | "custom" {
  if (type === "book" || type === "lecture") {
    return type;
  }
  return "custom";
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
 * 플래너 검증 모드
 * - warn: 경고만 로깅 (기본값, 레거시 호환)
 * - strict: 플래너 미연결 시 에러 반환
 * - auto_create: 플래너 미연결 시 자동 생성 후 연결
 */
export type PlannerValidationMode = "warn" | "strict" | "auto_create";

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
  /** Phase 3: 플래너 검증 모드 (기본: warn) */
  plannerValidationMode?: PlannerValidationMode;
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

  // 메트릭스 빌더 초기화
  const metricsBuilder = MetricsBuilder.create("generateHybridPlanComplete")
    .setContext({ studentId: input.student.id })
    .setRequestParams({
      contentType: "hybridComplete",
      maxRecommendations: input.contents.length,
    });

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

  // Phase 0.5: Plan Group 정보 조회 및 플래너 연계 검증
  const supabaseForValidation = await createSupabaseServerClient();
  const { data: planGroup, error: planGroupError } = await supabaseForValidation
    .from("plan_groups")
    .select("id, name, planner_id, is_single_content, content_type, content_id, start_range, end_range")
    .eq("id", input.planGroupId)
    .single();

  if (planGroupError || !planGroup) {
    throw new AppError(
      `플랜 그룹을 찾을 수 없습니다: ${input.planGroupId}`,
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // Phase 3: 플래너 연결 확인 (검증 모드에 따라 다르게 처리)
  const validationMode = input.plannerValidationMode ?? "warn";

  if (!planGroup.planner_id) {
    if (validationMode === "strict") {
      // strict 모드: 플래너 미연결 시 에러 반환
      return {
        success: false,
        error: "플래너 미연결 Plan Group입니다. 플래너를 먼저 연결하세요.",
        errorPhase: "ai_framework",
      };
    }

    if (validationMode === "auto_create") {
      // auto_create 모드: 플래너 자동 생성 후 Plan Group 업데이트
      try {
        // getOrCreateDefaultPlannerAction은 성공 시 직접 결과 반환, 실패 시 throw
        const plannerResult = await getOrCreateDefaultPlannerAction({
          studentId: input.student.id,
          periodStart: input.period.startDate,
          periodEnd: input.period.endDate,
        });

        const { error: updateError } = await supabaseForValidation
          .from("plan_groups")
          .update({ planner_id: plannerResult.plannerId })
          .eq("id", input.planGroupId);

        if (!updateError) {
          logActionDebug(
            { domain: "plan", action: "generateHybridPlanComplete" },
            "플래너 자동 생성 및 연결 완료",
            {
              planGroupId: input.planGroupId,
              plannerId: plannerResult.plannerId,
              isNewPlanner: plannerResult.isNew,
            }
          );
        } else {
          logActionWarn(
            { domain: "plan", action: "generateHybridPlanComplete" },
            "플래너 연결 실패 (계속 진행)",
            { error: updateError.message }
          );
        }
      } catch (plannerError) {
        logActionWarn(
          { domain: "plan", action: "generateHybridPlanComplete" },
          "플래너 자동 생성 실패 (계속 진행)",
          { error: plannerError instanceof Error ? plannerError.message : "Unknown error" }
        );
      }
    } else {
      // warn 모드 (기본값): 경고만 로깅, 레거시 호환성 유지
      // P3-3: 레거시 데이터 경고 개선
      logActionWarn(
        { domain: "plan", action: "generateHybridPlanComplete" },
        "[레거시] 플래너 미연결 Plan Group에서 AI 플랜 생성",
        {
          planGroupId: input.planGroupId,
          planGroupName: planGroup.name,
          studentId: input.student.id,
          legacyInfo: {
            reason: "플래너 없이 생성된 Plan Group (레거시 워크플로우)",
            recommendation: "plannerValidationMode: 'auto_create' 사용 권장",
            impact: "학생별 학습 계획 통합 관리 불가",
          },
        }
      );
    }
  }

  // P2-2: 단일 콘텐츠 모드 검증 강화
  // P3-3: 레거시 데이터 경고 개선 - 더 상세한 안내 제공
  if (!planGroup.is_single_content) {
    logActionWarn(
      { domain: "plan", action: "generateHybridPlanComplete" },
      "[레거시] 다중 콘텐츠 Plan Group 감지 - 마이그레이션 권장",
      {
        planGroupId: input.planGroupId,
        planGroupName: planGroup.name,
        isSingleContent: planGroup.is_single_content,
        legacyInfo: {
          reason: "plan_contents 테이블을 사용하는 레거시 구조",
          recommendation: "단일 콘텐츠 모드(is_single_content: true)로 마이그레이션 권장",
          migrationPath: "Plan Group 재생성 또는 data migration script 실행",
          affectedFeatures: ["플래너 통합", "콘텐츠 범위 직접 참조", "성능 최적화"],
        },
      }
    );
  } else {
    // 단일 콘텐츠 모드일 때 데이터 무결성 검증
    const contentValidationIssues: string[] = [];

    if (!planGroup.content_type) {
      contentValidationIssues.push("content_type 누락");
    }
    if (!planGroup.content_id) {
      contentValidationIssues.push("content_id 누락");
    }

    // 범위 검증
    const startRange = planGroup.start_range;
    const endRange = planGroup.end_range;

    if (startRange != null && endRange != null) {
      if (startRange > endRange) {
        contentValidationIssues.push(`범위 역전 (start: ${startRange} > end: ${endRange})`);
      }
      if (startRange < 0 || endRange < 0) {
        contentValidationIssues.push(`음수 범위값 (start: ${startRange}, end: ${endRange})`);
      }
    } else if (planGroup.content_type && planGroup.content_id) {
      // 콘텐츠는 있지만 범위가 없는 경우 (경고)
      if (startRange == null && endRange == null) {
        contentValidationIssues.push("범위 정보 미설정");
      }
    }

    if (contentValidationIssues.length > 0) {
      logActionWarn(
        { domain: "plan", action: "generateHybridPlanComplete" },
        "단일 콘텐츠 모드 데이터 불완전",
        {
          planGroupId: input.planGroupId,
          planGroupName: planGroup.name,
          issues: contentValidationIssues,
          contentType: planGroup.content_type,
          contentId: planGroup.content_id,
          startRange,
          endRange,
        }
      );
    } else {
      logActionDebug(
        { domain: "plan", action: "generateHybridPlanComplete" },
        "단일 콘텐츠 Plan Group 확인",
        {
          planGroupId: input.planGroupId,
          contentType: planGroup.content_type,
          contentId: planGroup.content_id,
          startRange,
          endRange,
        }
      );
    }
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
        return { ...c, id: realId, contentType: safeContentType(c.contentType) }; 
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
    // 에러 메트릭스 로깅
    logRecommendationError(
      "generateHybridPlanComplete",
      extractErrorMessage(frameworkResult.error),
      {
        studentId: input.student.id,
        strategy: "recommend",
        stage: "ai_framework",
      }
    );

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

  // Phase 4: 성공 메트릭스 로깅
  metricsBuilder
    .setContext({ tenantId: tenant.tenantId })
    .setTokenUsage({
      inputTokens: frameworkResult.tokensUsed?.input ?? 0,
      outputTokens: frameworkResult.tokensUsed?.output ?? 0,
      totalTokens: (frameworkResult.tokensUsed?.input ?? 0) + (frameworkResult.tokensUsed?.output ?? 0),
    })
    .setCost({
      estimatedUSD: 0, // 상위 레벨에서 집계
      modelTier: input.modelTier || "standard",
    })
    .setRecommendation({
      count: planResult.count ?? 0,
      strategy: "recommend",
      usedFallback: false,
    })
    .setWebSearch({
      enabled: input.enableWebSearch ?? false,
      queriesCount: frameworkResult.webSearchResults?.searchQueries.length ?? 0,
      resultsCount: frameworkResult.webSearchResults?.resultsCount ?? 0,
    })
    .log();

  // Phase 5: 성공 결과 반환
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
