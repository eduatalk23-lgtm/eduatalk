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
  PlanGenerationSettings,
  SubjectScore,
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
 * 플랜 아이템 파싱 결과
 */
interface ParsePlanItemResult {
  plan: GeneratedPlanItem | null;
  skipped?: SkippedPlanInfo;
}

/**
 * 플랜 아이템 파싱 및 검증
 */
function parsePlanItem(
  raw: RawPlanItem,
  date: string,
  validContentIds?: Set<string>
): ParsePlanItemResult {
  // 필수 필드 검증
  if (!raw.contentId) {
    return {
      plan: null,
      skipped: { date, reason: "contentId 누락" },
    };
  }
  if (!raw.startTime || !raw.endTime) {
    return {
      plan: null,
      skipped: { date, contentId: raw.contentId, reason: "시작/종료 시간 누락" },
    };
  }

  // contentId 유효성 검증
  if (validContentIds && !validContentIds.has(raw.contentId)) {
    return {
      plan: null,
      skipped: {
        date,
        contentId: raw.contentId,
        reason: `유효하지 않은 contentId: ${raw.contentId}`,
      },
    };
  }

  return {
    plan: {
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
    },
  };
}

/**
 * 일별 그룹 파싱 결과
 */
interface ParseDailyGroupResult {
  group: DailyPlanGroup | null;
  skippedPlans: SkippedPlanInfo[];
}

/**
 * 일별 그룹 파싱
 */
function parseDailyGroup(
  raw: RawDailyGroup,
  validContentIds?: Set<string>
): ParseDailyGroupResult {
  if (!raw.date) {
    return { group: null, skippedPlans: [] };
  }

  const plans: GeneratedPlanItem[] = [];
  const skippedPlans: SkippedPlanInfo[] = [];
  let totalMinutes = 0;

  for (const rawPlan of raw.plans || []) {
    const result = parsePlanItem(rawPlan, raw.date, validContentIds);
    if (result.plan) {
      plans.push(result.plan);
      totalMinutes += result.plan.estimatedMinutes;
    } else if (result.skipped) {
      skippedPlans.push(result.skipped);
    }
  }

  return {
    group: {
      date: raw.date,
      dayOfWeek: raw.dayOfWeek ?? new Date(raw.date).getDay(),
      totalMinutes: raw.totalMinutes || totalMinutes,
      plans,
      dailySummary: raw.dailySummary,
    },
    skippedPlans,
  };
}

/**
 * 주간 매트릭스 파싱 결과
 */
interface ParseWeeklyMatrixResult {
  matrix: WeeklyPlanMatrix | null;
  skippedPlans: SkippedPlanInfo[];
}

/**
 * 주간 매트릭스 파싱
 */
