"use server";

/**
 * 배치 AI 플랜 생성 액션
 *
 * 여러 학생에게 동시에 AI 플랜을 생성합니다.
 * API 레이트 리밋을 고려하여 동시에 최대 3명씩 처리합니다.
 *
 * @module lib/domains/admin-plan/actions/batchAIPlanGeneration
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandlingSafe } from "@/lib/errors";
import { revalidatePath } from "next/cache";

import { createMessage, estimateCost, type GroundingMetadata } from "@/lib/domains/plan/llm/client";
import { getWebSearchContentService } from "@/lib/domains/plan/llm/services/webSearchContentService";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
} from "@/lib/domains/plan/llm/prompts/planGeneration";
import {
  buildLLMRequest,
  validateRequest,
} from "@/lib/domains/plan/llm/transformers/requestBuilder";
import { parseLLMResponse } from "@/lib/domains/plan/llm/transformers/responseParser";

import type {
  ModelTier,
  GeneratedPlanItem,
} from "@/lib/domains/plan/llm/types";

// 원자 트랜잭션 임포트
import {
  createPlanGroupAtomic,
  generatePlansAtomic,
  type AtomicPlanGroupInput,
} from "@/lib/domains/plan/transactions";
import { batchPlanItemsToAtomicPayloads } from "@/lib/domains/admin-plan/transformers/llmResponseTransformer";

// ============================================
// 타입 정의
// ============================================

/**
 * 배치 플랜 생성 설정
 */
export interface BatchPlanSettings {
  /** 시작 날짜 */
  startDate: string;
  /** 종료 날짜 */
  endDate: string;
  /** 일일 학습 시간 (분) */
  dailyStudyMinutes: number;
  /** 제외 요일 (0-6) */
  excludeDays?: number[];
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
  /** 모델 티어 (기본값: fast - 비용 효율적) */
  modelTier?: ModelTier;
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

/**
 * 배치 플랜 생성 입력
 */
export interface BatchPlanGenerationInput {
  /** 학생 ID 및 콘텐츠 ID 목록 */
  students: Array<{
    studentId: string;
    contentIds: string[];
  }>;
  /** 공통 설정 */
  settings: BatchPlanSettings;
  /** 플랜 그룹 이름 템플릿 (기본값: "AI 학습 계획 ({startDate} ~ {endDate})") */
  planGroupNameTemplate?: string;
}

/**
 * 개별 학생 결과
 */
export interface StudentPlanResult {
  studentId: string;
  studentName: string;
  status: "success" | "error" | "skipped";
  planGroupId?: string;
  totalPlans?: number;
  cost?: {
    inputTokens: number;
    outputTokens: number;
    estimatedUSD: number;
  };
  error?: string;
  /** 실패한 단계 (에러 진단용) */
  failedStep?: string;
  /** 웹 검색 결과 (grounding 활성화 시) */
  webSearchResults?: {
    searchQueries: string[];
    resultsCount: number;
    savedCount?: number;
    /** 웹 콘텐츠 저장 경고 메시지 */
    saveWarnings?: string[];
    /** 웹 콘텐츠 저장 에러 메시지 */
    saveError?: string;
  };
}

/**
 * 배치 진행 이벤트
 */
export interface BatchProgressEvent {
  type: "progress" | "complete" | "error";
  current: number;
  total: number;
  studentId?: string;
  studentName?: string;
  status?: "success" | "error" | "skipped";
  message?: string;
}

/**
 * 배치 플랜 생성 결과
 */
export interface BatchPlanGenerationResult {
  success: boolean;
  results: StudentPlanResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    totalPlans: number;
    totalCost: number;
  };
  error?: string;
}

// ============================================
// 데이터 로드 함수
// ============================================

