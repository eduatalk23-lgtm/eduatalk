/**
 * 가이드 벌크 Insert (배치 500건, 트랜잭션)
 *
 * Admin client 사용 (RLS 우회).
 * dry-run 지원.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ImportBatchResult,
  ImportMatchResult,
} from "../types";
import { transformAccessRow, type TransformResult } from "./transformer";
import {
  SubjectMatcher,
  CareerFieldMatcher,
  type SubjectRecord,
  type CareerFieldRecord,
} from "./subject-matcher";
import type { AccessGuideRow } from "../types";

const BATCH_SIZE = 500;

export interface BulkInsertOptions {
  dryRun?: boolean;
  batchSize?: number;
  onProgress?: (done: number, total: number) => void;
}

/** 가이드 벌크 Import 실행 */
export async function bulkInsertGuides(
  adminClient: SupabaseClient,
  rows: AccessGuideRow[],
  options: BulkInsertOptions = {},
): Promise<ImportBatchResult> {
  const batchSize = options.batchSize ?? BATCH_SIZE;

  // 참조 데이터 로드
  const [subjectsRes, careerFieldsRes] = await Promise.all([
    adminClient.from("subjects").select("id, name"),
    adminClient.from("exploration_guide_career_fields").select("id, code, name_kor"),
  ]);

  const subjects: SubjectRecord[] = subjectsRes.data ?? [];
  const careerFields: CareerFieldRecord[] = careerFieldsRes.data ?? [];

  const subjectMatcher = new SubjectMatcher(subjects);
  const careerFieldMatcher = new CareerFieldMatcher(careerFields);

  // 변환 + 매칭
  const transformed: Array<{
    row: AccessGuideRow;
    result: TransformResult;
    match: ImportMatchResult;
  }> = [];

  let subjectMatchCount = 0;
  let careerFieldMatchCount = 0;

  for (const row of rows) {
    const result = transformAccessRow(row);
    const careerFieldIds = careerFieldMatcher.match(result.originalCareerField);

    // 쉼표 구분 복수 과목 각각 매칭
    const subjectParts = result.originalSubjectName
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const matchedSubjects: Array<{ subjectId: string; subjectName: string }> = [];
    const unmatchedSubjects: string[] = [];

    for (const part of subjectParts) {
      const sm = subjectMatcher.match(part);
      if (sm.matched && sm.subjectId && sm.subjectName) {
        // 중복 제거
        if (!matchedSubjects.some((m) => m.subjectId === sm.subjectId)) {
          matchedSubjects.push({ subjectId: sm.subjectId, subjectName: sm.subjectName });
        }
      } else {
        unmatchedSubjects.push(part);
      }
    }

    const match: ImportMatchResult = {
      legacyId: row.ID,
      title: result.guide.title,
      matchedSubjects,
      unmatchedSubjects,
      originalSubjectName: result.originalSubjectName,
      careerFieldMatched: careerFieldIds.length > 0,
      matchedCareerFieldIds: careerFieldIds,
      errors: [],
    };

    if (matchedSubjects.length > 0) subjectMatchCount++;
    if (careerFieldIds.length > 0) careerFieldMatchCount++;

    transformed.push({ row, result, match });
  }

  const batchResult: ImportBatchResult = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    subjectMatchRate: rows.length > 0 ? Math.round((subjectMatchCount / rows.length) * 1000) / 10 : 0,
    careerFieldMatchRate: rows.length > 0 ? Math.round((careerFieldMatchCount / rows.length) * 1000) / 10 : 0,
  };

  if (options.dryRun) {
    batchResult.inserted = transformed.length;
    return batchResult;
  }

  // 배치 처리
  for (let i = 0; i < transformed.length; i += batchSize) {
    const batch = transformed.slice(i, i + batchSize);

    try {
      await processBatch(adminClient, batch);
      batchResult.inserted += batch.length;
    } catch {
      // 배치 실패 시 개별 처리
      for (const item of batch) {
        try {
          await processBatch(adminClient, [item]);
          batchResult.inserted++;
        } catch (innerErr) {
          batchResult.skipped++;
          batchResult.errors.push({
            legacyId: item.row.ID,
            error: innerErr instanceof Error ? innerErr.message : JSON.stringify(innerErr),
          });
        }
      }
    }

    options.onProgress?.(Math.min(i + batchSize, transformed.length), transformed.length);
  }

  return batchResult;
}

