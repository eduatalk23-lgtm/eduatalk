// ============================================
// Gap Tracker — bridge 하이퍼엣지 생성 엔진
//
// 규칙 기반 (LLM 없음). 결정적 알고리즘 5단계:
//   1. Blueprint → Analysis 매칭 (Jaccard)
//   2. Bridge 하이퍼엣지 생성
//   3. Drift 감지
//   4. Urgency 산정
//   5. Coherence 산출
//
// 참조: blueprint/types.ts — GAP_TRACKER_CONSTANTS
// ============================================

import type {
  GapTrackerInput,
  GapTrackerOutput,
  BridgeHyperedgeProposal,
  BridgeGapType,
  JourneyCoherenceMetrics,
  JourneyGap,
  DriftItem,
  PriorityAction,
} from "./types";
import { GAP_TRACKER_CONSTANTS } from "./types";

// ============================================
// 공용 유틸: Jaccard 유사도
// ============================================

function jaccard(a: string[] | null, b: string[] | null): number {
  const setA = new Set(a ?? []);
  const setB = new Set(b ?? []);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function memberLabelOverlap(
  bMembers: Array<{ label: string }>,
  aMembers: Array<{ label: string }>,
): number {
  if (bMembers.length === 0 && aMembers.length === 0) return 0;
  const aLabels = new Set(aMembers.map((m) => m.label.toLowerCase()));
  let matchCount = 0;
  for (const m of bMembers) {
    if (aLabels.has(m.label.toLowerCase())) matchCount++;
  }
  const total = Math.max(bMembers.length, aMembers.length);
  return total === 0 ? 0 : matchCount / total;
}

// ============================================
// Grade→Numeric 변환 (역량 등급 A+=6 ~ C=1)
// ============================================

const GRADE_NUMERIC: Record<string, number> = {
  "A+": 6, "A-": 5, "B+": 4, "B-": 3, "C+": 2, "C": 1,
};

function gradeToNumeric(grade: string): number {
  return GRADE_NUMERIC[grade] ?? 0;
}

// ============================================
// Step 1: Blueprint → Analysis 매칭
// ============================================

interface MatchResult {
  blueprintId: string;
  analysisId: string | null;
  score: number;
}

function matchBlueprintToAnalysis(input: GapTrackerInput): MatchResult[] {
  const { KEYWORD_WEIGHT, COMPETENCY_WEIGHT, MEMBER_WEIGHT, MATCH_THRESHOLD } =
    GAP_TRACKER_CONSTANTS;

  const usedAnalysisIds = new Set<string>();
  const results: MatchResult[] = [];

  for (const bp of input.blueprintHyperedges) {
    let bestScore = 0;
    let bestAnalysisId: string | null = null;

    for (const an of input.analysisHyperedges) {
      if (usedAnalysisIds.has(an.id)) continue;

      const kwScore = jaccard(bp.sharedKeywords, an.sharedKeywords);
      const compScore = jaccard(bp.sharedCompetencies, an.sharedCompetencies);
      const memberScore = memberLabelOverlap(bp.members, an.members);

      const totalScore =
        kwScore * KEYWORD_WEIGHT +
        compScore * COMPETENCY_WEIGHT +
        memberScore * MEMBER_WEIGHT;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestAnalysisId = an.id;
      }
    }

    if (bestScore >= MATCH_THRESHOLD && bestAnalysisId) {
      usedAnalysisIds.add(bestAnalysisId);
      results.push({ blueprintId: bp.id, analysisId: bestAnalysisId, score: bestScore });
    } else {
      results.push({ blueprintId: bp.id, analysisId: null, score: 0 });
    }
  }

  return results;
}

// ============================================
// Step 2: Bridge 하이퍼엣지 생성
// ============================================

