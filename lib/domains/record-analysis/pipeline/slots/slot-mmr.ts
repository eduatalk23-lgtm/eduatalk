// ============================================
// pipeline/slots/slot-mmr.ts
//
// 권고3 / Step 2.4 (2026-04-28): MMR (Maximal Marginal Relevance) 다양성 선택.
//
// Carbonell & Goldstein (1998) — 추천 시스템에서 relevance 와 diversity 의 balanced
// trade-off 를 일반화한 표준 알고리즘. λ ∈ [0, 1] 로 두 축 비중 조정.
//
//   MMR(c) = λ · sim_to_query(c) - (1-λ) · max_{s ∈ selected} sim_to_selected(c, s)
//
// 본 모듈은 슬롯 단위로 N 개 후보 중 expectedCount 만큼 선택할 때 호출.
// 학년별 λ 권장값(slot-config 와 정합):
//   1학년 0.5 (다양성 우선) / 2학년 0.7 / 3학년 0.8 (관련성 우선)
//
// 본 PR 은 순수 알고리즘 + 단위 테스트. 호출 배선은 후속.
// ============================================

import type { ScoreableGuide } from "./slot-aware-score";

export interface MmrCandidate<G = ScoreableGuide> {
  guide: G;
  /** 가이드와 슬롯의 적합도 (scoreGuideForSlot.totalScore 등) */
  relevance: number;
  /** 다양성 비교용 키워드/주제 임베딩 — 본 PR 은 string[] 로 jaccard 비교 */
  features: string[];
}

export interface MmrOptions {
  /** 0~1. 1=관련성만, 0=다양성만. 학년별 권장: 1학년 0.5 / 2학년 0.7 / 3학년 0.8 */
  lambda: number;
  /** 선택 개수 — 슬롯 expectedCount */
  k: number;
}

export interface MmrSelection<G = ScoreableGuide> {
  selected: Array<MmrCandidate<G>>;
  /** 후보 풀 중 선택되지 않은 항목 (디버깅용) */
  notSelected: Array<MmrCandidate<G>>;
}

/**
 * jaccard 유사도 — 두 string set 의 |A ∩ B| / |A ∪ B|. 빈 set 일 때 0.
 * 후속에서 코사인/임베딩 거리로 교체 가능 (시그니처 유지).
 */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a.map((s) => s.toLowerCase()));
  const B = new Set(b.map((s) => s.toLowerCase()));
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** relevance 정규화 — 0~1 로 스케일링 (max 가 0 이면 모두 0) */
function normalizeRelevance<G>(cands: Array<MmrCandidate<G>>): Array<MmrCandidate<G>> {
  const max = cands.reduce((m, c) => Math.max(m, c.relevance), 0);
  if (max === 0) return cands;
  return cands.map((c) => ({ ...c, relevance: c.relevance / max }));
}

/**
 * MMR 다양성 선택. 그리디 — 매 라운드 best MMR 점수 1건 선택.
 *
 * 시간복잡도 O(k · N · |selected|) — N=후보 수, k=목표 수. 슬롯당 N≤30, k≤5 라
 * 충분히 hot path.
 */
export function selectByMmr<G>(
  candidates: Array<MmrCandidate<G>>,
  options: MmrOptions,
): MmrSelection<G> {
  const { lambda, k } = options;
  if (candidates.length === 0 || k === 0) {
    return { selected: [], notSelected: [...candidates] };
  }

  const normed = normalizeRelevance(candidates);
  // 초기 — 가장 관련성 높은 1건 선택
  const sorted = [...normed].sort((a, b) => b.relevance - a.relevance);
  const selected: Array<MmrCandidate<G>> = [sorted[0]];
  const remaining = sorted.slice(1);

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      let maxSimToSelected = 0;
      for (const s of selected) {
        const sim = jaccard(c.features, s.features);
        if (sim > maxSimToSelected) maxSimToSelected = sim;
      }
      const mmr = lambda * c.relevance - (1 - lambda) * maxSimToSelected;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return { selected, notSelected: remaining };
}

/** 학년별 λ 권장값 — slot-config 와 정합. 호출자가 직접 lambda 지정도 OK. */
export function defaultLambdaForGrade(grade: 1 | 2 | 3): number {
  if (grade === 1) return 0.5;
  if (grade === 2) return 0.7;
  return 0.8;
}
