/**
 * 세특 8단계 Flow Completion 산출 모듈
 *
 * NEIS 기록에서 파이프라인이 이미 생산한 `content_quality` 데이터
 * (5축 점수 + issues + feedback)를 토대로 8단계 충족 여부를 휴리스틱으로 추론.
 * LLM 추가 호출 없음.
 *
 * 참조: evaluation-criteria/defaults.ts
 *  - SETEK_FLOW_STAGES      — 8단계 정의
 *  - FLOW_COMPLETION_TIERS  — 충족도(%) → 전형 적합성 판단
 *  - getCareerMinStages()   — 대학 수준별 진로교과 필수 단계
 *  - FAIL_PATTERNS          — issues 배열의 code 문자열 규격
 */

import {
  SETEK_FLOW_STAGES,
  FLOW_COMPLETION_TIERS,
  getCareerMinStages,
  type UniversityTier,
} from "./defaults";

// ============================================================
// 공개 타입
// ============================================================

/** 단계별 충족 판정 결과 */
export interface FlowStageResult {
  /** 단계 번호 (1~8) */
  stage: number;
  /** 간결 라벨 (예: "지적호기심/의문") */
  label: string;
  /** 충족 여부 */
  fulfilled: boolean;
  /** 판정 신뢰도 */
  confidence: "high" | "medium" | "low";
  /** 미충족 시 근거 (충족이면 undefined) */
  reason?: string;
}

/** computeFlowCompletion 반환 타입 */
export interface FlowCompletionResult {
  /** 전체 충족도 (0~100, 소수점 첫째 자리 반올림) */
  completionPercent: number;
  /** FLOW_COMPLETION_TIERS 매핑 */
  tier: (typeof FLOW_COMPLETION_TIERS)[number];
  /** 단계별 상세 */
  stages: FlowStageResult[];
  /** 진로교과 여부 */
  isCareerSubject: boolean;
  /** 대학 수준 기준 */
  universityTier: UniversityTier;
}

/** computeFlowCompletion 의 첫 번째 인수 — content_quality 행 구조 */
export interface QualitySnapshot {
  specificity: number;
  coherence: number;
  depth: number;
  grammar: number;
  /** scientific_validity: 구버전 행이면 null */
  scientific_validity: number | null;
  overall_score: number;
  /** FAIL_PATTERNS.code 문자열 목록 (예: ["P1_나열식", "F6_자명한결론"]) */
  issues: string[] | null;
  /** LLM 피드백 원문 — 특정 키워드 유무로 단계 추론에 활용 */
  feedback: string | null;
}

// ============================================================
// 내부 상수
// ============================================================

/**
 * 8단계 → 추론 규칙 정의
 *
 * fulfilled = true 조건:
 *   - thresholds: 해당 축이 minScore 이상이어야 함 (AND 조건)
 *   - forbiddenIssues: issues 배열에 하나도 없어야 함
 *   - feedbackKeywords: feedback 원문에 하나라도 있으면 신뢰도 boost
 *   - isBonus: 가산 요소 (없어도 감점 아님)
 *   - requiredFor: 해당 단계가 필수인 경우 (진로교과 기준 계산에 사용)
 */
interface StageRule {
  thresholds: Partial<Record<"specificity" | "coherence" | "depth" | "scientific_validity", number>>;
  forbiddenIssues: string[];
  feedbackKeywords?: string[];
  isBonus: boolean;
}