async function loadStudentData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  tenantId?: string
) {
  let query = supabase
    .from("students")
    .select("id, name, grade, school_id, school_type, tenant_id")
    .eq("id", studentId);

  // tenant_id가 제공된 경우 추가 필터링
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: student, error } = await query.single();

  // 디버깅을 위한 상세 로깅
  if (error) {
    console.error(`[loadStudentData] 학생 조회 실패 - studentId: ${studentId}`, {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      tenantId: tenantId || "not provided",
    });
  }

  if (!student && !error) {
    console.warn(`[loadStudentData] 학생 데이터 없음 - studentId: ${studentId}, tenantId: ${tenantId || "not provided"}`);
  }

  return student;
}

async function loadScores(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
) {
  const { data: scores } = await supabase
    .from("scores")
    .select(
      "subject, subject_category, score, grade, percentile, standard_score"
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);

  return scores || [];
}

async function loadContents(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  contentIds: string[]
) {
  if (!contentIds || contentIds.length === 0) {
    return [];
  }

  // master_books와 master_lectures에서 조회 (content_masters 뷰가 없으므로 직접 조회)
  const [booksResult, lecturesResult] = await Promise.all([
    supabase
      .from("master_books")
      .select(`
        id,
        title,
        subject,
        subject_category,
        total_pages,
        estimated_hours
      `)
      .in("id", contentIds)
      .eq("is_active", true),
    supabase
      .from("master_lectures")
      .select(`
        id,
        title,
        subject,
        subject_category,
        total_episodes,
        estimated_hours
      `)
      .in("id", contentIds)
      .eq("is_active", true),
  ]);

  // 결과 통합
  const contents = [
    ...(booksResult.data || []).map((b) => ({
      id: b.id,
      title: b.title,
      subject: b.subject,
      subject_category: b.subject_category,
      content_type: "book" as const,
      total_pages: b.total_pages,
      total_lectures: null,
      estimated_hours: b.estimated_hours ? Number(b.estimated_hours) : null,
    })),
    ...(lecturesResult.data || []).map((l) => ({
      id: l.id,
      title: l.title,
      subject: l.subject,
      subject_category: l.subject_category,
      content_type: "lecture" as const,
      total_pages: null,
      total_lectures: l.total_episodes,
      estimated_hours: l.estimated_hours ? Number(l.estimated_hours) : null,
    })),
  ];

  console.log(`[loadContents] 조회 결과 - books: ${booksResult.data?.length || 0}, lectures: ${lecturesResult.data?.length || 0}`);
  return contents;
}

async function loadTimeSlots(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string
) {
  const { data: slots } = await supabase
    .from("time_slots")
    .select("id, name, start_time, end_time, slot_type")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("slot_order", { ascending: true });

  return slots || [];
}

