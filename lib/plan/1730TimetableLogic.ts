/**
 * 1730 Timetable 플랜 생성 로직
 *
 * 문서 기반:
 * - 1730Timetable-솔루션-요구사항-및-플랜-예시.md
 * - 플랜-생성-로직-설계.md
 * - 학습일-복습일-주기-설정.md
 * - 요구사항-정리.md
 */

import {
  PlanGroup,
  PlanExclusion,
  AcademySchedule,
  StudyReviewCycle,
  SubjectConstraints,
  NonStudyTimeBlock,
} from "@/lib/types/plan";
import {
  getEffectiveAllocation,
  type ContentAllocation,
  type SubjectAllocation as UtilSubjectAllocation,
} from "@/lib/utils/subjectAllocation";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";

export type DayType = "study" | "review" | "exclusion";

export type CycleDayInfo = {
  date: string; // YYYY-MM-DD
  day_type: DayType;
  cycle_day_number: number; // 주기 내 일자 번호 (1부터 시작)
  cycle_number: number; // 주차 번호 (1부터 시작)
};

export type SubjectAllocation = {
  subject_id: string;
  subject_name: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number; // 전략과목인 경우 주당 배정 일수 (2, 3, 4)
};

export type ContentDurationInfo = {
  content_id: string;
  content_type: "book" | "lecture" | "custom";
  base_duration_per_unit: number; // 단위당 기본 소요시간 (분)
  total_units: number; // 총 단위 수 (페이지, 강의 수 등)
};

export type StudentLevel = "high" | "medium" | "low";

export type DurationCalculationResult = {
  base_duration: number; // 기본 소요시간 (분)
  student_level_factor: number; // 학생 수준 보정 계수
  subject_factor: number; // 과목별 보정 계수
  difficulty_factor: number; // 난이도 보정 계수
  review_factor?: number; // 복습 보정 계수 (복습일인 경우)
  review_of_review_factor?: number; // 복습의 복습 보정 계수 (추가 기간인 경우)
  final_duration: number; // 최종 소요시간 (분)
};

/**
 * 학습일/복습일 주기 계산
 * 제외일은 주기 계산에서 완전히 제외됨
 */
export function calculateStudyReviewCycle(
  periodStart: string,
  periodEnd: string,
  cycle: StudyReviewCycle,
  exclusions: PlanExclusion[]
): CycleDayInfo[] {
  const result: CycleDayInfo[] = [];
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  // 제외일 Set 생성
  const exclusionDates = new Set(
    exclusions.map((e) => e.exclusion_date.split("T")[0])
  );

  // 날짜 범위 생성
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // 주기 계산 (제외일 제외)
  let cycleDayNumber = 0;
  let cycleNumber = 1;
  const cycleLength = cycle.study_days + cycle.review_days;

  for (const date of dates) {
    const dateStr = formatDate(date);

    // 제외일 체크
    if (exclusionDates.has(dateStr)) {
      result.push({
        date: dateStr,
        day_type: "exclusion",
        cycle_day_number: 0, // 제외일은 주기 일자 번호 없음
        cycle_number: cycleNumber,
      });
      continue;
    }

    // 주기 일자 카운트 증가
    cycleDayNumber++;

    // 주기 경계 처리
    if (cycleDayNumber > cycleLength) {
      cycleDayNumber = 1;
      cycleNumber++;
    }

    // 학습일/복습일 구분
    const dayType: DayType =
      cycleDayNumber <= cycle.study_days ? "study" : "review";

    result.push({
      date: dateStr,
      day_type: dayType,
      cycle_day_number: cycleDayNumber,
      cycle_number: cycleNumber,
    });
  }

  return result;
}

/**
 * @deprecated 이 함수는 제거되었습니다.
 * 
 * 새로운 코드에서는 `lib/utils/subjectAllocation.ts`의 `getEffectiveAllocation` 함수를 직접 사용하세요.
 * 
 * @see lib/utils/subjectAllocation.ts - getEffectiveAllocation
 */

/**
 * 전략과목/취약과목 배정 날짜 계산
 */
