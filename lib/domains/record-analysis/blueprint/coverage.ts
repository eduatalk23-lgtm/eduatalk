// ============================================
// blueprint/coverage.ts
//
// M1-d (2026-04-27): Blueprint targetConvergences 의 "미충족" 판정 헬퍼.
//
// Blueprint 의 학년별 수렴축이 이미 (a) 배정된 가이드 또는 (b) NEIS 활동에 의해
// 충족됐는지 판정한다. AI 탐구 설계(S2 Phase A) 가 미충족 수렴축을 우선 채우도록
// prompt 에 명시적 시그널을 주는 데 사용.
//
// 휴리스틱:
//   - 가이드 title / NEIS 활동 텍스트에 themeKeywords 중 1개 이상 포함되면 충족
//   - themeLabel 자체 일치도 충족 신호로 인정
//   - keywords 가 비어있으면 themeLabel 토큰화로 폴백
//
// 본 모듈은 순수 함수 (DB 의존 0). 호출자가 사전 조회한 배열을 input 으로 주입.
// ============================================

import type { BlueprintConvergence } from "./types";
import type { CascadePlan } from "../capability/cascade-plan";

export interface CoverageInput {
  convergences: BlueprintConvergence[];
  /** 이미 배정된 가이드 title 목록 (lowercase 권장하지만 본 함수가 정규화). */
  assignedGuideTitles: string[];
  /** 학생 NEIS 활동 텍스트 발췌 (세특/창체/행특). 학년 필터 없이 전부 주입 가능. */
  neisActivityTexts: string[];
}

export interface CoverageVerdict {
  /** 입력 convergences 와 동일 순서. true = 충족, false = 미충족 */
  fulfilled: boolean[];
  /** 미충족 convergence 의 index 배열 (prompt highlight 용) */
  unfulfilledIndices: number[];
  /** 충족 신호 디버그 — index → 매칭된 토큰 */
  matchedTokensByIndex: Record<number, string[]>;
}

/**
 * Blueprint 수렴축이 이미 충족됐는지 판정.
 *
 * @param input - convergences + 충족 신호 풀(가이드 title + NEIS 활동 텍스트)
 * @returns 학년·수렴축 단위 fulfilled 판정 + 미충족 인덱스
 */
export function computeUnfulfilledConvergences(
  input: CoverageInput,
): CoverageVerdict {
  const { convergences, assignedGuideTitles, neisActivityTexts } = input;
  const fulfilled: boolean[] = [];
  const unfulfilledIndices: number[] = [];
  const matchedTokensByIndex: Record<number, string[]> = {};

  // 충족 신호 풀 — 모든 텍스트를 lowercase 로 정규화
  const haystack = [
    ...assignedGuideTitles,
    ...neisActivityTexts,
  ]
    .map((t) => t?.toLowerCase().trim())
    .filter((t): t is string => Boolean(t && t.length > 0));

  for (let i = 0; i < convergences.length; i++) {
    const conv = convergences[i];
    const tokens = collectTokens(conv);

    const matched: string[] = [];
    for (const tok of tokens) {
      const tokLower = tok.toLowerCase();
      if (tokLower.length < 2) continue;
      for (const text of haystack) {
        if (text.includes(tokLower)) {
          matched.push(tok);
          break;
        }
      }
    }

    const isFulfilled = matched.length > 0;
    fulfilled.push(isFulfilled);
    if (matched.length > 0) matchedTokensByIndex[i] = matched;
    if (!isFulfilled) unfulfilledIndices.push(i);
  }

  return { fulfilled, unfulfilledIndices, matchedTokensByIndex };
}

// ============================================
// W4 (M1-c, 2026-04-27): cascade ↔ blueprint 정합성 검증
// ============================================

export interface CascadeBlueprintCoherenceVerdict {
  /** 학년별 일치/불일치 — true=정합 (토큰 중첩 ≥ 임계) */
  byGrade: Record<number, { coherent: boolean; overlap: number; cascadeTokens: string[]; bpTokens: string[] }>;
  /** 불일치 학년 수 */
  mismatchCount: number;
  /** 사람-읽기 요약 */
  summary: string;
}