const STAGE_RULES: Record<number, StageRule> = {
  /** ① 지적호기심/의문: specificity ≥ 3, P1_나열식 없음 */
  1: {
    thresholds: { specificity: 3 },
    forbiddenIssues: ["P1_나열식", "F12_자기주도성부재"],
    feedbackKeywords: ["호기심", "의문", "궁금"],
    isBonus: false,
  },
  /** ② 주제선정(진로연결): coherence ≥ 3, P4_내신탐구불일치 없음 */
  2: {
    thresholds: { coherence: 3 },
    forbiddenIssues: ["P4_내신탐구불일치", "F1_별개활동포장"],
    feedbackKeywords: ["주제", "진로", "연결"],
    isBonus: false,
  },
  /** ③ 탐구내용/이론: depth ≥ 3, P3_키워드만 없음 */
  3: {
    thresholds: { depth: 3 },
    forbiddenIssues: ["P3_키워드만", "F4_전제불일치"],
    feedbackKeywords: ["탐구", "이론", "논리"],
    isBonus: false,
  },
  /** ④ 참고문헌/독서: depth ≥ 4 또는 feedback에 "문헌"/"출처"/"도서" 언급, F3_출처불일치 없음 */
  4: {
    thresholds: { depth: 4 },
    forbiddenIssues: ["F3_출처불일치"],
    feedbackKeywords: ["문헌", "출처", "도서", "참고", "자료"],
    isBonus: false,
  },
  /** ⑤ 결론(해결/제언/고안): coherence ≥ 3 + depth ≥ 3, F2_인과단절/F6_자명한결론 없음 — 가산 요소 */
  5: {
    thresholds: { coherence: 3, depth: 3 },
    forbiddenIssues: ["F2_인과단절", "F6_자명한결론"],
    feedbackKeywords: ["결론", "제언", "고안", "해결"],
    isBonus: true,
  },
  /** ⑥ 교사관찰(구체적 근거): specificity ≥ 3, M1_교사관찰불가 없음 */
  6: {
    thresholds: { specificity: 3 },
    forbiddenIssues: ["M1_교사관찰불가"],
    feedbackKeywords: ["관찰", "구체", "근거"],
    isBonus: false,
  },
  /** ⑦ 성장서사: coherence ≥ 4, F10_성장부재 없음 */
  7: {
    thresholds: { coherence: 4 },
    forbiddenIssues: ["F10_성장부재"],
    feedbackKeywords: ["성장", "발전", "잠재"],
    isBonus: false,
  },
  /** ⑧ 오류→재탐구: depth ≥ 4 + scientific_validity ≥ 4 (null이면 depth만) — 순수 가산 요소 */
  8: {
    thresholds: { depth: 4, scientific_validity: 4 },
    forbiddenIssues: [],
    feedbackKeywords: ["오류", "재탐구", "한계", "보완"],
    isBonus: true,
  },
};

// ============================================================
// 내부 유틸
// ============================================================

/** issues 배열 정규화 (null → []) */
function normalizeIssues(issues: string[] | null): string[] {
  return issues ?? [];
}

/** feedback 소문자 정규화 (null → "") */
function normalizeFeedback(feedback: string | null): string {
  return (feedback ?? "").toLowerCase();
}

/**
 * 단일 단계 충족 여부 판정
 *
 * 판정 로직:
 * 1. threshold 축 모두 충족 → base fulfilled
 * 2. forbiddenIssues 중 하나라도 있으면 → NOT fulfilled
 * 3. 단계 ④는 threshold(depth ≥ 4) 미충족이어도
 *    feedbackKeywords 중 하나라도 feedback에 있으면 fulfilled (low confidence)
 * 4. scientific_validity가 null인 구버전 → 단계 ⑧ threshold에서 scientific_validity 제외
 */