export function calculateSubjectAllocationDates(
  cycleDays: CycleDayInfo[],
  allocation: SubjectAllocation
): string[] {
  const studyDates = cycleDays
    .filter((d) => d.day_type === "study")
    .map((d) => d.date);

  if (allocation.subject_type === "weakness") {
    // 취약과목: 전체 학습일 배정
    return studyDates;
  } else {
    // 전략과목: 주당 배정 일수에 따라 배정
    const weeklyDays = allocation.weekly_days || 3;
    const allocatedDates: string[] = [];

    // 주차별로 그룹화
    const weeks = new Map<number, string[]>();
    for (const cycleDay of cycleDays) {
      if (cycleDay.day_type === "study") {
        if (!weeks.has(cycleDay.cycle_number)) {
          weeks.set(cycleDay.cycle_number, []);
        }
        weeks.get(cycleDay.cycle_number)!.push(cycleDay.date);
      }
    }

    // 각 주차에서 주당 배정 일수만큼 균등하게 선택
    for (const [_, weekDates] of weeks.entries()) {
      const selectedCount = Math.min(weeklyDays, weekDates.length);
      if (selectedCount === 0) continue;
      
      // 균등하게 분배하기 위한 간격 계산
      const step = weekDates.length / selectedCount;
      
      for (let i = 0; i < selectedCount; i++) {
        // 중간값을 사용하여 더 균등하게 분배
        const index = Math.floor((i + 0.5) * step);
        allocatedDates.push(weekDates[index]);
      }
    }

    return allocatedDates;
  }
}

/**
 * 학습 범위 분할
 */
export function divideContentRange(
  totalRange: number,
  allocatedDates: string[],
  contentId: string
): Map<string, { start: number; end: number }> {
  const result = new Map<string, { start: number; end: number }>();

  if (allocatedDates.length === 0) {
    return result;
  }

  const dailyRange = totalRange / allocatedDates.length;
  let currentStart = 0;

  for (let i = 0; i < allocatedDates.length; i++) {
    const date = allocatedDates[i];
    const isLast = i === allocatedDates.length - 1;
    // 누적 반올림 (Bresenham): 오차가 마지막 날에 집중되지 않도록
    const dayRange = isLast
      ? totalRange - currentStart
      : Math.round(dailyRange * (i + 1)) - currentStart;
    const dayEnd = currentStart + dayRange;

    result.set(date, {
      start: Math.round(currentStart),
      end: Math.round(dayEnd),
    });

    currentStart = dayEnd;
  }

  return result;
}

/**
 * 소요시간 계산
 */
export function calculateDuration(
  range: { start: number; end: number },
  durationInfo: ContentDurationInfo,
  studentLevel: StudentLevel,
  subjectType: "strategy" | "weakness",
  isReview: boolean = false,
  isReviewOfReview: boolean = false
): DurationCalculationResult {
  const amount = range.end - range.start;

  // 기본 소요시간
  const baseDuration = amount * durationInfo.base_duration_per_unit;

  // 학생 수준 보정 계수
  let studentLevelFactor = 1.0;
  switch (studentLevel) {
    case "high":
      studentLevelFactor = 0.85; // 0.8~0.9 평균
      break;
    case "medium":
      studentLevelFactor = 1.0;
      break;
    case "low":
      studentLevelFactor = 1.2; // 1.1~1.3 평균
      break;
  }

  // 과목별 보정 계수
  let subjectFactor = 1.0;
  if (subjectType === "weakness") {
    subjectFactor = 1.2; // 취약과목
  } else {
    subjectFactor = 1.05; // 전략과목 (1.0~1.1 평균)
  }

  // 난이도 보정 계수 (기본값 1.0, 향후 확장 가능)
  const difficultyFactor = 1.0;

  // 복습 보정 계수
  let reviewFactor: number | undefined;
  if (isReview) {
    reviewFactor = 0.4; // 0.3~0.5 평균
  }

  // 복습의 복습 보정 계수
  let reviewOfReviewFactor: number | undefined;
  if (isReviewOfReview) {
    reviewOfReviewFactor = 0.25; // 0.2~0.3 평균
  }

  // 최종 소요시간 계산
  let finalDuration =
    baseDuration * studentLevelFactor * subjectFactor * difficultyFactor;

  if (isReview && reviewFactor) {
    finalDuration *= reviewFactor;
  }

  if (isReviewOfReview && reviewOfReviewFactor) {
    finalDuration *= reviewOfReviewFactor;
  }

  return {
    base_duration: baseDuration,
    student_level_factor: studentLevelFactor,
    subject_factor: subjectFactor,
    difficulty_factor: difficultyFactor,
    review_factor: reviewFactor,
    review_of_review_factor: reviewOfReviewFactor,
    final_duration: Math.round(finalDuration),
  };
}

