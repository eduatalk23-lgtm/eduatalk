// ============================================
// Phase 2 Step 5 (2026-04-14) — Narrative Arc 기반 F10/M1 재계산
// ============================================
//
// 기존 휴리스틱(PATTERN_MAP["F10_성장부재"] / M1_교사관찰불가)은 LLM이 content_quality.issues[]에
// 코드를 삽입했을 때만 작동. Layer 3 narrative_arc가 등장하면서 레코드 단위
// growth_narrative_present / teacher_observation_present 불리언을 직접 사용하는 쪽이 더 정확.
//
// - narrativeArcs 제공 시: 이 체커가 F10/M1 발행, 기존 PATTERN_MAP의 F10/M1은 스킵 (engine에서 제어)
// - narrativeArcs 미제공 시: 기존 휴리스틱이 fallback으로 작동
//
// 스코프: setek + personal_setek (F10/M1의 `setek_*` ruleId 일관성 유지)

import type { RecordWarning } from "./types";

export interface NarrativeArcRow {
  record_type: "setek" | "personal_setek" | "changche" | "haengteuk";
  record_id: string;
  grade: number;
  growth_narrative_present: boolean;
  teacher_observation_present: boolean;
  stages_present_count: number | null;
}

// ≥3건 누락 시 발행 (기존 issues 기반 단일 발행 패턴 유지)
const ABSENCE_THRESHOLD = 3;

/**
 * 세특/개인세특 narrative_arc 기반으로 F10(성장부재)/M1(교사관찰불가) 경고 계산.
 * 각 ruleId는 학생당 1회만 발행 (기존 PATTERN_MAP 동작 일치).
 */
export function checkNarrativeArc(narrativeArcs: NarrativeArcRow[]): RecordWarning[] {
  const warnings: RecordWarning[] = [];
  const setekArcs = narrativeArcs.filter(
    (a) => a.record_type === "setek" || a.record_type === "personal_setek",
  );

  if (setekArcs.length === 0) return warnings;

  const growthAbsent = setekArcs.filter((a) => !a.growth_narrative_present);
  const teacherAbsent = setekArcs.filter((a) => !a.teacher_observation_present);

  if (growthAbsent.length >= ABSENCE_THRESHOLD) {
    const grades = Array.from(new Set(growthAbsent.map((a) => a.grade))).sort();
    warnings.push({
      ruleId: "setek_no_growth_curve",
      severity: "medium",
      category: "quality",
      title: "학년 간 성장 곡선 부재",
      message: `세특 ${setekArcs.length}건 중 ${growthAbsent.length}건에서 성장 서사(⑦)가 확인되지 않습니다 (${grades.join(", ")}학년 포함)`,
      suggestion:
        "학년이 올라갈수록 탐구 깊이가 심화되어야 합니다 (고1 넓은→고2 심화→고3 확장+제언). 세특마다 '무엇을 배웠고 어떻게 변화했는가'를 한 문장 이상 남기세요",
    });
  }

  if (teacherAbsent.length >= ABSENCE_THRESHOLD) {
    warnings.push({
      ruleId: "setek_teacher_unobservable",
      severity: "medium",
      category: "quality",
      title: "교사 관찰 불가 표현",
      message: `세특 ${setekArcs.length}건 중 ${teacherAbsent.length}건에 교사 직접 관찰(⑥)이 누락되었습니다`,
      suggestion:
        '"~다짐함", "~생각함", "~깨닫게 됨" 등 교사가 관찰할 수 없는 내면 상태 대신, 행동·발표·산출물 관찰 중심으로 기술하세요',
    });
  }

  return warnings;
}

/** narrative_arc 제공 시 기존 issues 기반 F10/M1을 스킵하기 위한 판별 */
export function hasNarrativeArcSignal(narrativeArcs?: NarrativeArcRow[]): boolean {
  if (!narrativeArcs || narrativeArcs.length === 0) return false;
  return narrativeArcs.some(
    (a) => a.record_type === "setek" || a.record_type === "personal_setek",
  );
}
