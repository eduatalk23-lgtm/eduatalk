/**
 * 학부모 관리 관련 상수 정의
 */

import type { ParentRelation } from "@/lib/domains/parent/types";

/**
 * 학부모 관계 라벨
 */
export const PARENT_RELATION_LABELS: Record<ParentRelation, string> = {
  father: "아버지",
  mother: "어머니",
  guardian: "보호자",
  other: "기타",
} as const;

/**
 * 학부모 관계 옵션 (select 등에서 사용)
 */
export const PARENT_RELATION_OPTIONS: Array<{
  value: ParentRelation;
  label: string;
}> = [
  { value: "father", label: "아버지" },
  { value: "mother", label: "어머니" },
  { value: "guardian", label: "보호자" },
  { value: "other", label: "기타" },
] as const;