/**
 * 복습일 소요시간 계산
 * 직전 학습일(6일) 동안 학습한 전체 범위를 복습
 */
export function calculateReviewDuration(
  previousStudyDays: CycleDayInfo[],
  contentRanges: Map<string, { start: number; end: number }>,
  durationInfo: ContentDurationInfo,
  studentLevel: StudentLevel,
  subjectType: "strategy" | "weakness"
): DurationCalculationResult {
  // 직전 학습일의 학습 범위 계산
  let totalStart = Infinity;
  let totalEnd = -Infinity;

  for (const day of previousStudyDays) {
    const range = contentRanges.get(day.date);
    if (range) {
      totalStart = Math.min(totalStart, range.start);
      totalEnd = Math.max(totalEnd, range.end);
    }
  }

  if (totalStart === Infinity || totalEnd === -Infinity) {
    // 직전 학습일 범위가 없으면 기본값 반환
    return {
      base_duration: 0,
      student_level_factor: 1.0,
      subject_factor: 1.0,
      difficulty_factor: 1.0,
      review_factor: 0.4,
      final_duration: 0,
    };
  }

  // 직전 학습일의 학습 소요시간 계산
  const previousRange = { start: totalStart, end: totalEnd };
  const previousDuration = calculateDuration(
    previousRange,
    durationInfo,
    studentLevel,
    subjectType,
    false // 학습일
  );

  // 복습 보정 계수 적용
  const reviewFactor = 0.4; // 0.3~0.5 평균
  const reviewDuration = previousDuration.final_duration * reviewFactor;

  return {
    base_duration: previousDuration.base_duration,
    student_level_factor: previousDuration.student_level_factor,
    subject_factor: previousDuration.subject_factor,
    difficulty_factor: previousDuration.difficulty_factor,
    review_factor: reviewFactor,
    final_duration: Math.round(reviewDuration),
  };
}

/**
 * 교과 제약 조건 검증
 * 개정교육과정별 세부 과목 검증 지원
 */
