// ============================================
// β+1 PriorityOrder — MidPlan.recordPriorityOverride 소비 유틸 (2026-04-24)
//
// MidPlanner(post-P3.5) 가 판정한 recordId → priority(0~100) 맵을 레코드 배열에
// 적용해 "높은 priority 먼저" 순으로 정렬한다. 소비처는 P9 draft_refinement
// (`pending.slice(0, chunkSize)` 청크 경계 전). 타 러너는 β+2 예정.
//
// 계약:
// - priority 미지정 레코드는 중간값(50) 취급 → 지정 레코드만 앞으로, 나머지는 원래 상대 순서 유지(stable).
// - priority map 이 undefined/empty → 원본 배열 그대로 반환 (graceful).
// - 레코드 식별 키는 record_id 또는 id — P9 pending(record_id) 과 기타(id) 양쪽 대응.
// ============================================

const DEFAULT_PRIORITY = 50;

type PriorityKey = "record_id" | "id";

function readKey<T extends Record<string, unknown>>(row: T): string | undefined {
  const key = (row.record_id ?? row.id) as string | undefined;
  return typeof key === "string" ? key : undefined;
}

/**
 * 레코드 배열을 `recordPriorityOverride` 기준 내림차순으로 재정렬한다.
 * 동점·미지정은 원본 상대 순서를 유지(stable sort).
 *
 * @param records 레코드 배열 (record_id 또는 id 필드 보유)
 * @param priority MidPlan.recordPriorityOverride — recordId → 0~100 score
 * @returns 새 배열. priority 없거나 빈 map 이면 원본과 동일한 내용의 새 배열.
 */
export function orderRecordsByPriority<
  T extends ({ record_id: string } | { id: string }) & Record<string, unknown>,
>(records: T[], priority: Record<string, number> | undefined | null): T[] {
  if (!records.length) return records.slice();
  if (!priority || Object.keys(priority).length === 0) return records.slice();

  return records
    .map((row, index) => ({ row, index, score: priority[readKey(row) ?? ""] ?? DEFAULT_PRIORITY }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map((w) => w.row);
}

export const PRIORITY_ORDER_DEFAULT = DEFAULT_PRIORITY;
export type { PriorityKey };