function buildBridgeProposals(
  input: GapTrackerInput,
  matches: MatchResult[],
): BridgeHyperedgeProposal[] {
  const analysisById = new Map(
    input.analysisHyperedges.map((a) => [a.id, a]),
  );
  const blueprintById = new Map(
    input.blueprintHyperedges.map((b) => [b.id, b]),
  );
  const scoreMap = new Map(
    input.currentCompetencyScores.map((s) => [s.item, s.gradeValue]),
  );

  const bridges: BridgeHyperedgeProposal[] = [];

  for (const match of matches) {
    const bp = blueprintById.get(match.blueprintId);
    if (!bp) continue;

    const an = match.analysisId ? analysisById.get(match.analysisId) : null;

    // ── Missing members ──
    const aLabelSet = new Set(
      (an?.members ?? []).map((m) => `${m.recordType}:${m.label.toLowerCase()}`),
    );
    const missingMembers = bp.members
      .filter((m) => !aLabelSet.has(`${m.recordType}:${m.label.toLowerCase()}`))
      .map((m) => ({
        recordType: m.recordType,
        subjectOrActivity: m.label,
        description: `Blueprint 수렴 "${bp.themeLabel}"에서 예상했으나 실현되지 않은 멤버`,
      }));

    // ── Competency gaps ──
    // 명시적 성장 타겟이 있는 역량만 gap 평가 (타겟 미설정 = 데이터 불충분 → skip)
    const competencyGaps = (bp.sharedCompetencies ?? [])
      .map((comp) => {
        const target = input.competencyGrowthTargets.find(
          (t) => t.competencyItem === comp,
        );
        if (!target) return null; // 타겟 미설정 → gap 판정 불가
        const current = scoreMap.get(comp);
        const currentNumeric = current ? gradeToNumeric(current) : 0;
        const targetNumeric = gradeToNumeric(target.targetGrade);
        const gap = targetNumeric - currentNumeric;
        return gap > 0
          ? { item: comp, currentGrade: current ?? null, targetGrade: target.targetGrade, gapSize: gap }
          : null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);

    // ── Gap type 판정 ──
    let gapType: BridgeGapType;
    if (!an) {
      gapType = "unmatched";
    } else if (missingMembers.length > 0) {
      gapType = "partial";
    } else if (competencyGaps.length > 0) {
      gapType = "competency_gap";
    } else {
      // 모든 멤버/역량 충족 — quality gap 또는 skip
      gapType = "quality_gap";
    }

    // 완전 매칭이고 gap도 없으면 bridge 불필요
    if (gapType === "quality_gap" && competencyGaps.length === 0 && missingMembers.length === 0) {
      continue;
    }

    // ── Recommended action ──
    const targetGrade = bp.grade ?? input.currentGrade;
    let recommendedAction: string;
    if (gapType === "unmatched") {
      recommendedAction = `"${bp.themeLabel}" 수렴 전체를 ${targetGrade}학년에서 시작해야 합니다.`;
    } else if (gapType === "partial") {
      const missing = missingMembers.map((m) => m.subjectOrActivity).join(", ");
      recommendedAction = `"${bp.themeLabel}" 수렴에서 ${missing}이(가) 부족합니다.`;
    } else if (gapType === "competency_gap") {
      const gaps = competencyGaps.map((g) => `${g.item}(${g.currentGrade ?? "미측정"}→${g.targetGrade})`).join(", ");
      recommendedAction = `"${bp.themeLabel}" 수렴의 역량 보강이 필요합니다: ${gaps}`;
    } else {
      recommendedAction = `"${bp.themeLabel}" 수렴의 콘텐츠 품질을 개선해야 합니다.`;
    }

    bridges.push({
      blueprintHyperedgeId: match.blueprintId,
      matchedAnalysisId: match.analysisId,
      matchScore: match.score > 0 ? match.score : null,
      gapType,
      missingMembers,
      competencyGaps,
      recommendedAction,
      targetGrade,
      urgency: "medium", // Step 4에서 재산정
      themeLabel: `[bridge] ${bp.themeLabel}`,
      themeKeywords: bp.sharedKeywords ?? [],
      confidence: bp.confidence * (match.score || 0.5),
    });
  }

  return bridges;
}

// ============================================
// Step 3: Drift 감지
// ============================================

function detectDrift(
  input: GapTrackerInput,
  matches: MatchResult[],
): DriftItem[] {
  const matchedAnalysisIds = new Set(
    matches.filter((m) => m.analysisId).map((m) => m.analysisId!),
  );

  // blueprint 전체의 sharedCompetencies 합집합
  const allBlueprintCompetencies = new Set<string>();
  for (const bp of input.blueprintHyperedges) {
    for (const c of bp.sharedCompetencies ?? []) {
      allBlueprintCompetencies.add(c);
    }
  }

  const driftItems: DriftItem[] = [];

  for (const an of input.analysisHyperedges) {
    if (matchedAnalysisIds.has(an.id)) continue;

    // competency 교집합으로 drift 성격 판정
    const anCompetencies = new Set(an.sharedCompetencies ?? []);
    let overlap = 0;
    for (const c of anCompetencies) {
      if (allBlueprintCompetencies.has(c)) overlap++;
    }

    let driftType: DriftItem["driftType"];
    if (overlap >= 1) {
      driftType = "positive_discovery";
    } else if (anCompetencies.size > 0) {
      driftType = "off_track";
    } else {
      driftType = "neutral";
    }

    const description =
      driftType === "positive_discovery"
        ? `계획에 없던 "${an.themeLabel}" 수렴이 형성됨 — Blueprint 반영 기회`
        : driftType === "off_track"
          ? `"${an.themeLabel}" 수렴이 진로와 무관하게 형성됨 — 서사 이탈 주의`
          : `"${an.themeLabel}" 수렴이 Blueprint와 별개로 형성됨`;

    driftItems.push({
      analysisHyperedgeId: an.id,
      themeLabel: an.themeLabel,
      driftType,
      description,
    });
  }

  return driftItems;
}

// ============================================
// Step 4: Urgency 산정
// ============================================

function assignUrgency(
  bridges: BridgeHyperedgeProposal[],
  currentGrade: number,
  currentSemester: 1 | 2,
): void {
  const { HIGH_URGENCY_SEMESTERS, HIGH_URGENCY_GAP_SIZE, MEDIUM_URGENCY_SEMESTERS } =
    GAP_TRACKER_CONSTANTS;

  const remainingSemesters =
    (3 - currentGrade) * 2 + (currentSemester === 1 ? 1 : 0);

  for (const bridge of bridges) {
    const hasLargeGap = bridge.competencyGaps.some(
      (g) => g.gapSize >= HIGH_URGENCY_GAP_SIZE,
    );

    if (
      (bridge.gapType === "unmatched" && remainingSemesters <= HIGH_URGENCY_SEMESTERS) ||
      hasLargeGap
    ) {
      bridge.urgency = "high";
    } else if (
      remainingSemesters <= MEDIUM_URGENCY_SEMESTERS ||
      (bridge.gapType === "partial" && bridge.missingMembers.length >= 2)
    ) {
      bridge.urgency = "medium";
    } else {
      bridge.urgency = "low";
    }
  }
}

// ============================================
// Step 5: Coherence 산출
// ============================================

function computeCoherence(
  input: GapTrackerInput,
  matches: MatchResult[],
  driftItems: DriftItem[],
  bridges: BridgeHyperedgeProposal[],
): JourneyCoherenceMetrics {
  const { DRIFT_PENALTY_CAP, DRIFT_PENALTY_RATE } = GAP_TRACKER_CONSTANTS;

  const blueprintCount = input.blueprintHyperedges.length;
  const matchedCount = matches.filter((m) => m.analysisId !== null).length;

  const coverage = blueprintCount > 0 ? matchedCount / blueprintCount : 0;
  const driftCount = driftItems.length;
  const driftPenalty = Math.min(
    (driftCount / Math.max(blueprintCount, 1)) * DRIFT_PENALTY_RATE,
    DRIFT_PENALTY_CAP,
  );
  const coherenceScore = Math.max(coverage - driftPenalty, 0);
  const gapCount = blueprintCount - matchedCount;
  const feasibleGapCount = bridges.filter(
    (b) => b.urgency !== "low" && b.targetGrade <= 3,
  ).length;

  return {
    coverage: Math.round(coverage * 1000) / 1000,
    driftCount,
    driftPenalty: Math.round(driftPenalty * 1000) / 1000,
    coherenceScore: Math.round(coherenceScore * 1000) / 1000,
    gapCount,
    feasibleGapCount,
  };
}

// ============================================
// 메인 엔트리: runGapTracker
// ============================================

/**
 * Gap Tracker 실행 — 규칙 기반 (LLM 없음).
 * Blueprint(WHAT) + Analysis(WHERE) → Bridge(GAP) + Coherence Metrics.
 */
export function runGapTracker(input: GapTrackerInput): GapTrackerOutput {
  // blueprint가 없으면 빈 결과
  if (input.blueprintHyperedges.length === 0) {
    return {
      bridgeProposals: [],
      metrics: {
        coverage: 0,
        driftCount: 0,
        driftPenalty: 0,
        coherenceScore: 0,
        gapCount: 0,
        feasibleGapCount: 0,
      },
      journeyGap: {
        coverageRate: 0,
        driftItems: [],
        priorityActions: [],
        coherenceScore: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  // Step 1: 매칭
  const matches = matchBlueprintToAnalysis(input);

  // Step 2: Bridge 생성
  const bridges = buildBridgeProposals(input, matches);

  // Step 3: Drift 감지
  const driftItems = detectDrift(input, matches);

  // Step 4: Urgency
  assignUrgency(bridges, input.currentGrade, input.currentSemester);

  // Step 5: Coherence
  const metrics = computeCoherence(input, matches, driftItems, bridges);

  // Journey GAP 조합
  const priorityActions: PriorityAction[] = bridges
    .filter((b) => b.urgency !== "low")
    .sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    })
    .map((b) => ({
      bridgeHyperedgeId: `bridge:${b.blueprintHyperedgeId}`, // 실제 ID는 DB 저장 후 배정
      description: b.recommendedAction,
      urgency: b.urgency,
      targetGrade: b.targetGrade,
      targetSemester: b.targetSemester,
    }));

  const journeyGap: JourneyGap = {
    coverageRate: metrics.coverage,
    driftItems,
    priorityActions,
    coherenceScore: metrics.coherenceScore,
    lastUpdated: new Date().toISOString(),
  };

  return {
    bridgeProposals: bridges,
    metrics,
    journeyGap,
  };
}