export function validateSubjectConstraints(
  plans: Array<{ 
    subject_id?: string; 
    subject_name?: string;
    detail_subject?: string; // 세부 과목 (선택사항)
  }>,
  constraints: SubjectConstraints,
  studentCurriculumRevisionId?: string // 학생의 개정교육과정 ID (선택사항)
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 필수 교과 검증
  if (
    constraints.required_subjects &&
    constraints.required_subjects.length > 0
  ) {
    for (const req of constraints.required_subjects) {
      // 개정교육과정별 세부 과목이 있는 경우
      if (req.subjects_by_curriculum && req.subjects_by_curriculum.length > 0) {
        // 학생의 개정교육과정에 해당하는 세부 과목 찾기
        const curriculumSubject = studentCurriculumRevisionId
          ? req.subjects_by_curriculum.find(
              (s) => s.curriculum_revision_id === studentCurriculumRevisionId
            )
          : undefined;

        if (curriculumSubject && curriculumSubject.subject_id) {
          // 세부 과목까지 검증
          const matchingCount = plans.filter(
            (p) =>
              p.subject_id === curriculumSubject.subject_id ||
              (p.detail_subject === curriculumSubject.subject_name &&
                (p.subject_name || "").toLowerCase().includes(req.subject_category.toLowerCase()))
          ).length;

          if (matchingCount < req.min_count) {
            errors.push(
              `필수 교과 "${req.subject_category} - ${curriculumSubject.subject_name}"의 콘텐츠가 ${req.min_count}개 필요하지만 ${matchingCount}개만 선택되었습니다.`
            );
          }
        } else {
          // 학생의 개정교육과정에 해당하는 세부 과목이 없으면 교과만 검증
          const matchingCount = plans.filter(
            (p) =>
              (p.subject_name || "").toLowerCase().includes(req.subject_category.toLowerCase())
          ).length;

          if (matchingCount < req.min_count) {
            errors.push(
              `필수 교과 "${req.subject_category}"의 콘텐츠가 ${req.min_count}개 필요하지만 ${matchingCount}개만 선택되었습니다.`
            );
          }
        }
      } else {
        // 세부 과목 지정이 없으면 교과만 검증
        const matchingCount = plans.filter(
          (p) =>
            (p.subject_name || "").toLowerCase().includes(req.subject_category.toLowerCase())
        ).length;

        if (matchingCount < req.min_count) {
          errors.push(
            `필수 교과 "${req.subject_category}"의 콘텐츠가 ${req.min_count}개 필요하지만 ${matchingCount}개만 선택되었습니다.`
          );
        }
      }
    }
  }

  // 제외 교과 검증
  if (
    constraints.excluded_subjects &&
    constraints.excluded_subjects.length > 0
  ) {
    const planSubjects = new Set<string>();
    for (const plan of plans) {
      const subject = plan.subject_id || plan.subject_name;
      if (subject) {
        planSubjects.add(subject.toLowerCase().trim());
      }
    }

    const includedExcludedSubjects = constraints.excluded_subjects.filter(
      (subject) => planSubjects.has(subject.toLowerCase().trim())
    );

    if (includedExcludedSubjects.length > 0) {
      errors.push(
        `제외된 교과가 포함되었습니다: ${includedExcludedSubjects.join(", ")}`
      );
    }
  }

  // 제약 조건 처리 방법에 따른 결과 반환
  if (errors.length > 0) {
    if (constraints.constraint_handling === "strict") {
      return { valid: false, errors };
    } else if (constraints.constraint_handling === "warning") {
      // 경고만 표시하고 계속 진행
      return { valid: true, errors };
    } else {
      // auto_fix: 자동 보완 (향후 구현)
      return { valid: true, errors };
    }
  }

  return { valid: true, errors: [] };
}

/**
 * 타임라인 구성 (제외 시간으로 인한 분할 처리 포함)
 */
export type TimeSlot = {
  start: string; // HH:mm
  end: string; // HH:mm
  type: "study" | "self_study";
};

export type PlanTimeline = {
  plan_id: string;
  date: string;
  time_slots: TimeSlot[];
  total_duration: number; // 분
  split_info?: {
    original_plan_id: string;
    split_order: number;
    total_split_count: number;
  };
};

export function buildPlanTimeline(
  planDuration: number, // 분
  date: string,
  availableTimeRanges: Array<{ start: string; end: string }>,
  useSelfStudy: boolean = false,
  selfStudyRanges?: Array<{ start: string; end: string }>
): PlanTimeline {
  const timeSlots: TimeSlot[] = [];
  let remainingDuration = planDuration;

  // 학습 시간대에 먼저 배정
  for (const range of availableTimeRanges) {
    if (remainingDuration <= 0) break;

    const rangeDuration = timeToMinutes(range.end) - timeToMinutes(range.start);
    const assignedDuration = Math.min(remainingDuration, rangeDuration);

    timeSlots.push({
      start: range.start,
      end: minutesToTime(timeToMinutes(range.start) + assignedDuration),
      type: "study",
    });

    remainingDuration -= assignedDuration;
  }

  // 배정 가능한 시간이 부족한 경우 자율 학습 시간 사용
  if (remainingDuration > 0 && useSelfStudy && selfStudyRanges) {
    for (const range of selfStudyRanges) {
      if (remainingDuration <= 0) break;

      const rangeDuration =
        timeToMinutes(range.end) - timeToMinutes(range.start);
      const assignedDuration = Math.min(remainingDuration, rangeDuration);

      timeSlots.push({
        start: range.start,
        end: minutesToTime(timeToMinutes(range.start) + assignedDuration),
        type: "self_study",
      });

      remainingDuration -= assignedDuration;
    }
  }

  // 분할 정보 생성 (제외 시간으로 인해 분할된 경우)
  const splitInfo =
    timeSlots.length > 1
      ? {
          original_plan_id: `plan_${date}_${Date.now()}`,
          split_order: 1,
          total_split_count: timeSlots.length,
        }
      : undefined;

  return {
    plan_id: `plan_${date}_${Date.now()}`,
    date,
    time_slots: timeSlots,
    total_duration: planDuration - remainingDuration,
    split_info: splitInfo,
  };
}

