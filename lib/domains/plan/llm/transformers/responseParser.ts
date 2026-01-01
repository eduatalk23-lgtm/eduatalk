/**
 * LLM 응답 파서
 *
 * LLM 응답을 파싱하고 검증합니다.
 */

import { extractJSON } from "../client";
import type {
  LLMPlanGenerationResponse,
  WeeklyPlanMatrix,
  DailyPlanGroup,
  GeneratedPlanItem,
  Recommendations,
  GenerationMetadata,
} from "../types";

// ============================================
// 응답 스키마 (내부 파싱용)
// ============================================

interface RawLLMResponse {
  weeklyMatrices?: RawWeeklyMatrix[];
  totalPlans?: number;
  recommendations?: RawRecommendations;
}

interface RawWeeklyMatrix {
  weekNumber?: number;
  weekStart?: string;
  weekEnd?: string;
  days?: RawDailyGroup[];
  weeklySummary?: string;
}

interface RawDailyGroup {
  date?: string;
  dayOfWeek?: number;
  totalMinutes?: number;
  plans?: RawPlanItem[];
  dailySummary?: string;
}

interface RawPlanItem {
  date?: string;
  dayOfWeek?: number;
  slotId?: string;
  startTime?: string;
  endTime?: string;
  contentId?: string;
  contentTitle?: string;
  subject?: string;
  subjectCategory?: string;
  rangeStart?: number;
  rangeEnd?: number;
  rangeDisplay?: string;
  estimatedMinutes?: number;
  isReview?: boolean;
  notes?: string;
  priority?: string;
}

interface RawRecommendations {
  studyTips?: string[];
  warnings?: string[];
  suggestedAdjustments?: string[];
  focusAreas?: string[];
}

// ============================================
// 파싱 함수
// ============================================

/**
 * 플랜 아이템 파싱 및 검증
 */
function parsePlanItem(raw: RawPlanItem, date: string): GeneratedPlanItem | null {
  // 필수 필드 검증
  if (!raw.contentId || !raw.startTime || !raw.endTime) {
    return null;
  }

  return {
    date: raw.date || date,
    dayOfWeek: raw.dayOfWeek ?? new Date(date).getDay(),
    slotId: raw.slotId,
    startTime: normalizeTime(raw.startTime),
    endTime: normalizeTime(raw.endTime),
    contentId: raw.contentId,
    contentTitle: raw.contentTitle || "제목 없음",
    subject: raw.subject || "기타",
    subjectCategory: raw.subjectCategory,
    rangeStart: raw.rangeStart,
    rangeEnd: raw.rangeEnd,
    rangeDisplay: raw.rangeDisplay || formatRange(raw.rangeStart, raw.rangeEnd),
    estimatedMinutes: raw.estimatedMinutes || calculateMinutes(raw.startTime, raw.endTime),
    isReview: raw.isReview || false,
    notes: raw.notes,
    priority: normalizePriority(raw.priority),
  };
}

/**
 * 일별 그룹 파싱
 */
function parseDailyGroup(raw: RawDailyGroup): DailyPlanGroup | null {
  if (!raw.date) return null;

  const plans: GeneratedPlanItem[] = [];
  let totalMinutes = 0;

  for (const rawPlan of raw.plans || []) {
    const plan = parsePlanItem(rawPlan, raw.date);
    if (plan) {
      plans.push(plan);
      totalMinutes += plan.estimatedMinutes;
    }
  }

  return {
    date: raw.date,
    dayOfWeek: raw.dayOfWeek ?? new Date(raw.date).getDay(),
    totalMinutes: raw.totalMinutes || totalMinutes,
    plans,
    dailySummary: raw.dailySummary,
  };
}

/**
 * 주간 매트릭스 파싱
 */
function parseWeeklyMatrix(raw: RawWeeklyMatrix, weekNumber: number): WeeklyPlanMatrix | null {
  const days: DailyPlanGroup[] = [];

  for (const rawDay of raw.days || []) {
    const day = parseDailyGroup(rawDay);
    if (day) {
      days.push(day);
    }
  }

  if (days.length === 0) return null;

  // 날짜 정렬
  days.sort((a, b) => a.date.localeCompare(b.date));

  return {
    weekNumber: raw.weekNumber || weekNumber,
    weekStart: raw.weekStart || days[0].date,
    weekEnd: raw.weekEnd || days[days.length - 1].date,
    days,
    weeklySummary: raw.weeklySummary,
  };
}

/**
 * 추천 사항 파싱
 */
function parseRecommendations(raw?: RawRecommendations): Recommendations {
  return {
    studyTips: raw?.studyTips || [],
    warnings: raw?.warnings || [],
    suggestedAdjustments: raw?.suggestedAdjustments,
    focusAreas: raw?.focusAreas,
  };
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 시간 정규화 (HH:mm)
 */
function normalizeTime(time: string): string {
  // 이미 HH:mm 형식이면 그대로 반환
  if (/^\d{2}:\d{2}$/.test(time)) {
    return time;
  }
  // H:mm -> HH:mm
  if (/^\d:\d{2}$/.test(time)) {
    return `0${time}`;
  }
  // HH:mm:ss -> HH:mm
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return time.slice(0, 5);
  }
  return time;
}

/**
 * 우선순위 정규화
 */