function parseWeeklyMatrix(
  raw: RawWeeklyMatrix,
  weekNumber: number,
  validContentIds?: Set<string>
): ParseWeeklyMatrixResult {
  const days: DailyPlanGroup[] = [];
  const allSkippedPlans: SkippedPlanInfo[] = [];

  for (const rawDay of raw.days || []) {
    const result = parseDailyGroup(rawDay, validContentIds);
    if (result.group) {
      days.push(result.group);
    }
    allSkippedPlans.push(...result.skippedPlans);
  }

  if (days.length === 0) {
    return { matrix: null, skippedPlans: allSkippedPlans };
  }

  // 날짜 정렬
  days.sort((a, b) => a.date.localeCompare(b.date));

  return {
    matrix: {
      weekNumber: raw.weekNumber || weekNumber,
      weekStart: raw.weekStart || days[0].date,
      weekEnd: raw.weekEnd || days[days.length - 1].date,
      days,
      weeklySummary: raw.weeklySummary,
    },
    skippedPlans: allSkippedPlans,
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

/**
 * 스킵된 플랜 정보
 */
export interface SkippedPlanInfo {
  date?: string;
  contentId?: string;
  reason: string;
}

export interface ParseResult {
  success: boolean;
  response?: LLMPlanGenerationResponse;
  error?: string;
  skippedPlans?: SkippedPlanInfo[];
}

/**
 * LLM 응답 텍스트를 파싱하여 구조화된 플랜 응답으로 변환합니다
 *
 * 처리 과정:
 * 1. JSON 추출 (코드 블록 또는 직접 JSON)
 * 2. weeklyMatrices 파싱 및 검증
 * 3. contentId 유효성 검증 (validContentIds 제공 시)
 * 4. 스킵된 플랜 추적
 * 5. 메타데이터 및 추천 정보 생성
 *
 * @param {string} content - LLM 응답 텍스트 (JSON 포함)
 * @param {string} modelId - 사용된 모델 ID
 * @param {Object} usage - 토큰 사용량 { inputTokens, outputTokens }
 * @param {string[]} [validContentIds] - 유효한 콘텐츠 ID 목록 (제공 시 검증 수행)
 * @returns {ParseResult} 파싱 결과 { success, response?, error?, skippedPlans? }
 *
 * @example
 * ```typescript
 * const contentIds = contents.map(c => c.id);
 * const result = parseLLMResponse(
 *   llmResponse.content,
 *   llmResponse.modelId,
 *   llmResponse.usage,
 *   contentIds
 * );
 *
 * if (result.success) {
 *   console.log('생성된 플랜:', result.response.totalPlans);
 *   if (result.skippedPlans?.length) {
 *     console.warn('스킵된 플랜:', result.skippedPlans);
 *   }
 * }
 * ```
 */
export function parseLLMResponse(
  content: string,
  modelId: string,
  usage: { inputTokens: number; outputTokens: number },
  validContentIds?: string[]
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

  // validContentIds를 Set으로 변환 (빠른 검색을 위해)
  const contentIdSet = validContentIds ? new Set(validContentIds) : undefined;

  // 주간 매트릭스 파싱
  const weeklyMatrices: WeeklyPlanMatrix[] = [];
  const allSkippedPlans: SkippedPlanInfo[] = [];
  let totalPlans = 0;

  for (let i = 0; i < raw.weeklyMatrices.length; i++) {
    const result = parseWeeklyMatrix(raw.weeklyMatrices[i], i + 1, contentIdSet);
    if (result.matrix) {
      weeklyMatrices.push(result.matrix);
      for (const day of result.matrix.days) {
        totalPlans += day.plans.length;
      }
    }
    allSkippedPlans.push(...result.skippedPlans);
  }

  if (weeklyMatrices.length === 0) {
    return {
      success: false,
      error: "유효한 플랜을 파싱할 수 없습니다.",
      skippedPlans: allSkippedPlans,
    };
  }

  // 스킵된 플랜에 대한 경고 생성
  const skippedWarnings = allSkippedPlans.length > 0
    ? [`${allSkippedPlans.length}개의 플랜이 유효성 검증 실패로 스킵됨`]
    : [];

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
    warnings: [...collectWarnings(weeklyMatrices), ...skippedWarnings],
  };

  // 최종 응답 구성
  const response: LLMPlanGenerationResponse = {
    success: true,
    meta,
    weeklyMatrices,
    totalPlans: raw.totalPlans || totalPlans,
    recommendations: parseRecommendations(raw.recommendations),
  };

  return {
    success: true,
    response,
    skippedPlans: allSkippedPlans.length > 0 ? allSkippedPlans : undefined,
  };
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
 * 생성된 단일 플랜 아이템을 DB 저장 형식으로 변환합니다
 *
 * LLM이 생성한 camelCase 필드를 snake_case DB 스키마에 맞게 변환하고,
 * ai_generated: true, status: 'pending' 기본값을 설정합니다.
 *
 * @param {GeneratedPlanItem} plan - LLM이 생성한 플랜 아이템
 * @returns {DBPlanData} DB 저장용 플랜 데이터
 *
 * @example
 * ```typescript
 * const dbPlan = toDBPlanData(plan);
 * await supabase.from('student_plans').insert(dbPlan);
 * ```
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
 * LLM 응답의 모든 플랜을 DB 저장 형식의 배열로 변환합니다
 *
 * weeklyMatrices > days > plans 구조를 평탄화하여 단일 배열로 반환합니다.
 *
 * @param {LLMPlanGenerationResponse} response - LLM 플랜 생성 응답
 * @returns {DBPlanData[]} DB 저장용 플랜 데이터 배열
 *
 * @example
 * ```typescript
 * const dbPlans = toDBPlanDataList(response);
 * await supabase.from('student_plans').insert(dbPlans);
 * ```
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

// ============================================
// 품질 메트릭 검증
// ============================================

/**
 * 품질 경고 타입
 */
export interface QualityWarning {
  type: "weak_subject" | "review_ratio" | "subject_balance" | "time_slot";
  message: string;
  expected?: number;
  actual?: number;
}

/**
 * 품질 메트릭 검증 결과
 */
export interface QualityMetricsResult {
  isValid: boolean;
  warnings: QualityWarning[];
  metrics: {
    weakSubjectRatio?: number;
    reviewRatio?: number;
    subjectDistribution?: Record<string, number>;
  };
}

/**
 * LLM이 생성한 플랜의 품질 메트릭을 검증합니다
 *
 * 설정에 따라 다음 항목들을 검증합니다:
 * - 취약 과목 오전 배치 비율 (prioritizeWeakSubjects=true)
 * - 복습 플랜 비율 (includeReview=true)
 * - 과목 균형 (balanceSubjects=true)
 *
 * @param {LLMPlanGenerationResponse} response - LLM 생성 응답
 * @param {PlanGenerationSettings} settings - 플랜 생성 설정
 * @param {SubjectScore[]} [scores] - 학생 성적 (취약 과목 isWeak 정보 포함)
 * @returns {QualityMetricsResult} 검증 결과 { isValid, warnings, metrics }
 *
 * @example
 * ```typescript
 * const quality = validateQualityMetrics(response, settings, scores);
 *
 * if (!quality.isValid) {
 *   console.warn('품질 경고:', quality.warnings);
 * }
 *
 * console.log('취약 과목 오전 배치율:', quality.metrics.weakSubjectRatio);
 * console.log('복습 비율:', quality.metrics.reviewRatio);
 * console.log('과목 분포:', quality.metrics.subjectDistribution);
 * ```
 */
export function validateQualityMetrics(
  response: LLMPlanGenerationResponse,
  settings: PlanGenerationSettings,
  scores?: SubjectScore[]
): QualityMetricsResult {
  const warnings: QualityWarning[] = [];
  const metrics: QualityMetricsResult["metrics"] = {};

  // 모든 플랜 추출
  const allPlans: GeneratedPlanItem[] = [];
  for (const matrix of response.weeklyMatrices) {
    for (const day of matrix.days) {
      allPlans.push(...day.plans);
    }
  }

  if (allPlans.length === 0) {
    return { isValid: false, warnings: [{ type: "weak_subject", message: "생성된 플랜이 없습니다." }], metrics };
  }

  // 1. 취약 과목 우선 배치 검증 (prioritizeWeakSubjects=true인 경우)
  if (settings.prioritizeWeakSubjects && scores) {
    const weakSubjects = scores.filter((s) => s.isWeak).map((s) => s.subject);

    if (weakSubjects.length > 0) {
      // 오전 시간 (12:00 이전) 플랜 중 취약 과목 비율 계산
      const morningPlans = allPlans.filter((p) => p.startTime < "12:00");
      const morningWeakPlans = morningPlans.filter((p) =>
        weakSubjects.some((ws) => p.subject.includes(ws))
      );

      const morningWeakRatio = morningPlans.length > 0
        ? morningWeakPlans.length / morningPlans.length
        : 0;

      metrics.weakSubjectRatio = morningWeakRatio;

      // 취약 과목이 오전 플랜의 30% 미만이면 경고
      if (morningWeakRatio < 0.3) {
        warnings.push({
          type: "weak_subject",
          message: `취약 과목이 오전 시간에 충분히 배치되지 않았습니다 (${Math.round(morningWeakRatio * 100)}%)`,
          expected: 30,
          actual: Math.round(morningWeakRatio * 100),
        });
      }
    }
  }

  // 2. 복습 비율 검증 (includeReview=true인 경우)
  if (settings.includeReview && settings.reviewRatio) {
    const reviewPlans = allPlans.filter((p) => p.isReview);
    const actualReviewRatio = reviewPlans.length / allPlans.length;

    metrics.reviewRatio = actualReviewRatio;

    // 허용 오차: ±10%
    const expectedRatio = settings.reviewRatio;
    const tolerance = 0.1;

    if (Math.abs(actualReviewRatio - expectedRatio) > tolerance) {
      warnings.push({
        type: "review_ratio",
        message: `복습 비율이 설정과 다릅니다 (설정: ${Math.round(expectedRatio * 100)}%, 실제: ${Math.round(actualReviewRatio * 100)}%)`,
        expected: Math.round(expectedRatio * 100),
        actual: Math.round(actualReviewRatio * 100),
      });
    }
  }

  // 3. 과목 균형 검증 (balanceSubjects=true인 경우)
  if (settings.balanceSubjects) {
    const subjectMinutes: Record<string, number> = {};

    for (const plan of allPlans) {
      const subject = plan.subject;
      subjectMinutes[subject] = (subjectMinutes[subject] || 0) + plan.estimatedMinutes;
    }

    metrics.subjectDistribution = subjectMinutes;

    const subjects = Object.keys(subjectMinutes);
    if (subjects.length > 1) {
      const totalMinutes = Object.values(subjectMinutes).reduce((a, b) => a + b, 0);
      const avgMinutes = totalMinutes / subjects.length;

      // 표준편차 계산
      const variance = subjects.reduce((acc, subject) => {
        return acc + Math.pow(subjectMinutes[subject] - avgMinutes, 2);
      }, 0) / subjects.length;
      const stdDev = Math.sqrt(variance);

      // 변동계수 (CV) = 표준편차 / 평균
      const cv = stdDev / avgMinutes;

      // CV가 0.5를 초과하면 균형이 맞지 않음
      if (cv > 0.5) {
        const maxSubject = subjects.reduce((a, b) =>
          subjectMinutes[a] > subjectMinutes[b] ? a : b
        );
        const minSubject = subjects.reduce((a, b) =>
          subjectMinutes[a] < subjectMinutes[b] ? a : b
        );

        warnings.push({
          type: "subject_balance",
          message: `과목 간 학습 시간 불균형 (${maxSubject}: ${subjectMinutes[maxSubject]}분, ${minSubject}: ${subjectMinutes[minSubject]}분)`,
        });
      }
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    metrics,
  };
}
