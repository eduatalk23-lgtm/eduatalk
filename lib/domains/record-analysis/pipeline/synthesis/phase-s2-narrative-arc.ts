// ============================================
// S2-e: runNarrativeArcExtraction — Layer 3 Narrative Arc 8단계 서사 태깅
// Phase 2 (2026-04-14)
//
// 각 세특/개인세특/창체/행특 레코드 원문에서 8단계 서사(①호기심 ~
// ⑧재탐구)의 존재 여부를 LLM으로 판정하고 student_record_narrative_arc에
// upsert한다.
//
// 호출 위치: executeSynthesisPhase2 best-effort 후속 (hyperedge와 동일 패턴).
// 실패 시 전체 phase 실패 안 시킴 — narrative_arc는 보강 레이어.
//
// 최적화:
//  - 이미 분석된 (record_type, record_id) 스킵 (source='ai' 기준)
//  - MIN_CONTENT_CHARS 미만은 서사 판정 불가로 스킵
//  - 4-layer 콘텐츠 해소 (imported > confirmed > content > ai_draft)
//  - 동시성 3 (Gemini Free Tier 15/min 고려)
// ============================================

import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../pipeline-types";
import { runWithConcurrency } from "../pipeline-task-runners-shared";
import {
  loadAnalyzedRecordKeys,
  upsertNarrativeArc,
  type NarrativeArcRecordType,
} from "@/lib/domains/student-record/repository/narrative-arc-repository";
import { extractNarrativeArc } from "../../llm/actions/extractNarrativeArc";

const LOG_CTX = {
  domain: "record-analysis",
  action: "pipeline.narrative_arc_extraction",
};

const CONCURRENCY = 3;
const MIN_CONTENT_CHARS = 40;

export interface NarrativeArcExtractionResult {
  /** 대상 레코드 총 수 (DB에서 읽은 수) */
  total: number;
  /** 이미 분석되어 스킵된 수 */
  skippedAlreadyAnalyzed: number;
  /** 원문 너무 짧아 스킵된 수 */
  skippedShortContent: number;
  /** LLM 호출 성공 + upsert 성공 */
  succeeded: number;
  /** LLM 호출 실패 */
  failed: number;
  /** 현재 파이프라인이 취소되어 중단된 수 */
  cancelled: boolean;
}

interface CandidateRecord {
  recordType: NarrativeArcRecordType;
  recordId: string;
  schoolYear: number;
  grade: number;
  subjectName?: string;
  content: string;
}

/** 4-layer 콘텐츠 해소: imported > confirmed > content > ai_draft */
function resolveContent(row: {
  imported_content?: string | null;
  confirmed_content?: string | null;
  content?: string | null;
  ai_draft_content?: string | null;
}): string {
  return (
    row.imported_content?.trim() ||
    row.confirmed_content?.trim() ||
    row.content?.trim() ||
    row.ai_draft_content?.trim() ||
    ""
  );
}