/** 단일 배치 처리 */
async function processBatch(
  client: SupabaseClient,
  items: Array<{
    row: AccessGuideRow;
    result: TransformResult;
    match: ImportMatchResult;
  }>,
): Promise<void> {
  // 1. 가이드 메타 UPSERT
  const guidesToInsert = items.map((item) => ({
    legacy_id: item.result.guide.legacyId,
    tenant_id: null,
    guide_type: item.result.guide.guideType,
    curriculum_year: item.result.guide.curriculumYear ?? null,
    subject_select: item.result.guide.subjectSelect ?? null,
    unit_major: item.result.guide.unitMajor ?? null,
    unit_minor: item.result.guide.unitMinor ?? null,
    title: item.result.guide.title,
    book_title: item.result.guide.bookTitle ?? null,
    book_author: item.result.guide.bookAuthor ?? null,
    book_publisher: item.result.guide.bookPublisher ?? null,
    book_year: item.result.guide.bookYear ?? null,
    status: "approved",
    source_type: "imported",
    content_format: "plain",
  }));

  const { data: guides, error: guideErr } = await client
    .from("exploration_guides")
    .upsert(guidesToInsert, { onConflict: "legacy_id" })
    .select("id, legacy_id");

  if (guideErr) throw guideErr;
  if (!guides) throw new Error("가이드 INSERT 결과 없음");

  // legacy_id → guide_id 매핑
  const legacyToId = new Map<number, string>();
  for (const g of guides) {
    if (g.legacy_id != null) {
      legacyToId.set(g.legacy_id, g.id);
    }
  }

  // 2. 본문 UPSERT
  const contentToInsert = items
    .map((item) => {
      const guideId = legacyToId.get(item.result.guide.legacyId!);
      if (!guideId) return null;

      return {
        guide_id: guideId,
        motivation: item.result.content.motivation ?? null,
        theory_sections: item.result.content.theorySections ?? [],
        reflection: item.result.content.reflection ?? null,
        impression: item.result.content.impression ?? null,
        summary: item.result.content.summary ?? null,
        follow_up: item.result.content.followUp ?? null,
        book_description: item.result.content.bookDescription ?? null,
        related_papers: item.result.content.relatedPapers ?? [],
        related_books: item.result.content.relatedBooks ?? [],
        image_paths: item.result.content.imagePaths ?? [],
        guide_url: item.result.content.guideUrl ?? null,
        setek_examples: item.result.content.setekExamples ?? [],
        raw_source: item.result.content.rawSource ?? null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (contentToInsert.length > 0) {
    const { error: contentErr } = await client
      .from("exploration_guide_content")
      .upsert(contentToInsert, { onConflict: "guide_id" });
    if (contentErr) throw contentErr;
  }

  // 3. 과목 매핑 (기존 삭제 → 재생성)
  const subjectMappings: Array<{
    guide_id: string;
    subject_id: string;
  }> = [];

  for (const item of items) {
    const guideId = legacyToId.get(item.result.guide.legacyId!);
    if (!guideId || item.match.matchedSubjects.length === 0) continue;
    for (const ms of item.match.matchedSubjects) {
      subjectMappings.push({
        guide_id: guideId,
        subject_id: ms.subjectId,
      });
    }
  }

  if (subjectMappings.length > 0) {
    // 해당 가이드들의 기존 매핑 삭제
    const guideIds = [...new Set(subjectMappings.map((m) => m.guide_id))];
    await client
      .from("exploration_guide_subject_mappings")
      .delete()
      .in("guide_id", guideIds);

    const { error: smErr } = await client
      .from("exploration_guide_subject_mappings")
      .insert(subjectMappings);
    if (smErr) throw smErr;
  }

  // 4. 계열 매핑 (기존 삭제 → 재생성)
  const careerMappings: Array<{
    guide_id: string;
    career_field_id: number;
  }> = [];

  for (const item of items) {
    const guideId = legacyToId.get(item.result.guide.legacyId!);
    if (!guideId || item.match.matchedCareerFieldIds.length === 0) continue;

    for (const cfId of item.match.matchedCareerFieldIds) {
      careerMappings.push({ guide_id: guideId, career_field_id: cfId });
    }
  }

  if (careerMappings.length > 0) {
    const guideIds = [...new Set(careerMappings.map((m) => m.guide_id))];
    await client
      .from("exploration_guide_career_mappings")
      .delete()
      .in("guide_id", guideIds);

    const { error: cmErr } = await client
      .from("exploration_guide_career_mappings")
      .insert(careerMappings);
    if (cmErr) throw cmErr;
  }
}
