/**
 * LLM 요청 빌더
 *
 * 데이터베이스 데이터를 LLM 요청 형식으로 변환합니다.
 */

import type {
  LLMPlanGenerationRequest,
  StudentInfo,
  SubjectScore,
  ContentInfo,
  LearningHistory,
  PlanGenerationSettings,
  TimeSlotInfo,
} from "../types";

// ============================================
// 데이터베이스 타입 (간소화)
// ============================================

interface DBStudent {
  id: string;
  name?: string | null;
  grade?: number | null;
  school_name?: string | null;
  target_university?: string | null;
  target_major?: string | null;
}

interface DBScore {
  subject?: string | null;
  subject_category?: string | null;
  score?: number | null;
  grade?: number | null;
  percentile?: number | null;
  standard_score?: number | null;
}

interface DBContent {
  id: string;
  title?: string | null;
  subject?: string | null;
  subject_category?: string | null;
  content_type?: string | null;
  total_pages?: number | null;
  total_lectures?: number | null;
  estimated_hours?: number | null;
  difficulty?: string | null;
}

interface DBTimeSlot {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  slot_type?: string | null;
}

interface DBLearningStats {
  total_plans_completed?: number | null;
  average_completion_rate?: number | null;
  average_daily_minutes?: number | null;
  preferred_times?: string[] | null;
  weak_subjects?: string[] | null;
}

// ============================================
// 변환 함수
// ============================================

/**
 * 학생 정보 변환
 */
export function transformStudent(db: DBStudent): StudentInfo {
  return {
    id: db.id,
    name: db.name || "학생",
    grade: db.grade || 3, // 기본값: 고3
    school: db.school_name || undefined,
    targetUniversity: db.target_university || undefined,
    targetMajor: db.target_major || undefined,
  };
}

/**
 * 성적 정보 변환
 */
export function transformScores(
  dbScores: DBScore[],
  weakSubjects?: string[]
): SubjectScore[] {
  return dbScores
    .filter((s) => s.subject)
    .map((s) => ({
      subject: s.subject!,
      subjectCategory: s.subject_category || undefined,
      score: s.score || undefined,
      grade: s.grade || undefined,
      percentile: s.percentile || undefined,
      standardScore: s.standard_score || undefined,
      isWeak: weakSubjects?.includes(s.subject!) || false,
    }));
}

/**
 * 콘텐츠 정보 변환
 */
export function transformContents(dbContents: DBContent[]): ContentInfo[] {
  return dbContents.map((c) => ({
    id: c.id,
    title: c.title || "제목 없음",
    subject: c.subject || "기타",
    subjectCategory: c.subject_category || undefined,
    contentType: (c.content_type as ContentInfo["contentType"]) || "custom",
    totalPages: c.total_pages || undefined,
    totalLectures: c.total_lectures || undefined,
    estimatedHoursTotal: c.estimated_hours || undefined,
    difficulty: (c.difficulty as ContentInfo["difficulty"]) || undefined,
  }));
}

/**
 * 시간 슬롯 변환
 */
export function transformTimeSlots(dbSlots: DBTimeSlot[]): TimeSlotInfo[] {
  return dbSlots.map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.start_time.slice(0, 5), // HH:mm 형식으로
    endTime: s.end_time.slice(0, 5),
    type: (s.slot_type as TimeSlotInfo["type"]) || "study",
  }));
}

/**
 * 학습 이력 변환
 */
export function transformLearningHistory(
  stats: DBLearningStats
): LearningHistory {
  return {
    totalPlansCompleted: stats.total_plans_completed || 0,
    averageCompletionRate: stats.average_completion_rate || 0,
    averageDailyStudyMinutes: stats.average_daily_minutes || 0,
    preferredStudyTimes: stats.preferred_times || undefined,
    frequentlyIncompleteSubjects: stats.weak_subjects || undefined,
  };
}

// ============================================
// 요청 빌더
// ============================================

export interface BuildRequestOptions {
  student: DBStudent;
  scores?: DBScore[];
  contents: DBContent[];
  timeSlots?: DBTimeSlot[];
  learningStats?: DBLearningStats;
  weakSubjects?: string[];
  settings: {
    startDate: string;
    endDate: string;
    dailyStudyMinutes: number;
    breakIntervalMinutes?: number;
    breakDurationMinutes?: number;
    excludeDays?: number[];
    excludeDates?: string[];
    prioritizeWeakSubjects?: boolean;
    balanceSubjects?: boolean;
    includeReview?: boolean;
    reviewRatio?: number;
  };
  additionalInstructions?: string;
}

/**
 * 데이터베이스 데이터를 LLM 플랜 생성 요청 형식으로 변환합니다
 *
 * 각 DB 엔티티를 LLM이 이해할 수 있는 구조로 변환하고,
 * 취약 과목 정보를 성적 데이터에 병합합니다.
 *
 * @param {BuildRequestOptions} options - 빌드 옵션
 * @param {DBStudent} options.student - 학생 정보 (DB 형식)
 * @param {DBScore[]} [options.scores] - 성적 목록
 * @param {string[]} [options.weakSubjects] - 취약 과목 목록
 * @param {DBContent[]} options.contents - 학습 콘텐츠 목록
 * @param {DBTimeSlot[]} [options.timeSlots] - 시간 슬롯 목록
 * @param {DBLearningStats} [options.learningStats] - 학습 통계
 * @param {Object} options.settings - 플랜 생성 설정
 * @returns {LLMPlanGenerationRequest} LLM 요청 객체
 *
 * @example
 * ```typescript
 * const request = buildLLMRequest({
 *   student: dbStudent,
 *   scores: dbScores,
 *   weakSubjects: ['수학'],
 *   contents: dbContents,
 *   settings: {
 *     startDate: '2025-01-01',
 *     endDate: '2025-01-31',
 *     dailyStudyMinutes: 180,
 *   },
 * });
 * ```
 */
