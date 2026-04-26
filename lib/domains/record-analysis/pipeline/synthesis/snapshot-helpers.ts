// ============================================
// snapshot-helpers — student_state_snapshots.snapshot_data 안전 추출 헬퍼
//
// `as unknown as { hakjongScore?: ... }` 이중 캐스팅이 4개 phase 에 반복되어
// 단일 헬퍼로 추출. 런타임 타입 가드 포함.
//
// 소비처: phase-s3-diagnosis, phase-s5-strategy, phase-s6-interview,
//         llm/load-hakjong-score-section
// ============================================

import type { HakjongScore } from "@/lib/domains/student-record/types/student-state";

/**
 * snapshot_data(JSONB) 에서 hakjongScore 필드를 안전하게 추출한다.
 *
 * @param snapshotData - PersistedStudentStateSnapshot.snapshot_data (Json)
 * @returns HakjongScore (있으면) / null (필드는 있지만 미계산) / undefined (snapshot 자체 부재)
 */
export function parseSnapshotHakjongScore(
  snapshotData: unknown,
): HakjongScore | null | undefined {
  if (!snapshotData || typeof snapshotData !== "object") return undefined;
  const state = snapshotData as { hakjongScore?: HakjongScore | null };
  return state.hakjongScore ?? null;
}