async function loadLearningStats(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
) {
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
// 개별 학생 플랜 생성 (원자 트랜잭션 사용)
// ============================================

export async function generatePlanForStudent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  studentId: string,
  contentIds: string[],
  settings: BatchPlanSettings,
  planGroupNameTemplate: string
): Promise<StudentPlanResult> {
  // 단계 추적 변수 (에러 진단용)
  let currentStep = "init";
  let studentName = "Unknown";

  try {
    // 1. 학생 데이터 로드 (tenantId를 전달하여 정확한 tenant 컨텍스트에서 조회)
    currentStep = "load_student";
    console.log(`[Batch AI Plan] 단계: ${currentStep} - studentId: ${studentId}`);

    const student = await loadStudentData(supabase, studentId, tenantId);
    if (!student) {
      return {
        studentId,
        studentName: "Unknown",
        status: "error",
        error: "학생 정보를 찾을 수 없습니다.",
        failedStep: currentStep,
      };
    }
    studentName = student.name;

    // 2. 콘텐츠 확인
    currentStep = "validate_content";
    if (!contentIds || contentIds.length === 0) {
      return {
        studentId,
        studentName: student.name,
        status: "skipped",
        error: "선택된 콘텐츠가 없습니다.",
        failedStep: currentStep,
      };
    }

    // 3. 관련 데이터 로드
    currentStep = "load_data";
    console.log(`[Batch AI Plan] 단계: ${currentStep} - ${studentName}`);

    const [scores, contents, timeSlots, learningStats] = await Promise.all([
      loadScores(supabase, studentId),
      loadContents(supabase, contentIds),
      loadTimeSlots(supabase, tenantId),
      loadLearningStats(supabase, studentId),
    ]);

    console.log(`[Batch AI Plan] 데이터 로드 완료 - scores: ${scores.length}, contents: ${contents.length}, timeSlots: ${timeSlots.length}`);

    if (contents.length === 0) {
      return {
        studentId,
        studentName: student.name,
        status: "skipped",
        error: "유효한 콘텐츠가 없습니다.",
        failedStep: currentStep,
      };
    }

    // 4. LLM 요청 빌드
    currentStep = "build_request";
    console.log(`[Batch AI Plan] 단계: ${currentStep} - ${studentName}`);

    const llmRequest = buildLLMRequest({
      student: {
        id: student.id,
        name: student.name,
        grade: student.grade,
        school_name: undefined, // students 테이블에 해당 컬럼 없음
        target_university: undefined,
        target_major: undefined,
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
        startDate: settings.startDate,
        endDate: settings.endDate,
        dailyStudyMinutes: settings.dailyStudyMinutes,
        excludeDays: settings.excludeDays,
        prioritizeWeakSubjects: settings.prioritizeWeakSubjects,
        balanceSubjects: settings.balanceSubjects,
        includeReview: settings.includeReview,
        reviewRatio: settings.reviewRatio,
      },
      additionalInstructions: settings.additionalInstructions,
    });

    // 5. 요청 유효성 검사
    currentStep = "validate_request";
    const validation = validateRequest(llmRequest);
    if (!validation.valid) {
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: validation.errors.join(", "),
        failedStep: currentStep,
      };
    }

    // 6. LLM 호출 (fast 모델 사용)
    currentStep = "llm_call";
    console.log(`[Batch AI Plan] 단계: ${currentStep} - ${studentName}, enableWebSearch: ${settings.enableWebSearch}`);

    const modelTier = settings.modelTier || "fast";
    const userPrompt = buildUserPrompt(llmRequest);

    // Grounding 설정 (웹 검색)
    const groundingConfig = settings.enableWebSearch
      ? {
          enabled: true,
          mode: settings.webSearchConfig?.mode || ("dynamic" as const),
          dynamicThreshold: settings.webSearchConfig?.dynamicThreshold,
        }
      : undefined;

    const result = await createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
      grounding: groundingConfig,
    });

    console.log(`[Batch AI Plan] LLM 호출 완료 - ${studentName}, contentLength: ${result.content.length}`);

    // 6-1. 웹 검색 결과 처리
    currentStep = "process_web_search";
    let webSearchResults:
      | {
          searchQueries: string[];
          resultsCount: number;
          savedCount?: number;
          saveWarnings?: string[];
          saveError?: string;
        }
      | undefined;

    if (result.groundingMetadata && result.groundingMetadata.webResults.length > 0) {
      console.log(
        `[Batch AI Plan] 웹 검색 결과 (${student.name}): ${result.groundingMetadata.webResults.length}건`
      );

      webSearchResults = {
        searchQueries: result.groundingMetadata.searchQueries,
        resultsCount: result.groundingMetadata.webResults.length,
      };

      // DB 저장 옵션이 활성화된 경우
      if (settings.webSearchConfig?.saveResults && tenantId) {
        try {
          const webContentService = getWebSearchContentService();

          // Grounding 메타데이터를 콘텐츠로 변환
          const webContents = webContentService.transformToContent(result.groundingMetadata, {
            tenantId,
            subject: contents[0]?.subject,
            subjectCategory: contents[0]?.subject_category,
          });

          if (webContents.length > 0) {
            const saveResult = await webContentService.saveToDatabase(webContents, tenantId);
            webSearchResults.savedCount = saveResult.savedCount;

            console.log(
              `[Batch AI Plan] 웹 콘텐츠 저장 (${student.name}): ${saveResult.savedCount}건`
            );

            // 부분 실패 로깅 (성공은 했지만 일부 에러가 있는 경우)
            if (saveResult.errors.length > 0) {
              console.warn(
                `[Batch AI Plan] 웹 콘텐츠 저장 경고 (${student.name}):`,
                saveResult.errors
              );
              webSearchResults.saveWarnings = saveResult.errors;
            }
          }
        } catch (webSaveError) {
          // 웹 저장 실패해도 플랜 생성은 계속 진행
          const errorMessage = webSaveError instanceof Error
            ? webSaveError.message
            : "Unknown error";
          console.error(
            `[Batch AI Plan] 웹 콘텐츠 저장 실패 (${student.name}):`,
            webSaveError
          );
          webSearchResults.saveError = errorMessage;
        }
      }
    } else if (settings.enableWebSearch) {
      // 웹 검색이 활성화되었지만 결과가 없는 경우 로깅
      console.log(`[Batch AI Plan] 웹 검색 활성화되었으나 결과 없음 - ${student.name}`);
    }

    // 7. 응답 파싱
    currentStep = "parse_response";
    console.log(`[Batch AI Plan] 단계: ${currentStep} - ${studentName}`);

    const parsed = parseLLMResponse(result.content, result.modelId, result.usage);

    if (!parsed.success || !parsed.response) {
      console.error(`[Batch AI Plan] 응답 파싱 실패 - ${studentName}:`, parsed.error);
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: parsed.error || "플랜 생성에 실패했습니다.",
        failedStep: currentStep,
      };
    }

    // 8. 플랜 그룹 원자적 생성
    currentStep = "create_plan_group";
    console.log(`[Batch AI Plan] 단계: ${currentStep} - ${studentName}`);

    const groupName = planGroupNameTemplate
      .replace("{startDate}", settings.startDate)
      .replace("{endDate}", settings.endDate)
      .replace("{studentName}", student.name);

    const groupInput: AtomicPlanGroupInput = {
      tenant_id: tenantId,
      student_id: studentId,
      name: groupName,
      plan_purpose: null,
      scheduler_type: "ai_batch",
      scheduler_options: null,
      period_start: settings.startDate,
      period_end: settings.endDate,
      target_date: null,
      block_set_id: null,
      status: "active",
      subject_constraints: null,
      additional_period_reallocation: null,
      non_study_time_blocks: null,
      daily_schedule: null,
      plan_type: "ai",
      camp_template_id: null,
      camp_invitation_id: null,
      use_slot_mode: false,
      content_slots: null,
    };

    const groupResult = await createPlanGroupAtomic(
      groupInput,
      [], // contents (콘텐츠는 플랜과 함께 저장)
      [], // exclusions
      [], // academySchedules
      true // useAdmin
    );

    if (!groupResult.success || !groupResult.group_id) {
      console.error(`[Batch AI Plan] 플랜 그룹 생성 실패 - ${studentName}:`, groupResult.error);
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: groupResult.error || "플랜 그룹 생성에 실패했습니다.",
        failedStep: currentStep,
      };
    }

    const planGroupId = groupResult.group_id;

    // 9. 플랜 원자적 저장
    currentStep = "save_plans";
    console.log(`[Batch AI Plan] 단계: ${currentStep} - ${studentName}, planGroupId: ${planGroupId}`);

    const allPlans: GeneratedPlanItem[] = [];
    for (const matrix of parsed.response.weeklyMatrices) {
      for (const day of matrix.days) {
        allPlans.push(...day.plans);
      }
    }

    console.log(`[Batch AI Plan] 플랜 변환 중 - ${studentName}, 총 ${allPlans.length}개 플랜`);

    // LLM 응답을 AtomicPlanPayload로 변환
    const atomicPlans = batchPlanItemsToAtomicPayloads(
      allPlans,
      planGroupId,
      studentId,
      tenantId
    );

    const plansResult = await generatePlansAtomic(
      planGroupId,
      atomicPlans,
      "active", // 플랜 상태를 active로 설정
      true // useAdmin
    );

    if (!plansResult.success) {
      // 플랜 저장 실패 시 생성된 그룹 삭제 시도
      console.error(`[Batch AI Plan] 플랜 저장 실패 - ${studentName}, 그룹 롤백 시도: ${planGroupId}`, plansResult.error);
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: plansResult.error || "플랜 저장에 실패했습니다.",
        failedStep: currentStep,
      };
    }

    // 10. 비용 계산
    const cost = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      modelTier
    );

    return {
      studentId,
      studentName: student.name,
      status: "success",
      planGroupId,
      totalPlans: allPlans.length,
      cost: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedUSD: cost,
      },
      webSearchResults,
    };
  } catch (error) {
    console.error(`[Batch AI Plan] 학생 ${studentId} 오류 (단계: ${currentStep}):`, error);
    return {
      studentId,
      studentName,
      status: "error",
      error:
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      failedStep: currentStep,
    };
  }
}

