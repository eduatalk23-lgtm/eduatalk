/**
 * 우회학과 벌크 Insert (배치 500건)
 *
 * Admin client 사용 (RLS 우회).
 * dry-run 지원.
 *
 * 패턴 참조: lib/domains/guide/import/bulk-inserter.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccessDepartmentRow,
  AccessCurriculumRow,
  AccessBypassPairRow,
  AccessClassificationRow,
  ImportDepartmentResult,
} from "../types";

const BATCH_SIZE = 500;

export interface BulkInsertOptions {
  dryRun?: boolean;
  batchSize?: number;
  onProgress?: (done: number, total: number) => void;
}

// ============================================================
// 1. 학과 Import
// ============================================================

/** 학과 벌크 Import */
export async function bulkInsertDepartments(
  adminClient: SupabaseClient,
  rows: AccessDepartmentRow[],
  options: BulkInsertOptions = {},
): Promise<ImportDepartmentResult> {
  const batchSize = options.batchSize ?? BATCH_SIZE;

  const result: ImportDepartmentResult = {
    total: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  if (options.dryRun) {
    result.inserted = rows.length;
    return result;
  }

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const toInsert = batch.map((row) => ({
      legacy_id: parseInt(row.ID, 10),
      university_name: row.대학명.trim(),
      department_name: row.학과.trim(),
      major_classification: row.대분류명?.trim() || null,
      mid_classification: row.중분류명?.trim() || null,
      sub_classification: row.소분류명?.trim() || null,
    }));

    try {
      const { error } = await adminClient
        .from("university_departments")
        .upsert(toInsert, { onConflict: "legacy_id" });

      if (error) throw error;
      result.inserted += batch.length;
    } catch {
      // 배치 실패 시 개별 처리
      for (const item of toInsert) {
        try {
          const { error } = await adminClient
            .from("university_departments")
            .upsert(item, { onConflict: "legacy_id" });
          if (error) throw error;
          result.inserted++;
        } catch (innerErr) {
          result.skipped++;
          result.errors.push({
            legacyId: item.legacy_id,
            error:
              innerErr instanceof Error
                ? innerErr.message
                : JSON.stringify(innerErr),
          });
        }
      }
    }

    options.onProgress?.(
      Math.min(i + batchSize, rows.length),
      rows.length,
    );
  }

  return result;
}

// ============================================================
// 2. 교육과정 Import
// ============================================================

/** 교육과정 벌크 Import */
export async function bulkInsertCurriculum(
  adminClient: SupabaseClient,
  rows: AccessCurriculumRow[],
  legacyIdMap: Map<string, string>,
  options: BulkInsertOptions = {},
): Promise<ImportDepartmentResult> {
  const batchSize = options.batchSize ?? BATCH_SIZE;

  const result: ImportDepartmentResult = {
    total: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  // 학과ID 매핑 적용
  const mapped = rows
    .map((row) => {
      const departmentId = legacyIdMap.get(row.학과ID);
      if (!departmentId) return null;

      return {
        department_id: departmentId,
        legacy_id: parseInt(row.ID, 10) || null,
        course_name: row.과목명.trim(),
        semester: row.학년학기?.trim() || null,
        notes: row.비고?.trim() || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  result.skipped = rows.length - mapped.length;

  if (options.dryRun) {
    result.inserted = mapped.length;
    return result;
  }

  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize);

    try {
      const { error } = await adminClient
        .from("department_curriculum")
        .insert(batch);

      if (error) throw error;
      result.inserted += batch.length;
    } catch {
      for (const item of batch) {
        try {
          const { error } = await adminClient
            .from("department_curriculum")
            .insert(item);
          if (error) throw error;
          result.inserted++;
        } catch (innerErr) {
          result.skipped++;
          result.errors.push({
            legacyId: item.legacy_id ?? 0,
            error:
              innerErr instanceof Error
                ? innerErr.message
                : JSON.stringify(innerErr),
          });
        }
      }
    }

    options.onProgress?.(
      Math.min(i + batchSize, mapped.length),
      mapped.length,
    );
  }

  return result;
}

// ============================================================
// 3. 분류 코드 Import
// ============================================================

/** 분류 코드 벌크 Import */
export async function bulkInsertClassifications(
  adminClient: SupabaseClient,
  rows: AccessClassificationRow[],
  options: BulkInsertOptions = {},
): Promise<ImportDepartmentResult> {
  const result: ImportDepartmentResult = {
    total: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  const toInsert = rows.map((row) => ({
    major_code: row.대분류코드.trim(),
    major_name: row.대분류명.trim(),
    mid_code: row.중분류코드?.trim() || null,
    mid_name: row.중분류명?.trim() || null,
    sub_code: row.소분류코드?.trim() || null,
    sub_name: row.소분류명?.trim() || null,
  }));

  if (options.dryRun) {
    result.inserted = toInsert.length;
    return result;
  }

  try {
    const { error } = await adminClient
      .from("department_classification")
      .insert(toInsert);

    if (error) throw error;
    result.inserted = toInsert.length;
  } catch (err) {
    result.errors.push({
      legacyId: 0,
      error: err instanceof Error ? err.message : JSON.stringify(err),
    });
    result.skipped = toInsert.length;
  }

  return result;
}

// ============================================================
// 4. 우회학과 페어 Import
// ============================================================

/** 우회학과 페어 벌크 Import */
export async function bulkInsertBypassPairs(
  adminClient: SupabaseClient,
  rows: AccessBypassPairRow[],
  legacyIdMap: Map<string, string>,
  options: BulkInsertOptions = {},
): Promise<ImportDepartmentResult> {
  const batchSize = options.batchSize ?? BATCH_SIZE;

  const result: ImportDepartmentResult = {
    total: rows.length,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  // 학과ID 매핑 적용 (우회학과 컬럼도 학과 legacy_id)
  const mapped = rows
    .map((row) => {
      const departmentId = legacyIdMap.get(row.학과ID);
      const bypassDeptId = legacyIdMap.get(row.우회학과);
      if (!departmentId) return null;

      return {
        department_id: departmentId,
        bypass_department_name: row.우회학과.trim(), // legacy_id as fallback name
        bypass_department_id: bypassDeptId ?? null,
        legacy_management_id:
          parseInt(row.우회학과관리ID, 10) || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  result.skipped = rows.length - mapped.length;

  if (options.dryRun) {
    result.inserted = mapped.length;
    return result;
  }

  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize);

    try {
      const { error } = await adminClient
        .from("bypass_major_pairs")
        .insert(batch);

      if (error) throw error;
      result.inserted += batch.length;
    } catch {
      for (const item of batch) {
        try {
          const { error } = await adminClient
            .from("bypass_major_pairs")
            .insert(item);
          if (error) throw error;
          result.inserted++;
        } catch (innerErr) {
          result.skipped++;
          result.errors.push({
            legacyId: item.legacy_management_id ?? 0,
            error:
              innerErr instanceof Error
                ? innerErr.message
                : JSON.stringify(innerErr),
          });
        }
      }
    }

    options.onProgress?.(
      Math.min(i + batchSize, mapped.length),
      mapped.length,
    );
  }

  return result;
}

// ============================================================
// 5. legacy_id → UUID 맵 로드
// ============================================================

/** DB에서 legacy_id → id 매핑 로드 (페이지네이션으로 전체 로드) */
export async function loadLegacyIdMap(
  adminClient: SupabaseClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const PAGE_SIZE = 1000;
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await adminClient
      .from("university_departments")
      .select("id, legacy_id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.legacy_id != null) {
        map.set(String(row.legacy_id), row.id);
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return map;
}