function normalizePriority(priority?: string): "high" | "medium" | "low" {
  const normalized = priority?.toLowerCase();
  if (normalized === "high" || normalized === "높음") return "high";
  if (normalized === "low" || normalized === "낮음") return "low";
  return "medium";
}

/**
 * 범위 포맷
 */
function formatRange(start?: number, end?: number): string | undefined {
  if (start === undefined && end === undefined) return undefined;
  if (start === end) return `p.${start}`;
  return `p.${start || "?"}-${end || "?"}`;
}

/**
 * 시간 차이 계산 (분)
 */
function calculateMinutes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

// ============================================
// 메인 파서
// ============================================

export interface ParseResult {
  success: boolean;
  response?: LLMPlanGenerationResponse;
  error?: string;
}

/**
 * LLM 응답 파싱
 */
export function parseLLMResponse(
  content: string,
  modelId: string,
  usage: { inputTokens: number; outputTokens: number }
): ParseResult {
  // JSON 추출
  const raw = extractJSON<RawLLMResponse>(content);

  if (!raw) {
    return {
      success: false,
      error: "LLM 응답에서 유효한 JSON을 찾을 수 없습니다.",
    };
  }

  // weeklyMatrices 검증
  if (!raw.weeklyMatrices || raw.weeklyMatrices.length === 0) {
    return {
      success: false,
      error: "생성된 플랜이 없습니다.",
    };
  }

  // 주간 매트릭스 파싱
  const weeklyMatrices: WeeklyPlanMatrix[] = [];
  let totalPlans = 0;

  for (let i = 0; i < raw.weeklyMatrices.length; i++) {
    const matrix = parseWeeklyMatrix(raw.weeklyMatrices[i], i + 1);
    if (matrix) {
      weeklyMatrices.push(matrix);
      for (const day of matrix.days) {
        totalPlans += day.plans.length;
      }
    }
  }

  if (weeklyMatrices.length === 0) {
    return {
      success: false,
      error: "유효한 플랜을 파싱할 수 없습니다.",
    };
  }

  // 메타데이터 생성
  const meta: GenerationMetadata = {
    modelId,
    confidence: calculateConfidence(weeklyMatrices),
    reasoning: "AI가 학생의 성적, 학습 이력, 콘텐츠를 분석하여 최적화된 플랜을 생성했습니다.",
    tokensUsed: {
      input: usage.inputTokens,
      output: usage.outputTokens,
    },
    generatedAt: new Date().toISOString(),
    warnings: collectWarnings(weeklyMatrices),
  };

  // 최종 응답 구성
  const response: LLMPlanGenerationResponse = {
    success: true,
    meta,
    weeklyMatrices,
    totalPlans: raw.totalPlans || totalPlans,
    recommendations: parseRecommendations(raw.recommendations),
  };

  return { success: true, response };
}

/**
 * 신뢰도 계산
 */
function calculateConfidence(matrices: WeeklyPlanMatrix[]): number {
  let validPlans = 0;
  let totalPlans = 0;

  for (const matrix of matrices) {
    for (const day of matrix.days) {
      for (const plan of day.plans) {
        totalPlans++;
        // 필수 필드 있으면 유효
        if (plan.contentId && plan.startTime && plan.endTime) {
          validPlans++;
        }
      }
    }
  }

  return totalPlans > 0 ? validPlans / totalPlans : 0;
}

/**
 * 경고 수집
 */
function collectWarnings(matrices: WeeklyPlanMatrix[]): string[] {
  const warnings: string[] = [];

  for (const matrix of matrices) {
    for (const day of matrix.days) {
      // 하루 학습 시간 초과 체크
      if (day.totalMinutes > 480) {
        warnings.push(
          `${day.date}: 하루 학습 시간이 8시간을 초과합니다 (${Math.round(day.totalMinutes / 60)}시간)`
        );
      }

      // 플랜 간 시간 겹침 체크
      const sortedPlans = [...day.plans].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      for (let i = 1; i < sortedPlans.length; i++) {
        if (sortedPlans[i].startTime < sortedPlans[i - 1].endTime) {
          warnings.push(
            `${day.date}: 시간 겹침 발견 (${sortedPlans[i - 1].endTime} ~ ${sortedPlans[i].startTime})`
          );
        }
      }
    }
  }

  return warnings;
}

// ============================================
// 플랜 변환 (DB 저장용)
// ============================================

export interface DBPlanData {
  plan_date: string;
  start_time: string;
  end_time: string;
  content_id: string;
  title: string;
  subject: string;
  subject_category?: string;
  range_start?: number;
  range_end?: number;
  range_display?: string;
  estimated_minutes: number;
  is_review: boolean;
  notes?: string;
  priority: string;
  status: "pending";
  ai_generated: boolean;
}

/**
 * 생성된 플랜을 DB 저장 형식으로 변환
 */
export function toDBPlanData(plan: GeneratedPlanItem): DBPlanData {
  return {
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
    ai_generated: true,
  };
}

/**
 * 전체 응답을 DB 저장 형식으로 변환
 */
export function toDBPlanDataList(response: LLMPlanGenerationResponse): DBPlanData[] {
  const plans: DBPlanData[] = [];

  for (const matrix of response.weeklyMatrices) {
    for (const day of matrix.days) {
      for (const plan of day.plans) {
        plans.push(toDBPlanData(plan));
      }
    }
  }

  return plans;
}
