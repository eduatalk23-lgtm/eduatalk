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
 * 콘텐츠의 전략/취약 설정을 가져옴 (폴백 메커니즘)
 * 
 * 우선순위:
 * 1. content_allocations (콘텐츠별 설정)
 * 2. subject_allocations (교과별 설정)
 * 3. 기본값 (취약과목)
 * 
 * @param content - 콘텐츠 정보 (content_type, content_id, subject_category 포함)
 * @param contentAllocations - 콘텐츠별 설정 (선택사항)
 * @param subjectAllocations - 교과별 설정 (선택사항)
 * @returns 전략/취약 설정 및 주당 배정 일수
 */
export function getContentAllocation(
  content: { content_type: string; content_id: string; subject_category?: string },
  contentAllocations?: Array<{
    content_type: string;
    content_id: string;
    subject_type: "strategy" | "weakness";
    weekly_days?: number;
  }>,
  subjectAllocations?: Array<{
    subject_name: string;
    subject_type: "strategy" | "weakness";
    weekly_days?: number;
  }>
): { subject_type: "strategy" | "weakness"; weekly_days?: number } {
  
  // 1순위: 콘텐츠별 설정
  if (contentAllocations) {
    const contentAlloc = contentAllocations.find(
      a => a.content_type === content.content_type && a.content_id === content.content_id
    );
    if (contentAlloc) {
      return {
        subject_type: contentAlloc.subject_type,
        weekly_days: contentAlloc.weekly_days
      };
    }
  }
  
  // 2순위: 교과별 설정 (폴백)
  if (subjectAllocations && content.subject_category) {
    const subjectAlloc = subjectAllocations.find(
      a => a.subject_name === content.subject_category
    );
    if (subjectAlloc) {
      return {
        subject_type: subjectAlloc.subject_type,
        weekly_days: subjectAlloc.weekly_days
      };
    }
  }
  
  // 3순위: 기본값 (취약과목)
  return { subject_type: "weakness" };
}

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

    // 각 주차에서 주당 배정 일수만큼 선택
    for (const [_, weekDates] of weeks.entries()) {
      const step = Math.ceil(weekDates.length / weeklyDays);
      for (let i = 0; i < weekDates.length; i += step) {
        if (allocatedDates.length < studyDates.length) {
          allocatedDates.push(weekDates[i]);
        }
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
    const dayRange = isLast
      ? totalRange - currentStart
      : Math.round(dailyRange);
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

/**
 * 유틸리티 함수
 */

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
