"use server";

/**
 * 배치 AI 플랜 생성 액션
 *
 * 여러 학생에게 동시에 AI 플랜을 생성합니다.
 * P3-1: API 레이트 리밋을 고려하여 동시에 최대 5명씩 처리합니다.
 *
 * @module lib/domains/admin-plan/actions/batchAIPlanGeneration
 */

// P3-1: 배치 동시 처리 수 제한 (3 → 5 확대)
// Rate limit 고려: Claude API는 분당 요청 제한이 있으므로 적절한 값 유지 필요
const BATCH_CONCURRENCY_LIMIT = 5;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandlingSafe } from "@/lib/errors";
import { logActionDebug, logActionWarn, logActionError } from "@/lib/utils/serverActionLogger";
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

// Phase 3: 플래너 자동 생성 유틸리티
import {
  ensurePlannerForPipeline,
  type PlannerValidationMode,
} from "@/lib/domains/plan/actions/planners/autoCreate";

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 날짜 범위에 대한 day_type 맵 생성
 * study_days/review_days 주기에 따라 각 날짜의 day_type 결정
 */
function buildDayTypeMap(
  periodStart: string,
  periodEnd: string,
  studyDays: number = 6,
  reviewDays: number = 1
): Map<string, "학습일" | "복습일"> {
  const dayTypeMap = new Map<string, "학습일" | "복습일">();
  const cycleLength = studyDays + reviewDays;

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  let dayIndex = 0;

  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const dateStr = current.toISOString().split("T")[0];
    const cyclePosition = dayIndex % cycleLength;
    const dayType = cyclePosition < studyDays ? "학습일" : "복습일";
    dayTypeMap.set(dateStr, dayType);
    dayIndex++;
  }

  return dayTypeMap;
}

/**
 * 시간 문자열을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 시간 문자열로 변환
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * 시간 범위에서 점유된 시간을 제외한 가용 시간 계산
 * @param baseSlots 기본 시간 슬롯 (예: 학습 시간)
 * @param occupiedSlots 점유된 시간 슬롯 (예: 기존 플랜)
 * @returns 남은 가용 시간 슬롯
 */
function subtractTimeRanges(
  baseSlots: Array<{ start: string; end: string }>,
  occupiedSlots: Array<{ start: string; end: string }>
): Array<{ start: string; end: string }> {
  if (occupiedSlots.length === 0) return baseSlots;

  const result: Array<{ start: string; end: string }> = [];

  for (const base of baseSlots) {
    let remainingRanges = [{ start: timeToMinutes(base.start), end: timeToMinutes(base.end) }];

    for (const occupied of occupiedSlots) {
      const occStart = timeToMinutes(occupied.start);
      const occEnd = timeToMinutes(occupied.end);
      const newRanges: Array<{ start: number; end: number }> = [];

      for (const range of remainingRanges) {
        // 겹치지 않는 경우 - 그대로 유지
        if (occEnd <= range.start || occStart >= range.end) {
          newRanges.push(range);
        }
        // 완전히 포함되는 경우 - 제거 (아무것도 추가 안함)
        else if (occStart <= range.start && occEnd >= range.end) {
          // 범위 전체가 점유됨 - 스킵
        }
        // 시작 부분만 점유
        else if (occStart <= range.start && occEnd < range.end) {
          newRanges.push({ start: occEnd, end: range.end });
        }
        // 끝 부분만 점유
        else if (occStart > range.start && occEnd >= range.end) {
          newRanges.push({ start: range.start, end: occStart });
        }
        // 중간 부분만 점유 - 두 개로 분할
        else if (occStart > range.start && occEnd < range.end) {
          newRanges.push({ start: range.start, end: occStart });
          newRanges.push({ start: occEnd, end: range.end });
        }
      }

      remainingRanges = newRanges;
    }

    // 최소 15분 이상인 슬롯만 포함
    for (const range of remainingRanges) {
      if (range.end - range.start >= 15) {
        result.push({ start: minutesToTime(range.start), end: minutesToTime(range.end) });
      }
    }
  }

  return result;
}