// ============================================================
// 콘텐츠별 배정 함수 (타임존 시스템용)
// ============================================================

export type ContentSchedulerOptions = {
  study_days?: number; // 학습일 수 (기본: 6)
  review_days?: number; // 복습일 수 (기본: 1)
  subject_type?: "strategy" | "weakness";
  weekly_allocation_days?: number; // 전략과목: 주당 배정일 (2, 3, 4)
  target_type: "page" | "episode" | "unit" | "time";
  target_value: number; // 목표 페이지/회차/시간(분)
  daily_amount?: number; // 일일 목표량
  auto_review: boolean; // 복습일 자동 생성
  review_ratio?: number; // 복습 분량 비율 (기본: 0.3)
  distribution_strategy: "even" | "front_loaded" | "back_loaded" | "custom";
};

export type ContentReviewPlan = {
  content_id: string;
  plan_date: string;
  day_type: "review";
  range_start: number;
  range_end: number;
  estimated_duration: number;
  review_source_content_ids: string[];
  week_number: number;
};

/**
 * 콘텐츠별 학습일 배정 날짜 계산
 *
 * 타임존 시스템에서 개별 콘텐츠의 학습일 배정에 사용됩니다.
 * subject_type에 따라 다른 배정 전략을 적용합니다:
 * - weakness: 모든 학습일에 배정
 * - strategy: 주당 weekly_allocation_days일만 배정
 * - undefined: 모든 학습일에 배정 (기본값)
 */
export function calculateContentAllocationDates(
  cycleDays: CycleDayInfo[],
  options: ContentSchedulerOptions
): string[] {
  const studyDays = cycleDays.filter((d) => d.day_type === "study");

  // 취약과목 또는 타입 미지정: 전체 학습일 배정
  if (!options.subject_type || options.subject_type === "weakness") {
    return studyDays.map((d) => d.date);
  }

  // 전략과목: 주당 N일 배정
  const weeklyDays = options.weekly_allocation_days || 3;
  return calculateStrategyAllocationDates(studyDays, weeklyDays);
}

/**
 * 전략과목 배정 날짜 계산 (주당 N일)
 */
function calculateStrategyAllocationDates(
  studyDays: CycleDayInfo[],
  weeklyAllocationDays: number
): string[] {
  const allocatedDates: string[] = [];

  // 주차별로 그룹화
  const weeklyGroups = groupByWeek(studyDays);

  for (const [_, weekDates] of weeklyGroups.entries()) {
    const selectedCount = Math.min(weeklyAllocationDays, weekDates.length);
    if (selectedCount === 0) continue;

    // 균등하게 분배하기 위한 간격 계산
    const step = weekDates.length / selectedCount;

    for (let i = 0; i < selectedCount; i++) {
      // 중간값을 사용하여 더 균등하게 분배
      const index = Math.floor((i + 0.5) * step);
      allocatedDates.push(weekDates[index]);
    }
  }

  return allocatedDates;
}

/**
 * 주차별로 학습일 그룹화
 */
function groupByWeek(studyDays: CycleDayInfo[]): Map<number, string[]> {
  const weeks = new Map<number, string[]>();

  for (const day of studyDays) {
    if (!weeks.has(day.cycle_number)) {
      weeks.set(day.cycle_number, []);
    }
    weeks.get(day.cycle_number)!.push(day.date);
  }

  return weeks;
}

