/**
 * WizardData 비교 유틸리티
 *
 * 초기 데이터와 현재 데이터를 비교하여 변경 사항을 감지합니다.
 *
 * 성능 최적화:
 * - 깊은 비교(O(n log n)) → Set 기반 비교(O(n))로 전환
 * - 핵심 스칼라 필드 먼저 비교 (조기 종료)
 * - 배열은 ID Set 비교 (정렬 제거)
 */

import type { WizardData } from "@/lib/schemas/planWizardSchema";

// ============================================================================
// 핵심 스칼라 필드 (가장 자주 변경되는 필드 순서대로)
// ============================================================================
const SCALAR_FIELDS = [
  "name",
  "period_start",
  "period_end",
  "scheduler_type",
  "block_set_id",
  "plan_purpose",
  "target_date",
  "student_level",
  "plan_type",
  "use_slot_mode",
  "allocation_mode",
  "show_required_subjects_ui",
  "camp_template_id",
  "camp_invitation_id",
] as const;

// ============================================================================
// 배열 필드와 고유 키 매핑
// ============================================================================
type ArrayKeyExtractor<T> = (item: T) => string;

const ARRAY_FIELD_KEY_EXTRACTORS: Record<string, ArrayKeyExtractor<unknown>> = {
  student_contents: (item) =>
    (item as { content_id?: string }).content_id ?? "",
  recommended_contents: (item) =>
    (item as { content_id?: string }).content_id ?? "",
  exclusions: (item) =>
    (item as { exclusion_date?: string }).exclusion_date ?? "",
  academy_schedules: (item) => {
    const s = item as {
      day_of_week?: number;
      start_time?: string;
      end_time?: string;
    };
    return `${s.day_of_week ?? ""}-${s.start_time ?? ""}-${s.end_time ?? ""}`;
  },
  subject_allocations: (item) =>
    (item as { subject_id?: string }).subject_id ?? "",
  content_allocations: (item) =>
    (item as { content_id?: string }).content_id ?? "",
  content_slots: (item) =>
    String((item as { slot_index?: number }).slot_index ?? ""),
  daily_schedule: (item) => (item as { date?: string }).date ?? "",
  non_study_time_blocks: (item) => {
    const b = item as {
      type?: string;
      start_time?: string;
      end_time?: string;
    };
    return `${b.type ?? ""}-${b.start_time ?? ""}-${b.end_time ?? ""}`;
  },
};

// ============================================================================
// 객체 필드 (단순 JSON 비교)
// ============================================================================
const OBJECT_FIELDS = [
  "scheduler_options",
  "time_settings",
  "schedule_summary",
  "study_review_cycle",
  "subject_constraints",
  "templateLockedFields",
  "additional_period_reallocation",
] as const;

// ============================================================================
// 배열 비교 함수 (Set 기반, O(n))
// ============================================================================

/**
 * 두 배열의 ID Set이 동일한지 비교
 */
function areArraysEqualByKey<T>(
  a: T[] | undefined | null,
  b: T[] | undefined | null,
  keyExtractor: ArrayKeyExtractor<T>
): boolean {
  // 둘 다 없으면 동일
  if (!a && !b) return true;
  if (!a || !b) return false;

  // 길이가 다르면 다름 (O(1) 조기 종료)
  if (a.length !== b.length) return false;

  // 빈 배열이면 동일
  if (a.length === 0) return true;

  // Set 기반 비교 (O(n))
  const setA = new Set(a.map(keyExtractor));
  return b.every((item) => setA.has(keyExtractor(item)));
}

/**
 * 두 배열이 동일한지 비교 (범위 포함)
 * student_contents, recommended_contents의 경우 범위도 비교
 */
function areContentsEqual(
  a: Array<{
    content_id?: string;
    start_range?: number;
    end_range?: number;
  }> | undefined | null,
  b: Array<{
    content_id?: string;
    start_range?: number;
    end_range?: number;
  }> | undefined | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;

  // content_id + 범위로 키 생성하여 Set 비교
  const createKey = (item: {
    content_id?: string;
    start_range?: number;
    end_range?: number;
  }) => `${item.content_id ?? ""}_${item.start_range ?? 0}_${item.end_range ?? 0}`;

  const setA = new Set(a.map(createKey));
  return b.every((item) => setA.has(createKey(item)));
}