/**
 * 학생의 기존 플랜 조회 (시간 충돌 방지용)
 */
async function fetchExistingPlansForStudent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  periodStart: string,
  periodEnd: string
): Promise<Map<string, Array<{ start: string; end: string }>>> {
  const { data, error } = await supabase
    .from("student_plan")
    .select(`
      plan_date,
      start_time,
      end_time
    `)
    .eq("student_id", studentId)
    .gte("plan_date", periodStart)
    .lte("plan_date", periodEnd)
    .eq("is_active", true)
    .not("start_time", "is", null)
    .not("end_time", "is", null);

  if (error) {
    logActionWarn("fetchExistingPlansForStudent", `기존 플랜 조회 실패: ${error.message}`);
    return new Map();
  }

  // 날짜별로 그룹화
  const occupiedByDate = new Map<string, Array<{ start: string; end: string }>>();
  for (const p of data || []) {
    const date = p.plan_date;
    const slots = occupiedByDate.get(date) || [];
    slots.push({
      start: p.start_time!.slice(0, 5),
      end: p.end_time!.slice(0, 5),
    });
    occupiedByDate.set(date, slots);
  }

  return occupiedByDate;
}

/**
 * 날짜별 가용 시간 슬롯 계산
 * - 기본 학습 시간에서 기존 플랜 시간을 제외
 */
function calculateAvailableSlots(
  periodStart: string,
  periodEnd: string,
  baseTimeSlots: Array<{ start_time: string; end_time: string; slot_type?: string | null }>,
  occupiedByDate: Map<string, Array<{ start: string; end: string }>>
): Array<{ date: string; startTime: string; endTime: string }> {
  const result: Array<{ date: string; startTime: string; endTime: string }> = [];

  // 학습 시간 슬롯만 필터링
  const studySlots = baseTimeSlots
    .filter((s) => s.slot_type === "study" || !s.slot_type)
    .map((s) => ({
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
    }));

  if (studySlots.length === 0) {
    // 기본 학습 시간이 없으면 09:00-18:00 사용
    studySlots.push({ start: "09:00", end: "18:00" });
  }

  // 날짜별로 가용 시간 계산
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const dateStr = current.toISOString().split("T")[0];
    const occupied = occupiedByDate.get(dateStr) || [];

    // 기본 슬롯에서 점유된 시간 제외
    const available = subtractTimeRanges(studySlots, occupied);

    // 결과에 추가
    for (const slot of available) {
      result.push({
        date: dateStr,
        startTime: slot.start,
        endTime: slot.end,
      });
    }
  }

  return result;
}

/**
 * AI 생성 플랜의 시간을 가용 슬롯에 맞게 강제 조정
 * - AI가 가용 슬롯을 무시하고 시간을 배치한 경우 강제로 조정
 * - 각 날짜별로 순차적으로 슬롯 할당
 */
