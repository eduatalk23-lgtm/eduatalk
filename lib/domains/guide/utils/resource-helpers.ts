/**
 * outline resource 항목 정규화 헬퍼
 *
 * 기존 string[] 데이터와 새 ResourceItem[] 데이터를 모두 처리
 */

import type { ResourceItem } from "../types";

/** string 또는 ResourceItem을 ResourceItem으로 정규화 */
export function normalizeResource(
  item: string | ResourceItem,
): ResourceItem {
  if (typeof item === "string") {
    return { description: item };
  }
  return item;
}

/** resources 배열 전체를 정규화 */
export function normalizeResources(
  resources?: (string | ResourceItem)[],
): ResourceItem[] {
  if (!resources?.length) return [];
  return resources.map(normalizeResource);
}

/** ResourceItem에서 URL이 있는지 확인 */
export function hasResourceUrl(item: ResourceItem): boolean {
  return !!item.url && item.url.trim().length > 0;
}
