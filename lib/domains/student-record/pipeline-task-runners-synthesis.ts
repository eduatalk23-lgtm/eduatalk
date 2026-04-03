// ============================================
// 종합 분석 태스크 러너 (Synthesis Pipeline S1-S6)
// S1: runStorylineGeneration
// S2: runEdgeComputation, runGuideMatching
// S3: runAiDiagnosis, runCourseRecommendation
// S4: runBypassAnalysis
// S5: runActivitySummary, runAiStrategy
// S6: runInterviewGeneration, runRoadmapGeneration
// legacy: runCompetencyAnalysis (전체 분석 통합 버전)
// ============================================

import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import type {
  PipelineContext,
  TaskRunnerOutput,
  ScoreRowWithSubject,
  CachedSetek,
  CachedChangche,
} from "./pipeline-types";
import type { PersistedEdge } from "./edge-repository";
import type { CrossRefEdge } from "./cross-reference";
import * as competencyRepo from "./competency-repository";
import * as diagnosisRepo from "./diagnosis-repository";
import * as repository from "./repository";
import type { ActivityTagInsert, CompetencyScoreInsert, DiagnosisInsert, CourseAdequacyResult } from "./types";
import type { HighlightAnalysisResult, HighlightAnalysisInput } from "./llm/types";
import type { RecordSummary } from "./llm/prompts/inquiryLinking";
import { runWithConcurrency } from "./pipeline-task-runners-shared";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

// ============================================
// 헬퍼: 전 학년 세특/창체/행특 품질 패턴 집계
// ============================================

/**
 * student_record_content_quality 테이블에서 해당 학생의 모든 issues를 수집하고
 * 동일 패턴이 2건 이상 등장하면 반복 패턴으로 집계한다.
 * Synthesis 파이프라인(진단/전략)에서 사용.
 *
 * 과목명은 student_record_seteks → subjects JOIN으로만 가능.
 * changche/haengteuk은 과목명 없음 → record_type을 label로 사용.
 *
 * @returns repeatingPatterns — issues[]의 반복 항목 (2건 이상)
 * @returns qualityPatternSection — 프롬프트 주입용 마크다운 섹션 (데이터 없으면 "")
 */
async function aggregateQualityPatterns(ctx: PipelineContext): Promise<{
  repeatingPatterns: Array<{ pattern: string; count: number; subjects: string[] }>;
  qualityPatternSection: string;
}> {
  const { supabase, studentId } = ctx;

  // 1. content_quality 전체 조회 (issues가 있는 행만)
  const { data: qualityRows } = await supabase
    .from("student_record_content_quality")
    .select("record_id, record_type, issues, feedback")
    .eq("student_id", studentId);

  const rows = (qualityRows ?? []) as Array<{
    record_id: string;
    record_type: string;
    issues: string[];
    feedback: string | null;
  }>;

  const nonEmptyRows = rows.filter((r) => Array.isArray(r.issues) && r.issues.length > 0);
  if (nonEmptyRows.length === 0) {
    return { repeatingPatterns: [], qualityPatternSection: "" };
  }

  // 2. setek record_id → subject name 매핑 (1회 쿼리)
  const setekIds = nonEmptyRows
    .filter((r) => r.record_type === "setek" || r.record_type === "personal_setek")
    .map((r) => r.record_id);

  const subjectNameById = new Map<string, string>();
  if (setekIds.length > 0) {
    const { data: setekRows } = await supabase
      .from("student_record_seteks")
      .select("id, subject:subject_id(name)")
      .in("id", setekIds);

    type SetekRow = { id: string; subject: { name: string } | null };
    for (const s of (setekRows ?? []) as unknown as SetekRow[]) {
      if (s.subject?.name) {
        subjectNameById.set(s.id, s.subject.name);
      }
    }
  }

  // 3. 패턴별 집계 (issue → {count, subjects[]})
  const patternMap = new Map<string, { count: number; subjects: Set<string> }>();
  for (const row of nonEmptyRows) {
    const label =
      subjectNameById.get(row.record_id) ??
      (row.record_type === "changche" ? "창체" : row.record_type === "haengteuk" ? "행특" : row.record_type);

    for (const issue of row.issues) {
      const entry = patternMap.get(issue) ?? { count: 0, subjects: new Set<string>() };
      entry.count += 1;
      entry.subjects.add(label);
      patternMap.set(issue, entry);
    }
  }

  // 4. 반복 패턴 필터 (2건 이상)
  const repeatingPatterns = Array.from(patternMap.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([pattern, v]) => ({
      pattern,
      count: v.count,
      subjects: Array.from(v.subjects),
    }));

  if (repeatingPatterns.length === 0) {
    return { repeatingPatterns: [], qualityPatternSection: "" };
  }

  // 5. 고유 피드백 수집 (중복 제거, 최대 5개)
  const feedbackSet = new Set<string>();
  for (const row of nonEmptyRows) {
    if (row.feedback && row.feedback.trim().length > 0) {
      feedbackSet.add(row.feedback.trim());
      if (feedbackSet.size >= 5) break;
    }
  }

  // 6. 마크다운 섹션 생성
  const patternLines = repeatingPatterns
    .map((p) => `- ${p.pattern} (${p.count}건: ${p.subjects.join(", ")}) — 학생의 습관적 약점으로 진단에 반영`)
    .join("\n");

  const feedbackLines =
    feedbackSet.size > 0
      ? `\n### 품질 피드백 요약\n${Array.from(feedbackSet)
          .map((f) => `- "${f}"`)
          .join("\n")}`
      : "";

  const qualityPatternSection = `## 세특 품질 패턴 분석 (전 학년 종합)\n\n### 반복 감지된 패턴\n${patternLines}${feedbackLines}`;

  return { repeatingPatterns, qualityPatternSection };
}

// ============================================
// 1. 역량 분석 (legacy — 전체 세특+창체+행특 통합)
// ============================================