function enforceAvailableSlots<T extends {
  date: string;
  startTime: string;
  endTime: string;
  estimatedMinutes: number;
}>(
  plans: T[],
  availableSlots: Array<{ date: string; startTime: string; endTime: string }>
): T[] {
  // 날짜별 가용 슬롯 맵 생성
  const slotsByDate = new Map<string, Array<{ start: number; end: number; used: number }>>();
  for (const slot of availableSlots) {
    const dateSlots = slotsByDate.get(slot.date) || [];
    dateSlots.push({
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime),
      used: 0, // 이 슬롯에서 이미 사용된 시간 (분)
    });
    slotsByDate.set(slot.date, dateSlots);
  }

  // 플랜을 날짜별로 정렬
  const sortedPlans = [...plans].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });

  const adjustedPlans: T[] = [];
  let adjustedCount = 0;

  for (const plan of sortedPlans) {
    const dateSlots = slotsByDate.get(plan.date);

    if (!dateSlots || dateSlots.length === 0) {
      // 해당 날짜에 가용 슬롯이 없으면 스킵
      logActionWarn("enforceAvailableSlots", `${plan.date}에 가용 슬롯 없음, 플랜 스킵`);
      continue;
    }

    const duration = plan.estimatedMinutes || 50; // 기본 50분
    const originalStart = timeToMinutes(plan.startTime);
    const originalEnd = timeToMinutes(plan.endTime);

    // 원래 시간이 가용 슬롯 내에 있는지 확인
    let fitsInSlot = false;
    for (const slot of dateSlots) {
      const availableStart = slot.start + slot.used;
      const availableEnd = slot.end;
      if (originalStart >= availableStart && originalEnd <= availableEnd) {
        fitsInSlot = true;
        // 슬롯 사용량 업데이트
        slot.used += (originalEnd - originalStart);
        break;
      }
    }

    if (fitsInSlot) {
      // 원래 시간 그대로 사용
      adjustedPlans.push(plan);
    } else {
      // 가용 슬롯 중 충분한 공간이 있는 첫 번째 슬롯에 배치
      let placed = false;
      for (const slot of dateSlots) {
        const availableStart = slot.start + slot.used;
        const availableEnd = slot.end;
        const availableDuration = availableEnd - availableStart;

        if (availableDuration >= duration) {
          // 이 슬롯에 배치
          const newStart = availableStart;
          const newEnd = Math.min(availableStart + duration, availableEnd);

          adjustedPlans.push({
            ...plan,
            startTime: minutesToTime(newStart),
            endTime: minutesToTime(newEnd),
          } as T);

          // 슬롯 사용량 업데이트
          slot.used += (newEnd - newStart);
          placed = true;
          adjustedCount++;
          break;
        }
      }

      if (!placed) {
        // 충분한 슬롯이 없으면 가장 큰 남은 슬롯에 가능한 만큼 배치
        let bestSlot = null;
        let maxAvailable = 0;
        for (const slot of dateSlots) {
          const available = slot.end - slot.start - slot.used;
          if (available > maxAvailable) {
            maxAvailable = available;
            bestSlot = slot;
          }
        }

        if (bestSlot && maxAvailable >= 15) { // 최소 15분
          const newStart = bestSlot.start + bestSlot.used;
          const newEnd = Math.min(newStart + duration, bestSlot.end);

          adjustedPlans.push({
            ...plan,
            startTime: minutesToTime(newStart),
            endTime: minutesToTime(newEnd),
            estimatedMinutes: newEnd - newStart, // 조정된 시간
          } as T);

          bestSlot.used += (newEnd - newStart);
          adjustedCount++;
        } else {
          // 배치할 수 없음 - 스킵
          logActionWarn("enforceAvailableSlots", `${plan.date}에 플랜 배치 불가 (공간 부족)`);
        }
      }
    }
  }

  if (adjustedCount > 0) {
    logActionDebug("enforceAvailableSlots", `${adjustedCount}개 플랜 시간 강제 조정됨`);
  }

  return adjustedPlans;
}

/**
 * 동일 조건의 기존 플랜 그룹 존재 여부 확인
 * - 같은 학생, 콘텐츠, 기간으로 이미 플랜 그룹이 있으면 해당 ID 반환
 */