// ============================================
// 배치 처리 메인 함수
// ============================================

/**
 * 여러 학생에게 AI 플랜을 배치로 생성합니다
 *
 * API 레이트 리밋을 고려하여 동시에 최대 3명씩 처리합니다.
 *
 * @param {BatchPlanGenerationInput} input - 배치 생성 입력
 * @returns {Promise<BatchPlanGenerationResult>} 배치 생성 결과
 *
 * @example
 * ```typescript
 * const result = await generateBatchPlansWithAI({
 *   students: [
 *     { studentId: 'student-1', contentIds: ['c1', 'c2'] },
 *     { studentId: 'student-2', contentIds: ['c3', 'c4'] },
 *   ],
 *   settings: {
 *     startDate: '2025-01-01',
 *     endDate: '2025-01-31',
 *     dailyStudyMinutes: 180,
 *   },
 * });
 *
 * console.log(`성공: ${result.summary.succeeded}명`);
 * console.log(`총 비용: $${result.summary.totalCost.toFixed(4)}`);
 * ```
 */
async function _generateBatchPlansWithAI(
  input: BatchPlanGenerationInput
): Promise<BatchPlanGenerationResult> {
  // 권한 확인
  const user = await getCurrentUser();
  if (!user || !["admin", "consultant"].includes(user.role)) {
    throw new AppError(
      "관리자 또는 컨설턴트 권한이 필요합니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // 테넌트 컨텍스트
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  const { students, settings, planGroupNameTemplate } = input;

  if (!students || students.length === 0) {
    throw new AppError(
      "처리할 학생이 없습니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  // 날짜 유효성 검사
  const startDate = new Date(settings.startDate);
  const endDate = new Date(settings.endDate);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError(
      "유효하지 않은 날짜 형식입니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  if (startDate >= endDate) {
    throw new AppError(
      "종료일은 시작일 이후여야 합니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  const results: StudentPlanResult[] = [];
  const CONCURRENCY_LIMIT = 3; // 동시 처리 수 제한
  const groupNameTemplate =
    planGroupNameTemplate || "AI 학습 계획 ({startDate} ~ {endDate})";

  // 배치 처리 (동시에 최대 3명씩)
  for (let i = 0; i < students.length; i += CONCURRENCY_LIMIT) {
    const batch = students.slice(i, i + CONCURRENCY_LIMIT);

    const batchResults = await Promise.all(
      batch.map((s) =>
        generatePlanForStudent(
          supabase,
          tenantContext.tenantId,
          s.studentId,
          s.contentIds,
          settings,
          groupNameTemplate
        )
      )
    );

    results.push(...batchResults);

    // 레이트 리밋 방지를 위한 짧은 대기 (배치 사이)
    if (i + CONCURRENCY_LIMIT < students.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // 결과 요약 계산
  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const totalPlans = results.reduce((sum, r) => sum + (r.totalPlans || 0), 0);
  const totalCost = results.reduce(
    (sum, r) => sum + (r.cost?.estimatedUSD || 0),
    0
  );

  // 캐시 무효화
  revalidatePath("/admin/students");

  return {
    success: true,
    results,
    summary: {
      total: students.length,
      succeeded,
      failed,
      skipped,
      totalPlans,
      totalCost,
    },
  };
}

export const generateBatchPlansWithAI = withErrorHandlingSafe(
  _generateBatchPlansWithAI
);

// ============================================
// 비용 추정 (배치 전체)
// ============================================

/**
 * 배치 플랜 생성 비용을 추정합니다
 */
export async function estimateBatchPlanCost(
  studentCount: number,
  modelTier: ModelTier = "fast"
): Promise<{
  estimatedCostPerStudent: number;
  estimatedTotalCost: number;
  modelTier: ModelTier;
}> {
  // 평균적인 토큰 사용량 추정
  // fast 모델 기준: 입력 ~2000 토큰, 출력 ~1500 토큰
  const avgInputTokens = 2000;
  const avgOutputTokens = 1500;

  const costPerStudent = estimateCost(avgInputTokens, avgOutputTokens, modelTier);
  const totalCost = costPerStudent * studentCount;

  return {
    estimatedCostPerStudent: costPerStudent,
    estimatedTotalCost: totalCost,
    modelTier,
  };
}

// ============================================
// 학생 콘텐츠 조회 (배치용)
// ============================================

/**
 * 여러 학생의 보유 콘텐츠를 조회합니다
 */
export async function getStudentsContentsForBatch(
  studentIds: string[]
): Promise<
  Map<string, { studentId: string; studentName: string; contentIds: string[] }>
> {
  const supabase = await createSupabaseServerClient();

  // 학생 정보 조회 (tenant_id 포함)
  const { data: students } = await supabase
    .from("students")
    .select("id, name, tenant_id")
    .in("id", studentIds);

  const result = new Map<
    string,
    { studentId: string; studentName: string; contentIds: string[] }
  >();

  for (const student of students || []) {
    // flexible_contents에서 학생별 콘텐츠 조회
    const { data: flexibleContents } = await supabase
      .from("flexible_contents")
      .select("id, master_book_id, master_lecture_id")
      .eq("student_id", student.id)
      .eq("is_archived", false);

    // master_book_id 또는 master_lecture_id 추출
    let contentIds = (flexibleContents || [])
      .flatMap((fc) => [fc.master_book_id, fc.master_lecture_id])
      .filter(Boolean) as string[];

    // flexible_contents가 비어있으면 테넌트의 기본 컨텐츠에서 가져오기
    if (contentIds.length === 0 && student.tenant_id) {
      console.log(`[getStudentsContentsForBatch] ${student.name}: flexible_contents 없음, master_books에서 기본 컨텐츠 조회`);

      // 테넌트의 활성 master_books에서 최근 10개 가져오기
      const { data: defaultBooks } = await supabase
        .from("master_books")
        .select("id")
        .eq("tenant_id", student.tenant_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);

      contentIds = (defaultBooks || []).map((b) => b.id);
      console.log(`[getStudentsContentsForBatch] ${student.name}: 기본 컨텐츠 ${contentIds.length}개 로드`);
    }

    result.set(student.id, {
      studentId: student.id,
      studentName: student.name,
      contentIds,
    });
  }

  return result;
}

// ============================================
// 스트리밍 지원 배치 생성 (Phase 1)
// ============================================

import type {
  BatchStreamEvent,
  OnProgressCallback,
  StreamingOptions,
} from "../types/streaming";

/**
 * 스트리밍을 지원하는 배치 플랜 생성 입력
 */
export interface BatchPlanGenerationWithStreamingInput
  extends BatchPlanGenerationInput {
  /** 스트리밍 옵션 */
  streamingOptions?: StreamingOptions;
}

/**
 * 스트리밍을 지원하는 배치 AI 플랜 생성
 *
 * Server Action이 아닌 일반 함수로 export하여
 * API 라우트에서 직접 호출할 수 있도록 합니다.
 */
export async function generateBatchPlansWithStreaming(
  input: BatchPlanGenerationWithStreamingInput
): Promise<BatchPlanGenerationResult> {
  const { streamingOptions, ...batchInput } = input;
  const onProgress = streamingOptions?.onProgress;
  const signal = streamingOptions?.signal;

  // 권한 확인
  const user = await getCurrentUser();
  if (!user || !["admin", "consultant"].includes(user.role)) {
    throw new AppError(
      "관리자 또는 컨설턴트 권한이 필요합니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // 테넌트 컨텍스트
  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  const { students, settings, planGroupNameTemplate } = batchInput;

  if (!students || students.length === 0) {
    throw new AppError(
      "처리할 학생이 없습니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  // 날짜 유효성 검사
  const startDate = new Date(settings.startDate);
  const endDate = new Date(settings.endDate);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError(
      "유효하지 않은 날짜 형식입니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  if (startDate >= endDate) {
    throw new AppError(
      "종료일은 시작일 이후여야 합니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  const results: StudentPlanResult[] = [];
  const CONCURRENCY_LIMIT = 3;
  const groupNameTemplate =
    planGroupNameTemplate || "AI 학습 계획 ({startDate} ~ {endDate})";

  // 시작 이벤트 발행
  onProgress?.({
    type: "start",
    progress: 0,
    total: students.length,
    timestamp: Date.now(),
    studentIds: students.map((s) => s.studentId),
  });

  // 학생 이름 미리 조회 (진행률 표시용)
  const studentNamesMap = new Map<string, string>();
  const { data: studentData } = await supabase
    .from("students")
    .select("id, name")
    .in(
      "id",
      students.map((s) => s.studentId)
    );

  for (const s of studentData || []) {
    studentNamesMap.set(s.id, s.name);
  }

  let processedCount = 0;

  // 배치 처리 (동시에 최대 3명씩)
  for (let i = 0; i < students.length; i += CONCURRENCY_LIMIT) {
    // 취소 확인
    if (signal?.aborted) {
      throw new AppError("처리가 취소되었습니다.", ErrorCode.BUSINESS_LOGIC_ERROR, 499, true);
    }

    const batch = students.slice(i, i + CONCURRENCY_LIMIT);

    // 시작 이벤트 발행 (배치 내 각 학생)
    for (const s of batch) {
      onProgress?.({
        type: "student_start",
        progress: processedCount + 1,
        total: students.length,
        timestamp: Date.now(),
        studentId: s.studentId,
        studentName: studentNamesMap.get(s.studentId) || "Unknown",
      });
    }

    const batchResults = await Promise.all(
      batch.map((s) =>
        generatePlanForStudent(
          supabase,
          tenantContext.tenantId,
          s.studentId,
          s.contentIds,
          settings,
          groupNameTemplate
        )
      )
    );

    // 결과 이벤트 발행 (배치 내 각 학생)
    for (const result of batchResults) {
      processedCount++;

      if (result.status === "error") {
        onProgress?.({
          type: "student_error",
          progress: processedCount,
          total: students.length,
          timestamp: Date.now(),
          studentId: result.studentId,
          studentName: result.studentName,
          error: result.error || "알 수 없는 오류",
        });
      } else {
        onProgress?.({
          type: "student_complete",
          progress: processedCount,
          total: students.length,
          timestamp: Date.now(),
          studentId: result.studentId,
          studentName: result.studentName,
          result,
        });
      }
    }

    results.push(...batchResults);

    // 레이트 리밋 방지를 위한 짧은 대기 (배치 사이)
    if (i + CONCURRENCY_LIMIT < students.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // 결과 요약 계산
  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const totalPlans = results.reduce((sum, r) => sum + (r.totalPlans || 0), 0);
  const totalCost = results.reduce(
    (sum, r) => sum + (r.cost?.estimatedUSD || 0),
    0
  );

  const summary = {
    total: students.length,
    succeeded,
    failed,
    skipped,
    totalPlans,
    totalCost,
  };

  // 완료 이벤트 발행
  onProgress?.({
    type: "complete",
    progress: students.length,
    total: students.length,
    timestamp: Date.now(),
    summary,
    results,
  });

  // 캐시 무효화
  revalidatePath("/admin/students");

  return {
    success: true,
    results,
    summary,
  };
}
