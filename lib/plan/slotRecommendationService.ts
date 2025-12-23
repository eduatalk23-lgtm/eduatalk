/**
 * AI 기반 슬롯 추천 서비스
 *
 * 학생 프로필(학년, 플랜 목적 등)을 기반으로
 * 최적의 슬롯 구성을 추천합니다.
 */

import type { ContentSlot, SlotType } from "@/lib/types/content-selection";

// ============================================================================
// Types
// ============================================================================

export type GradeLevel =
  | "middle_1"
  | "middle_2"
  | "middle_3"
  | "high_1"
  | "high_2"
  | "high_3"
  | "n_su" // N수생
  | "other";

export type PlanPurpose =
  | "수능대비"
  | "내신대비"
  | "기초학습"
  | "심화학습"
  | "복습"
  | "방학특강"
  | "기타";

export type StudyIntensity = "light" | "normal" | "intensive";

/**
 * 슬롯 추천을 위한 학생 프로필
 */
export type StudentProfile = {
  gradeLevel: GradeLevel;
  planPurpose: PlanPurpose;
  studyIntensity?: StudyIntensity;
  preferredSubjects?: string[]; // 선호 교과
  weakSubjects?: string[]; // 약한 교과
  dailyStudyHours?: number; // 일일 학습 시간 (시간)
  weeklyStudyDays?: number; // 주간 학습 일수
};

/**
 * 교과별 추천 비율
 */
export type SubjectDistribution = {
  subject_category: string;
  percentage: number; // 0-100
  slot_count: number;
  slot_types: SlotType[];
};

/**
 * 슬롯 추천 결과
 */
export type SlotRecommendationResult = {
  slots: ContentSlot[];
  distribution: SubjectDistribution[];
  explanation: string;
  confidence: number; // 0-1
  alternatives?: SlotRecommendationResult[];
};

/**
 * 추천 옵션
 */
export type RecommendationOptions = {
  maxSlots?: number; // 최대 슬롯 수 (기본: 9)
  includeReview?: boolean; // 복습 슬롯 포함 여부
  includeTest?: boolean; // 테스트 슬롯 포함 여부
  balanceSubjects?: boolean; // 교과 균형 맞추기
};

// ============================================================================
// Constants - 교과별 기본 설정
// ============================================================================

const SUBJECT_CATEGORIES = {
  core: ["국어", "수학", "영어"], // 주요 3과목
  science: ["물리", "화학", "생명과학", "지구과학"],
  social: ["한국사", "사회문화", "생활과윤리", "정치와법", "경제", "세계지리", "한국지리", "동아시아사", "세계사"],
  secondary: ["제2외국어", "한문"],
};

/**
 * 학년별 기본 교과 분배
 */
const GRADE_SUBJECT_DISTRIBUTION: Record<
  GradeLevel,
  { subject: string; weight: number }[]
> = {
  middle_1: [
    { subject: "국어", weight: 30 },
    { subject: "수학", weight: 35 },
    { subject: "영어", weight: 25 },
    { subject: "기타", weight: 10 },
  ],
  middle_2: [
    { subject: "국어", weight: 25 },
    { subject: "수학", weight: 35 },
    { subject: "영어", weight: 30 },
    { subject: "기타", weight: 10 },
  ],
  middle_3: [
    { subject: "국어", weight: 25 },
    { subject: "수학", weight: 35 },
    { subject: "영어", weight: 30 },
    { subject: "기타", weight: 10 },
  ],
  high_1: [
    { subject: "국어", weight: 25 },
    { subject: "수학", weight: 35 },
    { subject: "영어", weight: 25 },
    { subject: "탐구", weight: 15 },
  ],
  high_2: [
    { subject: "국어", weight: 25 },
    { subject: "수학", weight: 30 },
    { subject: "영어", weight: 25 },
    { subject: "탐구", weight: 20 },
  ],
  high_3: [
    { subject: "국어", weight: 25 },
    { subject: "수학", weight: 30 },
    { subject: "영어", weight: 20 },
    { subject: "탐구", weight: 25 },
  ],
  n_su: [
    { subject: "국어", weight: 25 },
    { subject: "수학", weight: 35 },
    { subject: "영어", weight: 15 },
    { subject: "탐구", weight: 25 },
  ],
  other: [
    { subject: "국어", weight: 25 },
    { subject: "수학", weight: 30 },
    { subject: "영어", weight: 25 },
    { subject: "기타", weight: 20 },
  ],
};

