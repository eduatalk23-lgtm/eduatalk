// ============================================
// capability/cascade-evidence.ts
//
// 옵션 A-2 (M1-c W3, 2026-04-27): cascadePlan LLM 출력의 evidenceFromNeis 검증/대체.
//
// 동기:
//  - LLM 이 NEIS 발췌가 없는 학년에도 "기초 실험 수행" 같은 가짜 evidence 를 만들어내는
//    실측 발견 (인제고 1학년 dry-run, 04-27).
//  - prompt 가드만으로는 100% 차단 어려움 → 코드 후처리로 강제 검증.
//
// 알고리즘:
//  1. 학년 X 의 NEIS 발췌 풀이 비어있으면 → byGrade[X].evidenceFromNeis 를 빈 배열로 강제 비움.
//  2. NEIS 발췌 풀이 있으면 → LLM 이 만든 evidence 각 항목이 실제 발췌 텍스트와 매칭되는지 검증.
//     - 매칭 = 발췌 텍스트에 evidence 의 핵심 토큰(2자 이상)이 1개 이상 포함되거나,
//             evidence 텍스트가 발췌 텍스트의 부분 문자열인 경우.
//  3. 매칭 실패한 항목은 제거 (가짜 evidence 차단).
//  4. LLM 결과가 비어있으면 코드 매칭 풀백으로 NEIS 발췌 풀에서 cascade 노드 키워드와
//     매칭되는 발췌를 자동 채움 (W3 코드 알고리즘).
//
// 본 모듈은 순수 함수 — DB/LLM 의존 0.
// ============================================

import type { CascadePlan, CascadeGradeNode } from "./cascade-plan";
import type { MainTheme } from "./main-theme";

export interface ReconcileInput {
  plan: CascadePlan;
  /** 학년별 NEIS 발췌 — runner 가 capability 호출 시 사용한 동일 dict. */
  neisExtractsByGrade?: Record<number, Array<{ category: string; summary: string }>>;
  /** mainTheme — 폴백 매칭 시 키워드 source. */
  mainTheme?: MainTheme;
}

export interface ReconcileVerdict {
  plan: CascadePlan;
  /** 학년별 변경 사유 — 텔레메트리/디버그용 */
  changes: Array<{
    grade: number;
    action: "cleared" | "filtered" | "auto-filled" | "kept";
    removed?: string[];
    added?: string[];
  }>;
}

/**
 * cascadePlan 의 evidenceFromNeis 를 NEIS 발췌 풀과 정합화.
 * LLM 출력을 입력으로 받아, 가짜 evidence 제거 + 코드 알고리즘 폴백.
 */
export function reconcileCascadeEvidence(input: ReconcileInput): ReconcileVerdict {
  const { plan, neisExtractsByGrade, mainTheme } = input;
  const changes: ReconcileVerdict["changes"] = [];
  const newByGrade: Record<string, CascadeGradeNode> = {};

  for (const [gradeStr, node] of Object.entries(plan.byGrade)) {
    const grade = Number(gradeStr);
    const extracts = neisExtractsByGrade?.[grade] ?? [];
    const hasNeis = extracts.length > 0;
    const llmEvidence = node.evidenceFromNeis ?? [];

    if (!hasNeis) {
      // NEIS 0건 학년 → evidence 강제 비움 (가짜 차단)
      newByGrade[gradeStr] = { ...node, evidenceFromNeis: undefined };
      if (llmEvidence.length > 0) {
        changes.push({
          grade,
          action: "cleared",
          removed: llmEvidence,
        });
      }
      continue;
    }

    // NEIS 있는 학년 — LLM 항목별 매칭 검증
    const haystack = extracts.map((e) => e.summary.toLowerCase());
    const filtered: string[] = [];
    const removed: string[] = [];
    for (const ev of llmEvidence) {
      if (matchesAnyExtract(ev, haystack)) {
        filtered.push(ev);
      } else {
        removed.push(ev);
      }
    }

    if (filtered.length === 0) {
      // 코드 알고리즘 폴백 — cascade 노드 키워드 + mainTheme 키워드로 발췌 매칭
      const tokens = collectMatchingTokens(node, mainTheme);
      const auto: string[] = [];
      for (const ex of extracts) {
        if (auto.length >= 4) break;
        if (textContainsAnyToken(ex.summary, tokens)) {
          auto.push(`[${ex.category}] ${ex.summary.slice(0, 80)}`);
        }
      }
      newByGrade[gradeStr] = {
        ...node,
        evidenceFromNeis: auto.length > 0 ? auto : undefined,
      };
      changes.push({
        grade,
        action: auto.length > 0 ? "auto-filled" : "cleared",
        removed: removed.length > 0 ? removed : undefined,
        added: auto.length > 0 ? auto : undefined,
      });
    } else {
      newByGrade[gradeStr] = { ...node, evidenceFromNeis: filtered };
      if (removed.length > 0) {
        changes.push({
          grade,
          action: "filtered",
          removed,
        });
      } else {
        changes.push({ grade, action: "kept" });
      }
    }
  }

  return {
    plan: { ...plan, byGrade: newByGrade },
    changes,
  };
}

/**
 * evidence 항목이 NEIS 발췌 풀과 매칭되는가.
 * - 직접 부분 문자열 매칭 (양방향)
 * - 또는 evidence 의 의미있는 토큰(2자 이상 명사구 후보)이 발췌에 포함
 */
function matchesAnyExtract(evidence: string, haystack: string[]): boolean {
  const ev = evidence.toLowerCase().trim();
  if (ev.length === 0) return false;
  for (const text of haystack) {
    if (text.length === 0) continue;
    if (text.includes(ev) || ev.includes(text)) return true;
    // 토큰 매칭 — evidence 가 짧은 라벨일 때
    const tokens = ev.split(/[\s·,·/()[\]{}"'`~!@#$%^&*+=|<>?-]+/).filter((t) => t.length >= 2);
    let hits = 0;
    for (const tok of tokens) {
      if (text.includes(tok)) hits++;
    }
    // 토큰 50% 이상 매칭이면 evidence 가 그 발췌를 압축한 것으로 인정
    if (tokens.length > 0 && hits / tokens.length >= 0.5) return true;
  }
  return false;
}

function collectMatchingTokens(
  node: CascadeGradeNode,
  mainTheme: MainTheme | undefined,
): string[] {
  const out = new Set<string>();
  for (const subj of node.subjects) {
    if (subj.length >= 2) out.add(subj.toLowerCase());
  }
  for (const tok of node.contentSummary.split(/[\s·,·/()[\]{}"'`~!@#$%^&*+=|<>?-]+/)) {
    const t = tok.trim().toLowerCase();
    if (t.length >= 2) out.add(t);
  }
  for (const kw of mainTheme?.keywords ?? []) {
    if (kw.length >= 2) out.add(kw.toLowerCase());
  }
  return Array.from(out);
}

function textContainsAnyToken(text: string, tokens: string[]): boolean {
  const t = text.toLowerCase();
  for (const tok of tokens) {
    if (tok.length >= 2 && t.includes(tok)) return true;
  }
  return false;
}