export async function runCompetencyAnalysis(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;

  // NEIS 레코드가 하나도 없으면 분석 대상 없음 — skip
  if (!ctx.neisGrades || ctx.neisGrades.length === 0) {
    return "NEIS 기록 없음 — 기록 임포트 후 분석 가능";
  }
  const { analyzeSetekWithHighlight } = await import("./llm/actions/analyzeWithHighlight");
  const { calculateCourseAdequacy: calcAdequacy } = await import("./course-adequacy");
  const { computeRecordContentHash } = await import("./content-hash");
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const allResults = new Map<string, HighlightAnalysisResult>();
  const currentSchoolYear = calculateSchoolYear();

  // 진로 역량 평가용 이수/성적 컨텍스트 사전 조회
  const tgtMajor = (snapshot?.target_major as string) ?? null;
  let careerContext: HighlightAnalysisInput["careerContext"] = undefined;
  let careerScoreRows: ScoreRowWithSubject[] = [];

  if (tgtMajor) {
    const { data: scoreRows } = await supabase
      .from("student_internal_scores")
      .select("subject:subject_id(name), rank_grade, grade, semester")
      .eq("student_id", studentId)
      .order("grade")
      .order("semester");
    careerScoreRows = (scoreRows ?? []) as ScoreRowWithSubject[];
    const subjectScores = careerScoreRows
      .map((s) => ({
        subjectName: s.subject?.name ?? "",
        rankGrade: s.rank_grade ?? 5,
      }))
      .filter((s) => s.subjectName);
    const takenNames = [...new Set(subjectScores.map((s) => s.subjectName))];

    // 학기별 성적 추이
    const gradeTrend = careerScoreRows
      .filter((s) => s.rank_grade != null)
      .map((s) => ({
        grade: s.grade ?? 1,
        semester: s.semester ?? 1,
        subjectName: s.subject?.name ?? "",
        rankGrade: s.rank_grade as number,
      }));

    careerContext = {
      targetMajor: tgtMajor,
      takenSubjects: takenNames,
      relevantScores: subjectScores,
      gradeTrend,
    };
  }

  // 증분 분석용 캐시 맵 (레코드 목록 확정 후 채움)
  let cacheMap = new Map<string, { analysis_result: unknown; content_hash: string | null }>();

  const careerHashCtx = careerContext ? { targetMajor: careerContext.targetMajor, takenSubjects: careerContext.takenSubjects } : null;

  // 분석 결과 저장 헬퍼 (배치/개별 양쪽에서 재사용)
  async function saveAnalysisResult(
    recordType: "setek" | "personal_setek" | "changche" | "haengteuk",
    recordId: string,
    content: string,
    data: HighlightAnalysisResult,
  ) {
    const tagInputs: ActivityTagInsert[] = [];
    for (const section of data.sections) {
      for (const tag of section.tags) {
        tagInputs.push({
          tenant_id: tenantId,
          student_id: studentId,
          record_type: recordType,
          record_id: recordId,
          competency_item: tag.competencyItem,
          evaluation: tag.evaluation,
          evidence_summary: `[AI] ${tag.reasoning}\n근거: "${tag.highlight}"`,
          source: "ai",
          status: "suggested",
        });
      }
    }
    if (tagInputs.length > 0) {
      await competencyRepo.insertActivityTags(tagInputs);
    }

    const currentHash = computeRecordContentHash(content, careerHashCtx);
    await competencyRepo.upsertAnalysisCache({
      tenant_id: tenantId,
      student_id: studentId,
      record_type: recordType,
      record_id: recordId,
      source: "ai",
      analysis_result: data,
      content_hash: currentHash,
    });

    // Phase QA: 품질 점수 저장
    if (data.contentQuality) {
      const cq = data.contentQuality;
      await supabase
        .from("student_record_content_quality")
        .upsert(
          {
            tenant_id: tenantId,
            student_id: studentId,
            record_type: recordType,
            record_id: recordId,
            school_year: currentSchoolYear,
            specificity: cq.specificity,
            coherence: cq.coherence,
            depth: cq.depth,
            grammar: cq.grammar,
            scientific_validity: cq.scientificValidity ?? null,
            overall_score: cq.overallScore,
            issues: cq.issues,
            feedback: cq.feedback,
            source: "ai",
          },
          { onConflict: "tenant_id,student_id,record_id,source" },
        )
        .then(({ error }) => {
          if (error) {
            logActionDebug(LOG_CTX, `contentQuality upsert failed: ${recordId} — ${error.message}`);
          }
        });
    }

    allResults.set(recordId, data);
    succeeded++;
  }

  // 1~3. DB 조회 병렬화
  await Promise.all([
    (async () => {
      if (!ctx.cachedSeteks) {
        const { data } = await supabase
          .from("student_record_seteks")
          .select("id, content, imported_content, grade, subject:subject_id(name)")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);
        ctx.cachedSeteks = (data ?? []) as unknown as CachedSetek[];
      }
    })(),
    (async () => {
      if (!ctx.cachedChangche) {
        const { data } = await supabase
          .from("student_record_changche")
          .select("id, content, imported_content, grade, activity_type")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId);
        ctx.cachedChangche = (data ?? []) as CachedChangche[];
      }
    })(),
    (async () => {
      if (!ctx.cachedHaengteuk) {
        const { data } = await supabase
          .from("student_record_haengteuk")
          .select("id, content, imported_content, grade")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId);
        ctx.cachedHaengteuk = (data ?? []) as import("./pipeline-types").CachedHaengteuk[];
      }
    })(),
  ]);

  // NEIS 레코드만 분석 대상으로 필터링 (imported_content 있는 레코드)
  type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
  const analysisRecords: AnalysisRecord[] = [];
  for (const s of ctx.cachedSeteks!) {
    const effectiveContent = s.imported_content?.trim() ? s.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "setek", id: s.id, content: effectiveContent, grade: s.grade, subjectName: s.subject?.name });
  }
  for (const c of ctx.cachedChangche!) {
    const effectiveContent = c.imported_content?.trim() ? c.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "changche", id: c.id, content: effectiveContent, grade: c.grade });
  }
  for (const h of ctx.cachedHaengteuk!) {
    const effectiveContent = h.imported_content?.trim() ? h.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    analysisRecords.push({ type: "haengteuk", id: h.id, content: effectiveContent, grade: h.grade });
  }

  // 증분 분석: 배치 캐시 조회 (1회 DB 호출)
  {
    const cachedEntries = await competencyRepo.findAnalysisCacheByRecordIds(
      analysisRecords.map((r) => r.id), tenantId, "ai",
    );
    cacheMap = new Map(cachedEntries.map((e) => [e.record_id, e]));
  }

  // 캐시 히트 분리 + 미히트 레코드의 AI 태그 배치 삭제
  const uncachedRecords: AnalysisRecord[] = [];
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
  if (uncachedRecords.length > 0) {
    await competencyRepo.deleteAiActivityTagsByRecordIds(uncachedRecords.map((r) => r.id), tenantId);
  }

  // 개별 LLM 호출 (동시성 3, 캐시 미히트 레코드만)
  if (uncachedRecords.length > 0) {
    const failedRecords: AnalysisRecord[] = [];

    await runWithConcurrency(uncachedRecords, 3, async (rec) => {
      try {
        const result = await analyzeSetekWithHighlight({
          recordType: rec.type,
          content: rec.content,
          subjectName: rec.subjectName,
          grade: rec.grade,
          careerContext,
        });
        if (result.success) {
          await saveAnalysisResult(rec.type, rec.id, rec.content, result.data);
        } else {
          failedRecords.push(rec);
          logActionDebug(LOG_CTX, `competency_analysis: ${rec.type} ${rec.id} failed — ${result.error}`);
        }
      } catch (err) {
        failedRecords.push(rec);
        logActionError({ ...LOG_CTX, action: `pipeline.competency.${rec.type}` }, err, { recordId: rec.id });
      }
    });

    // 실패 레코드 재시도 (동시성 1, 10초 대기 후)
    if (failedRecords.length > 0) {
      logActionDebug(LOG_CTX, `competency_analysis: ${failedRecords.length}건 재시도 대기 (10초)`);
      await new Promise((r) => setTimeout(r, 10_000));
      for (const rec of failedRecords) {
        try {
          const result = await analyzeSetekWithHighlight({
            recordType: rec.type,
            content: rec.content,
            subjectName: rec.subjectName,
            grade: rec.grade,
            careerContext,
          });
          if (result.success) {
            await saveAnalysisResult(rec.type, rec.id, rec.content, result.data);
          } else {
            failed++;
            logActionDebug(LOG_CTX, `competency_analysis: retry ${rec.type} ${rec.id} failed — ${result.error}`);
          }
        } catch (err) {
          failed++;
          logActionError({ ...LOG_CTX, action: `pipeline.competency.retry.${rec.type}` }, err, { recordId: rec.id });
        }
      }
    }
  }

  // 4. 루브릭 기반 종합 등급 저장 (Bottom-Up)
  {
    const {
      aggregateCompetencyGrades,
      computeCourseEffortGrades,
      computeCourseAchievementGrades,
    } = await import("./rubric-matcher");

    const allGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> =
      [...allResults.values()].flatMap((d) => d.competencyGrades);

    if (tgtMajor) {
      const subjectScores = careerScoreRows
        .map((s) => ({
          subjectName: s.subject?.name ?? "",
          rankGrade: s.rank_grade ?? 5,
        }))
        .filter((s) => s.subjectName);
      const takenNames = [...new Set(subjectScores.map((s) => s.subjectName))];

      const { getCurriculumYear: getCurYearFn } = await import("@/lib/utils/schoolYear");
      const enrollYear = calculateSchoolYear() - studentGrade + 1;
      const curYear = getCurYearFn(enrollYear);
      const adequacy = calcAdequacy(tgtMajor, takenNames, null, curYear);

      if (adequacy) {
        const gradedSubjects = careerScoreRows
          .filter((s) => s.subject?.name && s.grade != null && s.semester != null)
          .map((s) => ({
            subjectName: s.subject!.name,
            grade: s.grade as number,
            semester: s.semester as number,
          }));
        allGrades.push(computeCourseEffortGrades(adequacy, gradedSubjects));
        allGrades.push(computeCourseAchievementGrades(adequacy.taken, subjectScores, adequacy));
      }
    }

    if (allGrades.length > 0) {
      const aggregated = aggregateCompetencyGrades(allGrades);

      await runWithConcurrency(aggregated, 5, async (ag) => {
        const narrative = ag.rubricScores
          ?.filter((rs) => rs.reasoning)
          .map((rs) => rs.reasoning)
          .join(" ") || null;

        await competencyRepo.upsertCompetencyScore({
          tenant_id: tenantId,
          student_id: studentId,
          school_year: currentSchoolYear,
          scope: "yearly",
          competency_area: ag.area,
          competency_item: ag.item,
          grade_value: ag.finalGrade,
          narrative,
          notes: `[AI] ${ag.recordCount}건 ${ag.method === "rubric" ? "루브릭 기반" : "레코드"} 종합`,
          rubric_scores: ag.rubricScores as unknown as CompetencyScoreInsert["rubric_scores"],
          source: "ai",
          status: "suggested",
        } as CompetencyScoreInsert);
      });
    }
  }

  const total = succeeded + skipped + failed;
  const allCached = total > 0 && skipped === total;
  const parts = [`${succeeded}건 분석`];
  if (skipped > 0) parts.push(`${skipped}건 캐시`);
  if (failed > 0) parts.push(`${failed}건 실패`);
  return {
    preview: `역량 분석 ${parts.join(", ")} (세특+창체+행특)`,
    result: { allCached },
  };
}

