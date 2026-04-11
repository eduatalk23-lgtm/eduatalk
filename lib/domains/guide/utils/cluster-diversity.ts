/**
 * 클러스터 다양성 유틸리티 (L3)
 *
 * 추천/검색 결과에서 특정 클러스터 편중을 방지합니다.
 * round-robin 방식으로 클러스터를 교대 선택하여 결과를 분산합니다.
 *
 * @example
 * ```typescript
 * const diversified = diversifyByCluster(guides, g => g.topic_cluster_id, 5);
 * ```
 */

/**
 * 아이템 배열을 클러스터 기준 round-robin으로 분산합니다.
 *
 * 동작:
 * 1. 클러스터별 그룹으로 분류 (null 클러스터는 독립 그룹)
 * 2. 각 그룹 내 원래 순서 유지 (입력 배열의 정렬 보존)
 * 3. 그룹 크기 내림차순 → round-robin으로 1개씩 교대 추출
 * 4. limit에 도달하면 종료
 *
 * @param items 정렬된 입력 배열 (match_reason, similarity 등으로 이미 정렬됨)
 * @param getClusterId 아이템에서 클러스터 ID를 추출하는 함수
 * @param limit 최대 반환 개수
 * @param maxPerCluster 클러스터당 최대 개수 (기본: ceil(limit * 0.6))
 */
export function diversifyByCluster<T>(
  items: T[],
  getClusterId: (item: T) => string | null | undefined,
  limit: number,
  maxPerCluster?: number,
): T[] {
  if (items.length <= limit) return items;

  const effectiveMax = maxPerCluster ?? Math.ceil(limit * 0.6);

  // 클러스터별 그룹화 (원래 순서 유지)
  const groups = new Map<string, T[]>();
  const NULL_KEY = "__no_cluster__";

  for (const item of items) {
    const clusterId = getClusterId(item) ?? NULL_KEY;
    const group = groups.get(clusterId);
    if (group) {
      group.push(item);
    } else {
      groups.set(clusterId, [item]);
    }
  }

  // 그룹 크기 내림차순 정렬 (큰 그룹 먼저 → round-robin에서 공평하게 분배)
  const sortedGroups = [...groups.values()].sort(
    (a, b) => b.length - a.length,
  );

  // Round-robin 추출
  const result: T[] = [];
  const groupIndices = new Array(sortedGroups.length).fill(0) as number[];
  const groupCounts = new Array(sortedGroups.length).fill(0) as number[];

  while (result.length < limit) {
    let added = false;
    for (let g = 0; g < sortedGroups.length; g++) {
      if (result.length >= limit) break;
      const group = sortedGroups[g];
      if (
        groupIndices[g] < group.length &&
        groupCounts[g] < effectiveMax
      ) {
        result.push(group[groupIndices[g]]);
        groupIndices[g]++;
        groupCounts[g]++;
        added = true;
      }
    }
    if (!added) break; // 모든 그룹 소진 또는 maxPerCluster 도달
  }

  // maxPerCluster 제한으로 limit 미달 시, 남은 아이템에서 보충
  if (result.length < limit) {
    const resultSet = new Set(result);
    for (const item of items) {
      if (result.length >= limit) break;
      if (!resultSet.has(item)) {
        result.push(item);
        resultSet.add(item);
      }
    }
  }

  return result;
}
