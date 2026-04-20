// ============================================
// Perception Trigger — α4 Agent Core 전구체 (2026-04-20)
//
// StudentStateDiff → 자율 Proposal Engine 기동 여부 + 심각도 판정.
// computeStudentStateDiff 의 직접 소비자.
//
// 설계 원칙:
//   - 순수 함수. I/O 없음. 규칙 기반 임계값 (v1).
//   - v2 (학습 기반 임계값 튜닝) 는 실측 누적 후 재검토 — 별도 함수로 추가 예정.
//   - shouldTrigger = severity ≠ 'none'.
//
// 임계값 (v1 규칙):
//   · high:   staleBlueprint || |hakjongScoreDelta| ≥ 5
//   · medium: |hakjongScoreDelta| ≥ 2 || competency 2축 이상 변화 || newRecords ≥ 3
//             || volunteerHours ≥ 10 || awardsAdded ≥ 1
//   · low:    competency 1축 변화 || newRecords 1~2 || integrityChanged
//             || volunteerHours 1~9
//   · none:   변화 없음
//
// 소비자 (α4~):
//   - Perception Trigger scheduler: shouldTrigger=true 시 Proposal Engine 기동
//   - 통지: severity=high 는 즉시, medium 은 일 1회, low 는 주 1회 등 정책 분리
// ============================================

import type { StudentStateDiff } from "../types/student-state";

export type TriggerSeverity = "none" | "low" | "medium" | "high";

export type TriggerSignalKind =
  | "stale_blueprint"
  | "hakjong_delta"
  | "competency_change"
  | "new_records"
  | "volunteer_hours"
  | "awards"
  | "integrity";

export interface TriggerSignal {
  readonly kind: TriggerSignalKind;
  readonly weight: "low" | "medium" | "high";
  readonly detail: string;
}

export interface PerceptionTriggerResult {
  readonly shouldTrigger: boolean;
  readonly severity: TriggerSeverity;
  readonly reasons: readonly string[];  // UI/로그용 한국어 요약
  readonly signals: readonly TriggerSignal[];
}

// ─── 임계값 상수 (v1) ────────────────────────────────────

const HAKJONG_DELTA_HIGH = 5;
const HAKJONG_DELTA_MEDIUM = 2;
const COMPETENCY_CHANGES_MEDIUM = 2;
const NEW_RECORDS_MEDIUM = 3;
const VOLUNTEER_HOURS_MEDIUM = 10;
const AWARDS_ADDED_MEDIUM = 1;

// ─── 내부 헬퍼 ────────────────────────────────────────────

const SEVERITY_ORDER: Record<TriggerSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function maxSeverity(
  a: TriggerSeverity,
  b: TriggerSeverity,
): TriggerSeverity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

// ─── 공개 API ────────────────────────────────────────────

/**
 * StudentStateDiff → 자율 Agent Perception Trigger 판정.
 *
 * @param diff computeStudentStateDiff 결과
 * @returns shouldTrigger / severity / reasons / signals
 */
