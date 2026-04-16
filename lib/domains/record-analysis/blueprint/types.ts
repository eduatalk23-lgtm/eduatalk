// ============================================
// Blueprint-Axis 아키텍처 — 핵심 타입 정의
//
// 하이퍼엣지 3종 (blueprint / analysis / bridge) 중심축으로
// 설계(top-down)와 분석(bottom-up) 파이프라인을 통합.
//
// 2026-04-16 설계. 실행 우선순위:
//   1. Blueprint Phase (LLM I/O) → blueprint 하이퍼엣지 생성
//   2. Journey Model (조합 엔티티) → WHO+WHAT+WHERE+GAP 통합 뷰
//   3. Gap Tracker → bridge 하이퍼엣지 생성 + 정합성 지표
//
// 참조: memory/blueprint-axis-hyperedge-architecture.md
// ============================================

import type {
  MainExplorationTierPlan,
} from "@/lib/domains/student-record/repository/main-exploration-repository";

// ============================================
// 0. 하이퍼엣지 3종 edge_context 확장
// ============================================

/**
 * 기존: 'analysis' | 'projected' | 'synthesis_inferred'
 * 확장: + 'blueprint' | 'bridge'
 *
 * DB 마이그레이션:
 *   ALTER TABLE student_record_hyperedges
 *     DROP CONSTRAINT IF EXISTS student_record_hyperedges_context_check;
 *   ALTER TABLE student_record_hyperedges
 *     ADD CONSTRAINT student_record_hyperedges_context_check
 *     CHECK (edge_context IN ('analysis','projected','synthesis_inferred','blueprint','bridge'));
 */
export type HyperedgeContext =
  | "analysis"
  | "projected"
  | "synthesis_inferred"
  | "blueprint"
  | "bridge";

// ============================================
// 1. Blueprint Phase — LLM 입력
// ============================================

/**
 * Blueprint Pipeline 입력 전체.
 * Journey Model.WHO + main_exploration.tier_plan → LLM → blueprint 산출물.
 */
export interface BlueprintPhaseInput {
  // ── WHO: 학생 정체성 ──────────────────────────
  identity: {
    /** KEDI 분류 or 자유 텍스트 (예: "의학/유전체학", "법학") */
    careerField: string;
    /** 목표 학과 (예: "서울대 의학과") */
    targetMajor?: string;
    /** 학교 권역 — 대학별 기대 수준 차등 */
    schoolTier: "top" | "mid" | "low";
    /** 핵심 정체성 키워드 (main_exploration.theme_keywords 기반) */
    identityKeywords: string[];
  };

  // ── SEED: 메인 탐구 씨앗 ─────────────────────
  mainExploration: {
    themeLabel: string;
    themeKeywords: string[];
    tierPlan: MainExplorationTierPlan;
    careerField: string | null;
  };

  // ── CURRICULUM: 교육과정 맥락 ──────────────────
  curriculum: {
    /** 2015 or 2022 (개정) */
    revisionYear: number;
    /** 학생 현재 학년 */
    currentGrade: number;
    /** 남은 학년 목록 (예: [1,2,3] or [2,3]) */
    remainingGrades: number[];
    /** 학교 개설 과목 목록 (선택) */
    offeredSubjects?: string[];
    /** 기존 수강 계획 (선택) */
    coursePlans?: BlueprintCoursePlan[];
  };

  // ── EXEMPLAR: few-shot 참고 (δ-1 추출 패턴) ───
  /**
   * 유사 진로의 우수 사례 패턴.
   * exemplar extraction(δ-1)에서 추출한 main_exploration pattern.
   * 최대 3건 — 토큰 절감.
   */
  exemplarPatterns?: BlueprintExemplarPattern[];

  // ── ANALYSIS: 기존 분석 데이터 (혼합 모드) ─────
  /**
   * 이미 1학년을 마친 2학년 설계 학생 등 — 실측 데이터가 있는 경우.
   * analysis 하이퍼엣지 + 역량 점수 + 스토리라인을 전달하면
   * LLM이 기존 수렴을 존중하며 2~3학년 blueprint를 생성.
   */
  existingAnalysis?: {
    analysisHyperedges: Array<{
      themeLabel: string;
      memberLabels: string[];
      grade: number | null;
      sharedCompetencies: string[];
    }>;
    competencyScores?: Array<{
      item: string;
      grade: string;
    }>;
    storylines?: Array<{
      title: string;
      keywords: string[];
    }>;
  };
}

