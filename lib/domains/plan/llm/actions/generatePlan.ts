"use server";

/**
 * AI 플랜 생성 서버 액션
 *
 * Claude API를 사용하여 학습 플랜을 자동 생성합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";

import { createMessage, getModelConfig, estimateCost, type GroundingMetadata, type WebSearchResult } from "../client";
import { SYSTEM_PROMPT, buildUserPrompt, estimatePromptTokens } from "../prompts/planGeneration";
import { getWebSearchContentService } from "../services/webSearchContentService";
import { buildLLMRequest, validateRequest } from "../transformers/requestBuilder";
import { parseLLMResponse, toDBPlanDataList } from "../transformers/responseParser";

import type {
  LLMPlanGenerationRequest,
  LLMPlanGenerationResponse,
  ModelTier,
  GeneratedPlanItem,
} from "../types";

import {
  validatePlans,
  type ValidationError,
  type ValidationWarning,
} from "../validators/planValidator";
import type { AcademyScheduleForPrompt, BlockInfoForPrompt } from "../transformers/requestBuilder";
import { getPlanExclusions } from "@/lib/data/planGroups/exclusions";

// ============================================
// 타입 정의
// ============================================

export interface GeneratePlanInput {
  /** 콘텐츠 ID 목록 */
  contentIds: string[];
  /** 시작 날짜 */
  startDate: string;
  /** 종료 날짜 */
  endDate: string;
  /** 일일 학습 시간 (분) */
  dailyStudyMinutes: number;
  /** 제외 요일 (0-6) */
  excludeDays?: number[];
  /** 제외 날짜 (YYYY-MM-DD 형식) - 직접 전달하거나, planGroupId가 있으면 자동 조회 */
  excludeDates?: string[];
  /** 취약 과목 우선 */
  prioritizeWeakSubjects?: boolean;
  /** 과목 균형 */
  balanceSubjects?: boolean;
  /** 복습 포함 */
  includeReview?: boolean;
  /** 복습 비율 (0-1) */
  reviewRatio?: number;
  /** 추가 지시사항 */
  additionalInstructions?: string;
  /** 모델 티어 */
  modelTier?: ModelTier;
  /** 플랜 그룹 ID (기존 그룹에 추가할 경우) */
  planGroupId?: string;
  /** 새 플랜 그룹 이름 (새로 생성할 경우) */
  planGroupName?: string;
  /** 웹 검색 활성화 여부 (Gemini Grounding) */
  enableWebSearch?: boolean;
  /** 웹 검색 설정 */
  webSearchConfig?: {
    /** 검색 모드 - dynamic: 필요시 검색, always: 항상 검색 */
    mode?: "dynamic" | "always";
    /** 동적 검색 임계값 (0.0 - 1.0) */
    dynamicThreshold?: number;
    /** 검색 결과를 DB에 저장할지 여부 */
    saveResults?: boolean;
  };
}

export interface GeneratePlanResult {
  success: boolean;
  data?: {
    planGroupId: string;
    totalPlans: number;
    response: LLMPlanGenerationResponse;
    cost: {
      inputTokens: number;
      outputTokens: number;
      estimatedUSD: number;
    };
    /** 검증 결과 - 에러가 있으면 플랜이 저장되지 않음 */
    validation?: {
      valid: boolean;
      errors: ValidationError[];
      warnings: ValidationWarning[];
    };
    /** 웹 검색 결과 (grounding 활성화 시) */
    webSearchResults?: {
      searchQueries: string[];
      resultsCount: number;
      savedCount?: number;
      /** 검색 결과 목록 (UI 표시용) */
      results: WebSearchResult[];
    };
  };
  error?: string;
}

// ============================================
// 데이터 로드
// ============================================

async function loadStudentData(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, school_name, target_university, target_major, tenant_id")
    .eq("id", userId)
    .single();

  return student;
}

async function loadScores(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, studentId: string) {
  const { data: scores } = await supabase
    .from("scores")
    .select("subject, subject_category, score, grade, percentile, standard_score")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);

  return scores || [];
}

async function loadContents(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, contentIds: string[]) {
  const { data: contents } = await supabase
    .from("content_masters")
    .select(`
      id,
      title,
      subject,
      subject_category,
      content_type,
      total_pages,
      total_lectures,
      estimated_hours
    `)
    .in("id", contentIds);

  return contents || [];
}