/**
 * 콘텐츠별 복습 플랜 생성
 *
 * 주차별로 해당 콘텐츠의 학습 범위를 그룹핑하여 복습 플랜을 생성합니다.
 */
export function generateContentReviewPlan(
  contentId: string,
  weekStudyPlans: Array<{
    date: string;
    range_start: number;
    range_end: number;
    estimated_duration: number;
  }>,
  reviewDate: string,
  weekNumber: number,
  options: ContentSchedulerOptions
): ContentReviewPlan | null {
  if (weekStudyPlans.length === 0) {
    return null;
  }

  // 해당 주차의 학습 범위 계산
  const rangeStart = Math.min(...weekStudyPlans.map((p) => p.range_start));
  const rangeEnd = Math.max(...weekStudyPlans.map((p) => p.range_end));
  const totalDuration = weekStudyPlans.reduce(
    (sum, p) => sum + p.estimated_duration,
    0
  );

  // 복습 분량 비율 적용 (기본 0.3)
  const reviewRatio = options.review_ratio || 0.3;
  const estimatedDuration = Math.round(totalDuration * reviewRatio);

  return {
    content_id: contentId,
    plan_date: reviewDate,
    day_type: "review",
    range_start: rangeStart,
    range_end: rangeEnd,
    estimated_duration: estimatedDuration,
    review_source_content_ids: [contentId],
    week_number: weekNumber,
  };
}

/**
 * 콘텐츠 범위를 배정된 날짜들에 분배
 *
 * distribution_strategy에 따라 다르게 분배합니다:
 * - even: 균등 분배
 * - front_loaded: 앞쪽에 더 많이 배정
 * - back_loaded: 뒤쪽에 더 많이 배정
 */
export function distributeContentRange(
  startRange: number,
  endRange: number,
  allocatedDates: string[],
  distributionStrategy: "even" | "front_loaded" | "back_loaded" | "custom" = "even"
): Map<string, { start: number; end: number }> {
  const result = new Map<string, { start: number; end: number }>();
  const totalRange = endRange - startRange;
  const dateCount = allocatedDates.length;

  if (dateCount === 0 || totalRange <= 0) {
    return result;
  }

  let weights: number[];

  switch (distributionStrategy) {
    case "front_loaded":
      // 앞쪽에 더 많이: 1.5, 1.3, 1.1, 0.9, 0.7...
      weights = allocatedDates.map((_, i) =>
        Math.max(0.5, 1.5 - (i * 0.4 / Math.max(1, dateCount - 1)))
      );
      break;
    case "back_loaded":
      // 뒤쪽에 더 많이: 0.7, 0.9, 1.1, 1.3, 1.5...
      weights = allocatedDates.map((_, i) =>
        Math.max(0.5, 0.5 + (i * 1.0 / Math.max(1, dateCount - 1)))
      );
      break;
    case "custom":
    case "even":
    default:
      // custom도 기본적으로 even 분배 사용 (별도 설정이 없는 경우)
      weights = allocatedDates.map(() => 1);
  }

  // 가중치 정규화
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = weights.map((w) => w / totalWeight);

  let currentStart = startRange;

  for (let i = 0; i < allocatedDates.length; i++) {
    const date = allocatedDates[i];
    const isLast = i === allocatedDates.length - 1;

    const dayRange = isLast
      ? endRange - currentStart
      : Math.round(totalRange * normalizedWeights[i]);

    const dayEnd = Math.min(currentStart + dayRange, endRange);

    result.set(date, {
      start: Math.round(currentStart),
      end: Math.round(dayEnd),
    });

    currentStart = dayEnd;
  }

  return result;
}

/**
 * 주차의 복습일 날짜 찾기
 */
export function getReviewDateForWeek(
  cycleDays: CycleDayInfo[],
  weekNumber: number
): string | null {
  const reviewDay = cycleDays.find(
    (d) => d.cycle_number === weekNumber && d.day_type === "review"
  );
  return reviewDay?.date || null;
}