// ============================================
// 2. 스토리라인 감지
// ============================================

export async function runStorylineGeneration(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId } = ctx;

  // NEIS 레코드가 하나도 없으면 스토리라인 추출 대상 없음 — skip
  if (!ctx.neisGrades || ctx.neisGrades.length === 0) {
    return "NEIS 기록 없음 — 기록 임포트 후 감지 가능";
  }

  // 기록 수집 — competency_analysis에서 이미 조회한 캐시 재사용
  // NEIS 레코드만 스토리라인 입력으로 사용 (imported_content 있는 레코드)
  const records: RecordSummary[] = [];
  let idx = 0;

  if (!ctx.cachedSeteks) {
    const { data } = await supabase
      .from("student_record_seteks")
      .select("id, content, imported_content, grade, subject:subject_id(name)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);
    ctx.cachedSeteks = (data ?? []) as unknown as CachedSetek[];
  }
  // grade 기준 정렬 (원래 order("grade") 대체)
  const sortedSeteks = [...ctx.cachedSeteks].sort((a, b) => a.grade - b.grade);
  for (const s of sortedSeteks) {
    const effectiveContent = s.imported_content?.trim() ? s.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    records.push({ index: idx++, id: s.id, grade: s.grade, subject: s.subject?.name ?? "과목 미정", type: "setek", content: effectiveContent });
  }

  if (!ctx.cachedChangche) {
    const { data } = await supabase
      .from("student_record_changche")
      .select("id, content, imported_content, grade, activity_type")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);
    ctx.cachedChangche = (data ?? []) as CachedChangche[];
  }
  const sortedChangche = [...ctx.cachedChangche].sort((a, b) => a.grade - b.grade);
  for (const c of sortedChangche) {
    const effectiveContent = c.imported_content?.trim() ? c.imported_content : null;
    if (!effectiveContent || effectiveContent.length < 20) continue;
    records.push({ index: idx++, id: c.id, grade: c.grade, subject: c.activity_type ?? "창체", type: "changche", content: effectiveContent });
  }

  if (records.length < 2) {
    return "기록 2건 미만 — 건너뜀";
  }

  const { detectInquiryLinks } = await import("./llm/actions/detectInquiryLinks");
  const result = await detectInquiryLinks(records);
  if (!result.success) throw new Error(result.error);

  const { suggestedStorylines, connections } = result.data;
  if (suggestedStorylines.length === 0) {
    return "스토리라인 연결 감지되지 않음";
  }

  // 기존 AI 스토리라인 삭제 (재실행 시 중복 방지) — 병렬
  const existingStorylines = await repository.findStorylinesByStudent(studentId, tenantId);
  const aiStorylines = existingStorylines.filter((s) => s.title.startsWith("[AI]"));
  await Promise.allSettled(aiStorylines.map((s) => repository.deleteStorylineById(s.id)));

  // sort_order 계산 (수동 스토리라인 뒤에 배치)
  const manualStorylines = existingStorylines.filter((s) => !s.title.startsWith("[AI]"));
  const baseSortOrder = manualStorylines.length > 0
    ? Math.max(...manualStorylines.map((s) => s.sort_order)) + 1
    : 0;

  // 스토리라인 삽입+링크 병렬 (각 단위 내부는 순차)
  let savedCount = 0;
  await Promise.allSettled(suggestedStorylines.map(async (sl, i) => {
    try {
      const storylineId = await repository.insertStoryline({
        tenant_id: tenantId,
        student_id: studentId,
        title: `[AI] ${sl.title}`,
        keywords: sl.keywords,
        narrative: sl.narrative || null,
        career_field: sl.careerField || null,
        grade_1_theme: sl.grade1Theme || null,
        grade_2_theme: sl.grade2Theme || null,
        grade_3_theme: sl.grade3Theme || null,
        strength: "moderate",
        sort_order: baseSortOrder + i,
      });

      // 연결된 레코드 링크 수집
      const linkEntries: Array<{ recordType: string; recordId: string; grade: number; note: string; sortOrder: number }> = [];
      const linkedIds = new Set<string>();
      for (const connIdx of sl.connectionIndices) {
        const conn = connections[connIdx];
        if (!conn) continue;
        for (const recIdx of [conn.fromIndex, conn.toIndex]) {
          const rec = records[recIdx];
          if (!rec || linkedIds.has(rec.id)) continue;
          linkedIds.add(rec.id);
          linkEntries.push({
            recordType: rec.type, recordId: rec.id,
            grade: rec.grade, note: conn.reasoning, sortOrder: linkEntries.length,
          });
        }
      }
      // 링크 병렬 삽입
      await Promise.allSettled(linkEntries.map((le) =>
        repository.insertStorylineLink({
          storyline_id: storylineId,
          record_type: le.recordType,
          record_id: le.recordId,
          grade: le.grade,
          connection_note: le.note,
          sort_order: le.sortOrder,
        }),
      ));
      savedCount++;
    } catch (err) {
      logActionError({ ...LOG_CTX, action: "pipeline.storyline" }, err, { title: sl.title });
    }
  }));

  const preview = `${savedCount}건 스토리라인 생성 (${connections.length}건 연결)`;
  return { preview, result: result.data };
}