async function loadTimeSlots(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, tenantId: string) {
  const { data: slots } = await supabase
    .from("time_slots")
    .select("id, name, start_time, end_time, slot_type")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("slot_order", { ascending: true });

  return slots || [];
}

async function loadAcademySchedules(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  tenantId: string
): Promise<AcademyScheduleForPrompt[]> {
  const { data: schedules } = await supabase
    .from("academy_schedules")
    .select("id, day_of_week, start_time, end_time, academy_name, travel_time")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!schedules || schedules.length === 0) {
    return [];
  }

  return schedules.map((s) => ({
    id: s.id,
    dayOfWeek: s.day_of_week,
    startTime: s.start_time,
    endTime: s.end_time,
    academyName: s.academy_name || undefined,
    travelTime: s.travel_time ?? 60,
  }));
}

async function loadBlockSets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<BlockInfoForPrompt[]> {
  // 블록 세트와 블록 스케줄을 조인하여 조회
  const { data: blocks } = await supabase
    .from("student_block_schedule")
    .select("id, day_of_week, start_time, end_time, block_set_id")
    .eq("student_id", studentId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!blocks || blocks.length === 0) {
    return [];
  }

  return blocks.map((b, index) => ({
    id: b.id,
    blockIndex: index,
    dayOfWeek: b.day_of_week,
    startTime: b.start_time,
    endTime: b.end_time,
  }));
}

async function loadLearningStats(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, studentId: string) {
  // 최근 30일 학습 통계 계산
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: plans } = await supabase
    .from("student_plan")
    .select("status, progress, estimated_minutes")
    .eq("student_id", studentId)
    .gte("plan_date", thirtyDaysAgo.toISOString().split("T")[0]);

  if (!plans || plans.length === 0) {
    return {
      total_plans_completed: 0,
      average_completion_rate: 0,
      average_daily_minutes: 0,
    };
  }

  const completed = plans.filter((p) => p.status === "completed").length;
  const avgProgress =
    plans.reduce((sum, p) => sum + (p.progress || 0), 0) / plans.length;
  const avgMinutes =
    plans.reduce((sum, p) => sum + (p.estimated_minutes || 0), 0) / 30;

  return {
    total_plans_completed: completed,
    average_completion_rate: Math.round(avgProgress),
    average_daily_minutes: Math.round(avgMinutes),
  };
}

// ============================================
// 플랜 저장
// ============================================