async function findExistingPlanGroup(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  contentId: string,
  periodStart: string,
  periodEnd: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("student_id", studentId)
    .eq("content_id", contentId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    logActionWarn(
      "findExistingPlanGroup",
      `기존 플랜 그룹 조회 실패: ${error.message}`
    );
    return null;
  }

  return data?.id ?? null;
}

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
  /** 플래너 검증 모드 (기본값: "auto_create") */
  plannerValidationMode?: "warn" | "strict" | "auto_create";
  /** 학습일 수 (기본값: 6) - 1730 타임테이블 사이클 */
  studyDays?: number;
  /** 복습일 수 (기본값: 1) - 1730 타임테이블 사이클 */
  reviewDays?: number;
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
  /** @deprecated 단일 Plan Group ID (하위 호환성). planGroupIds 사용 권장 */
  planGroupId?: string;
  /** 콘텐츠별 생성된 Plan Group ID 목록 */
  planGroupIds?: string[];
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
    logActionError("loadStudentData", `학생 조회 실패 - studentId: ${studentId}, error: ${error.message}, code: ${error.code}, tenantId: ${tenantId || "not provided"}`);
  }

  if (!student && !error) {
    logActionWarn("loadStudentData", `학생 데이터 없음 - studentId: ${studentId}, tenantId: ${tenantId || "not provided"}`);
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

  logActionDebug("loadContents", `조회 결과 - books: ${booksResult.data?.length || 0}, lectures: ${lecturesResult.data?.length || 0}`);
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
    logActionDebug("generatePlanForStudent", `단계: ${currentStep} - studentId: ${studentId}`);

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

    // 2.5. 플래너 확보 (Phase 3 플래너 연계) - 공통 유틸리티 사용
    currentStep = "ensure_planner";
    logActionDebug("generatePlanForStudent", `단계: ${currentStep} - ${studentName}`);

    const plannerResult = await ensurePlannerForPipeline({
      studentId,
      periodStart: settings.startDate,
      periodEnd: settings.endDate,
      validationMode: (settings.plannerValidationMode as PlannerValidationMode) ?? "auto_create",
    });

    // strict 모드에서 플래너 확보 실패 시 에러 반환
    if (!plannerResult.success) {
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: plannerResult.error || "플래너 확보에 실패했습니다.",
        failedStep: currentStep,
      };
    }

    const plannerId = plannerResult.plannerId;

    if (plannerResult.isNew) {
      logActionDebug(
        "generatePlanForStudent",
        `플래너 자동 생성 완료 - ${studentName}: plannerId=${plannerId}`
      );
    } else if (plannerResult.hasWarning) {
      // P3-3: 레거시 데이터 경고 개선
      logActionWarn(
        "generatePlanForStudent",
        `[레거시] 플래너 미연결 상태 - ${studentName} (studentId: ${studentId}) | 원인: 플래너 자동 생성 비활성화/실패 | 영향: 통합 관리 불가 | 권장: 배치 설정에서 플래너 자동 생성 활성화`
      );
    } else {
      logActionDebug(
        "generatePlanForStudent",
        `기존 플래너 사용 - ${studentName}: plannerId=${plannerId}`
      );
    }

    // 3. 관련 데이터 로드
    currentStep = "load_data";
    logActionDebug("generatePlanForStudent", `단계: ${currentStep} - ${studentName}`);

    const [scores, contents, timeSlots, learningStats, occupiedByDate] = await Promise.all([
      loadScores(supabase, studentId),
      loadContents(supabase, contentIds),
      loadTimeSlots(supabase, tenantId),
      loadLearningStats(supabase, studentId),
      // 시간 충돌 방지: 기존 플랜 조회
      fetchExistingPlansForStudent(supabase, studentId, settings.startDate, settings.endDate),
    ]);

    // 가용 시간 슬롯 계산 (기존 플랜 시간 제외)
    const availableSlots = calculateAvailableSlots(
      settings.startDate,
      settings.endDate,
      timeSlots,
      occupiedByDate
    );

    const occupiedCount = Array.from(occupiedByDate.values()).flat().length;
    logActionDebug("generatePlanForStudent", `데이터 로드 완료 - scores: ${scores.length}, contents: ${contents.length}, timeSlots: ${timeSlots.length}, occupiedPlans: ${occupiedCount}, availableSlots: ${availableSlots.length}`);

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
    logActionDebug("generatePlanForStudent", `단계: ${currentStep} - ${studentName}`);

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
      // 시간 충돌 방지: 사전 계산된 가용 슬롯만 전달 (AI는 이 슬롯에만 배치 가능)
      availableSlots: availableSlots.length > 0 ? availableSlots : undefined,
    });

    // 가용 슬롯 정보 로그
    if (occupiedCount > 0) {
      logActionDebug(
        "generatePlanForStudent",
        `기존 플랜 ${occupiedCount}개 시간 제외, 가용 슬롯 ${availableSlots.length}개 AI에게 전달 - ${studentName}`
      );
    }

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
    logActionDebug("generatePlanForStudent", `단계: ${currentStep} - ${studentName}, enableWebSearch: ${settings.enableWebSearch}`);

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

    logActionDebug("generatePlanForStudent", `LLM 호출 완료 - ${studentName}, contentLength: ${result.content.length}`);

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
      logActionDebug(
        "generatePlanForStudent",
        `웹 검색 결과 (${student.name}): ${result.groundingMetadata.webResults.length}건`
      );

      webSearchResults = {
        searchQueries: result.groundingMetadata.searchQueries,
        resultsCount: result.groundingMetadata.webResults.length,
      };

      // DB 저장 옵션이 활성화된 경우
      if (settings.webSearchConfig?.saveResults) {
        if (!tenantId) {
          logActionWarn(
            "generatePlanForStudent",
            `[웹 검색] tenantId 누락으로 콘텐츠 저장 스킵 - ${student.name}`
          );
        } else {
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

            logActionDebug(
              "generatePlanForStudent",
              `웹 콘텐츠 저장 (${student.name}): ${saveResult.savedCount}건`
            );

            // 부분 실패 로깅 (성공은 했지만 일부 에러가 있는 경우)
            if (saveResult.errors.length > 0) {
              logActionWarn(
                "generatePlanForStudent",
                `웹 콘텐츠 저장 경고 (${student.name}): ${saveResult.errors.join(", ")}`
              );
              webSearchResults.saveWarnings = saveResult.errors;
            }
          }
        } catch (webSaveError) {
          // 웹 저장 실패해도 플랜 생성은 계속 진행
          const errorMessage = webSaveError instanceof Error
            ? webSaveError.message
            : "Unknown error";
          logActionError(
            "generatePlanForStudent",
            `웹 콘텐츠 저장 실패 (${student.name}): ${errorMessage}`
          );
          webSearchResults.saveError = errorMessage;
        }
        }
      }
    } else if (settings.enableWebSearch) {
      // 웹 검색이 활성화되었지만 결과가 없는 경우 로깅
      logActionDebug("generatePlanForStudent", `웹 검색 활성화되었으나 결과 없음 - ${student.name}`);
    }

    // 7. 응답 파싱
    currentStep = "parse_response";
    logActionDebug("generatePlanForStudent", `단계: ${currentStep} - ${studentName}`);

    const parsed = parseLLMResponse(result.content, result.modelId, result.usage);

    if (!parsed.success || !parsed.response) {
      logActionError("generatePlanForStudent", `응답 파싱 실패 - ${studentName}: ${parsed.error || "unknown"}`);
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: parsed.error || "플랜 생성에 실패했습니다.",
        failedStep: currentStep,
      };
    }

    // 8. 플랜 수집 및 콘텐츠별 그룹화
    currentStep = "collect_plans";
    logActionDebug("generatePlanForStudent", `단계: ${currentStep} - ${studentName}`);

    let allPlans: GeneratedPlanItem[] = [];
    for (const matrix of parsed.response.weeklyMatrices) {
      for (const day of matrix.days) {
        allPlans.push(...day.plans);
      }
    }

    logActionDebug("generatePlanForStudent", `총 ${allPlans.length}개 플랜 수집 완료 (조정 전) - ${studentName}`);

    // 8-1. 시간 충돌 방지: AI 생성 플랜을 가용 슬롯에 맞게 강제 조정
    if (availableSlots.length > 0) {
      const beforeCount = allPlans.length;
      allPlans = enforceAvailableSlots(allPlans, availableSlots);
      logActionDebug(
        "generatePlanForStudent",
        `시간 강제 조정 완료 - 조정 전: ${beforeCount}개, 조정 후: ${allPlans.length}개 - ${studentName}`
      );
    }

    // 플랜을 contentId별로 그룹화
    const plansByContent = new Map<string, GeneratedPlanItem[]>();
    for (const plan of allPlans) {
      const existing = plansByContent.get(plan.contentId) || [];
      existing.push(plan);
      plansByContent.set(plan.contentId, existing);
    }

    // contents를 Map으로 변환 (빠른 조회용)
    const contentsMap = new Map(contents.map((c) => [c.id, c]));

    logActionDebug(
      "generatePlanForStudent",
      `콘텐츠별 분할: ${plansByContent.size}개 콘텐츠 - ${studentName}`
    );

    // 9. 콘텐츠별 Plan Group 생성 및 플랜 저장 (병렬 처리 최적화)
    currentStep = "create_plan_groups_per_content";

    // 9.1 유효한 콘텐츠 데이터 준비
    type ContentPlanData = {
      contentId: string;
      content: NonNullable<ReturnType<typeof contentsMap.get>>;
      contentPlans: GeneratedPlanItem[];
      groupInput: AtomicPlanGroupInput;
    };

    const validContentData: ContentPlanData[] = [];
    for (const [contentId, contentPlans] of plansByContent) {
      const content = contentsMap.get(contentId);
      if (!content) {
        // P3-3: 레거시 데이터 경고 개선
        logActionWarn(
          "generatePlanForStudent",
          `[데이터 불일치] 콘텐츠 매핑 실패 - ${studentName} | contentId: ${contentId} | 건너뛴 플랜: ${contentPlans.length}개 | 원인: AI 응답의 contentId가 콘텐츠 목록에 없음 (삭제됨 또는 파싱 오류)`
        );
        continue;
      }

      // 콘텐츠별 Plan Group 이름 생성
      const groupName = `${content.title} (${settings.startDate} ~ ${settings.endDate})`;

      // 콘텐츠의 범위 계산 (플랜에서 최소/최대 추출)
      const ranges = contentPlans
        .filter((p) => p.rangeStart !== undefined && p.rangeEnd !== undefined)
        .map((p) => ({ start: p.rangeStart!, end: p.rangeEnd! }));
      const startRange = ranges.length > 0 ? Math.min(...ranges.map((r) => r.start)) : 1;
      const endRange = ranges.length > 0
        ? Math.max(...ranges.map((r) => r.end))
        : content.total_pages ?? content.total_lectures ?? 1;

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

        // Phase 3 플래너 연계 필드
        planner_id: plannerId,
        creation_mode: "ai_batch",
        is_single_content: true,

        // 단일 콘텐츠 정보
        content_type: content.content_type,
        content_id: content.id,
        master_content_id: content.id,
        start_range: startRange,
        end_range: endRange,
      };

      validContentData.push({ contentId, content, contentPlans, groupInput });
    }

    // 9.2 Phase 1: 모든 Plan Group 병렬 생성 (중복 체크 포함)
    const groupCreationPromises = validContentData.map(async (data) => {
      // 중복 체크: 같은 학생, 콘텐츠, 기간의 플랜 그룹이 이미 존재하는지 확인
      const existingGroupId = await findExistingPlanGroup(
        supabase,
        studentId,
        data.content.id,
        settings.startDate,
        settings.endDate
      );

      if (existingGroupId) {
        logActionDebug(
          "generatePlanForStudent",
          `기존 Plan Group 발견 - ${data.content.title}, ${studentName}: groupId=${existingGroupId} (스킵)`
        );
        // 기존 그룹이 있으면 스킵 (중복 생성 방지)
        return { ...data, groupId: null as string | null, skipped: true };
      }

      const groupResult = await createPlanGroupAtomic(
        data.groupInput,
        [],
        [],
        [],
        true
      );

      if (!groupResult.success || !groupResult.group_id) {
        logActionError(
          "generatePlanForStudent",
          `Plan Group 생성 실패 - ${data.content.title}, ${studentName}: ${groupResult.error || "unknown"}`
        );
        return { ...data, groupId: null as string | null, skipped: false };
      }

      return { ...data, groupId: groupResult.group_id, skipped: false };
    });

    const groupResults = await Promise.all(groupCreationPromises);
    // 새로 생성된 그룹만 필터 (스킵된 것 제외)
    const successfulGroups = groupResults.filter(
      (r) => r.groupId !== null && !r.skipped
    );
    const skippedCount = groupResults.filter((r) => r.skipped).length;

    if (skippedCount > 0) {
      logActionDebug(
        "generatePlanForStudent",
        `중복으로 스킵된 콘텐츠: ${skippedCount}개 - ${studentName}`
      );
    }

    // 9.3 Phase 2: 모든 플랜 병렬 저장
    // day_type 맵 생성 (settings에서 studyDays/reviewDays 사용, 기본값: 6:1)
    const dayTypeMap = buildDayTypeMap(
      settings.startDate,
      settings.endDate,
      settings.studyDays ?? 6,
      settings.reviewDays ?? 1
    );

    const planCreationPromises = successfulGroups.map(async (data) => {
      const atomicPlans = batchPlanItemsToAtomicPayloads(
        data.contentPlans,
        data.groupId!,
        studentId,
        tenantId,
        dayTypeMap
      );

      const plansResult = await generatePlansAtomic(
        data.groupId!,
        atomicPlans,
        "active",
        true
      );

      if (!plansResult.success) {
        logActionError(
          "generatePlanForStudent",
          `플랜 저장 실패 - ${data.content.title}, ${studentName}: ${plansResult.error || "unknown"}`
        );
        return { groupId: data.groupId!, planCount: 0, success: false };
      }

      logActionDebug(
        "generatePlanForStudent",
        `Plan Group 생성 완료 - ${data.content.title}: ${data.contentPlans.length}개 플랜, groupId: ${data.groupId}`
      );

      return { groupId: data.groupId!, planCount: data.contentPlans.length, success: true };
    });

    const planResults = await Promise.all(planCreationPromises);

    // 9.4 결과 집계
    const createdGroupIds = planResults.filter((r) => r.success).map((r) => r.groupId);
    const totalSavedPlans = planResults.reduce((sum, r) => sum + r.planCount, 0);

    // 생성된 그룹이 없으면 에러
    if (createdGroupIds.length === 0) {
      logActionError("generatePlanForStudent", `모든 Plan Group 생성 실패 - ${studentName}`);
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: "Plan Group 생성에 실패했습니다.",
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
      planGroupId: createdGroupIds[0], // 하위 호환성
      planGroupIds: createdGroupIds,
      totalPlans: totalSavedPlans,
      cost: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedUSD: cost,
      },
      webSearchResults,
    };
  } catch (error) {
    logActionError("generatePlanForStudent", `학생 ${studentId} 오류 (단계: ${currentStep}): ${error instanceof Error ? error.message : "unknown"}`);
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
 * API 레이트 리밋을 고려하여 동시에 최대 5명씩 처리합니다.
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
  const groupNameTemplate =
    planGroupNameTemplate || "AI 학습 계획 ({startDate} ~ {endDate})";

  // P3-1: 배치 처리 (동시에 최대 5명씩)
  for (let i = 0; i < students.length; i += BATCH_CONCURRENCY_LIMIT) {
    const batch = students.slice(i, i + BATCH_CONCURRENCY_LIMIT);

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
    if (i + BATCH_CONCURRENCY_LIMIT < students.length) {
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
      logActionDebug("getStudentsContentsForBatch", `${student.name}: flexible_contents 없음, master_books에서 기본 컨텐츠 조회`);

      // 테넌트의 활성 master_books에서 최근 10개 가져오기
      const { data: defaultBooks } = await supabase
        .from("master_books")
        .select("id")
        .eq("tenant_id", student.tenant_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);

      contentIds = (defaultBooks || []).map((b) => b.id);
      logActionDebug("getStudentsContentsForBatch", `${student.name}: 기본 컨텐츠 ${contentIds.length}개 로드`);
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

  // 배치 처리 (동시에 최대 5명씩)
  for (let i = 0; i < students.length; i += BATCH_CONCURRENCY_LIMIT) {
    // 취소 확인
    if (signal?.aborted) {
      throw new AppError("처리가 취소되었습니다.", ErrorCode.BUSINESS_LOGIC_ERROR, 499, true);
    }

    const batch = students.slice(i, i + BATCH_CONCURRENCY_LIMIT);

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
    if (i + BATCH_CONCURRENCY_LIMIT < students.length) {
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
