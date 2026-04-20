// ============================================
// StudentStateDiff — α4 Perception 전구체 (2026-04-20)
//
// 두 StudentState snapshot 간 변화를 추출하는 순수 함수.
// α4 Perception Trigger 가 이 diff 를 읽어 Proposal Engine 에 입력으로 넘김.
//
// 설계 원칙:
//   - Readonly 입력 → Readonly 출력. 사이드이펙트 없음.
//   - "변화 없음" 도 valid diff (빈 배열, 0 delta).
//   - 필드별 로컬 규칙으로 단순 비교 — 시나리오 분석은 하위 Agent 가 수행.
//
// 주요 소비자 (α4~):
//   - Perception Trigger: staleBlueprint / competencyChanges / hakjongScoreDelta
//   - Proposal Engine: newRecordIds (맥락 업데이트), auxChanges (공동체 기여 변화)
// ============================================

import type {
  StudentState,
  StudentStateDiff,
} from "../types/student-state";
import type {
  CompetencyGrade,
  CompetencyItemCode,
} from "../types/enums";

// ─── 내부 헬퍼 ────────────────────────────────────────────

function gradesEqual(
  a: CompetencyGrade | null,
  b: CompetencyGrade | null,
): boolean {
  return a === b;
}

/** StudentState 에서 참조된 모든 record_id 수집 (narrativeArc + hyperedges + awards). */
function collectRecordIds(state: StudentState): Set<string> {
  const ids = new Set<string>();
  for (const seg of state.narrativeArc) ids.add(seg.recordId);
  for (const he of state.hyperedges) {
    for (const id of he.memberRecordIds) ids.add(id);
  }
  for (const item of state.aux?.awards?.items ?? []) ids.add(item.recordId);
  return ids;
}

function diffCompetencyAxes(
  from: StudentState,
  to: StudentState,
): ReadonlyArray<{
  readonly code: CompetencyItemCode;
  readonly before: CompetencyGrade | null;
  readonly after: CompetencyGrade | null;
}> {
  const fromByCode = new Map<CompetencyItemCode, CompetencyGrade | null>();
  for (const a of from.competencies?.axes ?? []) fromByCode.set(a.code, a.grade);

  const toByCode = new Map<CompetencyItemCode, CompetencyGrade | null>();
  for (const a of to.competencies?.axes ?? []) toByCode.set(a.code, a.grade);

  const allCodes = new Set<CompetencyItemCode>([
    ...fromByCode.keys(),
    ...toByCode.keys(),
  ]);

  const changes: Array<{
    code: CompetencyItemCode;
    before: CompetencyGrade | null;
    after: CompetencyGrade | null;
  }> = [];

  for (const code of allCodes) {
    const before = fromByCode.get(code) ?? null;
    const after = toByCode.get(code) ?? null;
    if (!gradesEqual(before, after)) {
      changes.push({ code, before, after });
    }
  }

  // 결정적 순서 — UI·테스트 재현성. 알파벳 정렬.
  changes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return changes;
}

// ─── 공개 API ────────────────────────────────────────────

/**
 * 두 StudentState snapshot 비교 → StudentStateDiff.
 *
 * staleBlueprint 판정 규칙 (v1, 규칙 기반):
 *   `to.blueprint` 존재 + (newRecordIds 추가 OR competency 변화 발생) +
 *   `to.blueprint.updatedAt <= from.blueprint?.updatedAt ?? ''`
 *   = blueprint 가 갱신되지 않았는데 state 는 움직였음 → 재수립 필요.
 *
 * from/to 의 학생 ID 불일치 여부는 **검증 안 함** — 호출자 책임.
 * asOf.schoolYear/grade/semester 는 from ≤ to 여야 시계열 의미 있음.
 */
export function computeStudentStateDiff(
  from: StudentState,
  to: StudentState,
): StudentStateDiff {
  // hakjongScoreDelta
  const fromTotal = from.hakjongScore?.total ?? null;
  const toTotal = to.hakjongScore?.total ?? null;
  const hakjongScoreDelta =
    fromTotal !== null && toTotal !== null
      ? Math.round((toTotal - fromTotal) * 10) / 10
      : null;

  // competencyChanges
  const competencyChanges = diffCompetencyAxes(from, to);

  // newRecordIds: to 에만 있는 record
  const fromIds = collectRecordIds(from);
  const toIds = collectRecordIds(to);
  const newRecordIds: string[] = [];
  for (const id of toIds) {
    if (!fromIds.has(id)) newRecordIds.push(id);
  }
  newRecordIds.sort();

  // auxChanges
  const volunteerFrom = from.aux?.volunteer?.totalHours ?? 0;
  const volunteerTo = to.aux?.volunteer?.totalHours ?? 0;
  const volunteerHoursDelta = volunteerTo - volunteerFrom;

  const awardsFrom = from.aux?.awards?.items.length ?? 0;
  const awardsTo = to.aux?.awards?.items.length ?? 0;
  const awardsAdded = awardsTo - awardsFrom;

  const integrityFrom = from.aux?.attendance?.integrityScore ?? null;
  const integrityTo = to.aux?.attendance?.integrityScore ?? null;
  const integrityChanged = integrityFrom !== integrityTo;

  // staleBlueprint: to.blueprint 있음 + state 움직임 + blueprint 미갱신
  const toBpUpdatedAt = to.blueprint?.updatedAt ?? null;
  const fromBpUpdatedAt = from.blueprint?.updatedAt ?? null;
  const blueprintNotUpdated =
    toBpUpdatedAt !== null &&
    fromBpUpdatedAt !== null &&
    toBpUpdatedAt === fromBpUpdatedAt;
  const stateShifted =
    newRecordIds.length > 0 ||
    competencyChanges.length > 0 ||
    (hakjongScoreDelta !== null && Math.abs(hakjongScoreDelta) >= 1);
  const staleBlueprint =
    to.blueprint !== null && stateShifted && blueprintNotUpdated;

  return {
    from: from.asOf,
    to: to.asOf,
    hakjongScoreDelta,
    competencyChanges,
    newRecordIds,
    staleBlueprint,
    auxChanges: {
      volunteerHoursDelta,
      awardsAdded,
      integrityChanged,
    },
  };
}