export interface BlueprintCoursePlan {
  subjectName: string;
  grade: number;
  semester: number;
  subjectType?: string;
}

export interface BlueprintExemplarPattern {
  themeLabel: string;
  tierPlan: MainExplorationTierPlan;
  careerField: string | null;
  /** 우수 사례의 실제 수렴 패턴 (hyperedge 요약) */
  convergences?: Array<{
    grade: number;
    themeLabel: string;
    memberLabels: string[];
    sharedCompetencies: string[];
  }>;
}

// ============================================
// 2. Blueprint Phase — LLM 출력
// ============================================

/**
 * Blueprint Pipeline LLM 산출물 전체.
 * 이 출력이 DB에 저장되는 경로:
 *   - targetConvergences → student_record_hyperedges (edge_context='blueprint')
 *   - storylineSkeleton → student_record_storylines (source='blueprint') or task_results
 *   - competencyGrowthTargets → task_results (Synthesis S3 진단에서 참조)
 *   - milestones → Journey Model 갱신
 */
export interface BlueprintPhaseOutput {
  // ── 학년별 타겟 수렴 (= blueprint 하이퍼엣지) ───
  /**
   * 3~5개/학년. 각각 "이런 활동들이 하나의 탐구 주제로 수렴해야 한다"를 표현.
   * DB 저장 시 student_record_hyperedges (edge_context='blueprint')로 영속화.
   */
  targetConvergences: BlueprintConvergence[];

  // ── 3년 관통 스토리라인 골격 ──────────────────
  storylineSkeleton: BlueprintStorylineSkeleton;

  // ── 역량 성장 타겟 ──────────────────────────
  /**
   * 학생이 3년간 달성해야 할 역량 등급 목표.
   * Gap Tracker가 실측과 비교하여 bridge 생성에 사용.
   */
  competencyGrowthTargets: CompetencyGrowthTarget[];

  // ── 학년별 마일스톤 ──────────────────────────
  /**
   * Journey Model.WHAT 갱신분.
   * 각 학년의 목표 수렴 수, 핵심 활동, 서사 목표를 정의.
   */
  milestones: Record<number, BlueprintMilestone>;
}

/** 단일 blueprint 수렴 (= 1개 blueprint 하이퍼엣지의 LLM 표현) */
export interface BlueprintConvergence {
  /** 목표 학년 */
  grade: number;
  /** 학기 (선택 — 1 or 2. 생략 시 학년 단위) */
  semester?: number;
  /** 수렴 테마 라벨 (예: "세포·화학 기초 수렴") */
  themeLabel: string;
  /** 테마 키워드 */
  themeKeywords: string[];
  /**
   * 이 수렴에 참여해야 할 활동/과목.
   * DB 저장 시 HyperedgeMember로 변환.
   * recordId는 아직 없으므로 placeholder UUID + subjectOrActivity로 식별.
   */
  targetMembers: BlueprintTargetMember[];
  /** 이 수렴이 강화할 역량 코드 */
  sharedCompetencies: string[];
  /** LLM 자체 확신도 (0~1) */
  confidence: number;
  /** 이 수렴이 필요한 이유 */
  rationale: string;
  /** tier_plan 매핑 */
  tierAlignment: "foundational" | "development" | "advanced";
}

export interface BlueprintTargetMember {
  recordType: "setek" | "changche" | "haengteuk" | "reading";
  /** 과목명 or 활동유형 (예: "생명과학", "과학탐구 동아리", "의학윤리 독서") */
  subjectOrActivity: string;
  /** 수렴 내 역할 */
  role: "anchor" | "support" | "evidence";
  /** 이 멤버가 수렴에서 수행할 탐구 내용 (1문장) */
  description: string;
}