async function loadCandidates(ctx: PipelineContext): Promise<CandidateRecord[]> {
  const { studentId, tenantId } = ctx;
  const [seteksRes, personalRes, changcheRes, haengteukRes] = await Promise.all([
    ctx.supabase
      .from("student_record_seteks")
      .select(
        "id, school_year, grade, content, confirmed_content, imported_content, ai_draft_content, subject:subject_id(name)",
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    ctx.supabase
      .from("student_record_personal_seteks")
      .select(
        "id, school_year, grade, content, confirmed_content, imported_content, ai_draft_content",
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    ctx.supabase
      .from("student_record_changche")
      .select(
        "id, school_year, grade, content, confirmed_content, imported_content, ai_draft_content",
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
    ctx.supabase
      .from("student_record_haengteuk")
      .select(
        "id, school_year, grade, content, confirmed_content, imported_content, ai_draft_content",
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
  ]);

  const out: CandidateRecord[] = [];

  for (const row of (seteksRes.data ?? []) as Array<{
    id: string;
    school_year: number;
    grade: number;
    content: string | null;
    confirmed_content: string | null;
    imported_content: string | null;
    ai_draft_content: string | null;
    subject: { name: string } | null;
  }>) {
    out.push({
      recordType: "setek",
      recordId: row.id,
      schoolYear: row.school_year,
      grade: row.grade,
      subjectName: row.subject?.name ?? undefined,
      content: resolveContent(row),
    });
  }
  for (const row of (personalRes.data ?? []) as Array<{
    id: string;
    school_year: number;
    grade: number;
    content: string | null;
    confirmed_content: string | null;
    imported_content: string | null;
    ai_draft_content: string | null;
  }>) {
    out.push({
      recordType: "personal_setek",
      recordId: row.id,
      schoolYear: row.school_year,
      grade: row.grade,
      content: resolveContent(row),
    });
  }
  for (const row of (changcheRes.data ?? []) as Array<{
    id: string;
    school_year: number;
    grade: number;
    content: string | null;
    confirmed_content: string | null;
    imported_content: string | null;
    ai_draft_content: string | null;
  }>) {
    out.push({
      recordType: "changche",
      recordId: row.id,
      schoolYear: row.school_year,
      grade: row.grade,
      content: resolveContent(row),
    });
  }
  for (const row of (haengteukRes.data ?? []) as Array<{
    id: string;
    school_year: number;
    grade: number;
    content: string | null;
    confirmed_content: string | null;
    imported_content: string | null;
    ai_draft_content: string | null;
  }>) {
    out.push({
      recordType: "haengteuk",
      recordId: row.id,
      schoolYear: row.school_year,
      grade: row.grade,
      content: resolveContent(row),
    });
  }

  return out;
}

/**
 * 트랙 D (2026-04-14): chunkSize를 주면 "미분석 N건만 처리 → hasMore 반환" 청크 모드.
 * 주지 않으면 기존(전량 처리) 동작 그대로.
 * grade P1~P3 self-healing 청크 패턴과 동일 — DB 캐시가 진실 소스, offset 불필요.
 */
export async function runNarrativeArcExtraction(
  ctx: PipelineContext,
  chunkSize?: number,
): Promise<
  TaskRunnerOutput & {
    result: NarrativeArcExtractionResult;
    hasMore: boolean;
    totalUncached: number;
    chunkProcessed: number;
  }
> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, pipelineId } = ctx;
  const targetMajor = (ctx.snapshot?.target_major as string | undefined) ?? undefined;

  let succeeded = 0;
  let failed = 0;
  let skippedShortContent = 0;

  try {
    const [candidates, analyzedKeys] = await Promise.all([
      loadCandidates(ctx),
      loadAnalyzedRecordKeys(studentId, tenantId),
    ]);

    const total = candidates.length;
    const allToProcess: CandidateRecord[] = [];
    let skippedAlreadyAnalyzed = 0;
    for (const c of candidates) {
      if (c.content.length < MIN_CONTENT_CHARS) {
        skippedShortContent++;
        continue;
      }
      if (analyzedKeys.has(`${c.recordType}:${c.recordId}`)) {
        skippedAlreadyAnalyzed++;
        continue;
      }
      allToProcess.push(c);
    }

    const totalUncached = allToProcess.length;
    const toProcess =
      chunkSize != null ? allToProcess.slice(0, chunkSize) : allToProcess;
    const hasMore = chunkSize != null ? totalUncached > chunkSize : false;

    const { cancelled } = await runWithConcurrency(
      toProcess,
      CONCURRENCY,
      async (rec) => {
        const res = await extractNarrativeArc({
          recordType: rec.recordType,
          recordId: rec.recordId,
          schoolYear: rec.schoolYear,
          grade: rec.grade,
          subjectName: rec.subjectName,
          content: rec.content,
          ...(targetMajor ? { targetMajor } : {}),
        });

        if (!res.success) {
          failed++;
          logActionWarn(
            LOG_CTX,
            `LLM 추출 실패 ${rec.recordType}:${rec.recordId.slice(0, 8)} — ${res.error}`,
            { studentId },
          );
          return;
        }

        try {
          await upsertNarrativeArc(
            studentId,
            tenantId,
            {
              recordType: rec.recordType,
              recordId: rec.recordId,
              schoolYear: rec.schoolYear,
              grade: rec.grade,
              result: {
                curiosity: res.data.curiosity,
                topicSelection: res.data.topicSelection,
                inquiryContent: res.data.inquiryContent,
                references: res.data.references,
                conclusion: res.data.conclusion,
                teacherObservation: res.data.teacherObservation,
                growthNarrative: res.data.growthNarrative,
                reinquiry: res.data.reinquiry,
              },
              source: "ai",
              modelName: res.data.modelName ?? null,
              pipelineId,
            },
            ctx.supabase,
          );
          succeeded++;
        } catch (err) {
          failed++;
          logActionError(
            LOG_CTX,
            err instanceof Error ? err : new Error(String(err)),
            { studentId, recordType: rec.recordType, recordId: rec.recordId },
          );
        }
      },
    );

    const remainingHint = hasMore
      ? ` · 잔여 ${totalUncached - toProcess.length}건`
      : "";
    return {
      preview: `${succeeded}/${toProcess.length} 레코드 서사 태깅 (스킵 ${skippedAlreadyAnalyzed} 기존 + ${skippedShortContent} 짧음)${remainingHint}`,
      result: {
        total,
        skippedAlreadyAnalyzed,
        skippedShortContent,
        succeeded,
        failed,
        cancelled,
      },
      hasMore,
      totalUncached,
      chunkProcessed: succeeded + failed,
    };
  } catch (err) {
    logActionError(LOG_CTX, err instanceof Error ? err : new Error(String(err)), {
      studentId,
      pipelineId,
    });
    throw err;
  }
}