export function computePerceptionTrigger(
  diff: StudentStateDiff,
): PerceptionTriggerResult {
  const signals: TriggerSignal[] = [];
  const reasons: string[] = [];
  let severity: TriggerSeverity = "none";

  // 1. staleBlueprint — 가장 강한 신호 (high)
  if (diff.staleBlueprint) {
    signals.push({
      kind: "stale_blueprint",
      weight: "high",
      detail: "청사진 갱신 이후 학생 상태 변화",
    });
    reasons.push("청사진 재수립 필요 — 상태 변화에도 blueprint 미갱신");
    severity = maxSeverity(severity, "high");
  }

  // 2. hakjongScoreDelta
  if (diff.hakjongScoreDelta !== null) {
    const abs = Math.abs(diff.hakjongScoreDelta);
    if (abs >= HAKJONG_DELTA_HIGH) {
      signals.push({
        kind: "hakjong_delta",
        weight: "high",
        detail: `학종 Reward ${diff.hakjongScoreDelta > 0 ? "+" : ""}${diff.hakjongScoreDelta}점 변화`,
      });
      reasons.push(
        `학종 Reward ${diff.hakjongScoreDelta > 0 ? "상승" : "하락"} ${abs}점 (HIGH)`,
      );
      severity = maxSeverity(severity, "high");
    } else if (abs >= HAKJONG_DELTA_MEDIUM) {
      signals.push({
        kind: "hakjong_delta",
        weight: "medium",
        detail: `학종 Reward ${diff.hakjongScoreDelta > 0 ? "+" : ""}${diff.hakjongScoreDelta}점 변화`,
      });
      reasons.push(
        `학종 Reward ${diff.hakjongScoreDelta > 0 ? "상승" : "하락"} ${abs}점`,
      );
      severity = maxSeverity(severity, "medium");
    }
  }

  // 3. competency 변화
  const cc = diff.competencyChanges.length;
  if (cc >= COMPETENCY_CHANGES_MEDIUM) {
    signals.push({
      kind: "competency_change",
      weight: "medium",
      detail: `역량 ${cc}축 변화`,
    });
    reasons.push(`역량 ${cc}축 변화 — 설계 재평가 가치`);
    severity = maxSeverity(severity, "medium");
  } else if (cc === 1) {
    const c = diff.competencyChanges[0];
    signals.push({
      kind: "competency_change",
      weight: "low",
      detail: `${c.code}: ${c.before ?? "—"} → ${c.after ?? "—"}`,
    });
    reasons.push(`역량 1축 변화 (${c.code})`);
    severity = maxSeverity(severity, "low");
  }

  // 4. newRecordIds
  const nr = diff.newRecordIds.length;
  if (nr >= NEW_RECORDS_MEDIUM) {
    signals.push({
      kind: "new_records",
      weight: "medium",
      detail: `신규 기록 ${nr}건`,
    });
    reasons.push(`신규 기록 ${nr}건 — 맥락 업데이트 필요`);
    severity = maxSeverity(severity, "medium");
  } else if (nr >= 1) {
    signals.push({
      kind: "new_records",
      weight: "low",
      detail: `신규 기록 ${nr}건`,
    });
    reasons.push(`신규 기록 ${nr}건`);
    severity = maxSeverity(severity, "low");
  }

  // 5. aux — volunteer hours
  const vh = diff.auxChanges.volunteerHoursDelta;
  if (vh >= VOLUNTEER_HOURS_MEDIUM) {
    signals.push({
      kind: "volunteer_hours",
      weight: "medium",
      detail: `봉사 ${vh}시간 증가`,
    });
    reasons.push(`봉사 시간 ${vh}h 증가 — 공동체 역량 기여 재평가`);
    severity = maxSeverity(severity, "medium");
  } else if (vh >= 1) {
    signals.push({
      kind: "volunteer_hours",
      weight: "low",
      detail: `봉사 ${vh}시간 증가`,
    });
    reasons.push(`봉사 시간 ${vh}h 증가`);
    severity = maxSeverity(severity, "low");
  }

  // 6. aux — awards
  const aa = diff.auxChanges.awardsAdded;
  if (aa >= AWARDS_ADDED_MEDIUM) {
    signals.push({
      kind: "awards",
      weight: "medium",
      detail: `수상 ${aa}건 추가`,
    });
    reasons.push(`수상 ${aa}건 추가`);
    severity = maxSeverity(severity, "medium");
  }

  // 7. aux — integrity (binary)
  if (diff.auxChanges.integrityChanged) {
    signals.push({
      kind: "integrity",
      weight: "low",
      detail: "출결 무결점 변화",
    });
    reasons.push("출결 무결점 변화");
    severity = maxSeverity(severity, "low");
  }

  return {
    shouldTrigger: severity !== "none",
    severity,
    reasons,
    signals,
  };
}