export interface BlueprintStorylineSkeleton {
  /** 3년 관통 테마 (예: "의학 탐구를 통한 생명윤리 의식 성장") */
  overarchingTheme: string;
  /** 학년별 서사 테마 */
  yearThemes: Record<number, string>;
  /** 전체 서사 호 (2~3문장) */
  narrativeArc: string;
}

export interface CompetencyGrowthTarget {
  /** 역량 항목 코드 */
  competencyItem: string;
  /** 현재 등급 (실측 있으면) */
  currentGrade?: string;
  /** 목표 등급 */
  targetGrade: string;
  /** 달성 목표 학년 */
  yearTarget: number;
  /** 달성 경로 (1문장) */
  pathway: string;
}

export interface BlueprintMilestone {
  grade: number;
  /** 이 학년 목표 수렴 수 */
  targetConvergenceCount: number;
  /** 핵심 활동 목록 (예: ["생명과학 세포 탐구", "의학 윤리 독서"]) */
  keyActivities: string[];
  /** 이 학년 집중 역량 코드 */
  competencyFocus: string[];
  /** 서사 목표 (1문장) */
  narrativeGoal: string;
}

// ============================================
// 3. Student Journey Model — 조합 엔티티
// ============================================

/**
 * 하이퍼엣지 3종이 소비하는 공유 참조점.
 * DB 테이블이 아닌 **조합 뷰** — 파이프라인 Synthesis 시 구성하여
 * task_results에 캐시, 또는 별도 스냅샷 테이블로 영속화.
 *
 * 구성 소스:
 *   - WHO: main_exploration (활성 overall)
 *   - WHAT: blueprint 하이퍼엣지 + milestones (task_results)
 *   - WHERE: analysis 하이퍼엣지 + competency_scores
 *   - GAP: bridge 하이퍼엣지 + coherence metrics
 */
export interface StudentJourneyModel {
  studentId: string;
  tenantId: string;
  /** 조합 시점 */
  snapshotAt: string;
  /** 소스 main_exploration id */
  mainExplorationId: string;

  // ── WHO: 진로 정체성 ──────────────────────────
  who: JourneyWho;
  // ── WHAT: 서사 뼈대 ──────────────────────────
  what: JourneyWhat;
  // ── WHERE: 현재 위치 ─────────────────────────
  where: JourneyWhere;
  // ── GAP: 정합성 대시보드 ─────────────────────
  gap: JourneyGap;
}

export interface JourneyWho {
  careerField: string;
  targetMajor?: string;
  schoolTier: "top" | "mid" | "low";
  identityKeywords: string[];
  themeLabel: string;
}

export interface JourneyWhat {
  milestones: Record<number, BlueprintMilestone>;
  storylineSkeleton: BlueprintStorylineSkeleton;
  competencyGrowthTargets: CompetencyGrowthTarget[];
  /** DB에 저장된 blueprint hyperedge ID 목록 */
  blueprintHyperedgeIds: string[];
}

export interface JourneyWhere {
  /** 실현된 수렴 (analysis hyperedge와 blueprint 매칭) */
  realizedConvergences: RealizedConvergence[];
  /** 역량 현황 vs 타겟 */
  competencyStatus: CompetencyStatus[];
  /** 평균 콘텐츠 품질 (content_quality.overall_score) */
  contentQualityAvg: number | null;
  /** 실측 데이터가 있는 학년 */
  analysisGrades: number[];
}

export interface RealizedConvergence {
  /** analysis 하이퍼엣지 ID */
  hyperedgeId: string;
  themeLabel: string;
  grade: number;
  /** 매칭된 blueprint 하이퍼엣지 ID (없으면 drift) */
  matchedBlueprintId: string | null;
  /** 매칭 점수 (0~1) */
  matchScore: number;
}

export interface CompetencyStatus {
  item: string;
  currentGrade: string | null;
  targetGrade: string;
  /** 현재 등급이 목표에 도달했거나 초과 */
  onTrack: boolean;
  /** GAP 크기 (숫자 등급 차이, A+=6 ~ C=1 스케일) */
  gapSize: number;
}