function judgeStage(
  stageNum: number,
  q: QualitySnapshot,
  issues: string[],
  feedbackLower: string,
): FlowStageResult {
  const rule = STAGE_RULES[stageNum];
  const stageInfo = SETEK_FLOW_STAGES.find((s) => s.order === stageNum)!;

  // 1. threshold 검사
  const svIsNull = q.scientific_validity === null;
  let thresholdMet = true;
  const failedThresholds: string[] = [];

  for (const [axis, minVal] of Object.entries(rule.thresholds)) {
    // scientific_validity null이면 threshold 스킵 (구버전 호환)
    if (axis === "scientific_validity" && svIsNull) continue;

    const actual =
      axis === "scientific_validity"
        ? (q.scientific_validity ?? 0)
        : q[axis as keyof Pick<QualitySnapshot, "specificity" | "coherence" | "depth" | "grammar">];

    if (actual < minVal) {
      thresholdMet = false;
      failedThresholds.push(`${axis}<${minVal}(실제:${actual})`);
    }
  }

  // 2. forbiddenIssues 검사
  const hitIssues = rule.forbiddenIssues.filter((code) => issues.includes(code));
  const issueMet = hitIssues.length === 0;

  // 3. feedbackKeywords 검사 (보조 신호)
  const hasFeedbackSignal =
    rule.feedbackKeywords !== undefined &&
    rule.feedbackKeywords.some((kw) => feedbackLower.includes(kw));

  // 4. 단계 ④ 예외: threshold 미충족이어도 feedback 키워드 있으면 low-confidence fulfilled
  const isStage4FeedbackFallback =
    stageNum === 4 && !thresholdMet && issueMet && hasFeedbackSignal;

  const fulfilled = isStage4FeedbackFallback || (thresholdMet && issueMet);

  // 신뢰도 결정
  let confidence: "high" | "medium" | "low";
  if (isStage4FeedbackFallback) {
    confidence = "low";
  } else if (!thresholdMet || !issueMet) {
    // 미충족
    confidence = "high";
  } else if (hasFeedbackSignal) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  // 미충족 근거 텍스트
  let reason: string | undefined;
  if (!fulfilled) {
    const parts: string[] = [];
    if (failedThresholds.length > 0) parts.push(`점수부족: ${failedThresholds.join(", ")}`);
    if (hitIssues.length > 0) parts.push(`감지패턴: ${hitIssues.join(", ")}`);
    reason = parts.join(" / ");
  }

  return {
    stage: stageNum,
    label: stageInfo.label,
    fulfilled,
    confidence,
    reason,
  };
}

/**
 * 충족도(%) 산출
 *
 * ```
 * base   = 필수단계 충족 수 / 필수단계 수 × 70   (0~70)
 * career = 진로교과 추가 필수단계 충족 수 / 추가단계 수 × 15  (0~15)
 * bonus  = 가산단계 충족 수 / 2 × 15              (0~15)
 * total  = base + career + bonus                  (0~100)
 * ```
 *
 * 필수단계 = [1, 2, 3, 6]
 * 진로교과 추가 = getCareerMinStages(tier) 에서 필수단계를 제외한 단계
 * 가산단계 = isBonus === true (⑤, ⑧)
 */
function computePercent(
  stageResults: FlowStageResult[],
  isCareerSubject: boolean,
  universityTier: UniversityTier,
): number {
  const BASE_REQUIRED = [1, 2, 3, 6];
  const BONUS_STAGES = [5, 8]; // isBonus === true

  // 진로교과 추가 필수단계: getCareerMinStages 결과에서 BASE_REQUIRED 제외
  const careerMinAll = isCareerSubject ? Array.from(getCareerMinStages(universityTier)) : [];
  const careerExtra = careerMinAll.filter((s) => !BASE_REQUIRED.includes(s) && !BONUS_STAGES.includes(s));

  const fulfilled = (stage: number) => stageResults.find((r) => r.stage === stage)?.fulfilled ?? false;

  // base (0~70)
  const baseFulfilled = BASE_REQUIRED.filter(fulfilled).length;
  const base = (baseFulfilled / BASE_REQUIRED.length) * 70;

  // career extra (0~15)
  let career = 0;
  if (isCareerSubject && careerExtra.length > 0) {
    const careerFulfilled = careerExtra.filter(fulfilled).length;
    career = (careerFulfilled / careerExtra.length) * 15;
  } else if (!isCareerSubject) {
    // 비진로교과: career 가중치(15)를 bonus에 이전
    // → bonus가 최대 30점이 됨. 단, 계산 구조를 단순하게 유지하기 위해
    //   비진로교과는 careerExtra=[] 이므로 career=0, 나머지 15를 base에 흡수시킴
    // 비진로교과 base = 필수충족/4 × 85 (70+15), bonus = 충족/2 × 15
    const baseFulfilledNonCareer = BASE_REQUIRED.filter(fulfilled).length;
    const bonusFulfilled = BONUS_STAGES.filter(fulfilled).length;
    const total =
      (baseFulfilledNonCareer / BASE_REQUIRED.length) * 85 +
      (bonusFulfilled / BONUS_STAGES.length) * 15;
    return Math.round(Math.min(100, total) * 10) / 10;
  }

  // bonus (0~15)
  const bonusFulfilled = BONUS_STAGES.filter(fulfilled).length;
  const bonus = (bonusFulfilled / BONUS_STAGES.length) * 15;

  return Math.round(Math.min(100, base + career + bonus) * 10) / 10;
}