/**
 * 주차별 학습일 목록 가져오기
 */
export function getStudyDaysForWeek(
  cycleDays: CycleDayInfo[],
  weekNumber: number
): CycleDayInfo[] {
  return cycleDays.filter(
    (d) => d.cycle_number === weekNumber && d.day_type === "study"
  );
}

/**
 * 전체 주차 수 계산
 */
export function getTotalWeeks(cycleDays: CycleDayInfo[]): number {
  const cycleNumbers = new Set(cycleDays.map((d) => d.cycle_number));
  return cycleNumbers.size;
}

/**
 * 유틸리티 함수
 */

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============================================
// Phase 2: Planner 기반 스케줄러 지원 함수
// ============================================

/**
 * 콘텐츠 정보 (스케줄러 입력용)
 */
export type ContentInfoForScheduler = {
  content_id: string;
  content_type: "book" | "lecture" | "custom";
  subject?: string | null;
  subject_category?: string | null;
  subject_id?: string;
};

/**
 * SchedulerOptions 타입 (scheduler_options JSON에서 추출)
 */
export type SchedulerOptionsForAllocation = {
  content_allocations?: ContentAllocation[];
  subject_allocations?: UtilSubjectAllocation[];
};

/**
 * 콘텐츠별 배정 날짜 계산 (SchedulerOptions 기반)
 *
 * Phase 2: Planner 단위 스케줄링을 위해 추가
 * - contentInfo와 schedulerOptions를 받아 내부에서 allocation 조회
 * - 기존 calculateContentAllocationDates와 호환 가능
 *
 * @param cycleDays - 주기 일자 정보 배열
 * @param contentInfo - 콘텐츠 정보 (content_id, subject_category 등)
 * @param schedulerOptions - 스케줄러 옵션 (content_allocations, subject_allocations 포함)
 * @returns 배정된 날짜 문자열 배열
 */
export function calculateContentAllocationDatesWithOptions(
  cycleDays: CycleDayInfo[],
  contentInfo: ContentInfoForScheduler,
  schedulerOptions: SchedulerOptionsForAllocation
): string[] {
  const { content_allocations, subject_allocations } = schedulerOptions;

  // getEffectiveAllocation으로 allocation 정보 조회
  const allocation = getEffectiveAllocation(
    {
      content_id: contentInfo.content_id,
      content_type: contentInfo.content_type,
      subject: contentInfo.subject,
      subject_category: contentInfo.subject_category,
      subject_id: contentInfo.subject_id,
    },
    content_allocations,
    subject_allocations,
    undefined, // contentSlots는 사용하지 않음
    false // 로깅 비활성화
  );

  // 학습일만 필터링
  const studyDays = cycleDays.filter((d) => d.day_type === "study");

  // 취약과목: 모든 학습일
  if (allocation.subject_type === "weakness") {
    return studyDays.map((d) => d.date);
  }

  // 전략과목: 주당 weekly_days일만 배정
  const weeklyDays = allocation.weekly_days ?? 3; // 기본값 3일

  // 주차별로 그룹화하여 배정
  const weekGroups = groupByWeek(studyDays);
  const allocatedDates: string[] = [];

  for (const [, days] of weekGroups) {
    // 각 주에서 weeklyDays만큼 선택 (균등 분포)
    const selectedDays = selectDatesEvenly(days, weeklyDays);
    allocatedDates.push(...selectedDays);
  }

  return allocatedDates;
}

/**
 * 날짜 문자열을 균등하게 선택
 */
function selectDatesEvenly(dates: string[], count: number): string[] {
  if (dates.length <= count) {
    return dates;
  }

  const result: string[] = [];
  const step = dates.length / count;

  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * step);
    result.push(dates[index]);
  }

  return result;
}

/**
 * 학습 플랜 정보 (복습 시간 계산용)
 */
export type StudyPlanForReview = {
  content_id: string;
  plan_date: string;
  duration_minutes: number;
};