// ============================================
// 3. 엣지 계산
// ============================================

export async function runEdgeComputation(ctx: PipelineContext): Promise<TaskRunnerOutput & { computedEdges?: PersistedEdge[] | CrossRefEdge[]; sharedCourseAdequacy?: CourseAdequacyResult | null }> {
  const { supabase, studentId, tenantId, pipelineId, studentGrade, snapshot } = ctx;

  // NEIS 레코드가 하나도 없으면 연결 계산 대상 없음 — skip
  if (!ctx.neisGrades || ctx.neisGrades.length === 0) {
    return "NEIS 기록 없음 — 기록 임포트 후 연결 분석 가능";
  }
  const { buildConnectionGraph } = await import("./cross-reference");
  const { fetchCrossRefData } = await import("./actions/diagnosis");
  const edgeRepo = await import("./edge-repository");
  const { computeContentHash } = await import("./content-hash");

  const { calculateCourseAdequacy } = await import("./course-adequacy");

  const [allTags, crd] = await Promise.all([
    competencyRepo.findActivityTags(studentId, tenantId),
    fetchCrossRefData(studentId, tenantId),
  ]);

  // F2: courseAdequacy 실제 계산 (COURSE_SUPPORTS 엣지 감지용)
  const targetMajor = (snapshot?.target_major as string) ?? null;
  let courseAdequacy: CourseAdequacyResult | null = null;
  if (targetMajor) {
    const { data: scoreRows } = await supabase
      .from("student_internal_scores")
      .select("subject:subject_id(name)")
      .eq("student_id", studentId);
    const takenSubjects = [...new Set(
      ((scoreRows ?? []) as unknown as ScoreRowWithSubject[])
        .map((s) => s.subject?.name)
        .filter((n): n is string => !!n),
    )];

    let offeredSubjects: string[] | null = null;
    const schoolName = (snapshot?.school_name as string) ?? null;
    if (schoolName) {
      const { data: profile } = await supabase
        .from("school_profiles")
        .select("id")
        .eq("school_name", schoolName)
        .maybeSingle();
      if (profile) {
        const { data: offered } = await supabase
          .from("school_offered_subjects")
          .select("subject:subject_id(name)")
          .eq("school_profile_id", profile.id);
        offeredSubjects = ((offered ?? []) as unknown as import("./pipeline-types").OfferedSubjectRow[])
          .map((o) => o.subject?.name)
          .filter((n): n is string => !!n);
      }
    }

    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const enrollmentYear = calculateSchoolYear() - studentGrade + 1;
    const curriculumYear = getCurriculumYear(enrollmentYear);
    courseAdequacy = calculateCourseAdequacy(targetMajor, takenSubjects, offeredSubjects, curriculumYear);
  }

  const graph = buildConnectionGraph({
    allTags,
    storylineLinks: crd.storylineLinks,
    readingLinks: crd.readingLinks,
    courseAdequacy,
    recordLabelMap: new Map(Object.entries(crd.recordLabelMap)),
    readingLabelMap: new Map(Object.entries(crd.readingLabelMap)),
    recordContentMap: crd.recordContentMap
      ? new Map(Object.entries(crd.recordContentMap))
      : undefined,
  });

  // DB 영속화
  const edgeCount = await edgeRepo.replaceEdges(studentId, tenantId, pipelineId, graph);
  await edgeRepo.saveSnapshot(studentId, pipelineId, graph);

  // content_hash 저장 — 레코드의 실제 updated_at을 사용
  const recordIds = Object.keys(crd.recordLabelMap);
  const allRecords: Array<{ id: string; updated_at: string | null }> = [];
  if (recordIds.length > 0) {
    const [sRes, cRes, hRes] = await Promise.all([
      supabase.from("student_record_seteks").select("id, updated_at").in("id", recordIds),
      supabase.from("student_record_changche").select("id, updated_at").in("id", recordIds),
      supabase.from("student_record_haengteuk").select("id, updated_at").in("id", recordIds),
    ]);
    for (const row of [...(sRes.data ?? []), ...(cRes.data ?? []), ...(hRes.data ?? [])]) {
      allRecords.push({ id: row.id, updated_at: row.updated_at ?? null });
    }
    // reading은 recordLabelMap에도 포함될 수 있음
    const missingIds = recordIds.filter((id) => !allRecords.some((r) => r.id === id));
    if (missingIds.length > 0) {
      const { data: rRes } = await supabase.from("student_record_reading").select("id, updated_at").in("id", missingIds);
      for (const row of (rRes ?? [])) {
        allRecords.push({ id: row.id, updated_at: row.updated_at ?? null });
      }
    }
  }
  const hash = computeContentHash(allRecords);
  await supabase
    .from("student_record_analysis_pipelines")
    .update({ content_hash: hash })
    .eq("id", pipelineId);

  // Phase E2: 후속 태스크용 엣지 배열
  const computedEdges = graph.nodes.flatMap((n) => n.edges) as PersistedEdge[] | CrossRefEdge[];

  const preview = `${edgeCount}개 엣지 감지 (${graph.nodes.length}개 영역)`;
  return { preview, result: { totalEdges: graph.totalEdges, nodeCount: graph.nodes.length }, computedEdges, sharedCourseAdequacy: courseAdequacy };
}

// ============================================
// 4. AI 종합 진단
// ============================================