export interface JourneyGap {
  /** blueprint 중 실현된 비율 (0~1) */
  coverageRate: number;
  /** blueprint에 없는 의외 수렴 (기회 또는 이탈) */
  driftItems: DriftItem[];
  /** 우선 행동 제안 (bridge 하이퍼엣지 기반) */
  priorityActions: PriorityAction[];
  /** 종합 정합성 점수 (0~1) — coverage - drift penalty */
  coherenceScore: number;
  /** 마지막 갱신 시점 */
  lastUpdated: string;
}

export interface DriftItem {
  /** drift를 형성한 analysis 하이퍼엣지 ID */
  analysisHyperedgeId: string;
  themeLabel: string;
  /** drift 성격 */
  driftType: "positive_discovery" | "off_track" | "neutral";
  /** 설명 */
  description: string;
}

export interface PriorityAction {
  /** 소스 bridge 하이퍼엣지 ID */
  bridgeHyperedgeId: string;
  description: string;
  urgency: "high" | "medium" | "low";
  targetGrade: number;
  targetSemester?: number;
}

// ============================================
// 4. Gap Tracker — 입력 / 출력 / Bridge 규칙
// ============================================

/**
 * Gap Tracker 입력.
 * Blueprint(WHAT) + Analysis(WHERE) + 현재 상태를 받아
 * Bridge 하이퍼엣지와 정합성 지표를 산출.
 */
export interface GapTrackerInput {
  studentId: string;
  tenantId: string;
  pipelineId: string;

  /** Blueprint 하이퍼엣지 (edge_context='blueprint') */
  blueprintHyperedges: Array<{
    id: string;
    themeLabel: string;
    themeSlug: string;
    members: Array<{ recordType: string; label: string; grade: number | null; role?: string }>;
    sharedKeywords: string[] | null;
    sharedCompetencies: string[] | null;
    confidence: number;
    /** milestones에서 파생된 grade */
    grade: number | null;
  }>;

  /** Analysis 하이퍼엣지 (edge_context='analysis') */
  analysisHyperedges: Array<{
    id: string;
    themeLabel: string;
    themeSlug: string;
    members: Array<{ recordType: string; label: string; grade: number | null; role?: string }>;
    sharedKeywords: string[] | null;
    sharedCompetencies: string[] | null;
    confidence: number;
  }>;

  /** 역량 성장 타겟 (Blueprint 산출물) */
  competencyGrowthTargets: CompetencyGrowthTarget[];

  /** 현재 역량 점수 */
  currentCompetencyScores: Array<{
    item: string;
    gradeValue: string;
    source: "ai" | "ai_projected";
  }>;

  /** 학생 현재 학년 */
  currentGrade: number;
  /** 현재 학기 (1 or 2) */
  currentSemester: 1 | 2;
}

/**
 * Gap Tracker 출력.
 * Synthesis Phase에서 소비:
 *   - bridgeProposals → student_record_hyperedges (edge_context='bridge') 저장
 *   - metrics → task_results 캐시 + UI 대시보드
 *   - journeyGap → Journey Model.GAP 갱신
 */
export interface GapTrackerOutput {
  /** Bridge 하이퍼엣지 제안 */
  bridgeProposals: BridgeHyperedgeProposal[];
  /** 정합성 메트릭 */
  metrics: JourneyCoherenceMetrics;
  /** Journey Model GAP 갱신분 */
  journeyGap: JourneyGap;
}

/** Bridge 하이퍼엣지 제안 1건 */
export interface BridgeHyperedgeProposal {
  // ── 매칭 관계 ──────────────────────────────
  /** 목표 blueprint 하이퍼엣지 ID */
  blueprintHyperedgeId: string;
  /** 매칭된 analysis 하이퍼엣지 ID (없으면 full gap) */
  matchedAnalysisId: string | null;
  /** 매칭 점수 (0~1, null이면 unmatched) */
  matchScore: number | null;

  // ── Gap 분석 ───────────────────────────────
  gapType: BridgeGapType;
  /** blueprint에 있지만 analysis에 없는 멤버 */
  missingMembers: Array<{
    recordType: string;
    subjectOrActivity: string;
    description: string;
  }>;
  /** 역량 갭 (현재 < 목표) */
  competencyGaps: Array<{
    item: string;
    currentGrade: string | null;
    targetGrade: string;
    gapSize: number;
  }>;

