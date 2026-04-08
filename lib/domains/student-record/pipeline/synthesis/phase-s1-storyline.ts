// ============================================
// S1: runStorylineGeneration
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
  type CachedSetek,
  type CachedChangche,
} from "../pipeline-types";
import * as repository from "../../repository";
import type { RecordSummary } from "../../llm/prompts/inquiryLinking";
import { PIPELINE_THRESHOLDS } from "../../constants";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

// ============================================
// 2. 스토리라인 감지
// ============================================

export async function runStorylineGeneration(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId } = ctx;

  // NEIS 레코드도 없고 설계 학년 가이드도 없으면 스토리라인 추출 대상 없음 — skip
  const hasDesignGuides = ctx.unifiedInput?.hasAnyDesign &&
    Object.values(ctx.unifiedInput.grades).some((g) => g.mode === "design" && g.directionGuides.length > 0);
  if ((!ctx.neisGrades || ctx.neisGrades.length === 0) && !hasDesignGuides) {
    return "NEIS 기록 없음 — 기록 임포트 후 감지 가능";
  }

  // 기록 수집 — competency_analysis에서 이미 조회한 캐시 재사용
  // NEIS 레코드만 스토리라인 입력으로 사용 (imported_content 있는 레코드)
  const records: RecordSummary[] = [];
  let idx = 0;

  if (!ctx.cachedSeteks) {
    const { data } = await supabase
      .from("student_record_seteks")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade, subject:subject_id(name)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .returns<CachedSetek[]>();
    ctx.cachedSeteks = data ?? [];
  }
  // grade 기준 정렬 (원래 order("grade") 대체)
  const { resolveEffectiveContent } = await import("../pipeline-data-resolver");
  const sortedSeteks = [...ctx.cachedSeteks].sort((a, b) => a.grade - b.grade);
  for (const s of sortedSeteks) {
    const effectiveContent = resolveEffectiveContent(s).text || null;
    if (!effectiveContent || effectiveContent.length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) continue;
    records.push({ index: idx++, id: s.id, grade: s.grade, subject: s.subject?.name ?? "과목 미정", type: "setek", content: effectiveContent });
  }

  if (!ctx.cachedChangche) {
    const { data } = await supabase
      .from("student_record_changche")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade, activity_type")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);
    ctx.cachedChangche = (data ?? []) as CachedChangche[];
  }
  const sortedChangche = [...ctx.cachedChangche].sort((a, b) => a.grade - b.grade);
  for (const c of sortedChangche) {
    const effectiveContent = resolveEffectiveContent(c).text || null;
    if (!effectiveContent || effectiveContent.length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) continue;
    records.push({ index: idx++, id: c.id, grade: c.grade, subject: c.activity_type ?? "창체", type: "changche", content: effectiveContent });
  }

  // 설계 학년의 방향 가이드를 가상 레코드로 병합 (unifiedInput 사용)
  if (ctx.unifiedInput?.hasAnyDesign) {
    const { collectDesignRecords } = await import("../pipeline-unified-input");
    const virtualRecords = collectDesignRecords(ctx.unifiedInput);
    for (const vr of virtualRecords) {
      records.push({ ...vr, index: idx++ });
    }
  }

  if (records.length < 2) {
    return "기록 2건 미만 — 건너뜀";
  }

  // 비NEIS 학년의 수강계획을 컨텍스트로 전달 (grade_X_theme 품질 향상)
  let coursePlanExtra: string | undefined;
  if (ctx.consultingGrades && ctx.consultingGrades.length > 0 && ctx.coursePlanData?.plans) {
    const plans = ctx.coursePlanData.plans.filter(
      (p) => (p.plan_status === "confirmed" || p.plan_status === "recommended")
        && ctx.consultingGrades.includes(p.grade),
    );
    if (plans.length > 0) {
      const byGrade = new Map<number, string[]>();
      for (const p of plans) {
        if (!byGrade.has(p.grade)) byGrade.set(p.grade, []);
        const name = (p.subject as { name?: string } | null)?.name ?? "과목 미정";
        byGrade.get(p.grade)?.push(name);
      }
      const lines = [...byGrade.entries()]
        .sort(([a], [b]) => a - b)
        .map(([g, subs]) => `- ${g}학년 수강 예정: ${subs.join(", ")}`);
      coursePlanExtra = `## 수강 계획 (기록 없는 학년 예정 교과)\n${lines.join("\n")}`;
    }
  }

  const { detectInquiryLinks } = await import("../../llm/actions/detectInquiryLinks");
  const result = await detectInquiryLinks(records, coursePlanExtra);
  if (!result.success) throw new Error(result.error);

  const { suggestedStorylines, connections } = result.data;
  if (suggestedStorylines.length === 0) {
    return "스토리라인 연결 감지되지 않음";
  }

  // 기존 AI 스토리라인 + 연관 링크를 트랜잭션으로 일괄 삭제 (재실행 시 중복 방지)
  // sort_order 계산용으로 수동 스토리라인 조회는 유지
  const existingStorylines = await repository.findStorylinesByStudent(studentId, tenantId);
  await repository.deleteAiStorylinesByStudent(studentId, tenantId);

  // sort_order 계산 (수동 스토리라인 뒤에 배치)
  const manualStorylines = existingStorylines.filter((s) => !s.title.startsWith("[AI]"));
  const baseSortOrder = manualStorylines.length > 0
    ? Math.max(...manualStorylines.map((s) => s.sort_order)) + 1
    : 0;

  // 스토리라인 삽입+링크를 RPC 트랜잭션으로 (부분 실패 시 고아 레코드 방지)
  let savedCount = 0;
  for (let i = 0; i < suggestedStorylines.length; i++) {
    const sl = suggestedStorylines[i];
    try {
      // 연결된 레코드 링크 수집
      const linkEntries: Array<{ record_type: string; record_id: string; grade: number; connection_note: string; sort_order: number }> = [];
      const linkedIds = new Set<string>();
      for (const connIdx of sl.connectionIndices) {
        const conn = connections[connIdx];
        if (!conn) continue;
        for (const recIdx of [conn.fromIndex, conn.toIndex]) {
          const rec = records[recIdx];
          if (!rec || linkedIds.has(rec.id)) continue;
          linkedIds.add(rec.id);
          linkEntries.push({
            record_type: rec.type,
            record_id: rec.id,
            grade: rec.grade,
            connection_note: conn.reasoning,
            sort_order: linkEntries.length,
          });
        }
      }

      // 스토리라인 + 링크 단일 트랜잭션 삽입
      await repository.createAiStorylineWithLinks(
        tenantId,
        studentId,
        {
          title: `[AI] ${sl.title}`,
          keywords: sl.keywords,
          narrative: sl.narrative || null,
          career_field: sl.careerField || null,
          grade_1_theme: sl.grade1Theme || null,
          grade_2_theme: sl.grade2Theme || null,
          grade_3_theme: sl.grade3Theme || null,
          strength: "moderate",
          sort_order: baseSortOrder + i,
        },
        linkEntries,
      );
      savedCount++;
    } catch (err) {
      logActionError({ ...LOG_CTX, action: "pipeline.storyline" }, err, { title: sl.title });
    }
  }

  const preview = `${savedCount}건 스토리라인 생성 (${connections.length}건 연결)`;
  // 커버리지 경고
  let coverageWarnings: import("../pipeline-types").DataCoverageWarning[] | undefined;
  if (ctx.unifiedInput) {
    const { checkCoverageForTask } = await import("../pipeline-unified-input");
    const warnings = checkCoverageForTask(ctx.unifiedInput, "storyline_generation");
    if (warnings.length > 0) coverageWarnings = warnings;
  }
  // 전체 LLM 응답은 DB(student_record_storylines)에 이미 저장됨 → ctx에는 카운트만 유지
  return { preview, result: { storylineCount: savedCount, connectionCount: connections.length, coverageWarnings } };
}
