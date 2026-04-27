// ============================================
// guide/capability/ranking.ts
//
// 가이드 랭킹 capability — 순수 함수 (DB 의존 0).
// M1-a (2026-04-27): pipeline phase-s2-guide-ranking.ts 의 산식을 추출하여
//   chat tool / MCP / pipeline 모두 동일 산식을 호출하도록 단일 진실 정착.
//
// 호출자 책임 = DB/메타 사전 조회 후 input DTO 로 주입.
// 본 모듈 = 6개 승수 보너스 + midPlan 보너스 + 클러스터 다양성 페널티만 계산.
// ============================================

import {
  computeClubContinuityScore,
  type ClubHistoryEntry,
  type Lineage12,
} from "@/lib/domains/student-record/evaluation-criteria/club-lineage";

// ============================================
// 타입
// ============================================

export interface RankedGuide {
  id: string;
  title: string;
  guide_type: string | null;
  match_reason: string;
  /** 기본 매칭 점수 (1: 단축, 2: 2축, 3: 3축 모두) */
  baseScore: number;
  /** 12계열 연속성 점수 (0.5~1.0) */
  continuityScore: number;
  /** Phase A: 난이도 적합도 (0.7~1.0) */
  difficultyScore: number;
  /** Phase A: 사슬 보너스 (1.0 기본 / 1.3 sequel / 1.5 sequel+궤적) */
  sequelBonus: number;
  /** 전공 적합도 보너스 (1.0 기본 / 1.2 전공 권장 과목) */
  majorBonus: number;
  /** P3: Layer 2 hyperedge 테마 부합 (1.0 기본 / 1.15 일치) */
  hyperedgeBonus?: number;
  /** P3: Layer 3 narrative_arc 약한 단계 보강 (1.0 기본 / 1.1 해당) */
  narrativeArcBonus?: number;
  /** 스토리라인 키워드 매칭 (1.0 기본 / 1.2 매칭) */
  storylineBonus?: number;
  /** 격차 3: MidPlan focusHypothesis 키워드 매칭 (1.0 / 1.05 / 1.10 / 1.15) */
  midPlanBonus?: number;
  /** 최종 가중치 점수 (모든 보너스 승수 곱 + 클러스터 페널티) */
  finalScore: number;
}

/**
 * P3: narrative_arc 8단계 중 "약한 단계" 를 보강 가능한 guide_type 매핑.
 * 휴리스틱 (컨설턴트 직관 기반).
 */
export const WEAK_STAGE_GUIDE_TYPE_MAP: Record<string, string[]> = {
  "참고문헌": ["reading"],
  "탐구내용/이론": ["topic_exploration", "experiment"],
  "결론/제언": ["experiment", "topic_exploration"],
  "성장서사": ["career_exploration_project", "reflection_program"],
  "오류분석→재탐구": ["experiment"],
  "교사관찰": ["reflection_program"],
  "주제선정": ["topic_exploration", "career_exploration_project"],
};

/** 클러스터 다양성 페널티 — 같은 클러스터 4번째부터 0.7배 */
export const CLUSTER_DIVERSITY_THRESHOLD = 3;
export const CLUSTER_DIVERSITY_PENALTY = 0.7;

export interface GuideMatchingInput {
  /** 매칭 대상 가이드 (3축 매칭 결과) */
  guides: Array<{ id: string; title: string; guide_type: string | null; match_reason: string }>;
  /** 학생 학년 (난이도 적합도 계산용) */
  studentGrade: number;
  /** 동아리 활동 이력 (12계열 연속성용) */
  clubHistory: ClubHistoryEntry[];
  /** guide_id → 12계열 매핑 (career_field 사전 조회) */
  lineageByGuide: Map<string, Lineage12 | null>;
  /** guide_id → 난이도 (basic/intermediate/advanced) */
  difficultyByGuide: Map<string, string | null>;
  /** guide_id → topic_cluster_id (사슬·다양성 페널티용) */
  clusterByGuide: Map<string, string | null>;
  /** sequel 대상: 이미 배정된 가이드의 후속 가이드 id 집합 */
  sequelTargets: Set<string>;
  /** 학생이 이미 탐구한 cluster id 집합 (sequel 강화용) */
  exploredClusters: Set<string>;
  /** 전공 권장 과목 매핑된 가이드 id 집합 */
  majorMatchGuides: Set<string>;
  /** Layer 2 hyperedge 테마 토큰 (analysis + blueprint context) */
  hyperedgeTokens: Set<string>;
  /** Layer 3 narrative_arc 약한 단계에 매핑되는 guide_type 집합 */
  weakStageGuideTypes: Set<string>;
  /** 스토리라인 키워드 (4차 fallback 포함, 모두 lowercase) */
  storylineKeywords: Set<string>;
  /** 격차 3: MidPlan focusHypothesis + gradeThemes 키워드 토큰 (lowercase) */
  midPlanFocusTokens?: Set<string>;
}

// ============================================
// 순수 함수
// ============================================

/** 학년에 맞는 난이도일수록 높은 점수 (0.7~1.0) */
export function computeDifficultyFit(
  studentGrade: number,
  difficulty: string | null | undefined,
): number {
  if (!difficulty) return 0.85; // 미분류 → 약간 감점
  const idealMap: Record<number, string> = {
    1: "basic",
    2: "intermediate",
    3: "advanced",
  };
  const ideal = idealMap[studentGrade] ?? "intermediate";
  if (difficulty === ideal) return 1.0;
  const levels = ["basic", "intermediate", "advanced"];
  const diff = Math.abs(levels.indexOf(difficulty) - levels.indexOf(ideal));
  if (diff === 1) return 0.85;
  return 0.7;
}