  // ── 액션 제안 ──────────────────────────────
  /** 컨설턴트에게 보여줄 구체적 행동 제안 */
  recommendedAction: string;
  targetGrade: number;
  targetSemester?: number;
  urgency: "high" | "medium" | "low";

  // ── Hyperedge 메타 (DB 저장용) ─────────────
  themeLabel: string;
  themeKeywords: string[];
  confidence: number;
  /**
   * B3(2026-04-16): blueprint convergence의 sharedCompetencies 원본.
   * competencyGaps는 score 기반 측정 gap만 포함 — ai_projected가 이미 목표 이상이면 빈 배열.
   * 하지만 bridge 하이퍼엣지의 sharedCompetencies에는 blueprint가 요구한 역량이 그대로 필요하므로
   * passthrough 용도로 유지.
   */
  blueprintSharedCompetencies: string[];
}

export type BridgeGapType =
  /** blueprint에 매칭되는 analysis 하이퍼엣지가 아예 없음 */
  | "unmatched"
  /** 매칭되었으나 멤버가 부분적으로만 실현됨 */
  | "partial"
  /** 멤버는 실현됐으나 역량 등급이 목표 미달 */
  | "competency_gap"
  /** 멤버/역량은 OK이나 콘텐츠 품질이 미달 */
  | "quality_gap";

/** Journey 정합성 수치 지표 */
export interface JourneyCoherenceMetrics {
  /** blueprint 하이퍼엣지 중 analysis에 매칭된 비율 (0~1) */
  coverage: number;
  /** analysis 중 blueprint에 없는 수렴 수 */
  driftCount: number;
  /** drift에 의한 coherence 감점 (0~0.2 cap) */
  driftPenalty: number;
  /** 종합 점수: coverage - driftPenalty */
  coherenceScore: number;
  /** 미실현 blueprint 수 */
  gapCount: number;
  /** 남은 학기 내 채울 수 있는 gap 수 (urgency로 필터) */
  feasibleGapCount: number;
}

// ============================================
// 5. Gap Tracker — Bridge 생성 알고리즘 규칙
// ============================================

/**
 * Gap Tracker Bridge 생성 알고리즘 (규칙 기반, LLM 없음).
 *
 * === Step 1: Blueprint → Analysis 매칭 ===
 *
 * 각 blueprint 하이퍼엣지 B에 대해:
 *   1. 모든 analysis 하이퍼엣지 A와 유사도 계산:
 *      score = keyword_jaccard(B, A) × 0.4
 *            + competency_jaccard(B, A) × 0.4
 *            + member_label_overlap(B, A) × 0.2
 *
 *   2. score ≥ MATCH_THRESHOLD (0.3) → "partial" match
 *      최고 점수의 A를 선택 (1:1 매칭, 이미 매칭된 A 제외)
 *
 *   3. score < MATCH_THRESHOLD → "unmatched" (full gap)
 *
 * === Step 2: Bridge 하이퍼엣지 생성 ===
 *
 * 각 매칭/미매칭 쌍에 대해:
 *
 *   [unmatched] → gapType='unmatched'
 *     - missingMembers = B.members 전체
 *     - competencyGaps = B.sharedCompetencies에서 학생 현재 점수 대비 gap
 *     - recommendedAction = "이 수렴 전체를 {targetGrade}학년에서 시작해야 합니다"
 *
 *   [partial] → gapType='partial' | 'competency_gap' | 'quality_gap'
 *     - missingMembers = B.members \ A.members (recordType+label 기준)
 *     - competencyGaps = B.sharedCompetencies에서 현재 < 목표인 항목
 *     - missingMembers 비어있고 competencyGaps도 비어있으면:
 *         quality_gap (content_quality 비교 필요 시) or skip
 *
 * === Step 3: Drift 감지 ===
 *
 * 어떤 blueprint에도 매칭되지 않은 analysis 하이퍼엣지 A:
 *   - drift 항목으로 등록
 *   - driftType 판정:
 *     - A.sharedCompetencies와 blueprint 전체의 sharedCompetencies 교집합 ≥ 1
 *       → 'positive_discovery' (관련 있는 의외 수렴)
 *     - 교집합 = 0
 *       → 'off_track' (관련 없는 수렴 — 경고)
 *     - 기타 → 'neutral'
 *
 * === Step 4: Urgency 산정 ===
 *
 * remaining_semesters = (3 - currentGrade) × 2
 *                       + (currentSemester === 1 ? 1 : 0)
 *
 * urgency:
 *   - 'high':   gapType='unmatched' AND remaining_semesters ≤ 2
 *               OR competencyGaps에 gapSize ≥ 3인 항목 존재
 *   - 'medium': remaining_semesters ≤ 4
 *               OR gapType='partial' AND missingMembers.length ≥ 2
 *   - 'low':    나머지
 *
 * === Step 5: Coherence 산출 ===
 *
 * coverage = matched_count / blueprint_count
 *            (blueprint_count = 0이면 coverage = 0)
 *
 * drift_penalty = min(drift_count / max(blueprint_count, 1) × 0.3, 0.2)
 *                 (drift가 많을수록 감점, 최대 0.2)
 *
 * coherence_score = max(coverage - drift_penalty, 0)
 *
 * feasible_gap_count = bridges.filter(b => b.urgency !== 'low'
 *                        && b.targetGrade <= 3).length
 */
