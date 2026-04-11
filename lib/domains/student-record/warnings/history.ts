import type { RecordWarning, RecordWarningRuleId } from "./types";
import type { WarningDiff, WarningChangeStatus, WarningSnapshot } from "./history-types";

/**
 * 현재 경고와 이전 스냅샷을 비교하여 diff를 계산한다.
 * ruleId 기준 Set 연산 — O(n).
 *
 * previousSnapshot이 null이면 (첫 실행) 모든 경고가 "persistent"로 처리.
 */
export function computeWarningDiff(
  current: RecordWarning[],
  previousSnapshot: WarningSnapshot | null,
): WarningDiff {
  const empty: WarningDiff = {
    newRuleIds: new Set(),
    resolvedRuleIds: new Set(),
    persistentRuleIds: new Set(),
    resolvedWarnings: [],
    previousSnapshot: null,
  };

  if (!previousSnapshot) {
    // 비교 대상 없음 — 모두 persistent
    for (const w of current) {
      empty.persistentRuleIds.add(w.ruleId);
    }
    return empty;
  }

  const currentIds = new Set<RecordWarningRuleId>(current.map((w) => w.ruleId));
  const prevIds = new Set<RecordWarningRuleId>(previousSnapshot.warnings.map((w) => w.ruleId));

  const newRuleIds = new Set<RecordWarningRuleId>();
  const resolvedRuleIds = new Set<RecordWarningRuleId>();
  const persistentRuleIds = new Set<RecordWarningRuleId>();

  // 현재 경고 분류: 신규 vs 지속
  for (const id of currentIds) {
    if (prevIds.has(id)) {
      persistentRuleIds.add(id);
    } else {
      newRuleIds.add(id);
    }
  }

  // 이전에만 있던 것 = 해결됨
  const resolvedWarnings: RecordWarning[] = [];
  for (const w of previousSnapshot.warnings) {
    if (!currentIds.has(w.ruleId) && !resolvedRuleIds.has(w.ruleId)) {
      resolvedRuleIds.add(w.ruleId);
      resolvedWarnings.push(w);
    }
  }

  return {
    newRuleIds,
    resolvedRuleIds,
    persistentRuleIds,
    resolvedWarnings,
    previousSnapshot,
  };
}

/**
 * 개별 경고의 변화 상태를 반환한다.
 * diff가 null이면 "persistent" (비교 불가).
 */
export function getWarningChangeStatus(
  ruleId: RecordWarningRuleId,
  diff: WarningDiff | null,
): WarningChangeStatus {
  if (!diff) return "persistent";
  if (diff.newRuleIds.has(ruleId)) return "new";
  if (diff.resolvedRuleIds.has(ruleId)) return "resolved";
  return "persistent";
}