async function createPlanGroup(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  tenantId: string,
  name: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from("plan_groups")
    .insert({
      student_id: studentId,
      tenant_id: tenantId,
      name,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      generation_mode: "ai",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function savePlans(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  tenantId: string,
  planGroupId: string,
  plans: GeneratedPlanItem[]
) {
  const planData = plans.map((plan) => ({
    student_id: studentId,
    tenant_id: tenantId,
    plan_group_id: planGroupId,
    plan_date: plan.date,
    start_time: plan.startTime,
    end_time: plan.endTime,
    content_id: plan.contentId,
    title: plan.contentTitle,
    subject: plan.subject,
    subject_category: plan.subjectCategory,
    range_start: plan.rangeStart,
    range_end: plan.rangeEnd,
    range_display: plan.rangeDisplay,
    estimated_minutes: plan.estimatedMinutes,
    is_review: plan.isReview || false,
    notes: plan.notes,
    priority: plan.priority || "medium",
    status: "pending",
    progress: 0,
  }));

  const { error } = await supabase.from("student_plan").insert(planData);

  if (error) throw error;
}

// ============================================
// 메인 액션
// ============================================

/**
 * Claude API를 사용하여 학습 플랜을 자동 생성하고 저장합니다
 *
 * 처리 과정:
 * 1. 학생 데이터 및 관련 정보 로드 (성적, 콘텐츠, 시간 슬롯, 학습 통계)
 * 2. LLM 요청 빌드 및 유효성 검사
 * 3. Claude API 호출
 * 4. 응답 파싱 및 검증
 * 5. 플랜 그룹 생성 또는 기존 그룹에 추가
 * 6. 생성된 플랜 DB 저장
 * 7. 관련 페이지 캐시 무효화
 *
 * @param {GeneratePlanInput} input - 플랜 생성 입력
 * @returns {Promise<GeneratePlanResult>} 생성 결과 { success, data?, error? }
 *
 * @example
 * ```typescript
 * // 서버 컴포넌트 또는 액션에서 호출
 * const result = await generatePlanWithAI({
 *   contentIds: ['content-1', 'content-2'],
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31',
 *   dailyStudyMinutes: 180,
 *   prioritizeWeakSubjects: true,
 *   includeReview: true,
 *   reviewRatio: 0.2,
 * });
 *
 * if (result.success) {
 *   console.log('생성된 플랜 수:', result.data.totalPlans);
 *   console.log('비용:', `$${result.data.cost.estimatedUSD.toFixed(4)}`);
 * }
 * ```
 */
export async function generatePlanWithAI(
  input: GeneratePlanInput
): Promise<GeneratePlanResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    // 1. 학생 데이터 로드
    const student = await loadStudentData(supabase, user.userId);
    if (!student) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    // 2. 관련 데이터 로드 (검증용 학원 일정, 블록 세트 포함)
    const tenantId = student.tenant_id;
    if (!tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const [scores, contents, timeSlots, learningStats, academySchedules, blockSets] = await Promise.all([
      loadScores(supabase, student.id),
      loadContents(supabase, input.contentIds),
      loadTimeSlots(supabase, tenantId),
      loadLearningStats(supabase, student.id),
      loadAcademySchedules(supabase, student.id, tenantId),
      loadBlockSets(supabase, student.id),
    ]);

    if (contents.length === 0) {
      return { success: false, error: "선택된 콘텐츠가 없습니다." };
    }

    // 2-1. 제외 날짜 조회 (입력값 우선, 없으면 플랜 그룹에서 조회)
    let excludeDates: string[] = [];
    if (input.excludeDates && input.excludeDates.length > 0) {
      // 입력으로 직접 전달된 제외 날짜 사용
      excludeDates = input.excludeDates;
    } else if (input.planGroupId) {
      // 기존 플랜 그룹이 있으면 해당 그룹의 제외일 조회
      const exclusions = await getPlanExclusions(input.planGroupId, tenantId);
      excludeDates = exclusions.map((e) => e.exclusion_date);
    }

    // 3. LLM 요청 빌드
    const llmRequest = buildLLMRequest({
      student: {
        id: student.id,
        name: student.name,
        grade: student.grade,
        school_name: student.school_name,
        target_university: student.target_university,
        target_major: student.target_major,
      },
      scores,
      contents: contents.slice(0, 20).map((c) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        subject_category: c.subject_category,
        content_type: c.content_type,
        total_pages: c.total_pages,
        total_lectures: c.total_lectures,
        estimated_hours: c.estimated_hours,
      })),
      timeSlots: timeSlots.map((s) => ({
        id: s.id,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        slot_type: s.slot_type,
      })),
      learningStats,
      settings: {
        startDate: input.startDate,
        endDate: input.endDate,
        dailyStudyMinutes: input.dailyStudyMinutes,
        excludeDays: input.excludeDays,
        prioritizeWeakSubjects: input.prioritizeWeakSubjects,
        balanceSubjects: input.balanceSubjects,
        includeReview: input.includeReview,
        reviewRatio: input.reviewRatio,
      },
      additionalInstructions: input.additionalInstructions,
    });

    // 4. 요청 유효성 검사
    const validation = validateRequest(llmRequest);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(", ") };
    }

    // 5. 토큰 추정 및 비용 확인
    const tokenEstimate = estimatePromptTokens(llmRequest);
    console.log(`[AI Plan] 예상 입력 토큰: ${tokenEstimate.totalTokens}`);

    // 6. LLM 호출
    const modelTier = input.modelTier || "standard";
    const userPrompt = buildUserPrompt(llmRequest);

    // Grounding 설정 (웹 검색)
    const groundingConfig = input.enableWebSearch
      ? {
          enabled: true,
          mode: input.webSearchConfig?.mode || ("dynamic" as const),
          dynamicThreshold: input.webSearchConfig?.dynamicThreshold,
        }
      : undefined;

    const result = await createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
      grounding: groundingConfig,
    });

    // 6-1. 웹 검색 결과 처리
    let webSearchResults:
      | {
          searchQueries: string[];
          resultsCount: number;
          savedCount?: number;
          results: WebSearchResult[];
        }
      | undefined;

    if (result.groundingMetadata && result.groundingMetadata.webResults.length > 0) {
      console.log(
        `[AI Plan] 웹 검색 결과: ${result.groundingMetadata.webResults.length}건, 검색어: ${result.groundingMetadata.searchQueries.join(", ")}`
      );

      webSearchResults = {
        searchQueries: result.groundingMetadata.searchQueries,
        resultsCount: result.groundingMetadata.webResults.length,
        results: result.groundingMetadata.webResults,
      };

      // DB 저장 옵션이 활성화된 경우
      if (input.webSearchConfig?.saveResults && tenantId) {
        const webContentService = getWebSearchContentService();

        // Grounding 메타데이터를 콘텐츠로 변환
        const webContents = webContentService.transformToContent(result.groundingMetadata, {
          tenantId,
          // 콘텐츠에서 과목 정보 추출 (첫 번째 콘텐츠 기준)
          subject: contents[0]?.subject,
          subjectCategory: contents[0]?.subject_category,
        });

        if (webContents.length > 0) {
          const saveResult = await webContentService.saveToDatabase(webContents, tenantId);
          webSearchResults.savedCount = saveResult.savedCount;

          console.log(
            `[AI Plan] 웹 콘텐츠 저장: ${saveResult.savedCount}건 저장, ${saveResult.duplicateCount}건 중복`
          );

          if (saveResult.errors.length > 0) {
            console.warn("[AI Plan] 웹 콘텐츠 저장 오류:", saveResult.errors);
          }
        }
      }
    }

    // 7. 응답 파싱
    const parsed = parseLLMResponse(result.content, result.modelId, result.usage);

    if (!parsed.success || !parsed.response) {
      return { success: false, error: parsed.error || "플랜 생성에 실패했습니다." };
    }

    // 8. 플랜 추출 및 검증
    const allPlans: GeneratedPlanItem[] = [];
    for (const matrix of parsed.response.weeklyMatrices) {
      for (const day of matrix.days) {
        allPlans.push(...day.plans);
      }
    }

    // 9. 플랜 검증 (학원 충돌, 제외일, 일일 학습량, 블록 호환성)
    const validationResult = validatePlans({
      plans: allPlans,
      academySchedules,
      blockSets,
      excludeDays: input.excludeDays,
      excludeDates,
      dailyStudyMinutes: input.dailyStudyMinutes,
    });

    // 검증 결과 로깅
    if (validationResult.errors.length > 0) {
      console.warn(`[AI Plan] 검증 에러 ${validationResult.errors.length}건:`,
        validationResult.errors.slice(0, 5).map(e => e.message));
    }
    if (validationResult.warnings.length > 0) {
      console.log(`[AI Plan] 검증 경고 ${validationResult.warnings.length}건`);
    }

    // 10. 플랜 그룹 생성 또는 사용
    let finalPlanGroupId: string;

    if (input.planGroupId) {
      finalPlanGroupId = input.planGroupId;
    } else {
      const groupName =
        input.planGroupName ||
        `AI 학습 계획 (${input.startDate} ~ ${input.endDate})`;

      finalPlanGroupId = await createPlanGroup(
        supabase,
        student.id,
        tenantId,
        groupName,
        input.startDate,
        input.endDate
      );
    }

    // 11. 플랜 저장 (검증 에러가 있어도 저장, 경고와 함께 반환)
    await savePlans(supabase, student.id, tenantId, finalPlanGroupId, allPlans);

    // 12. 캐시 무효화
    revalidatePath("/plan");
    revalidatePath("/plan/calendar");
    revalidatePath("/today");

    // 13. 비용 계산
    const estimatedCost = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      modelTier
    );

    return {
      success: true,
      data: {
        planGroupId: finalPlanGroupId,
        totalPlans: allPlans.length,
        response: parsed.response,
        cost: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedUSD: estimatedCost,
        },
        validation: validationResult,
        webSearchResults,
      },
    };
  } catch (error) {
    console.error("[AI Plan] 생성 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 생성 중 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 미리보기 (저장하지 않음)
// ============================================

export interface PreviewPlanResult {
  success: boolean;
  data?: {
    response: LLMPlanGenerationResponse;
    cost: {
      inputTokens: number;
      outputTokens: number;
      estimatedUSD: number;
    };
    /** 검증 결과 - 미리보기에서도 검증 수행 */
    validation?: {
      valid: boolean;
      errors: ValidationError[];
      warnings: ValidationWarning[];
    };
  };
  error?: string;
}

/**
 * Claude API를 사용하여 학습 플랜을 미리보기로 생성합니다 (저장하지 않음)
 *
 * `generatePlanWithAI`와 동일한 로직으로 플랜을 생성하지만,
 * DB에 저장하지 않고 결과만 반환합니다.
 *
 * 기본적으로 'fast' 모델(Haiku)을 사용하여 비용을 절감합니다.
 *
 * @param {Omit<GeneratePlanInput, 'planGroupId' | 'planGroupName'>} input - 플랜 생성 입력 (그룹 정보 제외)
 * @returns {Promise<PreviewPlanResult>} 미리보기 결과 { success, data?, error? }
 *
 * @example
 * ```typescript
 * // 플랜 확인 후 저장 여부 결정
 * const preview = await previewPlanWithAI({
 *   contentIds: ['content-1'],
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-07',
 *   dailyStudyMinutes: 120,
 * });
 *
 * if (preview.success) {
 *   // UI에 미리보기 표시
 *   showPreview(preview.data.response);
 *
 *   // 사용자 확인 후 실제 저장
 *   if (userConfirmed) {
 *     await generatePlanWithAI({ ...input, planGroupName: 'My Plan' });
 *   }
 * }
 * ```
 */
export async function previewPlanWithAI(
  input: Omit<GeneratePlanInput, "planGroupId" | "planGroupName">
): Promise<PreviewPlanResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    // 데이터 로드 (검증용 학원 일정, 블록 세트 포함)
    const student = await loadStudentData(supabase, user.userId);
    if (!student) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    const tenantId = student.tenant_id;
    if (!tenantId) {
      return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
    }

    const [scores, contents, timeSlots, learningStats, academySchedules, blockSets] = await Promise.all([
      loadScores(supabase, student.id),
      loadContents(supabase, input.contentIds),
      loadTimeSlots(supabase, tenantId),
      loadLearningStats(supabase, student.id),
      loadAcademySchedules(supabase, student.id, tenantId),
      loadBlockSets(supabase, student.id),
    ]);

    if (contents.length === 0) {
      return { success: false, error: "선택된 콘텐츠가 없습니다." };
    }

    // LLM 요청 빌드
    const llmRequest = buildLLMRequest({
      student: {
        id: student.id,
        name: student.name,
        grade: student.grade,
        school_name: student.school_name,
        target_university: student.target_university,
        target_major: student.target_major,
      },
      scores,
      contents: contents.slice(0, 20).map((c) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        subject_category: c.subject_category,
        content_type: c.content_type,
        total_pages: c.total_pages,
        total_lectures: c.total_lectures,
        estimated_hours: c.estimated_hours,
      })),
      timeSlots: timeSlots.map((s) => ({
        id: s.id,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        slot_type: s.slot_type,
      })),
      learningStats,
      settings: {
        startDate: input.startDate,
        endDate: input.endDate,
        dailyStudyMinutes: input.dailyStudyMinutes,
        excludeDays: input.excludeDays,
        prioritizeWeakSubjects: input.prioritizeWeakSubjects,
        balanceSubjects: input.balanceSubjects,
        includeReview: input.includeReview,
        reviewRatio: input.reviewRatio,
      },
      additionalInstructions: input.additionalInstructions,
    });

    // 요청 유효성 검사
    const requestValidation = validateRequest(llmRequest);
    if (!requestValidation.valid) {
      return { success: false, error: requestValidation.errors.join(", ") };
    }

    // LLM 호출 (fast 모델 사용으로 비용 절감)
    const modelTier = input.modelTier || "fast";
    const userPrompt = buildUserPrompt(llmRequest);

    const result = await createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
    });

    // 응답 파싱
    const parsed = parseLLMResponse(result.content, result.modelId, result.usage);

    if (!parsed.success || !parsed.response) {
      return { success: false, error: parsed.error || "플랜 생성에 실패했습니다." };
    }

    // 플랜 추출 및 검증
    const allPlans: GeneratedPlanItem[] = [];
    for (const matrix of parsed.response.weeklyMatrices) {
      for (const day of matrix.days) {
        allPlans.push(...day.plans);
      }
    }

    const validationResult = validatePlans({
      plans: allPlans,
      academySchedules,
      blockSets,
      excludeDays: input.excludeDays,
      excludeDates: input.excludeDates || [],
      dailyStudyMinutes: input.dailyStudyMinutes,
    });

    // 비용 계산
    const estimatedCost = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      modelTier
    );

    return {
      success: true,
      data: {
        response: parsed.response,
        cost: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedUSD: estimatedCost,
        },
        validation: validationResult,
      },
    };
  } catch (error) {
    console.error("[AI Plan Preview] 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "미리보기 생성 중 오류가 발생했습니다.",
    };
  }
}