// ============================================================================
// 메인 비교 함수
// ============================================================================

/**
 * 두 WizardData 객체가 동일한지 비교 (최적화된 비교)
 *
 * 성능:
 * - 스칼라 필드: O(1) 비교로 조기 종료
 * - 배열 필드: O(n) Set 기반 비교 (정렬 없음)
 * - 객체 필드: JSON.stringify 비교 (최후 수단)
 *
 * @param a 첫 번째 WizardData 객체
 * @param b 두 번째 WizardData 객체
 * @returns 동일하면 true, 다르면 false
 */
export function isWizardDataEqual(
  a: Partial<WizardData> | null | undefined,
  b: Partial<WizardData> | null | undefined
): boolean {
  // 1단계: 레퍼런스 동일성 체크 (O(1))
  if (a === b) return true;

  // 둘 다 null/undefined이면 동일
  if (!a && !b) return true;

  // 하나만 null/undefined이면 다름
  if (!a || !b) return false;

  // 2단계: 스칼라 필드 빠른 비교 (O(1) * 필드 수)
  for (const field of SCALAR_FIELDS) {
    const aValue = (a as Record<string, unknown>)[field];
    const bValue = (b as Record<string, unknown>)[field];
    if (aValue !== bValue) return false;
  }

  // 3단계: 배열 필드 비교 (O(n))
  // student_contents, recommended_contents는 범위 포함 비교
  if (!areContentsEqual(a.student_contents, b.student_contents)) {
    return false;
  }
  if (!areContentsEqual(a.recommended_contents, b.recommended_contents)) {
    return false;
  }

  // 나머지 배열 필드는 키 기반 비교
  for (const [field, keyExtractor] of Object.entries(ARRAY_FIELD_KEY_EXTRACTORS)) {
    // student_contents, recommended_contents는 이미 비교함
    if (field === "student_contents" || field === "recommended_contents") {
      continue;
    }
    const aArray = (a as Record<string, unknown[]>)[field];
    const bArray = (b as Record<string, unknown[]>)[field];
    if (!areArraysEqualByKey(aArray, bArray, keyExtractor)) {
      return false;
    }
  }

  // 4단계: 객체 필드 비교 (JSON.stringify, 최후 수단)
  for (const field of OBJECT_FIELDS) {
    const aValue = (a as Record<string, unknown>)[field];
    const bValue = (b as Record<string, unknown>)[field];

    // 둘 다 없으면 동일
    if (!aValue && !bValue) continue;

    // 하나만 없으면 다름
    if (!aValue || !bValue) return false;

    // JSON 비교
    if (JSON.stringify(aValue) !== JSON.stringify(bValue)) {
      return false;
    }
  }

  return true;
}

/**
 * WizardData가 변경되었는지 확인
 *
 * @param initial 초기 WizardData
 * @param current 현재 WizardData
 * @returns 변경되었으면 true, 동일하면 false
 */
export function hasWizardDataChanged(
  initial: Partial<WizardData> | null | undefined,
  current: Partial<WizardData> | null | undefined
): boolean {
  return !isWizardDataEqual(initial, current);
}

// ============================================================================
// 레거시 함수 (하위 호환성)
// ============================================================================

/**
 * @deprecated isWizardDataEqual을 사용하세요
 */
export function normalizeWizardDataForComparison(
  data: Partial<WizardData>
): Record<string, unknown> {
  // 레거시 호환을 위해 유지하지만, 새 코드에서는 사용하지 않음
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      normalized[key] = [...value].sort((a, b) => {
        if (
          typeof a === "object" &&
          typeof b === "object" &&
          a !== null &&
          b !== null
        ) {
          const aId = (a as { id?: string }).id || JSON.stringify(a);
          const bId = (b as { id?: string }).id || JSON.stringify(b);
          return aId.localeCompare(bId);
        }
        return String(a).localeCompare(String(b));
      });
    } else if (typeof value === "object") {
      normalized[key] = normalizeWizardDataForComparison(
        value as Partial<WizardData>
      );
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}





