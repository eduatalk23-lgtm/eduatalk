// ============================================
// 메인 탐구 semantic_role 결정 — Phase α Step 2.5
//
// 모델 C 동적 위계 (session-handoff-2026-04-15-c):
//   1. pinnedByConsultant=true                                → 'consultant_pin'
//   2. direction='analysis'                                    → 'aggregation_target'
//   3. direction='design' × grade=1 × 선행 분석 없음           → 'hypothesis_root'
//   4. direction='design' × (grade≥2 OR 선행 분석 있음)        → 'hybrid_recursion'
// ============================================

import {
  getActiveMainExploration,
  type MainExplorationDirection,
  type MainExplorationScope,
  type MainExplorationSemanticRole,
} from "../repository/main-exploration-repository";

// ============================================
// 1. 순수 함수 — 입력 플래그 → role
// ============================================

export interface ResolveSemanticRoleInput {
  direction: MainExplorationDirection;
  grade: 1 | 2 | 3;
  hasPriorAnalysis: boolean;
  pinnedByConsultant?: boolean;
}

export function resolveSemanticRole(
  input: ResolveSemanticRoleInput,
): MainExplorationSemanticRole {
  if (input.pinnedByConsultant) return "consultant_pin";
  if (input.direction === "analysis") return "aggregation_target";
  // direction === 'design'
  if (input.grade === 1 && !input.hasPriorAnalysis) return "hypothesis_root";
  return "hybrid_recursion";
}

// ============================================
// 2. DB 조회 기반 자동 해석
// ============================================

export interface ResolveSemanticRoleForStudentInput {
  studentId: string;
  tenantId: string;
  direction: MainExplorationDirection;
  grade: 1 | 2 | 3;
  pinnedByConsultant?: boolean;
  scope?: MainExplorationScope;
  trackLabel?: string | null;
}

/**
 * 학생의 현재 DB 상태로 semantic_role 자동 해석.
 *   direction='design' 일 때 동일 scope/track 의 analysis 활성본 존재로 hasPriorAnalysis 추론.
 */
export async function resolveSemanticRoleForStudent(
  input: ResolveSemanticRoleForStudentInput,
): Promise<MainExplorationSemanticRole> {
  if (input.pinnedByConsultant) return "consultant_pin";
  if (input.direction === "analysis") return "aggregation_target";

  const analysisActive = await getActiveMainExploration(
    input.studentId,
    input.tenantId,
    {
      scope: input.scope ?? "overall",
      trackLabel: input.trackLabel ?? null,
      direction: "analysis",
    },
  );

  return resolveSemanticRole({
    direction: input.direction,
    grade: input.grade,
    hasPriorAnalysis: analysisActive != null,
  });
}