export function buildLLMRequest(
  options: BuildRequestOptions
): LLMPlanGenerationRequest {
  const student = transformStudent(options.student);
  const scores = options.scores
    ? transformScores(options.scores, options.weakSubjects)
    : undefined;
  const contents = transformContents(options.contents);
  const timeSlots = options.timeSlots
    ? transformTimeSlots(options.timeSlots)
    : undefined;
  const learningHistory = options.learningStats
    ? transformLearningHistory(options.learningStats)
    : undefined;

  const settings: PlanGenerationSettings = {
    startDate: options.settings.startDate,
    endDate: options.settings.endDate,
    dailyStudyMinutes: options.settings.dailyStudyMinutes,
    breakIntervalMinutes: options.settings.breakIntervalMinutes,
    breakDurationMinutes: options.settings.breakDurationMinutes,
    excludeDays: options.settings.excludeDays,
    excludeDates: options.settings.excludeDates,
    prioritizeWeakSubjects: options.settings.prioritizeWeakSubjects,
    balanceSubjects: options.settings.balanceSubjects,
    includeReview: options.settings.includeReview,
    reviewRatio: options.settings.reviewRatio,
  };

  return {
    student,
    scores,
    contents,
    learningHistory,
    settings,
    timeSlots,
    additionalInstructions: options.additionalInstructions,
  };
}

// ============================================
// 콘텐츠 제한
// ============================================

/**
 * 콘텐츠 목록을 최대 개수로 제한합니다 (토큰 절약)
 *
 * 우선순위 기준:
 * 1. priority가 'high'인 콘텐츠 우선
 * 2. 기존 순서 유지
 *
 * @param {ContentInfo[]} contents - 원본 콘텐츠 목록
 * @param {number} [maxCount=20] - 최대 콘텐츠 수
 * @returns {ContentInfo[]} 제한된 콘텐츠 목록
 *
 * @example
 * ```typescript
 * const limited = limitContents(allContents, 15);
 * console.log(limited.length); // <= 15
 * ```
 */
export function limitContents(
  contents: ContentInfo[],
  maxCount: number = 20
): ContentInfo[] {
  if (contents.length <= maxCount) {
    return contents;
  }

  // 우선순위 높은 것 우선, 그 다음 추정 시간이 긴 것 우선
  const sorted = [...contents].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const aPriority = priorityOrder[a.priority || "medium"];
    const bPriority = priorityOrder[b.priority || "medium"];

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return (b.estimatedHoursTotal || 0) - (a.estimatedHoursTotal || 0);
  });

  return sorted.slice(0, maxCount);
}

/**
 * 기간 내 실제 학습 일수를 계산합니다
 *
 * 제외 요일(예: 주말)을 고려하여 학습 가능한 날짜 수를 반환합니다.
 *
 * @param {string} startDate - 시작 날짜 (YYYY-MM-DD)
 * @param {string} endDate - 종료 날짜 (YYYY-MM-DD)
 * @param {number[]} [excludeDays] - 제외할 요일 (0=일요일, 6=토요일)
 * @returns {number} 학습 가능 일수
 *
 * @example
 * ```typescript
 * // 주말 제외한 일수 계산
 * const days = calculateDaysInRange('2025-01-01', '2025-01-07', [0, 6]);
 * console.log(days); // 5 (월~금)
 * ```
 */
export function calculateDaysInRange(
  startDate: string,
  endDate: string,
  excludeDays?: number[]
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (!excludeDays?.includes(dayOfWeek)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * LLM 플랜 생성 요청의 유효성을 검사합니다
 *
 * 검사 항목:
 * - 시작/종료 날짜 순서
 * - 기간 제한 (최대 90일)
 * - 콘텐츠 최소 1개 이상
 * - 일일 학습 시간 범위 (30분 ~ 12시간)
 *
 * @param {LLMPlanGenerationRequest} request - 검사할 요청 객체
 * @returns {{ valid: boolean; errors: string[] }} 유효성 검사 결과
 *
 * @example
 * ```typescript
 * const { valid, errors } = validateRequest(request);
 * if (!valid) {
 *   console.error('검증 실패:', errors);
 *   return;
 * }
 * ```
 */
export function validateRequest(
  request: LLMPlanGenerationRequest
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 기간 검사
  const start = new Date(request.settings.startDate);
  const end = new Date(request.settings.endDate);

  if (start > end) {
    errors.push("시작 날짜가 종료 날짜보다 늦습니다.");
  }

  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysDiff > 90) {
    errors.push("최대 90일까지만 플랜 생성이 가능합니다.");
  }

  // 콘텐츠 검사
  if (request.contents.length === 0) {
    errors.push("최소 1개 이상의 콘텐츠가 필요합니다.");
  }

  // 학습 시간 검사
  if (request.settings.dailyStudyMinutes < 30) {
    errors.push("일일 학습 시간은 최소 30분 이상이어야 합니다.");
  }
  if (request.settings.dailyStudyMinutes > 720) {
    errors.push("일일 학습 시간은 12시간을 초과할 수 없습니다.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