export async function runAiDiagnosis(
  ctx: PipelineContext,
  computedEdges: PersistedEdge[] | CrossRefEdge[],
  sharedCourseAdequacy: CourseAdequacyResult | null,
): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId, pipelineId, studentGrade, snapshot, tasks, coursePlanData, neisGrades } = ctx;

  const currentSchoolYear = calculateSchoolYear();

  const [scores, tags] = await Promise.all([
    competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId),
    competencyRepo.findActivityTags(studentId, tenantId),
  ]);

  // NEIS 학년이 없어 역량 데이터가 0건이면 수강계획 기반 예비 진단으로 전환.
  const hasNeisData = neisGrades && neisGrades.length > 0;

  // NEIS가 있는데 역량 데이터까지 0건이면 역량 분석이 아직 실행되지 않은 것 → 건너뜀
  if (hasNeisData && scores.length === 0 && tags.length === 0) {
    return "역량 데이터 없음 — 건너뜀";
  }

  const coursePlanContext = !hasNeisData
    ? { studentId, tenantId, coursePlanData: coursePlanData ?? null, snapshot }
    : undefined;

  const { generateAiDiagnosis } = await import("./llm/actions/generateDiagnosis");
  // Phase E2: 엣지 데이터 → 진단 프롬프트에 투입
  let diagnosisEdgeSection: string | undefined;
  const edgeComputationFailed = tasks.edge_computation === "failed";
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("./edge-summary");
    diagnosisEdgeSection = buildEdgePromptSection(computedEdges, "diagnosis");
  } else if (edgeComputationFailed) {
    logActionDebug(LOG_CTX, "엣지 계산 실패 → 진단에 연결 분석 미포함", { pipelineId });
  }

  // 보강 컨텍스트: 성적 추이 + 교과이수적합도
  const { data: trendRows } = await supabase
    .from("student_internal_scores")
    .select("subject:subject_id(name), rank_grade, grade, semester")
    .eq("student_id", studentId)
    .order("grade")
    .order("semester");
  const gradeTrend = ((trendRows ?? []) as unknown as ScoreRowWithSubject[])
    .filter((s) => s.rank_grade != null)
    .map((s) => ({
      grade: s.grade ?? 1,
      semester: s.semester ?? 1,
      subjectName: s.subject?.name ?? "",
      rankGrade: s.rank_grade as number,
    }));

  // edge_computation에서 계산한 courseAdequacy 재사용, 없으면 fallback 계산
  let diagCourseAdequacy = sharedCourseAdequacy;
  if (!diagCourseAdequacy && (snapshot?.target_major as string)) {
    try {
      const { calculateCourseAdequacy: calcAdequacyFallback } = await import("./course-adequacy");
      const { getCurriculumYear: getCurrYearFallback } = await import("@/lib/utils/schoolYear");
      const fbEnrollmentYear = calculateSchoolYear() - studentGrade + 1;
      const fbCurriculumYear = getCurrYearFallback(fbEnrollmentYear);
      const fbTargetMajor = snapshot!.target_major as string;

      // 이수과목 조회
      const { data: fbScoreRows } = await supabase
        .from("student_internal_scores")
        .select("subject:subject_id(name)")
        .eq("student_id", studentId);
      const fbTakenSubjects = [...new Set(
        ((fbScoreRows ?? []) as unknown as ScoreRowWithSubject[])
          .map((s) => s.subject?.name)
          .filter((n): n is string => !!n),
      )];

      diagCourseAdequacy = calcAdequacyFallback(fbTargetMajor, fbTakenSubjects, null, fbCurriculumYear);
      logActionDebug(LOG_CTX, "courseAdequacy fallback 계산 완료 (edge_computation 미실행)", { pipelineId });
    } catch (fbErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.diagCourseAdequacyFallback" }, fbErr, { pipelineId });
    }
  }

  // P2-1: 엣지의 shared_competencies에서 역량 연결 빈도 집계
  const edgeCompetencyFreq = new Map<string, number>();
  for (const e of computedEdges) {
    const comps = "shared_competencies" in e ? e.shared_competencies : ("sharedCompetencies" in e ? (e as { sharedCompetencies?: string[] }).sharedCompetencies : null);
    for (const c of comps ?? []) {
      edgeCompetencyFreq.set(c, (edgeCompetencyFreq.get(c) ?? 0) + 1);
    }
  }

  // 전 학년 품질 패턴 집계 (NEIS 데이터가 있는 경우에만 의미 있음)
  let diagQualityPatternSection: string | undefined;
  if (hasNeisData) {
    try {
      const { qualityPatternSection } = await aggregateQualityPatterns(ctx);
      if (qualityPatternSection) diagQualityPatternSection = qualityPatternSection;
    } catch (qpErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.aggregateQualityPatterns" }, qpErr, { pipelineId });
    }
  }

  const result = await generateAiDiagnosis(scores, tags, {
    targetMajor: (snapshot?.target_major as string) ?? undefined,
    schoolName: (snapshot?.school_name as string) ?? undefined,
  }, diagnosisEdgeSection, {
    gradeTrend,
    courseAdequacy: diagCourseAdequacy ? {
      score: diagCourseAdequacy.score,
      majorCategory: diagCourseAdequacy.majorCategory,
      taken: diagCourseAdequacy.taken,
      notTaken: diagCourseAdequacy.notTaken,
      notOffered: diagCourseAdequacy.notOffered,
      generalRate: diagCourseAdequacy.generalRate,
      careerRate: diagCourseAdequacy.careerRate,
      fusionRate: diagCourseAdequacy.fusionRate,
    } : null,
  }, edgeCompetencyFreq, coursePlanContext, diagQualityPatternSection);
  if (!result.success) throw new Error(result.error);

  await diagnosisRepo.upsertDiagnosis({
    tenant_id: tenantId,
    student_id: studentId,
    school_year: currentSchoolYear,
    overall_grade: result.data.overallGrade,
    record_direction: result.data.recordDirection,
    direction_strength: result.data.directionStrength as "strong" | "moderate" | "weak",
    direction_reasoning: result.data.directionReasoning || null,
    strengths: result.data.strengths,
    weaknesses: result.data.weaknesses,
    improvements: result.data.improvements as unknown as import("@/lib/supabase/database.types").Json,
    recommended_majors: result.data.recommendedMajors,
    strategy_notes: result.data.strategyNotes,
    source: "ai",
    status: "draft",
  } as DiagnosisInsert);

  const warnSuffix = result.data.warnings?.length ? ` ⚠️ ${result.data.warnings.join(", ")}` : "";
  const diagLabel = hasNeisData ? "종합진단" : "예비진단(수강계획 기반)";
  return {
    preview: `${diagLabel} 생성 (등급: ${result.data.overallGrade}, 방향: ${result.data.directionStrength})${warnSuffix}`,
    result: { weaknesses: result.data.weaknesses, improvements: result.data.improvements },
  };
}

// ============================================
// 5. 수강 추천
// ============================================

export async function runCourseRecommendation(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId } = ctx;

  const { generateRecommendationsAction } = await import("./actions/coursePlan");
  const result = await generateRecommendationsAction(studentId, tenantId);
  if (!result.success) throw new Error(result.error);
  const count = Array.isArray(result.data) ? result.data.length : 0;
  return `${count}개 과목 추천됨`;
}

// ============================================
// 6. 가이드 매칭 + 배정
// ============================================