/** completionPercent → FLOW_COMPLETION_TIERS 매핑 */
function resolveTier(
  percent: number,
): (typeof FLOW_COMPLETION_TIERS)[number] {
  // FLOW_COMPLETION_TIERS는 내림차순으로 정의됨 (80, 60, 50, 0)
  for (const tier of FLOW_COMPLETION_TIERS) {
    if (percent >= tier.minPercent) return tier;
  }
  // fallback — minPercent=0 항목
  return FLOW_COMPLETION_TIERS[FLOW_COMPLETION_TIERS.length - 1];
}

// ============================================================
// 공개 함수
// ============================================================

/**
 * 단일 세특의 8단계 Flow Completion 산출
 *
 * @param qualityData content_quality 행의 5축 점수 + issues + feedback
 * @param options.isCareerSubject 진로교과 여부 (false = 비진로교과)
 * @param options.universityTier 대학 수준 기준 (default: "mid")
 */
export function computeFlowCompletion(
  qualityData: QualitySnapshot,
  options: {
    isCareerSubject: boolean;
    universityTier?: UniversityTier;
  },
): FlowCompletionResult {
  const tier = options.universityTier ?? "mid";
  const issues = normalizeIssues(qualityData.issues);
  const feedbackLower = normalizeFeedback(qualityData.feedback);

  const stages: FlowStageResult[] = SETEK_FLOW_STAGES.map((s) =>
    judgeStage(s.order, qualityData, issues, feedbackLower),
  );

  const completionPercent = computePercent(stages, options.isCareerSubject, tier);
  const resolvedTier = resolveTier(completionPercent);

  return {
    completionPercent,
    tier: resolvedTier,
    stages,
    isCareerSubject: options.isCareerSubject,
    universityTier: tier,
  };
}

/** computeAggregateFlowCompletion 의 입력 레코드 타입 */
export interface AggregateFlowInput {
  qualityData: QualitySnapshot;
  isCareerSubject: boolean;
}

/**
 * 학생의 전체 세특에 대한 평균 Flow Completion 산출
 *
 * @param records 세특 목록 (각각 qualityData + isCareerSubject)
 * @param universityTier 대학 수준 기준 (default: "mid")
 */
export function computeAggregateFlowCompletion(
  records: AggregateFlowInput[],
  universityTier?: UniversityTier,
): {
  avgPercent: number;
  tier: (typeof FLOW_COMPLETION_TIERS)[number];
  byRecord: FlowCompletionResult[];
} {
  if (records.length === 0) {
    return {
      avgPercent: 0,
      tier: FLOW_COMPLETION_TIERS[FLOW_COMPLETION_TIERS.length - 1],
      byRecord: [],
    };
  }

  const byRecord = records.map((r) =>
    computeFlowCompletion(r.qualityData, {
      isCareerSubject: r.isCareerSubject,
      universityTier,
    }),
  );

  const avgPercent =
    Math.round(
      (byRecord.reduce((sum, r) => sum + r.completionPercent, 0) / byRecord.length) * 10,
    ) / 10;

  const tier = resolveTier(avgPercent);

  return { avgPercent, tier, byRecord };
}