/**
 * 여러 콘텐츠의 복습 시간 조율 계산
 *
 * Phase 2: Planner 단위 스케줄링을 위해 추가
 * - 모든 콘텐츠의 복습을 한 날짜에 함께 고려
 * - 블록 시간 내에 맞추기 위해 조율
 *
 * @param contentStudyPlans - 콘텐츠별 학습 플랜 맵 (content_id -> 플랜 배열)
 * @param reviewDate - 복습 날짜
 * @param blockDurationMinutes - 해당 날짜 블록 총 시간 (분)
 * @param reviewCoefficient - 복습 계수 (기본: 0.4)
 * @returns 콘텐츠별 조율된 복습 시간 맵 (content_id -> 분)
 */
export function calculateReviewDurations(
  contentStudyPlans: Map<string, StudyPlanForReview[]>,
  reviewDate: string,
  blockDurationMinutes: number,
  reviewCoefficient: number = 0.4
): Map<string, number> {
  // 1. 각 콘텐츠의 기본 복습 시간 계산
  const baseDurations = new Map<string, number>();

  for (const [contentId, plans] of contentStudyPlans) {
    // 해당 복습일 이전의 학습 플랜만 고려
    const relevantPlans = plans.filter((p) => p.plan_date < reviewDate);
    const totalStudyTime = relevantPlans.reduce(
      (sum, p) => sum + p.duration_minutes,
      0
    );
    const reviewTime = Math.round(totalStudyTime * reviewCoefficient);
    baseDurations.set(contentId, reviewTime);
  }

  // 2. 총 복습 시간 계산
  let totalReviewTime = 0;
  for (const duration of baseDurations.values()) {
    totalReviewTime += duration;
  }

  // 3. 블록 시간 초과 시 비율 조정
  if (totalReviewTime > blockDurationMinutes && totalReviewTime > 0) {
    const ratio = blockDurationMinutes / totalReviewTime;
    const adjustedDurations = new Map<string, number>();

    for (const [contentId, duration] of baseDurations) {
      adjustedDurations.set(contentId, Math.floor(duration * ratio));
    }

    return adjustedDurations;
  }

  return baseDurations;
}

/**
 * 복습의 복습 (추가 기간) 시간 계산
 *
 * Phase 2: 추가 기간 복습 시간 조율
 *
 * @param contentStudyPlans - 콘텐츠별 학습 플랜 맵
 * @param additionalReviewDate - 추가 복습 날짜
 * @param blockDurationMinutes - 블록 총 시간 (분)
 * @param additionalReviewCoefficient - 복습의 복습 계수 (기본: 0.25)
 * @returns 콘텐츠별 추가 복습 시간 맵
 */
export function calculateAdditionalReviewDurations(
  contentStudyPlans: Map<string, StudyPlanForReview[]>,
  additionalReviewDate: string,
  blockDurationMinutes: number,
  additionalReviewCoefficient: number = 0.25
): Map<string, number> {
  // 복습의 복습은 더 낮은 계수 사용
  return calculateReviewDurations(
    contentStudyPlans,
    additionalReviewDate,
    blockDurationMinutes,
    additionalReviewCoefficient
  );
}

/**
 * 블록 시간 내 콘텐츠 배치 순서 결정
 *
 * Phase 2: 여러 콘텐츠를 블록 내에 순차 배치
 * - 취약과목 우선 배치 (더 많은 학습 필요)
 * - 동일 유형 내에서는 duration 기준 정렬
 *
 * @param contentDurations - 콘텐츠별 소요시간 배열
 * @returns 정렬된 콘텐츠 ID 배열
 */
export function sortContentsForBlockPlacement(
  contentDurations: Array<{
    content_id: string;
    duration_minutes: number;
    subject_type: "strategy" | "weakness";
  }>
): string[] {
  // 취약과목 우선, 그 다음 시간 긴 순서
  const sorted = [...contentDurations].sort((a, b) => {
    // 1. 취약과목 우선
    if (a.subject_type !== b.subject_type) {
      return a.subject_type === "weakness" ? -1 : 1;
    }
    // 2. 시간 긴 순서
    return b.duration_minutes - a.duration_minutes;
  });

  return sorted.map((c) => c.content_id);
}