export async function runGuideMatching(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;

  const { autoRecommendGuidesAction } = await import("@/lib/domains/guide/actions/auto-recommend");
  const classificationId = snapshot?.target_sub_classification_id as number | null;
  const result = await autoRecommendGuidesAction({
    studentId,
    classificationId,
  });
  if (!result.success) throw new Error(result.error);
  const guides = Array.isArray(result.data) ? result.data : [];
  let assigned = 0;
  if (guides.length > 0) {
    const { data: existing } = await supabase
      .from("exploration_guide_assignments")
      .select("guide_id")
      .eq("student_id", studentId);
    const existingIds = new Set((existing ?? []).map((a) => a.guide_id));
    const newGuides = guides.filter((g) => !existingIds.has(g.id));
    if (newGuides.length > 0) {
      const currentSchoolYear = calculateSchoolYear();

      // area-resolver로 가이드별 대상 영역 도출
      const { resolveGuideTargetArea } = await import("@/lib/domains/guide/actions/area-resolver");
      const areaMap = await resolveGuideTargetArea(newGuides.map((g) => g.id));

      // 기존 세특 조회 (auto-link용)
      const { data: existingSeteks } = await supabase
        .from("student_record_seteks")
        .select("id, subject_id")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      const setekBySubject = new Map<string, string>();
      for (const s of existingSeteks ?? []) {
        if (!setekBySubject.has(s.subject_id)) {
          setekBySubject.set(s.subject_id, s.id);
        }
      }

      const { error: insertErr } = await supabase
        .from("exploration_guide_assignments")
        .insert(newGuides.map((g) => {
          const area = areaMap.get(g.id);
          const targetSubjectId = area?.targetSubjectId ?? null;
          const setekId = targetSubjectId ? setekBySubject.get(targetSubjectId) ?? null : null;
          return {
            tenant_id: tenantId,
            student_id: studentId,
            guide_id: g.id,
            assigned_by: null,
            school_year: currentSchoolYear,
            grade: studentGrade,
            status: "assigned",
            student_notes: `[AI] 파이프라인 자동 배정 (${g.match_reason})`,
            target_subject_id: targetSubjectId,
            target_activity_type: area?.targetActivityType ?? null,
            linked_record_type: setekId ? "setek" : null,
            linked_record_id: setekId,
            ai_recommendation_reason: g.match_reason,
          };
        }));
      if (!insertErr) assigned = newGuides.length;
    }
  }
  return `${assigned}건 가이드 배정 (${guides.length}건 추천)`;
}

// ============================================
// 10. 활동 요약서
// ============================================

export async function runActivitySummary(
  ctx: PipelineContext,
  computedEdges: PersistedEdge[] | CrossRefEdge[],
): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade } = ctx;

  const { generateActivitySummary } = await import("./llm/actions/generateActivitySummary");
  const grades = Array.from({ length: studentGrade }, (_, i) => i + 1);
  // Phase E2: 엣지 데이터 → 요약서 프롬프트에 투입
  let summaryEdgeSection: string | undefined;
  if (computedEdges.length > 0) {
    const { buildEdgePromptSection } = await import("./edge-summary");
    summaryEdgeSection = buildEdgePromptSection(computedEdges, "summary");
  }
  // Phase 6: 가이드 배정 컨텍스트 → 요약서 프롬프트에 투입
  const { buildGuideContextSection } = await import("./guide-context");
  const summaryContextSection = await buildGuideContextSection(studentId, "summary");

  // 진단 데이터 → 요약서에 강점/약점 맥락 투입
  let diagnosisSection: string | undefined;
  const summaryDiag = await diagnosisRepo.findDiagnosis(studentId, calculateSchoolYear(), tenantId, "ai");
  if (summaryDiag) {
    const parts: string[] = ["## 종합 진단 요약 (활동 서술에 반영)"];
    if (summaryDiag.strengths && (summaryDiag.strengths as string[]).length > 0) {
      parts.push(`강점: ${(summaryDiag.strengths as string[]).join("; ")}`);
    }
    if (summaryDiag.weaknesses && (summaryDiag.weaknesses as string[]).length > 0) {
      parts.push(`보완 필요: ${(summaryDiag.weaknesses as string[]).join("; ")}`);
    }
    if (Array.isArray(summaryDiag.improvements) && (summaryDiag.improvements as unknown[]).length > 0) {
      const imps = summaryDiag.improvements as Array<{ priority: string; area: string; action: string }>;
      parts.push(`개선 전략: ${imps.map((i) => `[${i.priority}] ${i.area}`).join(", ")}`);
    }
    if (parts.length > 1) diagnosisSection = parts.join("\n");
  }

  const extraSections = [summaryEdgeSection, summaryContextSection, diagnosisSection].filter(Boolean).join("\n") || undefined;
  const result = await generateActivitySummary(studentId, grades, extraSections);
  if (!result.success) throw new Error(result.error);
  return "활동 요약서 생성 완료";
}

// ============================================
// 11. 보완전략 자동 제안
// ============================================

export async function runAiStrategy(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, studentGrade, snapshot, pipelineId, results } = ctx;

  const currentSchoolYear = calculateSchoolYear();

  // 1~3. 진단 + 역량 + 기존 전략 병렬 조회
  const [diagnosis, aiScores, existingStrategies] = await Promise.all([
    diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai"),
    competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai"),
    diagnosisRepo.findStrategies(studentId, currentSchoolYear, tenantId),
  ]);
  const weaknesses = (diagnosis?.weaknesses as string[]) ?? [];

  const { COMPETENCY_ITEMS: CI } = await import("./constants");
  const weakCompetencies = aiScores
    .filter((s) => ["B", "B-", "C"].includes(s.grade_value))
    .map((s) => ({
      item: s.competency_item as import("./types").CompetencyItemCode,
      grade: s.grade_value as import("./types").CompetencyGrade,
      label: CI.find((i) => i.code === s.competency_item)?.label ?? s.competency_item,
    }));

  // 루브릭 질문별 약점 추출 (B- 이하)
  const { COMPETENCY_RUBRIC_QUESTIONS: CRQ } = await import("./constants");
  const rubricWeaknesses: string[] = [];
  for (const score of aiScores) {
    const rubrics = Array.isArray(score.rubric_scores) ? score.rubric_scores as Array<{ questionIndex: number; grade: string; reasoning: string }> : [];
    const questions = CRQ[score.competency_item as import("./types").CompetencyItemCode] ?? [];
    for (const r of rubrics) {
      if (["B-", "C"].includes(r.grade) && questions[r.questionIndex]) {
        const itemLabel = CI.find((i) => i.code === score.competency_item)?.label ?? score.competency_item;
        rubricWeaknesses.push(`${itemLabel} — "${questions[r.questionIndex]}" (${r.grade}): ${r.reasoning.slice(0, 50)}`);
      }
    }
  }

  if (weaknesses.length === 0 && weakCompetencies.length === 0 && rubricWeaknesses.length === 0) {
    return "약점/부족역량 없음 — 건너뜀";
  }

  // 재실행 안전성: 기존 planned 전략 삭제 (in_progress/done은 보존)
  const plannedStrategies = existingStrategies.filter((s) => s.status === "planned");
  if (plannedStrategies.length > 0) {
    await Promise.allSettled(
      plannedStrategies.map((s) => diagnosisRepo.deleteStrategy(s.id)),
    );
  }

  // 삭제 후 남은 전략만으로 중복 체크
  const keptStrategies = existingStrategies.filter((s) => s.status !== "planned");
  const existingContents = keptStrategies.map((s) => s.strategy_content.slice(0, 60));

  // 4. AI 보완전략 제안
  // P2-1: 진단의 improvements를 시드 데이터로 전달
  const diagnosisImprovements = Array.isArray(diagnosis?.improvements)
    ? (diagnosis.improvements as Array<{ priority: string; area: string; gap: string; action: string; outcome: string }>)
    : [];

  const { suggestStrategies } = await import("./llm/actions/suggestStrategies");
  const result = await suggestStrategies({
    weaknesses,
    weakCompetencies,
    rubricWeaknesses,
    diagnosisImprovements,
    grade: studentGrade,
    targetMajor: (snapshot?.target_major as string) ?? undefined,
    existingStrategies: existingContents,
  });
  if (!result.success) throw new Error(result.error);

  // 5. DB 저장 — 병렬
  const strategyResults = await Promise.allSettled(
    result.data.suggestions.map((suggestion) =>
      diagnosisRepo.insertStrategy({
        student_id: studentId,
        tenant_id: tenantId,
        school_year: currentSchoolYear,
        grade: studentGrade,
        target_area: suggestion.targetArea,
        strategy_content: suggestion.strategyContent,
        priority: suggestion.priority,
        status: "planned",
        reasoning: suggestion.reasoning || null,
        source_urls: suggestion.sourceUrls ?? null,
      }),
    ),
  );
  const saved = strategyResults.filter((r) => r.status === "fulfilled").length;
  const strategyFailed = strategyResults.filter((r) => r.status === "rejected");
  if (strategyFailed.length > 0) {
    logActionError({ ...LOG_CTX, action: "pipeline.ai_strategy.save" }, new Error(`${strategyFailed.length}건 저장 실패`), {
      pipelineId,
      reasons: strategyFailed.map((r) => r.status === "rejected" ? String(r.reason) : "").filter(Boolean).slice(0, 3),
    });
  }

  // results는 컨텍스트에서 참조하므로 사용됨을 명시
  void results;

  return `${saved}건 보완전략 제안됨`;
}

