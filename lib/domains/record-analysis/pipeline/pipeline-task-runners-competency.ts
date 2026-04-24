// ============================================
// 역량 분석 태스크 러너 (Grade Pipeline P1-P3)
// G1-a: runCompetencySetekForGrade / runCompetencySetekChunkForGrade
// G1-b: runCompetencyChangcheForGrade / runCompetencyChangcheChunkForGrade
// G1-c: runCompetencyHaengteukForGrade / runCompetencyHaengteukChunkForGrade
// G1(legacy): runCompetencyAnalysisForGrade
// ============================================

import { logActionError, logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import { updatePipelineState, checkCancelled } from "./pipeline-executor";
import {
  assertGradeCtx,
  type PipelineContext,
  type TaskRunnerOutput,
  type ScoreRowWithSubject,
} from "./pipeline-types";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import { toDbJson, type CompetencyScoreInsert, type TagContext } from "@/lib/domains/student-record/types";
import type { HighlightAnalysisResult, HighlightAnalysisInput } from "../llm/types";
import { runWithConcurrency, collectAnalysisContext } from "./pipeline-task-runners-shared";
import { PIPELINE_THRESHOLDS } from "@/lib/domains/student-record/constants";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

// ============================================
// 역량 분석 타입별 설정 (G1-a/b/c 공통 디스패치)
// ============================================

const COMPETENCY_TYPE_CONFIG = {
  setek:    { cacheKey: "cachedSeteks"    as const, taskKey: "competency_setek"    as const, label: "세특" },
  changche: { cacheKey: "cachedChangche"  as const, taskKey: "competency_changche" as const, label: "창체" },
  haengteuk:{ cacheKey: "cachedHaengteuk" as const, taskKey: "competency_haengteuk" as const, label: "행특" },
} as const;

// ============================================
// G0-shared. 역량 분석 공통 헬퍼
// ============================================

/** 진행 상황 콜백 옵션 */
interface CompetencyProgressOptions {
  /** 진행 상황을 저장할 태스크 키 (e.g. "competency_setek") */
  taskKey?: string;
  /** DB 업데이트 간격 (레코드 수 기준, 기본 3) */
  flushEvery?: number;
}

/**
 * 특정 영역(setek/changche/haengteuk)의 레코드들에 대해 역량 분석을 수행하고 결과를 저장한다.
 * runCompetencySetekForGrade, runCompetencyChangcheForGrade, runCompetencyHaengteukForGrade에서 공통 사용.
 */
async function runCompetencyForRecords(
  ctx: PipelineContext,
  targetGrade: number,
  recordType: "setek" | "changche" | "haengteuk",
  analysisRecords: Array<{ type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string }>,
  progressOpts?: CompetencyProgressOptions,
  chunkOpts?: { chunkSize: number },
): Promise<{ succeeded: number; failed: number; skipped: number; allResults: Map<string, HighlightAnalysisResult>; hasMore: boolean; totalUncached: number; tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;

  const { analyzeSetekWithHighlight } = await import("@/lib/domains/record-analysis/llm/actions/analyzeWithHighlight");
  const { computeRecordContentHash } = await import("@/lib/domains/student-record/content-hash");
  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  // Phase 0: 토큰 사용량 누적
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allResults = new Map<string, HighlightAnalysisResult>();

  // 진로 역량 평가용 이수/성적 컨텍스트
  const tgtMajor = (snapshot?.target_major as string) ?? null;
  let careerContext: HighlightAnalysisInput["careerContext"] = undefined;

  const { fetchCareerContext } = await import("@/lib/domains/student-record/repository/score-query");
  const ccResult = await fetchCareerContext(supabase, studentId, tgtMajor);
  if (ccResult) {
    careerContext = ccResult.careerContext;
  }

  const careerHashCtx = careerContext
    ? { targetMajor: careerContext.targetMajor, takenSubjects: careerContext.takenSubjects }
    : null;

  if (analysisRecords.length === 0) {
    return { succeeded, failed, skipped, allResults, hasMore: false, totalUncached: 0, tokenUsage: undefined };
  }

  // Layer 0: 학생 프로필 카드 — 파이프라인 1회 빌드, ctx 캐시 + DB 영속화(H2)
  // 3-state invariant: undefined=미빌드, ""=시도했으나 데이터 없음, "..."=빌드 완료
  // setek/changche/haengteuk × chunked run (최대 6회 호출) 간 중복 DB 조회 방지
  // DB cache hit = 이전 파이프라인 실행의 interest_consistency 재사용 → LLM 호출 스킵
  if (ctx.belief.profileCard === undefined) {
    const {
      buildStudentProfileCard,
      enrichCardWithInterestConsistency,
      renderStudentProfileCard,
      computeProfileCardStructuralHash,
    } = await import("./pipeline-task-runners-shared");
    const profileCardRepo = await import(
      "@/lib/domains/student-record/repository/profile-card-repository"
    );

    let card = await buildStudentProfileCard(supabase, studentId, tenantId, targetSchoolYear, targetGrade);
    let cacheOutcome: "hit" | "stale" | "miss" | "skip" = "skip";
    if (card) {
      const structuralHash = computeProfileCardStructuralHash(card, targetGrade);
      const existing = await profileCardRepo.findProfileCard(
        studentId, tenantId, targetGrade, "ai", supabase,
      );

      if (existing && existing.content_hash === structuralHash && existing.interest_consistency) {
        // 캐시 히트: 저장된 interestConsistency 재사용, LLM 호출 스킵
        card = { ...card, interestConsistency: existing.interest_consistency };
        cacheOutcome = "hit";
      } else {
        // 캐시 미스 또는 해시 불일치: LLM 호출 + upsert
        cacheOutcome = existing ? "stale" : "miss";
        const targetMajor = (snapshot?.target_major as string | undefined) ?? undefined;
        card = await enrichCardWithInterestConsistency(card, targetMajor);
        try {
          await profileCardRepo.upsertProfileCard(
            studentId,
            tenantId,
            {
              targetGrade,
              targetSchoolYear,
              card,
              contentHash: structuralHash,
              source: "ai",
              modelName: card.interestConsistency ? "gemini-2.5-flash" : null,
              pipelineId: ctx.pipelineId,
            },
            supabase,
          );
        } catch (err) {
          // non-fatal: 영속화 실패해도 메모리 카드로 파이프라인 진행
          logActionWarn(LOG_CTX, "profileCard upsert failed", {
            studentId, targetGrade,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    ctx.belief.profileCard = card ? renderStudentProfileCard(card) : "";
    logActionDebug(
      LOG_CTX,
      `profileCard built: ${card ? `${card.priorSchoolYears.length}yrs, ${card.persistentWeaknesses.length}약점, narrative=${card.interestConsistency ? "yes" : "no"}, cache=${cacheOutcome}` : "empty"}`,
      { studentId, targetGrade },
    );
  }
  const profileCardSection = ctx.belief.profileCard || undefined;

  // 증분 분석: 배치 캐시 조회
  const cachedEntries = await competencyRepo.findAnalysisCacheByRecordIds(
    analysisRecords.map((r) => r.id), tenantId, "ai",
  );
  const cacheMap = new Map(cachedEntries.map((e) => [e.record_id, e]));

  // 캐시 히트 분리 + 미히트 레코드 AI 태그 삭제
  const uncachedRecords: typeof analysisRecords = [];
  for (const rec of analysisRecords) {
    const currentHash = computeRecordContentHash(rec.content, careerHashCtx);
    const cached = cacheMap.get(rec.id);
    if (cached?.content_hash && cached.content_hash === currentHash) {
      allResults.set(rec.id, cached.analysis_result as HighlightAnalysisResult);
      skipped++;
    } else {
      uncachedRecords.push(rec);
    }
  }
  // 청크 슬라이싱: chunkSize가 지정되면 첫 N개 미캐시 레코드만 처리
  const totalUncached = uncachedRecords.length;
  let effectiveUncached = uncachedRecords;
  let hasMore = false;
  if (chunkOpts?.chunkSize != null && uncachedRecords.length > chunkOpts.chunkSize) {
    effectiveUncached = uncachedRecords.slice(0, chunkOpts.chunkSize);
    hasMore = true;
  }

  // 분석 결과 저장 헬퍼 (per-record atomic: delete+insert in single RPC transaction)
  async function saveResult(
    recType: "setek" | "personal_setek" | "changche" | "haengteuk",
    recordId: string,
    content: string,
    data: HighlightAnalysisResult,
  ) {
    const rpcTags: Array<{ record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary: string; tag_context: TagContext; section_type?: string; highlight_phrase?: string }> = [];
    for (const section of data.sections) {
      for (const tag of section.tags) {
        rpcTags.push({
          record_type: recType,
          record_id: recordId,
          competency_item: tag.competencyItem,
          evaluation: tag.evaluation,
          evidence_summary: `[AI] ${tag.reasoning}\n근거: "${tag.highlight}"`,
          tag_context: "analysis",
          section_type: section.sectionType,
          highlight_phrase: tag.highlight,
        });
      }
    }
    await competencyRepo.refreshCompetencyTagsAtomic(studentId, tenantId, [recordId], rpcTags);

    // Phase 0: 방금 삽입한 태그의 ID를 조회 (advisory lock 내이므로 race 없음)
    const { data: insertedTagRows } = await supabase
      .from("student_record_activity_tags")
      .select("id")
      .eq("record_id", recordId)
      .eq("tenant_id", tenantId)
      .eq("source", "ai")
      .eq("tag_context", "analysis");
    const insertedTagIds = (insertedTagRows ?? []).map((r) => r.id as string);

    const currentHash = computeRecordContentHash(content, careerHashCtx);
    await competencyRepo.upsertAnalysisCache({
      tenant_id: tenantId,
      student_id: studentId,
      record_type: recType,
      record_id: recordId,
      source: "ai",
      analysis_result: data,
      content_hash: currentHash,
    });

    if (data.contentQuality) {
      const cq = data.contentQuality;
      const qualityRow = {
        tenant_id: tenantId,
        student_id: studentId,
        record_type: recType,
        record_id: recordId,
        school_year: targetSchoolYear,
        specificity: cq.specificity,
        coherence: cq.coherence,
        depth: cq.depth,
        grammar: cq.grammar,
        scientific_validity: cq.scientificValidity ?? null,
        overall_score: cq.overallScore,
        issues: cq.issues,
        feedback: cq.feedback,
        source: "ai",
        issue_tag_ids: insertedTagIds.length > 0 ? insertedTagIds : null,
      };
      const { error: qualityErr } = await supabase
        .from("student_record_content_quality")
        .upsert(qualityRow as never, {
          onConflict: "tenant_id,student_id,record_id,source",
        });
      if (qualityErr) {
        logActionWarn(LOG_CTX, `contentQuality upsert failed: ${recordId} — ${qualityErr.message}`, { recordId, recType });
      }
    }

    allResults.set(recordId, data);
    succeeded++;
  }

  // 진행 상황 추적
  const taskKey = progressOpts?.taskKey;
  const flushEvery = progressOpts?.flushEvery ?? 3;
  const total = analysisRecords.length; // 캐시 포함 전체
  let processed = skipped; // 캐시 히트는 이미 처리 완료
  let lastFlush = 0;
  const startMs = Date.now();

  /** 진행 상황을 ctx + DB에 반영 */
  async function flushProgress(force = false) {
    if (!taskKey) return;
    processed = succeeded + skipped + failed;
    // 매 flushEvery 건마다, 또는 강제 플러시
    if (!force && processed - lastFlush < flushEvery) return;
    lastFlush = processed;

    const progressText = `${processed}/${total} 진행 (${succeeded}건 완료${failed > 0 ? `, ${failed}건 실패` : ""}${skipped > 0 ? `, ${skipped}건 캐시` : ""})`;
    ctx.previews[taskKey] = progressText;
    ctx.results[taskKey] = {
      ...(typeof ctx.results[taskKey] === "object" && ctx.results[taskKey] != null
        ? ctx.results[taskKey] as Record<string, unknown>
        : {}),
      progress: { total, completed: succeeded, failed, skipped, processed },
      elapsedMs: Date.now() - startMs,
    };

    await updatePipelineState(
      ctx.supabase as import("@/lib/supabase/admin").SupabaseAdminClient,
      ctx.pipelineId,
      "running",
      ctx.tasks,
      ctx.previews,
      ctx.results,
      ctx.errors,
    );
  }

  // 캐시 히트가 있으면 초기 진행 상황 플러시
  if (skipped > 0 && taskKey) {
    await flushProgress(true);
  }

  // 개별 LLM 호출 (동시성 3)
  if (effectiveUncached.length > 0) {
    const failedRecords: typeof effectiveUncached = [];

    // 5초 throttle된 cancellation 체크 (DB 조회 비용 억제)
    let lastCancelCheckMs = 0;
    const shouldCancel = async () => {
      const now = Date.now();
      if (now - lastCancelCheckMs < 5000) return false;
      lastCancelCheckMs = now;
      return checkCancelled(ctx);
    };

    const concurrencyResult = await runWithConcurrency(effectiveUncached, 3, async (rec) => {
      try {
        const result = await analyzeSetekWithHighlight({
          recordType: rec.type,
          content: rec.content,
          subjectName: rec.subjectName,
          grade: rec.grade,
          careerContext,
          profileCard: profileCardSection,
        });
        if (result.success) {
          if (result.usage) { totalInputTokens += result.usage.inputTokens; totalOutputTokens += result.usage.outputTokens; }
          await saveResult(rec.type, rec.id, rec.content, result.data);
          await flushProgress();
        } else {
          failedRecords.push(rec);
          logActionDebug(LOG_CTX, `competency_${recordType}[g${targetGrade}]: ${rec.id} failed — ${result.error}`);
        }
      } catch (err) {
        failedRecords.push(rec);
        logActionError({ ...LOG_CTX, action: `pipeline.competency.grade${targetGrade}.${recordType}` }, err, { recordId: rec.id });
      }
    }, { shouldCancel });

    // cancelled 시 재시도 루프도 건너뜀 (부분 결과는 saveResult로 이미 저장됨)
    if (concurrencyResult.cancelled) {
      logActionDebug(LOG_CTX, `competency_${recordType}[g${targetGrade}]: cancelled — ${succeeded}건 처리 완료`);
      return { succeeded, failed, skipped, allResults, hasMore: true, totalUncached, tokenUsage: totalInputTokens > 0 ? { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalTokens: totalInputTokens + totalOutputTokens } : undefined };
    }

    // 실패 레코드 재시도 (동시성 1, 10초 대기)
    if (failedRecords.length > 0) {
      logActionDebug(LOG_CTX, `competency_${recordType}[g${targetGrade}]: ${failedRecords.length}건 재시도 대기 (10초)`);
      await new Promise((r) => setTimeout(r, 10_000));
      // 재시도 전에도 cancelled 확인
      if (await checkCancelled(ctx)) {
        logActionDebug(LOG_CTX, `competency_${recordType}[g${targetGrade}]: cancelled before retry`);
        return { succeeded, failed, skipped, allResults, hasMore: true, totalUncached, tokenUsage: totalInputTokens > 0 ? { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalTokens: totalInputTokens + totalOutputTokens } : undefined };
      }
      for (const rec of failedRecords) {
        try {
          const result = await analyzeSetekWithHighlight({
            recordType: rec.type,
            content: rec.content,
            subjectName: rec.subjectName,
            grade: rec.grade,
            careerContext,
            profileCard: profileCardSection,
          });
          if (result.success) {
            if (result.usage) { totalInputTokens += result.usage.inputTokens; totalOutputTokens += result.usage.outputTokens; }
            await saveResult(rec.type, rec.id, rec.content, result.data);
          } else {
            failed++;
            logActionDebug(LOG_CTX, `competency_${recordType}[g${targetGrade}]: retry ${rec.id} failed — ${result.error}`);
          }
        } catch (err) {
          failed++;
          logActionError({ ...LOG_CTX, action: `pipeline.competency.grade${targetGrade}.${recordType}.retry` }, err, { recordId: rec.id });
        }
      }
    }
  }

  // 최종 진행 상황 플러시
  await flushProgress(true);

  return { succeeded, failed, skipped, allResults, hasMore, totalUncached, tokenUsage: totalInputTokens > 0 ? { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalTokens: totalInputTokens + totalOutputTokens } : undefined };
}

/**
 * 학년별 집계 (aggregateCompetencyGrades + 교과 이수/성취 등급).
 * runCompetencyHaengteukForGrade 완료 시 호출 (마지막 영역).
 */
async function runAggregateForGrade(
  ctx: PipelineContext,
  targetGrade: number,
  allResults: Map<string, HighlightAnalysisResult>,
): Promise<void> {
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;
  const {
    aggregateCompetencyGrades,
    computeCourseEffortGrades,
    computeCourseAchievementGrades,
  } = await import("@/lib/domains/student-record/rubric-matcher");
  const { calculateCourseAdequacy: calcAdequacy } = await import("@/lib/domains/student-record/course-adequacy");
  const { calculateSchoolYear: calcSchoolYear } = await import("@/lib/utils/schoolYear");

  const currentSchoolYear = calcSchoolYear();
  const targetSchoolYear = currentSchoolYear - studentGrade + targetGrade;
  const tgtMajor = (snapshot?.target_major as string) ?? null;

  // Phase 0: 각 grade에 sourceRecordId 부여하여 증거 체인 추적
  const allGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[]; sourceRecordId?: string }> =
    [...allResults.entries()].flatMap(([recordId, d]) =>
      d.competencyGrades.map((g) => ({ ...g, sourceRecordId: recordId })),
    );

  const { fetchCareerContext: fetchCC } = await import("@/lib/domains/student-record/repository/score-query");
  const aggCcResult = await fetchCC(supabase, studentId, tgtMajor);
  const careerScoreRows = aggCcResult?.careerScoreRows ?? [];

  if (tgtMajor && aggCcResult) {
    const subjectScores = careerScoreRows
      .map((s) => ({ subjectName: s.subject?.name ?? "", rankGrade: s.rank_grade ?? 5 }))
      .filter((s) => s.subjectName);
    const takenNames = aggCcResult.careerContext.takenSubjects;

    const { getCurriculumYear: getCurYearFn } = await import("@/lib/utils/schoolYear");
    const enrollYear = currentSchoolYear - studentGrade + 1;
    const curYear = getCurYearFn(enrollYear);
    const adequacy = calcAdequacy(tgtMajor, takenNames, null, curYear);

    if (adequacy) {
      const gradedSubjects = careerScoreRows
        .filter((s) => s.subject?.name && s.grade != null && s.semester != null)
        .map((s) => ({ subjectName: s.subject!.name, grade: s.grade as number, semester: s.semester as number }));
      allGrades.push(computeCourseEffortGrades(adequacy, gradedSubjects));
      allGrades.push(computeCourseAchievementGrades(adequacy.taken, subjectScores, adequacy));
    }
  }

  if (allGrades.length > 0) {
    const aggregated = aggregateCompetencyGrades(allGrades);

    // Phase 0: sourceRecordIds → sourceTagIds 역추적 (1회 배치 조회)
    const allSourceRecordIds = [...new Set(aggregated.flatMap((ag) => ag.sourceRecordIds ?? []))];
    const recordItemToTagIds = new Map<string, string[]>();
    if (allSourceRecordIds.length > 0) {
      const { data: tagRows } = await supabase
        .from("student_record_activity_tags")
        .select("id, record_id, competency_item")
        .in("record_id", allSourceRecordIds)
        .eq("tenant_id", tenantId)
        .eq("source", "ai")
        .eq("tag_context", "analysis");
      for (const row of tagRows ?? []) {
        const key = `${row.record_id}:${row.competency_item}`;
        if (!recordItemToTagIds.has(key)) recordItemToTagIds.set(key, []);
        recordItemToTagIds.get(key)!.push(row.id as string);
      }
    }

    await runWithConcurrency(aggregated, 5, async (ag) => {
      const narrative = ag.rubricScores
        ?.filter((rs) => rs.reasoning)
        .map((rs) => rs.reasoning)
        .join(" ") || null;

      // Phase 0: 기여 태그 ID 수집
      const sourceTagIds = ag.sourceRecordIds?.flatMap((rid) =>
        recordItemToTagIds.get(`${rid}:${ag.item}`) ?? [],
      );

      await competencyRepo.upsertCompetencyScore({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: targetSchoolYear,
        scope: "yearly",
        competency_area: ag.area,
        competency_item: ag.item,
        grade_value: ag.finalGrade,
        narrative,
        notes: `[AI] ${ag.recordCount}건 ${ag.method === "rubric" ? "루브릭 기반" : "레코드"} 종합 (${targetGrade}학년)`,
        rubric_scores: toDbJson(ag.rubricScores),
        source: "ai",
        status: "suggested",
        source_tag_ids: sourceTagIds && sourceTagIds.length > 0 ? sourceTagIds : null,
        source_record_ids: ag.sourceRecordIds && ag.sourceRecordIds.length > 0 ? ag.sourceRecordIds : null,
      } as CompetencyScoreInsert);
    });
  }
}

// ============================================
// G1-internal. 타입별 디스패치 제네릭 구현
// ============================================

type CompetencyRecordType = "setek" | "changche" | "haengteuk";
type AnalysisRecord = { type: CompetencyRecordType; id: string; content: string; grade: number; subjectName?: string };

/** 공통 레코드 빌더: ctx[cacheKey]에서 targetGrade 레코드를 AnalysisRecord[]로 변환 */
function buildAnalysisRecords(ctx: PipelineContext, recordType: CompetencyRecordType): AnalysisRecord[] {
  const config = COMPETENCY_TYPE_CONFIG[recordType];
  const records = ctx[config.cacheKey] ?? [];
  const { targetGrade } = ctx;
  const result: AnalysisRecord[] = [];
  for (const rec of records) {
    if (rec.grade !== targetGrade) continue;
    const effectiveContent = rec.imported_content?.trim() ? rec.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    const subjectName = "subject" in rec ? (rec as { subject?: { name?: string } }).subject?.name : undefined;
    result.push({ type: recordType, id: rec.id, content: effectiveContent, grade: rec.grade, subjectName });
  }
  return result;
}

/** 행특 완료 후 전 영역 집계를 수행하는 헬퍼 */
async function runHaengteukAggregate(
  ctx: PipelineContext,
  targetGrade: number,
  currentResults: Map<string, import("@/lib/domains/record-analysis/llm/types").HighlightAnalysisResult>,
): Promise<void> {
  const allForAggregate = new Map<string, import("@/lib/domains/record-analysis/llm/types").HighlightAnalysisResult>();
  const { computeRecordContentHash } = await import("@/lib/domains/student-record/content-hash");
  const allRecordIds: string[] = [];
  for (const s of (ctx.cachedSeteks ?? [])) {
    if (s.grade === targetGrade && (s.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(s.id);
  }
  for (const c of (ctx.cachedChangche ?? [])) {
    if (c.grade === targetGrade && (c.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(c.id);
  }
  for (const h of (ctx.cachedHaengteuk ?? [])) {
    if (h.grade === targetGrade && (h.imported_content?.trim()?.length ?? 0) >= 20) allRecordIds.push(h.id);
  }
  if (allRecordIds.length > 0) {
    const cached = await competencyRepo.findAnalysisCacheByRecordIds(allRecordIds, ctx.tenantId, "ai");
    for (const entry of cached) {
      if (entry.analysis_result) {
        allForAggregate.set(entry.record_id, entry.analysis_result as import("@/lib/domains/record-analysis/llm/types").HighlightAnalysisResult);
      }
    }
  }
  // 방금 분석한 행특 결과도 포함
  for (const [id, result] of currentResults) {
    allForAggregate.set(id, result);
  }
  void computeRecordContentHash; // 사용됨을 lint에 알림
  await runAggregateForGrade(ctx, targetGrade, allForAggregate);
}

/**
 * 역량 분석 ForGrade 제네릭 구현 (setek/changche/haengteuk 공통).
 * haengteuk은 완료 후 전 영역 집계를 추가 실행한다.
 */
async function runCompetencyForType(ctx: PipelineContext, recordType: CompetencyRecordType): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { targetGrade } = ctx;
  const config = COMPETENCY_TYPE_CONFIG[recordType];

  const gradeResolved = ctx.belief.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return `${targetGrade}학년 NEIS 기록 없음 — ${config.label} 역량 분석 건너뜀`;
  }

  const analysisRecords = buildAnalysisRecords(ctx, recordType);

  const { succeeded, failed, skipped, allResults, tokenUsage } = await runCompetencyForRecords(
    ctx, targetGrade, recordType, analysisRecords, { taskKey: config.taskKey },
  );

  // Phase 간 맥락 전달: 분석 결과를 ctx.belief.analysisContext 에 축적
  collectAnalysisContext(ctx, targetGrade, recordType, analysisRecords, allResults);

  // 행특이 마지막 역량 분석 Phase이므로 여기서 전 영역 집계를 실행
  if (recordType === "haengteuk") {
    await runHaengteukAggregate(ctx, targetGrade, allResults);

    // Phase 분할 재시작 시 복원 가능하도록 task_results 에 영속화
    if (ctx.belief.analysisContext) {
      ctx.results["_analysisContext"] = ctx.belief.analysisContext;
    }
  }

  const total = succeeded + skipped + failed;

  // B7: 완결성 가드 — 실패율이 10% 초과하면 failed 처리. 재실행 cascade로 복구 유도.
  if (total > 0 && failed / total > 0.1) {
    throw new Error(
      `competency_${recordType} 부분 실행: ${failed}/${total}건 실패 (${((failed / total) * 100).toFixed(0)}% > 10%)`,
    );
  }

  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  if (recordType === "haengteuk") parts.push("집계 완료");
  return {
    preview: `${targetGrade}학년 ${config.label} 역량 분석 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total, tokenUsage },
  };
}

/**
 * 역량 분석 ChunkForGrade 제네릭 구현 (setek/changche/haengteuk 공통).
 * haengteuk은 마지막 청크(!hasMore)에서만 전 영역 집계를 실행한다.
 */
async function runCompetencyChunkForType(
  ctx: PipelineContext,
  recordType: CompetencyRecordType,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  assertGradeCtx(ctx);
  const { targetGrade } = ctx;
  const config = COMPETENCY_TYPE_CONFIG[recordType];

  const gradeResolved = ctx.belief.resolvedRecords?.[targetGrade];
  if (!gradeResolved?.hasAnyNeis) {
    return {
      preview: `${targetGrade}학년 NEIS 기록 없음 — ${config.label} 역량 분석 건너뜀`,
      result: { allCached: false },
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
    };
  }

  const analysisRecords = buildAnalysisRecords(ctx, recordType);

  const { succeeded, failed, skipped, allResults, hasMore, totalUncached, tokenUsage } = await runCompetencyForRecords(
    ctx, targetGrade, recordType, analysisRecords,
    { taskKey: config.taskKey },
    { chunkSize },
  );

  // Phase 간 맥락 전달: 청크 결과도 ctx.belief.analysisContext 에 축적
  collectAnalysisContext(ctx, targetGrade, recordType, analysisRecords, allResults);

  // 행특: 마지막 청크에서만 집계 실행
  if (recordType === "haengteuk" && !hasMore) {
    await runHaengteukAggregate(ctx, targetGrade, allResults);

    // Phase 분할 재시작 시 복원 가능하도록 task_results 에 영속화
    if (ctx.belief.analysisContext) {
      ctx.results["_analysisContext"] = ctx.belief.analysisContext;
    }
  }

  const total = succeeded + skipped + failed;

  // B7: 청크 단위 완결성 가드 — 한 청크 내 실패율이 10% 초과면 throw. 재실행 cascade 유도.
  if (total > 0 && failed / total > 0.1) {
    throw new Error(
      `competency_${recordType} 청크 부분 실행: ${failed}/${total}건 실패 (${((failed / total) * 100).toFixed(0)}% > 10%)`,
    );
  }

  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  if (recordType === "haengteuk" && !hasMore) parts.push("집계 완료");
  if (hasMore) parts.push(`잔여 ${totalUncached - chunkSize}건`);

  return {
    preview: `${targetGrade}학년 ${config.label} 역량 ${total === 0 ? "대상 없음" : parts.join(", ")}`,
    result: { allCached: total > 0 && skipped === total, tokenUsage },
    hasMore,
    totalUncached,
    chunkProcessed: succeeded + failed,
  };
}

// ============================================
// G1-a. 학년별 세특 역량 분석
// ============================================

export async function runCompetencySetekForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  return runCompetencyForType(ctx, "setek");
}

// ============================================
// G1-a-chunk. 학년별 세특 역량 분석 (청크 단위)
// ============================================

export async function runCompetencySetekChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  return runCompetencyChunkForType(ctx, "setek", chunkSize);
}

// ============================================
// G1-b. 학년별 창체 역량 분석
// ============================================

export async function runCompetencyChangcheForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  return runCompetencyForType(ctx, "changche");
}

// ============================================
// G1-b-chunk. 학년별 창체 역량 분석 (청크 단위)
// ============================================

export async function runCompetencyChangcheChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  return runCompetencyChunkForType(ctx, "changche", chunkSize);
}

// ============================================
// G1-c. 학년별 행특 역량 분석 (+ 집계)
// ============================================

export async function runCompetencyHaengteukForGrade(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  return runCompetencyForType(ctx, "haengteuk");
}

// ============================================
// G1-c-chunk. 학년별 행특 역량 분석 (청크 단위 + 마지막 청크에서 집계)
// ============================================

export async function runCompetencyHaengteukChunkForGrade(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  return runCompetencyChunkForType(ctx, "haengteuk", chunkSize);
}

// ============================================
// α1-2. 학년별 봉사 역량 태깅 (Phase 4 pre-task)
//   - 학년 묶음 1회 LLM 호출 (청크 미지원)
//   - 저장 범위: activity_tags (record_type='volunteer') 전용
//     · competency_scores / content_quality 는 건드리지 않음 (P3 집계와 UNIQUE 충돌 회피)
//     · α1-3 VolunteerState 빌더가 activity_tags + volunteer 테이블에서 집계
//   - analysis_cache 미사용 (봉사는 standard tier 단발 호출이라 재실행 비용 낮음)
// ============================================

export async function runCompetencyVolunteerForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { supabase, studentId, tenantId, targetGrade, snapshot } = ctx;

  const { fetchVolunteerByGrade } = await import(
    "@/lib/domains/student-record/repository/volunteer-repository"
  );
  const { analyzeVolunteerBatch } = await import(
    "@/lib/domains/record-analysis/llm/actions/analyzeVolunteerBatch"
  );

  const volunteers = await fetchVolunteerByGrade(
    supabase,
    studentId,
    tenantId,
    targetGrade,
  );

  // 빈 봉사 기록: LLM 호출 없이 completed 마킹
  if (volunteers.length === 0) {
    // 이전 실행의 volunteer activity_tags 가 남아있을 수 있으니 정리
    // (예: 사용자가 봉사 row 를 모두 삭제한 케이스)
    await supabase
      .from("student_record_activity_tags")
      .delete()
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("record_type", "volunteer")
      .eq("tag_context", "analysis")
      .eq("source", "ai");

    return {
      preview: `${targetGrade}학년 봉사 기록 없음`,
      result: {
        activityCount: 0,
        totalHours: 0,
        tagCount: 0,
        themeCount: 0,
        skippedReason: "no_volunteer_records",
      },
    };
  }

  // LLM 입력 구성
  const targetMajor = (snapshot?.target_major as string | undefined) ?? undefined;
  const input: import("../llm/types").VolunteerAnalysisInput = {
    grade: targetGrade,
    activities: volunteers.map((v) => ({
      id: v.id,
      hours: Number(v.hours ?? 0),
      description: v.description ?? null,
      activityDate: v.activity_date ?? null,
    })),
    targetMajor,
    profileCard: ctx.profileCard || undefined,
  };

  const startMs = Date.now();
  const analysisResult = await analyzeVolunteerBatch(input);

  if (!analysisResult.success) {
    throw new Error(
      `봉사 역량 분석 실패 (${targetGrade}학년): ${analysisResult.error}`,
    );
  }

  const data = analysisResult.data;

  // activity_tags 저장 — RPC 경유 (같은 학생의 volunteer 레코드 ID 전체를 기준으로 기존 태그 원자적 교체)
  const volunteerIds = volunteers.map((v) => v.id);
  const rpcTags = data.competencyTags.map((tag) => ({
    record_type: "volunteer",
    record_id: tag.volunteerId,
    competency_item: tag.competencyItem,
    evaluation: tag.evaluation,
    evidence_summary: `[AI] ${tag.reasoning}`,
    tag_context: "analysis" as TagContext,
  }));

  try {
    await competencyRepo.refreshCompetencyTagsAtomic(
      studentId,
      tenantId,
      volunteerIds,
      rpcTags,
    );
  } catch (err) {
    logActionError(
      { ...LOG_CTX, action: `pipeline.competency_volunteer.grade${targetGrade}` },
      err,
      { studentId, targetGrade, tagCount: rpcTags.length },
    );
    throw err;
  }

  // ctx.results 영속화 — α1-3 VolunteerState 빌더가 재조회 시 활용 (ephemeral)
  ctx.results ??= {};
  ctx.results["competency_volunteer"] = {
    ...(typeof ctx.results["competency_volunteer"] === "object" &&
    ctx.results["competency_volunteer"] != null
      ? (ctx.results["competency_volunteer"] as Record<string, unknown>)
      : {}),
    activityCount: volunteers.length,
    totalHours: data.totalHours,
    tagCount: data.competencyTags.length,
    themeCount: data.recurringThemes.length,
    recurringThemes: data.recurringThemes,
    caringEvidence: data.caringEvidence,
    leadershipEvidence: data.leadershipEvidence,
    elapsedMs: Date.now() - startMs,
    ...(analysisResult.usage
      ? {
          tokenUsage: {
            inputTokens: analysisResult.usage.inputTokens,
            outputTokens: analysisResult.usage.outputTokens,
            totalTokens:
              analysisResult.usage.inputTokens + analysisResult.usage.outputTokens,
          },
        }
      : {}),
  };

  const themePreview =
    data.recurringThemes.length > 0
      ? ` · ${data.recurringThemes.slice(0, 3).join(", ")}`
      : "";

  return {
    preview: `${targetGrade}학년 봉사 ${volunteers.length}건 · ${data.totalHours}시간${themePreview}`.slice(
      0,
      80,
    ),
    result: ctx.results["competency_volunteer"],
  };
}

// ============================================
// α1-4-b. 학년별 수상 역량 태깅 (Phase 4 pre-task)
//   - 학년 묶음 1회 LLM 호출 (청크 미지원)
//   - 저장 범위: activity_tags (record_type='award') 전용
//     · competency_scores / content_quality 는 건드리지 않음 (봉사와 동일 예외)
//     · α1-4-a collectAwardState 가 activity_tags + ctx.results 에서 AwardState 집계
//   - analysis_cache 미사용 (수상 정보는 짧고 standard tier 단발 호출로 충분)
// ============================================

export async function runCompetencyAwardsForGrade(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertGradeCtx(ctx);
  const { supabase, studentId, tenantId, targetGrade, snapshot } = ctx;

  const { fetchAwardsByGrade } = await import(
    "@/lib/domains/student-record/repository/awards-repository"
  );
  const { analyzeAwardsBatch } = await import(
    "@/lib/domains/record-analysis/llm/actions/analyzeAwardsBatch"
  );

  const awards = await fetchAwardsByGrade(
    supabase,
    studentId,
    tenantId,
    targetGrade,
  );

  // 빈 수상 기록: LLM 호출 없이 completed 마킹
  if (awards.length === 0) {
    // 이전 실행의 award activity_tags 정리 (예: 사용자가 award row 를 모두 삭제한 케이스)
    await supabase
      .from("student_record_activity_tags")
      .delete()
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("record_type", "award")
      .eq("tag_context", "analysis")
      .eq("source", "ai");

    return {
      preview: `${targetGrade}학년 수상 기록 없음`,
      result: {
        awardCount: 0,
        tagCount: 0,
        themeCount: 0,
        skippedReason: "no_award_records",
      },
    };
  }

  const targetMajor = (snapshot?.target_major as string | undefined) ?? undefined;
  const input: import("../llm/types").AwardsAnalysisInput = {
    grade: targetGrade,
    awards: awards.map((a) => ({
      id: a.id,
      awardName: a.award_name ?? "",
      awardLevel: a.award_level ?? null,
      awardingBody: a.awarding_body ?? null,
      participants: a.participants ?? null,
      awardDate: a.award_date ?? null,
    })),
    targetMajor,
    profileCard: ctx.profileCard || undefined,
  };

  const startMs = Date.now();
  const analysisResult = await analyzeAwardsBatch(input);

  if (!analysisResult.success) {
    throw new Error(
      `수상 역량 분석 실패 (${targetGrade}학년): ${analysisResult.error}`,
    );
  }

  const data = analysisResult.data;

  // activity_tags 저장 — RPC 경유 (같은 학생의 award 레코드 ID 전체를 기준으로 기존 태그 원자적 교체)
  const awardIds = awards.map((a) => a.id);
  const rpcTags = data.competencyTags.map((tag) => ({
    record_type: "award",
    record_id: tag.awardId,
    competency_item: tag.competencyItem,
    evaluation: tag.evaluation,
    evidence_summary: `[AI] ${tag.reasoning}`,
    tag_context: "analysis" as TagContext,
  }));

  try {
    await competencyRepo.refreshCompetencyTagsAtomic(
      studentId,
      tenantId,
      awardIds,
      rpcTags,
    );
  } catch (err) {
    logActionError(
      { ...LOG_CTX, action: `pipeline.competency_awards.grade${targetGrade}` },
      err,
      { studentId, targetGrade, tagCount: rpcTags.length },
    );
    throw err;
  }

  // ctx.results 영속화 — α1-4-a collectAwardState 가 leadership/career evidence 를 소비
  ctx.results ??= {};
  ctx.results["competency_awards"] = {
    ...(typeof ctx.results["competency_awards"] === "object" &&
    ctx.results["competency_awards"] != null
      ? (ctx.results["competency_awards"] as Record<string, unknown>)
      : {}),
    awardCount: awards.length,
    tagCount: data.competencyTags.length,
    themeCount: data.recurringThemes.length,
    recurringThemes: data.recurringThemes,
    leadershipEvidence: data.leadershipEvidence,
    careerRelevance: data.careerRelevance,
    elapsedMs: Date.now() - startMs,
    ...(analysisResult.usage
      ? {
          tokenUsage: {
            inputTokens: analysisResult.usage.inputTokens,
            outputTokens: analysisResult.usage.outputTokens,
            totalTokens:
              analysisResult.usage.inputTokens + analysisResult.usage.outputTokens,
          },
        }
      : {}),
  };

  const themePreview =
    data.recurringThemes.length > 0
      ? ` · ${data.recurringThemes.slice(0, 3).join(", ")}`
      : "";

  return {
    preview: `${targetGrade}학년 수상 ${awards.length}건 · 태그 ${data.competencyTags.length}건${themePreview}`.slice(
      0,
      80,
    ),
    result: ctx.results["competency_awards"],
  };
}