/**
 * cascadePlan 의 학년별 노드(subjects + contentSummary) 와 blueprint targetConvergences 의
 * 학년별 themeKeywords/themeLabel 토큰 중첩도를 측정.
 *
 * 임계 1개 미만 = 불일치 (warning 대상).
 * 자동 수정은 하지 않음 — 컨설턴트가 검토 후 mainTheme 또는 blueprint 갱신을 결정.
 */
export function computeCascadeBlueprintCoherence(input: {
  cascade: CascadePlan;
  targetConvergences: BlueprintConvergence[];
}): CascadeBlueprintCoherenceVerdict {
  const { cascade, targetConvergences } = input;
  const byGrade: CascadeBlueprintCoherenceVerdict["byGrade"] = {};
  let mismatchCount = 0;
  const summaryParts: string[] = [];

  for (const [gradeStr, node] of Object.entries(cascade.byGrade)) {
    const grade = Number(gradeStr);
    if (!Number.isFinite(grade)) continue;

    // cascade 토큰: subjects + contentSummary 토큰화 (lowercase)
    const cascadeTokens = new Set<string>();
    for (const s of node.subjects) {
      const t = s.trim().toLowerCase();
      if (t.length >= 2) cascadeTokens.add(t);
    }
    for (const tok of node.contentSummary.split(/[\s·,·/()[\]{}"'`~!@#$%^&*+=|<>?-]+/)) {
      const t = tok.trim().toLowerCase();
      if (t.length >= 2) cascadeTokens.add(t);
    }

    // blueprint 토큰: 같은 학년의 targetConvergences themeKeywords + themeLabel
    const bpTokens = new Set<string>();
    for (const conv of targetConvergences) {
      if (conv.grade !== grade) continue;
      for (const kw of conv.themeKeywords ?? []) {
        const t = kw.trim().toLowerCase();
        if (t.length >= 2) bpTokens.add(t);
      }
      for (const tok of (conv.themeLabel ?? "").split(/[\s·,·/()[\]{}"'`~!@#$%^&*+=|<>?-]+/)) {
        const t = tok.trim().toLowerCase();
        if (t.length >= 2) bpTokens.add(t);
      }
    }

    if (bpTokens.size === 0) {
      // 해당 학년의 blueprint 수렴축 자체가 없음 — 비교 불가, 정합성 판정 보류.
      byGrade[grade] = {
        coherent: true,
        overlap: 0,
        cascadeTokens: [...cascadeTokens],
        bpTokens: [],
      };
      continue;
    }

    let overlap = 0;
    for (const t of cascadeTokens) {
      if (bpTokens.has(t)) overlap++;
    }
    const coherent = overlap >= 1;
    byGrade[grade] = {
      coherent,
      overlap,
      cascadeTokens: [...cascadeTokens],
      bpTokens: [...bpTokens],
    };
    if (!coherent) {
      mismatchCount++;
      summaryParts.push(`${grade}학년 토큰 중첩 0`);
    }
  }

  return {
    byGrade,
    mismatchCount,
    summary: mismatchCount === 0 ? "all coherent" : summaryParts.join(", "),
  };
}

/**
 * 수렴축에서 매칭 후보 토큰 추출.
 * themeKeywords 가 비어있으면 themeLabel 을 공백/특수문자 분리로 토큰화.
 */
function collectTokens(conv: BlueprintConvergence): string[] {
  const out: string[] = [];
  if (Array.isArray(conv.themeKeywords) && conv.themeKeywords.length > 0) {
    for (const kw of conv.themeKeywords) {
      if (kw && kw.trim().length >= 2) out.push(kw.trim());
    }
  }
  if (conv.themeLabel) {
    // themeLabel 자체도 후보 (전체 일치 시 충족 신호)
    out.push(conv.themeLabel.trim());
    // 토큰화 폴백 — keywords 가 빈약할 때 보강
    if (out.length < 3) {
      for (const tok of conv.themeLabel.split(/[\s·,·/()[\]{}"'`~!@#$%^&*+=|<>?]+/)) {
        const t = tok.trim();
        if (t.length >= 2) out.push(t);
      }
    }
  }
  return out;
}