// ============================================
// 12. 우회학과 분석
// ============================================

export async function runBypassAnalysis(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId } = ctx;

  const { discoverDepartmentsFromDiagnosis } = await import("@/lib/domains/bypass-major/department-discovery");
  const currentSchoolYear = calculateSchoolYear();

  const discovery = await discoverDepartmentsFromDiagnosis(studentId, tenantId, currentSchoolYear);

  if (discovery.targetDepartments.length === 0) {
    return "매칭 학과 없음 — 건너뜀";
  }

  const { runBypassPipeline } = await import("@/lib/domains/bypass-major/pipeline");
  let totalGenerated = 0;
  let totalEnriched = 0;
  let totalCompetency = 0;
  const targetNames: string[] = [];

  // 발견된 대표 학과별로 우회학과 파이프라인 실행 (최대 3개)
  // O3: 진단 약점을 우회학과 3축 평가에 전달
  const bypassDiagnosis = await diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai");
  const bypassWeaknesses = (bypassDiagnosis?.weaknesses as string[]) ?? [];
  const bypassImprovements = Array.isArray(bypassDiagnosis?.improvements)
    ? (bypassDiagnosis.improvements as Array<{ priority: string; area: string }>)
    : [];

  for (const target of discovery.targetDepartments.slice(0, 3)) {
    try {
      const result = await runBypassPipeline({
        studentId,
        tenantId,
        targetDeptId: target.departmentId,
        schoolYear: currentSchoolYear,
        diagnosticWeaknesses: bypassWeaknesses.length > 0 ? bypassWeaknesses : undefined,
        diagnosticImprovements: bypassImprovements.length > 0 ? bypassImprovements : undefined,
      });
      totalGenerated += result.totalGenerated;
      totalEnriched += result.enriched;
      totalCompetency += result.withCompetency;
      targetNames.push(target.midClassification ?? target.departmentName);
    } catch (err) {
      logActionError({ ...LOG_CTX, action: "pipeline.bypass.target" }, err, {
        targetDeptId: target.departmentId,
      });
    }
  }

  // D-3: 모의고사 존재 시 자동 배치 분석 + placement_grade 백필
  let placementInfo = "";
  try {
    const { autoRunPlacement, backfillPlacementGrades } = await import("@/lib/domains/admission/placement/auto-placement");
    const placementResult = await autoRunPlacement(studentId, tenantId);
    if (placementResult) {
      const backfilled = await backfillPlacementGrades(studentId, tenantId, currentSchoolYear);
      placementInfo = ` + 배치 ${placementResult.verdictCount}개 대학 (${backfilled}건 연동)`;
    }
  } catch (err) {
    logActionDebug(LOG_CTX, `자동 배치 스킵: ${err}`);
  }

  const sourceLabel = discovery.source === "diagnosis_recommended" ? "AI진단" : "희망학과";
  const extras: string[] = [];
  if (totalCompetency > 0) extras.push(`역량 ${totalCompetency}건`);
  if (totalEnriched > 0) extras.push(`확충 ${totalEnriched}건`);
  const extrasStr = extras.length > 0 ? ` [${extras.join(", ")}]` : "";
  return `${totalGenerated}건 우회학과 후보 생성 (${sourceLabel}: ${targetNames.join(", ")})${extrasStr}${placementInfo}`;
}

// ============================================
// 13. 면접 예상 질문 생성
// ============================================

export async function runInterviewGeneration(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { supabase, studentId, tenantId, snapshot, results } = ctx;

  // 세특/창체 레코드 수집 (캐시 재사용)
  if (!ctx.cachedSeteks) {
    const { data } = await supabase
      .from("student_record_seteks")
      .select("id, content, grade, subject:subject_id(name)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);
    ctx.cachedSeteks = (data ?? []) as unknown as CachedSetek[];
  }
  if (!ctx.cachedChangche) {
    const { data } = await supabase
      .from("student_record_changche")
      .select("id, content, grade, activity_type")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);
    ctx.cachedChangche = (data ?? []) as CachedChangche[];
  }

  // 타입 가드: 세특 vs 창체 판별
  type CachedRecord = import("./pipeline-types").CachedSetek | import("./pipeline-types").CachedChangche;
  function isCachedSetek(r: CachedRecord): r is import("./pipeline-types").CachedSetek {
    return "subject" in r;
  }
  function getSubjectLabel(r: CachedRecord): string {
    return isCachedSetek(r) ? (r.subject?.name ?? "과목 미정") : ((r as import("./pipeline-types").CachedChangche).activity_type ?? "기록");
  }
  function getRecordType(r: CachedRecord): "setek" | "changche" {
    return isCachedSetek(r) ? "setek" : "changche";
  }

  // 가장 긴 세특 레코드 5건 선택 (면접 질문 생성용)
  const candidateRecords: CachedRecord[] = [...ctx.cachedSeteks!, ...ctx.cachedChangche!]
    .filter((r) => r.content && r.content.trim().length >= 50)
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, 5);

  if (candidateRecords.length === 0) return "기록 부족 — 건너뜀";

  const { generateInterviewQuestions } = await import("./llm/actions/generateInterviewQuestions");

  // 메인 레코드 + 추가 레코드로 교차 질문 생성
  const main = candidateRecords[0];
  const mainSubject = getSubjectLabel(main);
  const mainType = getRecordType(main);

  const additionalRecords = candidateRecords.slice(1).map((r) => ({
    content: r.content,
    recordType: getRecordType(r),
    subjectName: getSubjectLabel(r),
    grade: r.grade,
  }));

  // 진단 약점을 면접 질문에 반영 (DB에서 조회 — in-memory 결과는 ai_diagnosis 실패 시 undefined)
  const interviewDiag = await diagnosisRepo.findDiagnosis(studentId, calculateSchoolYear(), tenantId, "ai");
  const diagWeaknesses = interviewDiag?.weaknesses as string[] | undefined;

  // 진로 컨텍스트
  const targetMajor = (snapshot?.target_major as string) ?? undefined;
  const careerContext = targetMajor ? {
    targetMajor,
    targetSubClassification: (snapshot as Record<string, unknown>)?.target_sub_classification_name as string | undefined,
  } : undefined;

  // 역량 약점 (B- 이하)
  let weakCompetencies: { item: string; label: string; grade: string }[] | undefined;
  const diagScores = (results.competency_analysis as { competencyScores?: Array<{ competency_item: string; grade_value: string }> } | undefined)?.competencyScores;
  if (diagScores) {
    const { COMPETENCY_ITEMS } = await import("./constants");
    weakCompetencies = diagScores
      .filter((s) => s.grade_value === "B-" || s.grade_value === "C" || s.grade_value === "C+")
      .map((s) => {
        const item = COMPETENCY_ITEMS.find((c) => c.code === s.competency_item);
        return { item: s.competency_item, label: item?.label ?? s.competency_item, grade: s.grade_value };
      });
    if (weakCompetencies.length === 0) weakCompetencies = undefined;
  }

  // Q4: 기존 질문 조회 (중복 방지)
  const { data: existingQs } = await supabase
    .from("student_record_interview_questions")
    .select("question")
    .eq("student_id", studentId)
    .limit(15);
  const existingQuestions = existingQs?.map((q) => q.question).filter(Boolean) ?? [];

  const result = await generateInterviewQuestions({
    content: main.content,
    recordType: mainType,
    subjectName: mainSubject,
    grade: main.grade,
    additionalRecords,
    diagnosticWeaknesses: diagWeaknesses,
    careerContext,
    weakCompetencies,
    existingQuestions: existingQuestions.length > 0 ? existingQuestions : undefined,
  });

  if (!result.success) throw new Error(result.error);

  // DB 저장
  const questions = result.data.questions ?? [];
  if (questions.length > 0) {
    const { error: insertErr } = await supabase
      .from("student_record_interview_questions")
      .upsert(
        questions.map((q) => ({
          student_id: studentId,
          tenant_id: tenantId,
          question: q.question,
          question_type: q.questionType,
          suggested_answer: q.suggestedAnswer ?? null,
          difficulty: q.difficulty,
          source_type: mainType,
          is_ai_generated: true,
        })),
        { onConflict: "student_id,question", ignoreDuplicates: true },
      );
    if (insertErr) {
      logActionError({ ...LOG_CTX, action: "pipeline.interview.insert" }, insertErr, { studentId });
    }
  }

  return `${questions.length}건 면접 질문 생성`;
}