export const GAP_TRACKER_CONSTANTS = {
  /** Blueprint → Analysis 매칭 최소 유사도 */
  MATCH_THRESHOLD: 0.3,
  /** Jaccard 계산 시 keyword 가중치 */
  KEYWORD_WEIGHT: 0.4,
  /** Jaccard 계산 시 competency 가중치 */
  COMPETENCY_WEIGHT: 0.4,
  /** Member label overlap 가중치 */
  MEMBER_WEIGHT: 0.2,
  /** Drift penalty cap */
  DRIFT_PENALTY_CAP: 0.2,
  /** Drift → coherence 감점 비율 (drift/blueprint × 이 값) */
  DRIFT_PENALTY_RATE: 0.3,
  /** urgency=high 기준: 남은 학기 */
  HIGH_URGENCY_SEMESTERS: 2,
  /** urgency=high 기준: competency gap size */
  HIGH_URGENCY_GAP_SIZE: 3,
  /** urgency=medium 기준: 남은 학기 */
  MEDIUM_URGENCY_SEMESTERS: 4,
} as const;

// ============================================
// 6. Blueprint → HyperedgeInput 변환 유틸 타입
// ============================================

/**
 * BlueprintConvergence → HyperedgeInput 변환 시 사용.
 * targetMembers에는 아직 실제 recordId가 없으므로
 * placeholder UUID를 생성하여 label 기반 식별.
 *
 * member.recordId = `blueprint:${grade}:${subjectOrActivity}` (결정적 slug)
 * member.role = anchor | support | evidence (그대로 매핑)
 */
export interface BlueprintToHyperedgeMapping {
  convergence: BlueprintConvergence;
  /** 생성된 HyperedgeInput (replaceHyperedges에 전달) */
  hyperedgeInput: {
    themeSlug: string;
    themeLabel: string;
    hyperedgeType: "theme_convergence";
    members: Array<{
      recordType: string;
      recordId: string;
      label: string;
      grade: number | null;
      role: "anchor" | "support" | "evidence";
    }>;
    confidence: number;
    evidence: string;
    sharedKeywords: string[];
    sharedCompetencies: string[];
  };
}

// ============================================
// 7. Pipeline 통합 — task_result 키
// ============================================

/**
 * Blueprint/Gap 관련 task_results 키 확장.
 * PipelineTaskResultMap에 추가할 엔트리.
 *
 * _blueprintPhase: BlueprintPhaseOutput
 * _journeyModel: StudentJourneyModel
 * _gapTracker: GapTrackerOutput
 */
export interface BlueprintTaskResultExtensions {
  /** Blueprint Phase LLM 산출물 전체 */
  _blueprintPhase: BlueprintPhaseOutput;
  /** 조합된 Journey Model 스냅샷 */
  _journeyModel: StudentJourneyModel;
  /** Gap Tracker 산출물 */
  _gapTracker: GapTrackerOutput;
}