/**
 * 플랜 목적별 슬롯 타입 선호도
 */
const PURPOSE_SLOT_TYPE_PREFERENCE: Record<
  PlanPurpose,
  { book: number; lecture: number; self_study: number; test: number }
> = {
  수능대비: { book: 50, lecture: 30, self_study: 15, test: 5 },
  내신대비: { book: 40, lecture: 20, self_study: 30, test: 10 },
  기초학습: { book: 30, lecture: 50, self_study: 15, test: 5 },
  심화학습: { book: 60, lecture: 20, self_study: 15, test: 5 },
  복습: { book: 30, lecture: 10, self_study: 50, test: 10 },
  방학특강: { book: 40, lecture: 40, self_study: 15, test: 5 },
  기타: { book: 40, lecture: 30, self_study: 20, test: 10 },
};

/**
 * 학습 강도별 슬롯 수
 */
const INTENSITY_SLOT_COUNT: Record<StudyIntensity, number> = {
  light: 4,
  normal: 6,
  intensive: 9,
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * 학생 프로필 기반 슬롯 추천
 */
export function recommendSlots(
  profile: StudentProfile,
  options: RecommendationOptions = {}
): SlotRecommendationResult {
  const {
    maxSlots = 9,
    includeReview = true,
    includeTest = false,
    balanceSubjects = true,
  } = options;

  // 1. 슬롯 수 결정
  const targetSlotCount = Math.min(
    INTENSITY_SLOT_COUNT[profile.studyIntensity || "normal"],
    maxSlots
  );

  // 2. 교과 분배 계산
  const distribution = calculateSubjectDistribution(
    profile,
    targetSlotCount,
    balanceSubjects
  );

  // 3. 슬롯 생성
  const slots = generateSlotsFromDistribution(
    distribution,
    profile,
    { includeReview, includeTest }
  );

  // 4. 결과 생성
  const explanation = generateExplanation(profile, distribution);
  const confidence = calculateConfidence(profile, distribution);

  return {
    slots,
    distribution,
    explanation,
    confidence,
  };
}

/**
 * 교과 분배 계산
 */
function calculateSubjectDistribution(
  profile: StudentProfile,
  slotCount: number,
  balanceSubjects: boolean
): SubjectDistribution[] {
  // 기본 분배 가져오기
  const baseDistribution = GRADE_SUBJECT_DISTRIBUTION[profile.gradeLevel];
  const slotTypePreference = PURPOSE_SLOT_TYPE_PREFERENCE[profile.planPurpose];

  // 선호/약점 교과 반영
  const adjustedWeights = adjustWeightsForPreferences(
    baseDistribution,
    profile.preferredSubjects,
    profile.weakSubjects
  );

  // 슬롯 수 분배
  const distribution: SubjectDistribution[] = [];
  let remainingSlots = slotCount;

  for (const { subject, weight } of adjustedWeights) {
    if (remainingSlots <= 0) break;

    const calculatedSlots = Math.round((weight / 100) * slotCount);
    const actualSlots = Math.min(calculatedSlots, remainingSlots);

    if (actualSlots > 0) {
      distribution.push({
        subject_category: subject,
        percentage: weight,
        slot_count: actualSlots,
        slot_types: determineSlotTypes(actualSlots, slotTypePreference),
      });
      remainingSlots -= actualSlots;
    }
  }

  // 남은 슬롯이 있으면 첫 번째 교과에 추가
  if (remainingSlots > 0 && distribution.length > 0) {
    distribution[0].slot_count += remainingSlots;
  }

  // 균형 조정
  if (balanceSubjects) {
    return balanceDistribution(distribution, slotCount);
  }

  return recalculatePercentages(distribution);
}

/**
 * 선호/약점 교과 반영
 */
function adjustWeightsForPreferences(
  baseWeights: { subject: string; weight: number }[],
  preferred?: string[],
  weak?: string[]
): { subject: string; weight: number }[] {
  const adjusted = baseWeights.map(({ subject, weight }) => {
    let adjustedWeight = weight;

    // 선호 교과는 가중치 증가
    if (preferred?.includes(subject)) {
      adjustedWeight *= 1.2;
    }

    // 약한 교과는 가중치 증가 (보강 필요)
    if (weak?.includes(subject)) {
      adjustedWeight *= 1.3;
    }

    return { subject, weight: adjustedWeight };
  });

  // 정규화 (합계 100%)
  const total = adjusted.reduce((sum, item) => sum + item.weight, 0);
  return adjusted.map(({ subject, weight }) => ({
    subject,
    weight: Math.round((weight / total) * 100),
  }));
}

/**
 * 슬롯 타입 결정
 */
function determineSlotTypes(
  slotCount: number,
  preference: { book: number; lecture: number; self_study: number; test: number }
): SlotType[] {
  const types: SlotType[] = [];
  const total = preference.book + preference.lecture + preference.self_study + preference.test;

  // 비율에 따라 슬롯 타입 결정
  const bookSlots = Math.round((preference.book / total) * slotCount);
  const lectureSlots = Math.round((preference.lecture / total) * slotCount);

  for (let i = 0; i < bookSlots && types.length < slotCount; i++) {
    types.push("book");
  }
  for (let i = 0; i < lectureSlots && types.length < slotCount; i++) {
    types.push("lecture");
  }

  // 나머지는 book으로 채움
  while (types.length < slotCount) {
    types.push("book");
  }

  return types;
}

/**
 * 분배 균형 조정
 */
function balanceDistribution(
  distribution: SubjectDistribution[],
  targetSlotCount: number
): SubjectDistribution[] {
  const currentTotal = distribution.reduce((sum, d) => sum + d.slot_count, 0);

  if (currentTotal === targetSlotCount) {
    return recalculatePercentages(distribution);
  }

  // 슬롯 수 조정
  const diff = targetSlotCount - currentTotal;
  if (diff > 0) {
    // 부족하면 주요 과목에 추가
    distribution[0].slot_count += diff;
  } else {
    // 초과하면 마지막 교과에서 제거
    let toRemove = Math.abs(diff);
    for (let i = distribution.length - 1; i >= 0 && toRemove > 0; i--) {
      const remove = Math.min(distribution[i].slot_count - 1, toRemove);
      if (remove > 0) {
        distribution[i].slot_count -= remove;
        toRemove -= remove;
      }
    }
  }

  const filtered = distribution.filter((d) => d.slot_count > 0);
  return recalculatePercentages(filtered);
}

/**
 * 실제 슬롯 수 기반으로 백분율 재계산
 */
function recalculatePercentages(
  distribution: SubjectDistribution[]
): SubjectDistribution[] {
  const totalSlots = distribution.reduce((sum, d) => sum + d.slot_count, 0);
  if (totalSlots === 0) return distribution;

  return distribution.map((d) => ({
    ...d,
    percentage: Math.round((d.slot_count / totalSlots) * 100),
  }));
}

/**
 * 분배에서 슬롯 생성
 */
function generateSlotsFromDistribution(
  distribution: SubjectDistribution[],
  profile: StudentProfile,
  options: { includeReview: boolean; includeTest: boolean }
): ContentSlot[] {
  const slots: ContentSlot[] = [];
  let slotIndex = 0;

  for (const dist of distribution) {
    for (let i = 0; i < dist.slot_count; i++) {
      const slotType = dist.slot_types[i] || "book";

      slots.push({
        slot_index: slotIndex,
        slot_type: slotType,
        subject_category: dist.subject_category,
        subject_id: null,
        is_required: i === 0, // 첫 번째 슬롯은 필수
        is_auto_recommended: true,
        recommendation_source: "auto",
      });

      slotIndex++;
    }
  }

  // 복습 슬롯 추가
  if (options.includeReview && slots.length < 9) {
    const mainSubject = distribution[0]?.subject_category || "수학";
    slots.push({
      slot_index: slotIndex,
      slot_type: "self_study",
      subject_category: mainSubject,
      subject_id: null,
      self_study_purpose: "review",
      is_required: false,
      is_auto_recommended: true,
      recommendation_source: "auto",
    });
    slotIndex++;
  }

  // 테스트 슬롯 추가
  if (options.includeTest && slots.length < 9) {
    slots.push({
      slot_index: slotIndex,
      slot_type: "test",
      subject_category: "전체",
      subject_id: null,
      is_required: false,
      is_auto_recommended: true,
      recommendation_source: "auto",
    });
  }

  return slots;
}

/**
 * 추천 설명 생성
 */
function generateExplanation(
  profile: StudentProfile,
  distribution: SubjectDistribution[]
): string {
  const gradeText = getGradeLevelText(profile.gradeLevel);
  const purposeText = profile.planPurpose;

  const subjectSummary = distribution
    .map((d) => `${d.subject_category} ${d.slot_count}개`)
    .join(", ");

  return `${gradeText} ${purposeText} 학습에 최적화된 구성입니다. (${subjectSummary})`;
}

/**
 * 학년 텍스트 변환
 */
function getGradeLevelText(grade: GradeLevel): string {
  const texts: Record<GradeLevel, string> = {
    middle_1: "중1",
    middle_2: "중2",
    middle_3: "중3",
    high_1: "고1",
    high_2: "고2",
    high_3: "고3",
    n_su: "N수생",
    other: "",
  };
  return texts[grade];
}

/**
 * 추천 신뢰도 계산
 */
function calculateConfidence(
  profile: StudentProfile,
  distribution: SubjectDistribution[]
): number {
  let confidence = 0.7; // 기본 신뢰도

  // 프로필 정보가 많을수록 신뢰도 증가
  if (profile.preferredSubjects?.length) confidence += 0.1;
  if (profile.weakSubjects?.length) confidence += 0.1;
  if (profile.dailyStudyHours) confidence += 0.05;
  if (profile.studyIntensity) confidence += 0.05;

  // 분배가 균형적이면 신뢰도 증가
  const slotCounts = distribution.map((d) => d.slot_count);
  const maxCount = Math.max(...slotCounts);
  const minCount = Math.min(...slotCounts);
  if (maxCount - minCount <= 2) confidence += 0.05;

  return Math.min(confidence, 1.0);
}

// ============================================================================
// Preset Templates
// ============================================================================

/**
 * 사전 정의된 추천 템플릿
 */
export const RECOMMENDATION_PRESETS: Record<
  string,
  { name: string; profile: Partial<StudentProfile>; options: RecommendationOptions }
> = {
  suneung_basic: {
    name: "수능 기본 (고3)",
    profile: {
      gradeLevel: "high_3",
      planPurpose: "수능대비",
      studyIntensity: "normal",
    },
    options: {
      maxSlots: 6,
      includeReview: true,
      includeTest: false,
    },
  },
  suneung_intensive: {
    name: "수능 집중 (고3)",
    profile: {
      gradeLevel: "high_3",
      planPurpose: "수능대비",
      studyIntensity: "intensive",
    },
    options: {
      maxSlots: 9,
      includeReview: true,
      includeTest: true,
    },
  },
  naesin_high1: {
    name: "내신 대비 (고1)",
    profile: {
      gradeLevel: "high_1",
      planPurpose: "내신대비",
      studyIntensity: "normal",
    },
    options: {
      maxSlots: 5,
      includeReview: true,
      includeTest: true,
    },
  },
  naesin_high2: {
    name: "내신 대비 (고2)",
    profile: {
      gradeLevel: "high_2",
      planPurpose: "내신대비",
      studyIntensity: "normal",
    },
    options: {
      maxSlots: 6,
      includeReview: true,
      includeTest: true,
    },
  },
  vacation_intensive: {
    name: "방학 집중반",
    profile: {
      gradeLevel: "high_2",
      planPurpose: "방학특강",
      studyIntensity: "intensive",
    },
    options: {
      maxSlots: 8,
      includeReview: true,
      includeTest: false,
    },
  },
  basic_learning: {
    name: "기초 학습",
    profile: {
      planPurpose: "기초학습",
      studyIntensity: "light",
    },
    options: {
      maxSlots: 4,
      includeReview: false,
      includeTest: false,
    },
  },
};

/**
 * 프리셋으로 슬롯 추천
 */
export function recommendSlotsFromPreset(
  presetKey: string,
  overrides?: Partial<StudentProfile>
): SlotRecommendationResult | null {
  const preset = RECOMMENDATION_PRESETS[presetKey];
  if (!preset) return null;

  const profile: StudentProfile = {
    gradeLevel: "high_1",
    planPurpose: "기타",
    ...preset.profile,
    ...overrides,
  };

  return recommendSlots(profile, preset.options);
}

/**
 * 사용 가능한 프리셋 목록
 */
export function getAvailablePresets(): { key: string; name: string }[] {
  return Object.entries(RECOMMENDATION_PRESETS).map(([key, preset]) => ({
    key,
    name: preset.name,
  }));
}