// ============================================
// 14. 로드맵 자동 생성
// ============================================

export async function runRoadmapGeneration(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  const { studentId, tenantId, pipelineId, studentGrade } = ctx;

  // Phase R1: LLM 기반 로드맵 생성 (planning/analysis 자동 감지)
  const { generateAiRoadmap } = await import("./llm/actions/generateRoadmap");
  // NEIS 기반 모드 판정: neisGrades가 있으면 실 데이터 분석 모드, 없으면 수강계획 기반 계획 모드
  const llmMode = (ctx.neisGrades && ctx.neisGrades.length > 0) ? "analysis" : "planning";

  const llmResult = await generateAiRoadmap(studentId, llmMode);
  if (llmResult.success && llmResult.data) {
    return {
      preview: `${llmResult.data.items.length}건 AI 로드맵 (${llmMode})`,
      result: { mode: llmMode, ...llmResult.data },
    };
  }

  // LLM 실패 → 규칙 기반 fallback
  logActionDebug(LOG_CTX, `roadmap LLM 실패 → rule-based fallback: ${"error" in llmResult ? llmResult.error : "unknown"}`, { pipelineId });

  const currentSchoolYear = calculateSchoolYear();
  const [storylines, setekGuidesRes, diagnosis] = await Promise.all([
    repository.findStorylinesByStudent(studentId, tenantId),
    (async () => {
      const { fetchSetekGuides } = await import("./actions/activitySummary");
      return fetchSetekGuides(studentId).catch(() => ({ success: false as const, error: "" }));
    })(),
    diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai"),
  ]);

  if (storylines.length === 0 && !diagnosis) {
    return "스토리라인/진단 없음 — 건너뜀";
  }

  const existing = await repository.findAllRoadmapItemsByStudent(studentId, tenantId);
  const aiItems = existing.filter((r) => r.plan_content.startsWith("[AI]"));
  await Promise.allSettled(aiItems.map((r) => repository.deleteRoadmapItemById(r.id)));

  const setekGuides = setekGuidesRes.success && setekGuidesRes.data ? setekGuidesRes.data : [];
  const roadmapItems: Array<{ area: string; plan_content: string; plan_keywords: string[]; grade: number; semester: number | null; storyline_id: string | null }> = [];

  for (const sl of storylines) {
    for (const { grade, theme } of [
      { grade: 1, theme: sl.grade_1_theme },
      { grade: 2, theme: sl.grade_2_theme },
      { grade: 3, theme: sl.grade_3_theme },
    ].filter((t) => t.theme && t.grade >= studentGrade)) {
      roadmapItems.push({ area: "setek", plan_content: `[AI] ${sl.title} — ${theme}`, plan_keywords: sl.keywords ?? [], grade, semester: null, storyline_id: sl.id });
    }
  }

  for (const guide of setekGuides) {
    if (!guide.direction) continue;
    const guideGrade = guide.school_year ? studentGrade - (currentSchoolYear - guide.school_year) : studentGrade;
    const effectiveGrade = (guideGrade >= 1 && guideGrade <= 3) ? guideGrade : studentGrade;
    roadmapItems.push({ area: "setek", plan_content: `[AI] 세특방향: ${guide.direction.slice(0, 100)}`, plan_keywords: guide.keywords ?? [], grade: effectiveGrade, semester: null, storyline_id: null });
  }

  const improvements = Array.isArray(diagnosis?.improvements) ? (diagnosis.improvements as Array<{ priority: string; area: string; action: string }>) : [];
  if (improvements.length > 0) {
    const priorityOrder = { "높음": 0, "중간": 1, "낮음": 2 } as Record<string, number>;
    for (const imp of [...improvements].sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)).slice(0, 3)) {
      roadmapItems.push({ area: "general", plan_content: `[AI] [${imp.priority}] ${imp.area}: ${imp.action}`, plan_keywords: [], grade: studentGrade, semester: null, storyline_id: null });
    }
  } else {
    for (const weakness of ((diagnosis?.weaknesses as string[]) ?? []).slice(0, 3)) {
      roadmapItems.push({ area: "general", plan_content: `[AI] 보완: ${weakness}`, plan_keywords: [], grade: studentGrade, semester: null, storyline_id: null });
    }
  }

  if (roadmapItems.length === 0) return "생성 가능한 로드맵 없음";

  let savedCount = 0;
  const baseSortOrder = existing.filter((r) => !r.plan_content.startsWith("[AI]")).length;
  await Promise.allSettled(
    roadmapItems.map((item, i) =>
      repository.insertRoadmapItem({ tenant_id: tenantId, student_id: studentId, school_year: currentSchoolYear, grade: item.grade, semester: item.semester, area: item.area, plan_content: item.plan_content, plan_keywords: item.plan_keywords, storyline_id: item.storyline_id, sort_order: baseSortOrder + i }).then(() => { savedCount++; }),
    ),
  );
  return `${savedCount}건 로드맵 생성 (fallback)`;
}
