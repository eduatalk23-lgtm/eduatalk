import type { RecordWarning, RecordWarningRuleId } from "./types";

/** DB row — student_record_warning_snapshots */
export interface WarningSnapshot {
  id: string;
  pipeline_id: string;
  pipeline_type: "grade" | "synthesis";
  grade: number | null;
  warnings: RecordWarning[];
  warning_count: number;
  created_at: string;
}

/** 이전 vs 현재 경고 비교 결과 */
export interface WarningDiff {
  /** 이번에 새로 발생한 ruleId */
  newRuleIds: Set<RecordWarningRuleId>;
  /** 이전에 있었지만 해결된 ruleId */
  resolvedRuleIds: Set<RecordWarningRuleId>;
  /** 이전에도 있고 지금도 있는 ruleId */
  persistentRuleIds: Set<RecordWarningRuleId>;
  /** 해결된 경고 상세 (UI 표시용) */
  resolvedWarnings: RecordWarning[];
  /** 비교 기준 이전 스냅샷 */
  previousSnapshot: WarningSnapshot | null;
}

/** 개별 경고의 변화 상태 */
export type WarningChangeStatus = "new" | "persistent" | "resolved";