function computeBaseScore(matchReason: string): number {
  if (matchReason === "all") return 3;
  if (
    matchReason === "both" ||
    matchReason === "classification+activity" ||
    matchReason === "subject+activity"
  ) {
    return 2;
  }
  return 1;
}

function computeMidPlanBonus(title: string, focusTokens: Set<string> | undefined): number {
  if (!focusTokens || focusTokens.size === 0) return 1.0;
  const titleLower = title.toLowerCase();
  let hitCount = 0;
  for (const tok of focusTokens) {
    if (titleLower.includes(tok)) hitCount++;
  }
  if (hitCount >= 3) return 1.15;
  if (hitCount === 2) return 1.10;
  if (hitCount === 1) return 1.05;
  return 1.0;
}

function computeHyperedgeBonus(title: string, tokens: Set<string>): number {
  if (tokens.size === 0) return 1.0;
  const titleLower = title.toLowerCase();
  for (const tok of tokens) {
    if (titleLower.includes(tok.toLowerCase())) return 1.15;
  }
  return 1.0;
}

function computeStorylineBonus(title: string, keywords: Set<string>): number {
  if (keywords.size === 0) return 1.0;
  const titleLower = title.toLowerCase();
  for (const kw of keywords) {
    if (titleLower.includes(kw)) return 1.2;
  }
  return 1.0;
}

/**
 * 클러스터 다양성 페널티 적용 — 같은 클러스터에서 N번째 초과 가이드는 0.7배 감점.
 * 입력은 finalScore 내림차순으로 사전 정렬되어 있어야 한다.
 */
export function applyClusterDiversityPenalty(
  ranked: RankedGuide[],
  clusterByGuide: Map<string, string | null>,
): RankedGuide[] {
  const clusterCount = new Map<string, number>();
  for (const g of ranked) {
    const cid = clusterByGuide.get(g.id);
    if (!cid) continue;
    const count = (clusterCount.get(cid) ?? 0) + 1;
    clusterCount.set(cid, count);
    if (count > CLUSTER_DIVERSITY_THRESHOLD) {
      g.finalScore *= CLUSTER_DIVERSITY_PENALTY;
    }
  }
  return ranked;
}

/**
 * 가이드 랭킹 산식 — 6 승수 보너스 + midPlan 보너스 + 클러스터 다양성 페널티.
 *
 * 호출자 책임:
 * - 모든 메타데이터(career_field, difficulty, cluster, sequel, trajectory, subject_mappings)는
 *   사전 조회하여 Map/Set 으로 주입할 것
 * - 토큰화(hyperedge / storyline / midPlan focus)는 호출자가 lowercase 정규화하여 주입
 *
 * 본 함수는 DB/네트워크 부수효과 없음 — 동일 입력 → 동일 출력.
 */
export function computeGuideRanking(input: GuideMatchingInput): RankedGuide[] {
  const {
    guides,
    studentGrade,
    clubHistory,
    lineageByGuide,
    difficultyByGuide,
    clusterByGuide,
    sequelTargets,
    exploredClusters,
    majorMatchGuides,
    hyperedgeTokens,
    weakStageGuideTypes,
    storylineKeywords,
    midPlanFocusTokens,
  } = input;

  if (guides.length === 0) return [];

  const ranked: RankedGuide[] = guides.map((g) => {
    const lineage = lineageByGuide.get(g.id) ?? null;
    const baseScore = computeBaseScore(g.match_reason);
    const continuityScore = computeClubContinuityScore(clubHistory, lineage, studentGrade);
    const difficultyScore = computeDifficultyFit(studentGrade, difficultyByGuide.get(g.id));

    const isSequel = sequelTargets.has(g.id);
    const clusterId = clusterByGuide.get(g.id);
    const hasTrajectory = clusterId ? exploredClusters.has(clusterId) : false;
    const sequelBonus = isSequel && hasTrajectory ? 1.5 : isSequel ? 1.3 : 1.0;

    const majorBonus = majorMatchGuides.has(g.id) ? 1.2 : 1.0;
    const hyperedgeBonus = computeHyperedgeBonus(g.title, hyperedgeTokens);
    const narrativeArcBonus =
      g.guide_type && weakStageGuideTypes.has(g.guide_type) ? 1.1 : 1.0;
    const storylineBonus = computeStorylineBonus(g.title, storylineKeywords);
    const midPlanBonus = computeMidPlanBonus(g.title, midPlanFocusTokens);

    return {
      id: g.id,
      title: g.title,
      guide_type: g.guide_type,
      match_reason: g.match_reason,
      baseScore,
      continuityScore,
      difficultyScore,
      sequelBonus,
      majorBonus,
      hyperedgeBonus,
      narrativeArcBonus,
      storylineBonus,
      midPlanBonus,
      finalScore:
        baseScore *
        continuityScore *
        difficultyScore *
        sequelBonus *
        majorBonus *
        hyperedgeBonus *
        narrativeArcBonus *
        storylineBonus *
        midPlanBonus,
    };
  });

  ranked.sort((a, b) => b.finalScore - a.finalScore);
  applyClusterDiversityPenalty(ranked, clusterByGuide);
  ranked.sort((a, b) => b.finalScore - a.finalScore);
  return ranked;
}
