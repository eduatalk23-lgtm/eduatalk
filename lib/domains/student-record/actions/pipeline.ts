"use server";

// ============================================
// AI 초기 분석 파이프라인
//
// [Grade Pipeline — 학년별, 7태스크×6Phase]
//   Phase 1: competency_setek
//   Phase 2: competency_changche
//   Phase 3: competency_haengteuk
//   Phase 4: setek_guide + slot_generation (병렬)
//   Phase 5: changche_guide
//   Phase 6: haengteuk_guide
//
// [Synthesis Pipeline — 종합, 10태스크×6Phase]
//   Phase 1: storyline_generation
//   Phase 2: edge_computation
//   Phase 3: ai_diagnosis + course_recommendation (병렬)
//   Phase 4: bypass_analysis
//   Phase 5: activity_summary + ai_strategy (병렬)
//   Phase 6: interview_generation + roadmap_generation (병렬)
//
// [Legacy Pipeline — 단일 15태스크, 하위 호환 유지]
//   pipeline-phases.ts → /api/admin/pipeline/run ~ phase-8
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { createSupabaseAdminClient, type SupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import type {
  PipelineStatus,
  PipelineTaskKey,
  PipelineTaskStatus,
  PipelineTaskResults,
  TaskRunnerOutput,
  ScoreRowWithSubject,
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
  OfferedSubjectRow,
} from "../pipeline-types";
import { PIPELINE_TASK_KEYS, PIPELINE_TASK_TIMEOUTS, computeCascadeResetKeys } from "../pipeline-types";
import type { GradePipelineTaskKey } from "../pipeline-types";
import {
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
  GRADE_TASK_DEPENDENTS,
} from "../pipeline-types";
import type { PersistedEdge } from "../edge-repository";
import type { CrossRefEdge } from "../cross-reference";
import * as competencyRepo from "../competency-repository";
import * as diagnosisRepo from "../diagnosis-repository";
import * as repository from "../repository";
import type { ActivityTagInsert, CompetencyScoreInsert, DiagnosisInsert } from "../types";
import type { HighlightAnalysisInput, HighlightAnalysisResult } from "../llm/types";
import type { RecordSummary } from "../llm/prompts/inquiryLinking";
import { resolveRecordData, deriveGradeCategories } from "../pipeline-data-resolver";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

/** 레코드 평균 길이 기반 배치 크기 추정 (출력 토큰 제한 방지) */
function estimateBatchSize(records: Array<{ content: string }>): number {
  if (records.length <= 2) return records.length;
  const avgLength = records.reduce((sum, r) => sum + r.content.length, 0) / records.length;
  if (avgLength > 1000) return 2;
  if (avgLength > 600) return 3;
  return 4;
}

/** 동시성 제한 병렬 실행 (I-9: worker pool 패턴 통일) */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (idx < items.length) {
        const i = idx++;
        await fn(items[i]);
      }
    },
  );
  await Promise.allSettled(workers);
}

/** Promise에 타임아웃을 적용. 초과 시 reject. */
function withTaskTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  taskKey: PipelineTaskKey,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Task "${taskKey}" timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ============================================
// 파이프라인 상태 조회
// ============================================

/** 학생의 최신 파이프라인 상태 조회 */
export async function fetchPipelineStatus(
  studentId: string,
): Promise<ActionResponse<PipelineStatus | null>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("student_record_analysis_pipelines")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return createSuccessResponse(null);

    // 하위 호환: 이전 5-task 파이프라인에서 새 키가 누락된 경우 "pending" 기본값
    const rawTasks = (data.tasks ?? {}) as Record<string, PipelineTaskStatus>;
    const tasks = {} as Record<PipelineTaskKey, PipelineTaskStatus>;
    for (const key of PIPELINE_TASK_KEYS) {
      tasks[key] = rawTasks[key] ?? "pending";
    }

    return createSuccessResponse<PipelineStatus>({
      id: data.id,
      studentId: data.student_id,
      status: data.status,
      mode: (data.mode as "analysis" | "prospective" | null) ?? null,
      tasks,
      taskPreviews: (data.task_previews ?? {}) as Record<string, string>,
      taskResults: (data.task_results ?? {}) as PipelineTaskResults,
      errorDetails: data.error_details as Record<string, string> | null,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
      contentHash: data.content_hash ?? null,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPipelineStatus" }, error, { studentId });
    return createErrorResponse("파이프라인 상태 조회 실패");
  }
}

// ============================================
// 속도 제한 (학생당 1 running + 5/hour)
// ============================================

async function checkPipelineRateLimit(
  studentId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentPipelines, error } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, status")
    .eq("student_id", studentId)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false });

  if (error) {
    logActionError({ ...LOG_CTX, action: "checkPipelineRateLimit" }, error, { studentId });
    return null; // fail-open
  }

  const rows = recentPipelines ?? [];
  if (rows.some((r) => r.status === "pending" || r.status === "running")) {
    return "이미 실행 중인 파이프라인이 있습니다. 완료 후 다시 시도해주세요.";
  }
  if (rows.length >= 5) {
    return "1시간 내 최대 5회까지 파이프라인을 실행할 수 있습니다. 잠시 후 다시 시도해주세요.";
  }
  return null;
}

// ============================================
// P2-3: 특정 태스크만 재실행
// ============================================

/** 완료된 파이프라인에서 특정 태스크들만 "pending"으로 리셋 후 재실행 */
export async function rerunPipelineTasks(
  pipelineId: string,
  taskKeys: PipelineTaskKey[],
): Promise<ActionResponse<{ pipelineId: string }>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: pipeline, error: fetchErr } = await supabase
      .from("student_record_analysis_pipelines")
      .select("*")
      .eq("id", pipelineId)
      .single();

    if (fetchErr || !pipeline) {
      return createErrorResponse("파이프라인을 찾을 수 없습니다");
    }
    if (pipeline.status === "running") {
      return createErrorResponse("실행 중인 파이프라인은 재실행할 수 없습니다");
    }

    // 지정된 태스크 + 의존 태스크를 pending으로 리셋
    const tasks = (pipeline.tasks ?? {}) as Record<string, PipelineTaskStatus>;
    const toReset = computeCascadeResetKeys(taskKeys);

    for (const key of toReset) {
      tasks[key] = "pending";
    }

    await supabase
      .from("student_record_analysis_pipelines")
      .update({ status: "running", tasks, completed_at: null })
      .eq("id", pipelineId);

    // competency_analysis 재실행 시 analysis_cache 무효화 → LLM 강제 재호출
    if (toReset.has("competency_analysis")) {
      await competencyRepo.deleteAnalysisCacheByStudentId(
        pipeline.student_id as string,
        pipeline.tenant_id as string,
      );
    }

    const existingState: ExistingPipelineState = {
      tasks,
      previews: (pipeline.task_previews ?? {}) as Record<string, string>,
      results: (pipeline.task_results ?? {}) as Record<string, unknown>,
      errors: (pipeline.error_details ?? {}) as Record<string, string>,
    };

    return createSuccessResponse({
      pipelineId,
      studentId: pipeline.student_id,
      tenantId: pipeline.tenant_id,
      studentSnapshot: pipeline.input_snapshot as Record<string, unknown> | null,
      existingState,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "rerunPipelineTasks" }, error, { pipelineId });
    return createErrorResponse("태스크 재실행 실패");
  }
}

// ============================================
// 태스크 실행 (내부)
// ============================================

/** 이어서 실행 시 복원할 기존 파이프라인 상태 */
interface ExistingPipelineState {
  tasks: Record<string, PipelineTaskStatus>;
  previews: Record<string, string>;
  results: Record<string, unknown>;
  errors: Record<string, string>;
}

export async function executePipelineTasks(
  pipelineId: string,
  studentId: string,
  tenantId: string,
  studentSnapshot: Record<string, unknown> | null,
  existingState?: ExistingPipelineState,
) {
  // I-7: fire-and-forget에서 request context(cookies) 만료 방지 → Admin Client 사용
  // 진입점(runInitialAnalysisPipeline/resumePipeline)에서 requireAdminOrConsultant() 이미 검증 완료
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Admin client unavailable — SUPABASE_SERVICE_ROLE_KEY missing");
  const supabase = admin;
  const tasks: Record<string, PipelineTaskStatus> = {};
  const previews: Record<string, string> = {};
  const results: PipelineTaskResults = {};
  const errors: Record<string, string> = {};

  // 이어서 실행: 기존 완료 태스크의 preview/result 복원
  if (existingState) {
    for (const key of PIPELINE_TASK_KEYS) {
      if (existingState.tasks[key] === "completed") {
        tasks[key] = "completed";
        if (existingState.previews[key]) previews[key] = existingState.previews[key];
        if (existingState.results[key]) results[key] = existingState.results[key];
      } else {
        tasks[key] = "pending";
      }
    }
    // 실패 태스크의 이전 에러는 제거 (재시도이므로)
  } else {
    for (const key of PIPELINE_TASK_KEYS) {
      tasks[key] = "pending";
    }
  }

  // Phase E2: edge_computation에서 수집 → 후속 태스크에서 context별 프롬프트 생성
  // DB 복원 시 PersistedEdge[], 그래프 계산 시 CrossRefEdge[]
  let computedEdges: PersistedEdge[] | CrossRefEdge[] = [];

  // 이어서 실행 시 edge_computation이 이미 완료되었으면 DB에서 엣지 복원
  if (existingState?.tasks.edge_computation === "completed") {
    const edgeRepo = await import("../edge-repository");
    const persistedEdges = await edgeRepo.findEdges(studentId, tenantId);
    computedEdges = persistedEdges;
  }

  // C2: 태스크 간 공유 레코드 캐시 (중복 DB 조회 방지)
  let cachedSeteks: CachedSetek[] | null = null;
  let cachedChangche: CachedChangche[] | null = null;
  let cachedHaengteuk: CachedHaengteuk[] | null = null;

  // studentSnapshot이 없거나 grade가 누락되면 DB 재조회
  let snapshot = studentSnapshot;
  if (!snapshot?.grade) {
    const { data: fresh } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();
    if (fresh) snapshot = fresh as Record<string, unknown>;
  }
  const studentGrade = (snapshot?.grade as number) ?? 3;

  // ── Phase V1: 파이프라인 모드 감지 ──
  // 레코드 캐시를 조기 조회하여 content 유무로 모드 결정
  {
    const [sRes, cRes, hRes] = await Promise.all([
      supabase
        .from("student_record_seteks")
        .select("id, content, imported_content, grade, subject:subject_id(name)")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      supabase
        .from("student_record_changche")
        .select("id, content, imported_content, grade, activity_type")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
      supabase
        .from("student_record_haengteuk")
        .select("id, content, imported_content, grade")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
    ]);
    cachedSeteks = (sRes.data ?? []) as unknown as CachedSetek[];
    cachedChangche = (cRes.data ?? []) as CachedChangche[];
    cachedHaengteuk = (hRes.data ?? []) as CachedHaengteuk[];
  }

  const resolvedRecords = resolveRecordData(cachedSeteks, cachedChangche, cachedHaengteuk);
  const { neisGrades, consultingGrades } = deriveGradeCategories(resolvedRecords);
  const hasNeisData = neisGrades.length > 0;

  // 수강계획 조회 (prospective 여부 결정) — admin client 직접 사용 (fire-and-forget 컨텍스트)
  let coursePlanData: import("../course-plan/types").CoursePlanTabData | null = null;
  {
    const { data: planRows } = await supabase
      .from("student_course_plans")
      .select(`
        *,
        subject:subject_id (
          id, name,
          subject_type:subject_type_id ( name ),
          subject_group:subject_group_id ( name )
        )
      `)
      .eq("student_id", studentId)
      .order("grade")
      .order("semester")
      .order("priority", { ascending: false });
    if (planRows) {
      coursePlanData = { plans: planRows as unknown as import("../course-plan/types").CoursePlanWithSubject[] };
    }
  }
  const hasCoursePlans = coursePlanData?.plans?.some(
    (p) => p.plan_status === "confirmed" || p.plan_status === "recommended",
  ) ?? false;

  // DB에 모드 저장 (hasNeisData 기준으로 판정)
  await supabase
    .from("student_record_analysis_pipelines")
    .update({ mode: hasNeisData ? "analysis" : "prospective" })
    .eq("id", pipelineId);

  // 공유 변수: edge_computation에서 계산한 courseAdequacy를 ai_diagnosis에서 재사용
  let sharedCourseAdequacy: import("../types").CourseAdequacyResult | null = null;

  const taskRunners: Array<{ key: PipelineTaskKey; run: () => Promise<TaskRunnerOutput> }> = [
    // ── 1. 역량 분석 (가장 먼저: 태그+등급 생성 → 진단/가이드의 입력) ──
    {
      key: "competency_analysis",
      run: async () => {
        // NEIS 없음 → 실 기록 없으므로 skip
        if (!hasNeisData) {
          return "신입생 모드 — 기록 입력 후 분석";
        }
        const { analyzeSetekWithHighlight } = await import("../llm/actions/analyzeWithHighlight");
        const { calculateCourseAdequacy: calcAdequacy } = await import("../course-adequacy");
        const { computeRecordContentHash } = await import("../content-hash");
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

          // Phase QA: 품질 점수 저장 (fire-and-forget — 저장 실패가 파이프라인을 중단하지 않음)
          // NOTE: overall_score 가중치가 버전에 따라 다름:
          //   - scientific_validity IS NULL (구버전): specificity×30 + coherence×20 + depth×30 + grammar×20
          //   - scientific_validity IS NOT NULL (신버전): specificity×25 + coherence×15 + depth×25 + grammar×10 + scientificValidity×25
          // 비교 시 scientific_validity NULL 여부로 버전을 구분하세요.
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
            if (!cachedSeteks) {
              const { data } = await supabase
                .from("student_record_seteks")
                .select("id, content, grade, subject:subject_id(name)")
                .eq("student_id", studentId)
                .eq("tenant_id", tenantId)
                .is("deleted_at", null);
              cachedSeteks = (data ?? []) as unknown as CachedSetek[];
            }
          })(),
          (async () => {
            if (!cachedChangche) {
              const { data } = await supabase
                .from("student_record_changche")
                .select("id, content, grade, activity_type")
                .eq("student_id", studentId)
                .eq("tenant_id", tenantId);
              cachedChangche = (data ?? []) as CachedChangche[];
            }
          })(),
          (async () => {
            if (!cachedHaengteuk) {
              const { data } = await supabase
                .from("student_record_haengteuk")
                .select("id, content, grade")
                .eq("student_id", studentId)
                .eq("tenant_id", tenantId);
              cachedHaengteuk = (data ?? []) as CachedHaengteuk[];
            }
          })(),
        ]);

        // 전체 레코드를 하나의 배열로 구성
        type AnalysisRecord = { type: "setek" | "changche" | "haengteuk"; id: string; content: string; grade: number; subjectName?: string };
        const analysisRecords: AnalysisRecord[] = [];
        for (const s of cachedSeteks!) {
          if (!s.content || s.content.trim().length < 20) continue;
          analysisRecords.push({ type: "setek", id: s.id, content: s.content, grade: s.grade, subjectName: s.subject?.name });
        }
        for (const c of cachedChangche!) {
          if (!c.content || c.content.trim().length < 20) continue;
          analysisRecords.push({ type: "changche", id: c.id, content: c.content, grade: c.grade });
        }
        for (const h of cachedHaengteuk!) {
          if (!h.content || h.content.trim().length < 20) continue;
          analysisRecords.push({ type: "haengteuk", id: h.id, content: h.content, grade: h.grade });
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
        // NOTE: 배치 호출(analyzeSetekBatchWithHighlight)은 LLM 품질 문제로 보류
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
        // AI 텍스트 분석 등급 + 결정론적 등급 병합 (질문별 최고 등급 선택)
        {
          const {
            aggregateCompetencyGrades,
            computeCourseEffortGrades,
            computeCourseAchievementGrades,
          } = await import("../rubric-matcher");

          const allGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> =
            [...allResults.values()].flatMap((d) => d.competencyGrades);

          // 결정론적 등급: 이수율/성적 기반 (사전 조회한 careerScoreRows 재사용)
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
            // 역량 등급 산정용: offeredSubjects=null (학교 제약과 무관한 절대 이수 노력 평가)
            const adequacy = calcAdequacy(tgtMajor, takenNames, null, curYear);

            if (adequacy) {
              // 학년별 이수 데이터 구성 (Q2 학습단계 순서 검증용)
              const gradedSubjects = careerScoreRows
                .filter((s) => s.subject?.name && s.grade != null && s.semester != null)
                .map((s) => ({
                  subjectName: s.subject!.name,
                  grade: s.grade as number,
                  semester: s.semester as number,
                }));
              // 교과 이수 노력 (이수율 + 학습단계 순서 기반)
              allGrades.push(computeCourseEffortGrades(adequacy, gradedSubjects));
              // 교과 성취도 (성적 기반 + 일반/진로 분리)
              allGrades.push(computeCourseAchievementGrades(adequacy.taken, subjectScores, adequacy));
            }
          }

          if (allGrades.length > 0) {
            const aggregated = aggregateCompetencyGrades(allGrades);

            await runWithConcurrency(aggregated, 5, async (ag) => {
              // P2-2: 루브릭 reasoning 조합 → narrative 생성
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
      },
    },

    // ── 2. 스토리라인 감지 (진단보다 먼저 — 엣지 계산의 입력) ──
    {
      key: "storyline_generation",
      run: async () => {
        // NEIS 없음 → 실 기록 없으므로 skip
        if (!hasNeisData) {
          return "신입생 모드 — 기록 입력 후 감지";
        }
        // 기록 수집 — competency_analysis에서 이미 조회한 캐시 재사용
        const records: RecordSummary[] = [];
        let idx = 0;

        if (!cachedSeteks) {
          const { data } = await supabase
            .from("student_record_seteks")
            .select("id, content, grade, subject:subject_id(name)")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId)
            .is("deleted_at", null);
          cachedSeteks = (data ?? []) as unknown as CachedSetek[];
        }
        // grade 기준 정렬 (원래 order("grade") 대체)
        const sortedSeteks = [...cachedSeteks].sort((a, b) => a.grade - b.grade);
        for (const s of sortedSeteks) {
          if (!s.content || s.content.trim().length < 20) continue;
          records.push({ index: idx++, id: s.id, grade: s.grade, subject: s.subject?.name ?? "과목 미정", type: "setek", content: s.content });
        }

        if (!cachedChangche) {
          const { data } = await supabase
            .from("student_record_changche")
            .select("id, content, grade, activity_type")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          cachedChangche = (data ?? []) as CachedChangche[];
        }
        const sortedChangche = [...cachedChangche].sort((a, b) => a.grade - b.grade);
        for (const c of sortedChangche) {
          if (!c.content || c.content.trim().length < 20) continue;
          records.push({ index: idx++, id: c.id, grade: c.grade, subject: c.activity_type ?? "창체", type: "changche", content: c.content });
        }

        if (records.length < 2) {
          return "기록 2건 미만 — 건너뜀";
        }

        const { detectInquiryLinks } = await import("../llm/actions/detectInquiryLinks");
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
      },
    },

    // ── 3. 엣지 계산 (태그+스토리라인 → 7종 엣지 영속화) ──
    {
      key: "edge_computation",
      run: async () => {
        // NEIS 없음 → 실 기록 없으므로 skip
        if (!hasNeisData) {
          return "신입생 모드 — 기록 입력 후 연결";
        }
        const { buildConnectionGraph } = await import("../cross-reference");
        const { fetchCrossRefData } = await import("./diagnosis");
        const edgeRepo = await import("../edge-repository");
        const { computeContentHash } = await import("../content-hash");

        const { calculateCourseAdequacy } = await import("../course-adequacy");

        const [allTags, crd] = await Promise.all([
          competencyRepo.findActivityTags(studentId, tenantId),
          fetchCrossRefData(studentId, tenantId),
        ]);

        // F2: courseAdequacy 실제 계산 (COURSE_SUPPORTS 엣지 감지용)
        const targetMajor = (snapshot?.target_major as string) ?? null;
        let courseAdequacy = null;
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
              offeredSubjects = ((offered ?? []) as unknown as OfferedSubjectRow[])
                .map((o) => o.subject?.name)
                .filter((n): n is string => !!n);
            }
          }

          const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
          const enrollmentYear = calculateSchoolYear() - studentGrade + 1;
          const curriculumYear = getCurriculumYear(enrollmentYear);
          courseAdequacy = calculateCourseAdequacy(targetMajor, takenSubjects, offeredSubjects, curriculumYear);
          sharedCourseAdequacy = courseAdequacy;
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

        // Phase E2: 후속 태스크용 엣지 배열 저장
        computedEdges = graph.nodes.flatMap((n) => n.edges);

        const preview = `${edgeCount}개 엣지 감지 (${graph.nodes.length}개 영역)`;
        return { preview, result: { totalEdges: graph.totalEdges, nodeCount: graph.nodes.length } };
      },
    },

    // ── 4. AI 종합 진단 (역량+엣지 → 강점/약점/추천전공) ──
    {
      key: "ai_diagnosis",
      run: async () => {
        const currentSchoolYear = calculateSchoolYear();

        const [scores, tags] = await Promise.all([
          competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId),
          competencyRepo.findActivityTags(studentId, tenantId),
        ]);

        // NEIS 없고 역량 데이터도 없으면 수강계획 기반 진단으로 전환
        // generateAiDiagnosis가 coursePlanContext를 받으면 내부에서 수강계획 기반 진단 생성
        if (scores.length === 0 && tags.length === 0 && !coursePlanData?.plans?.length) {
          return "역량 데이터 없음 — 건너뜀";
        }

        const { generateAiDiagnosis } = await import("../llm/actions/generateDiagnosis");
        // Phase E2: 엣지 데이터 → 진단 프롬프트에 투입
        let diagnosisEdgeSection: string | undefined;
        const edgeComputationFailed = tasks.edge_computation === "failed";
        if (computedEdges.length > 0) {
          const { buildEdgePromptSection } = await import("../edge-summary");
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
            const { calculateCourseAdequacy: calcAdequacyFallback } = await import("../course-adequacy");
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

        // 수강계획 컨텍스트 (NEIS 없는 학생 또는 혼합 케이스에서 활용)
        const coursePlanContext = coursePlanData?.plans?.length ? {
          plans: coursePlanData.plans
            .filter((p) => p.plan_status === "confirmed" || p.plan_status === "recommended")
            .map((p) => ({
              grade: p.grade,
              semester: p.semester,
              subjectName: p.subject?.name ?? "과목 미정",
              subjectType: p.subject?.subject_type?.name ?? undefined,
            })),
          targetMajor: (snapshot?.target_major as string) ?? undefined,
        } : undefined;

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
        }, edgeCompetencyFreq, coursePlanContext);
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
        return {
          preview: `종합진단 생성 (등급: ${result.data.overallGrade}, 방향: ${result.data.directionStrength})${warnSuffix}`,
          result: { weaknesses: result.data.weaknesses, improvements: result.data.improvements },
        };
      },
    },

    // ── 5. 수강 추천 (독립) ──
    {
      key: "course_recommendation",
      run: async () => {
        const { generateRecommendationsAction } = await import("./coursePlan");
        const result = await generateRecommendationsAction(studentId, tenantId);
        if (!result.success) throw new Error(result.error);
        const count = Array.isArray(result.data) ? result.data.length : 0;
        return `${count}개 과목 추천됨`;
      },
    },

    // ── 6. 가이드 매칭 + 배정 (독립) ──
    {
      key: "guide_matching",
      run: async () => {
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
      },
    },

    // ── 7. 세특 방향 가이드 (진단+엣지+가이드배정 활용) ──
    {
      key: "setek_guide",
      run: async () => {
        const { generateSetekGuide } = await import("../llm/actions/generateSetekGuide");
        // Phase E2: 엣지 데이터 → 가이드 프롬프트에 투입
        let guideEdgeSection: string | undefined;
        if (computedEdges.length > 0) {
          const { buildEdgePromptSection } = await import("../edge-summary");
          guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
        }
        // Phase 6: 가이드 배정 컨텍스트 → 방향 프롬프트에 투입
        const { buildGuideContextSection } = await import("../guide-context");
        const guideContextSection = await buildGuideContextSection(studentId, "guide");

        // 진단 improvements → 세특 방향에 보완 우선순위 컨텍스트 제공
        let improvementsSection: string | undefined;
        const currentYear = calculateSchoolYear();
        const diagForGuide = await diagnosisRepo.findDiagnosis(studentId, currentYear, tenantId, "ai");
        if (diagForGuide && Array.isArray(diagForGuide.improvements) && (diagForGuide.improvements as unknown[]).length > 0) {
          const imps = diagForGuide.improvements as Array<{ priority: string; area: string; action: string }>;
          improvementsSection = `## 개선 우선순위 (세특 방향에 반영)\n${imps.map((i) => `- [${i.priority}] ${i.area}: ${i.action}`).join("\n")}`;
        }

        const extraSections = [guideEdgeSection, guideContextSection, improvementsSection].filter(Boolean).join("\n") || undefined;
        const result = await generateSetekGuide(studentId, undefined, extraSections);
        if (!result.success) throw new Error(result.error);
        const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
        return guides ? `${guides.length}과목 방향 생성` : "세특 방향 생성 완료";
      },
    },

    // ── 8. 창체 방향 가이드 (세특방향 → 창체방향, Phase 3b) ──
    {
      key: "changche_guide",
      run: async () => {
        // NEIS 없음 → 수강계획+진로 기반 창체 방향 생성
        if (!hasNeisData) {
          const { generateProspectiveChangcheGuide } = await import("../llm/actions/generateChangcheGuide");
          const { fetchReportData } = await import("./report");
          const reportResult = await fetchReportData(studentId);
          if (!reportResult.success || !reportResult.data) {
            throw new Error(reportResult.success === false ? reportResult.error : "데이터 수집 실패");
          }
          // 세특 방향 컨텍스트 (setek_guide prospective 결과 있으면 전달)
          const currentYear = calculateSchoolYear();
          let setekCtx: string | undefined;
          const { data: setekRows } = await supabase
            .from("student_record_setek_guides")
            .select("direction, keywords")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId)
            .eq("school_year", currentYear)
            .eq("source", "ai")
            .limit(4);
          if (setekRows && setekRows.length > 0) {
            const lines = setekRows.map((r) =>
              `- ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
            );
            setekCtx = `## 세특 방향 요약\n${lines.join("\n")}`;
          }
          const result = await generateProspectiveChangcheGuide(
            studentId, tenantId, (await import("@/lib/auth/guards").then((m) => m.requireAdminOrConsultant())).userId,
            reportResult.data, coursePlanData, undefined, setekCtx,
          );
          if (!result.success) throw new Error(result.error);
          const guides = (result.data as { guides?: Array<{ activityType: string }> })?.guides;
          return guides ? `${guides.length}개 활동유형 방향 생성 (예비)` : "창체 방향 생성 완료 (예비)";
        }

        const { generateChangcheGuide } = await import("../llm/actions/generateChangcheGuide");
        // Phase E2: 엣지 데이터 → 창체 가이드 프롬프트에 투입
        let guideEdgeSection: string | undefined;
        if (computedEdges.length > 0) {
          const { buildEdgePromptSection } = await import("../edge-summary");
          guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
        }

        // 세특 방향 컨텍스트 — setek_guide DB 결과에서 요약 구성
        let setekGuideContext: string | undefined;
        const currentYear = calculateSchoolYear();
        const { data: setekRows } = await supabase
          .from("student_record_setek_guides")
          .select("subject_id, direction, keywords, competency_focus")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .eq("school_year", currentYear)
          .eq("source", "ai")
          .limit(6);
        if (setekRows && setekRows.length > 0) {
          // subject_id → 과목명 조회
          const { data: subs } = await supabase
            .from("subjects")
            .select("id, name")
            .in("id", setekRows.map((r) => r.subject_id));
          const subMap = new Map((subs ?? []).map((s) => [s.id, s.name]));
          const lines = setekRows.map((r) =>
            `- ${subMap.get(r.subject_id) ?? r.subject_id}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
          );
          setekGuideContext = `## 세특 방향 요약\n${lines.join("\n")}`;
        }

        const result = await generateChangcheGuide(studentId, undefined, guideEdgeSection, setekGuideContext);
        if (!result.success) throw new Error(result.error);
        const guides = (result.data as { guides?: Array<{ activityType: string }> })?.guides;
        return guides ? `${guides.length}개 활동유형 방향 생성` : "창체 방향 생성 완료";
      },
    },

    // ── 9. 행특 방향 가이드 (창체방향 → 행특방향, Phase 3c) ──
    {
      key: "haengteuk_guide",
      run: async () => {
        // NEIS 없음 → 수강계획+진로 기반 행특 방향 생성
        if (!hasNeisData) {
          const { generateProspectiveHaengteukGuide } = await import("../llm/actions/generateHaengteukGuide");
          const { fetchReportData } = await import("./report");
          const reportResult = await fetchReportData(studentId);
          if (!reportResult.success || !reportResult.data) {
            throw new Error(reportResult.success === false ? reportResult.error : "데이터 수집 실패");
          }
          // 창체 방향 컨텍스트 (changche_guide prospective 결과 있으면 전달)
          const currentYear = calculateSchoolYear();
          let changcheCtx: string | undefined;
          const { data: changcheRows } = await supabase
            .from("student_record_changche_guides")
            .select("activity_type, direction, keywords")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId)
            .eq("school_year", currentYear)
            .eq("source", "ai")
            .limit(3);
          if (changcheRows && changcheRows.length > 0) {
            const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
            const lines = changcheRows.map((r) =>
              `- ${ACTIVITY_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
            );
            changcheCtx = `## 창체 방향 요약\n${lines.join("\n")}`;
          }
          const result = await generateProspectiveHaengteukGuide(
            studentId, tenantId, (await import("@/lib/auth/guards").then((m) => m.requireAdminOrConsultant())).userId,
            reportResult.data, coursePlanData, undefined, changcheCtx,
          );
          if (!result.success) throw new Error(result.error);
          return "행특 방향 생성 완료 (예비)";
        }

        const { generateHaengteukGuide } = await import("../llm/actions/generateHaengteukGuide");
        // Phase E2: 엣지 데이터 → 행특 가이드 프롬프트에 투입
        let guideEdgeSection: string | undefined;
        if (computedEdges.length > 0) {
          const { buildEdgePromptSection } = await import("../edge-summary");
          guideEdgeSection = buildEdgePromptSection(computedEdges, "guide");
        }

        // 창체 방향 컨텍스트 — changche_guide DB 결과에서 요약 구성
        let changcheGuideContext: string | undefined;
        const currentYear = calculateSchoolYear();
        const { data: changcheRows } = await supabase
          .from("student_record_changche_guides")
          .select("activity_type, direction, keywords")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .eq("school_year", currentYear)
          .eq("source", "ai")
          .limit(3);
        if (changcheRows && changcheRows.length > 0) {
          const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
          const lines = changcheRows.map((r) =>
            `- ${ACTIVITY_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`,
          );
          changcheGuideContext = `## 창체 방향 요약\n${lines.join("\n")}`;
        }

        const result = await generateHaengteukGuide(studentId, undefined, guideEdgeSection, changcheGuideContext);
        if (!result.success) throw new Error(result.error);
        return "행특 방향 생성 완료";
      },
    },

    // ── 10. 활동 요약서 (진단+엣지+가이드배정 활용, Phase 3 — 진단 후 실행) ──
    {
      key: "activity_summary",
      run: async () => {
        const { generateActivitySummary } = await import("../llm/actions/generateActivitySummary");
        const grades = Array.from({ length: studentGrade }, (_, i) => i + 1);
        // Phase E2: 엣지 데이터 → 요약서 프롬프트에 투입
        let summaryEdgeSection: string | undefined;
        if (computedEdges.length > 0) {
          const { buildEdgePromptSection } = await import("../edge-summary");
          summaryEdgeSection = buildEdgePromptSection(computedEdges, "summary");
        }
        // Phase 6: 가이드 배정 컨텍스트 → 요약서 프롬프트에 투입
        const { buildGuideContextSection } = await import("../guide-context");
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
      },
    },

    // ── 9. 보완전략 자동 제안 (진단 약점 + 부족 역량 → AI 전략 생성) ──
    {
      key: "ai_strategy",
      run: async () => {
        const currentSchoolYear = calculateSchoolYear();

        // 1~3. 진단 + 역량 + 기존 전략 병렬 조회
        const [diagnosis, aiScores, existingStrategies] = await Promise.all([
          diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai"),
          competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId, "ai"),
          diagnosisRepo.findStrategies(studentId, currentSchoolYear, tenantId),
        ]);
        const weaknesses = (diagnosis?.weaknesses as string[]) ?? [];

        const { COMPETENCY_ITEMS: CI } = await import("../constants");
        const weakCompetencies = aiScores
          .filter((s) => ["B", "B-", "C"].includes(s.grade_value))
          .map((s) => ({
            item: s.competency_item as import("../types").CompetencyItemCode,
            grade: s.grade_value as import("../types").CompetencyGrade,
            label: CI.find((i) => i.code === s.competency_item)?.label ?? s.competency_item,
          }));

        // 루브릭 질문별 약점 추출 (B- 이하)
        const { COMPETENCY_RUBRIC_QUESTIONS: CRQ } = await import("../constants");
        const rubricWeaknesses: string[] = [];
        for (const score of aiScores) {
          const rubrics = Array.isArray(score.rubric_scores) ? score.rubric_scores as Array<{ questionIndex: number; grade: string; reasoning: string }> : [];
          const questions = CRQ[score.competency_item as import("../types").CompetencyItemCode] ?? [];
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

        const { suggestStrategies } = await import("../llm/actions/suggestStrategies");
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

        return `${saved}건 보완전략 제안됨`;
      },
    },

    // ── 10. 우회학과 분석 (독립, Phase 2) — C-1: 진단 기반 학과 발견 ──
    {
      key: "bypass_analysis",
      run: async () => {
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
      },
    },

    // ── 11. 면접 예상 질문 생성 (진단 후, Phase 3) ──
    {
      key: "interview_generation",
      run: async () => {
        // 세특/창체 레코드 수집 (캐시 재사용)
        if (!cachedSeteks) {
          const { data } = await supabase
            .from("student_record_seteks")
            .select("id, content, grade, subject:subject_id(name)")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId)
            .is("deleted_at", null);
          cachedSeteks = (data ?? []) as unknown as CachedSetek[];
        }
        if (!cachedChangche) {
          const { data } = await supabase
            .from("student_record_changche")
            .select("id, content, grade, activity_type")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          cachedChangche = (data ?? []) as CachedChangche[];
        }

        // 타입 가드: 세특 vs 창체 판별
        type CachedRecord = CachedSetek | CachedChangche;
        function isCachedSetek(r: CachedRecord): r is CachedSetek {
          return "subject" in r;
        }
        function getSubjectLabel(r: CachedRecord): string {
          return isCachedSetek(r) ? (r.subject?.name ?? "과목 미정") : (r.activity_type ?? "기록");
        }
        function getRecordType(r: CachedRecord): "setek" | "changche" {
          return isCachedSetek(r) ? "setek" : "changche";
        }

        // 가장 긴 세특 레코드 5건 선택 (면접 질문 생성용)
        const candidateRecords: CachedRecord[] = [...cachedSeteks!, ...cachedChangche!]
          .filter((r) => r.content && r.content.trim().length >= 50)
          .sort((a, b) => b.content.length - a.content.length)
          .slice(0, 5);

        if (candidateRecords.length === 0) return "기록 부족 — 건너뜀";

        const { generateInterviewQuestions } = await import("../llm/actions/generateInterviewQuestions");

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
          const { COMPETENCY_ITEMS } = await import("../constants");
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
      },
    },

    // ── 12. 로드맵 자동 생성 (LLM 우선, 실패 시 규칙 기반 fallback) ──
    {
      key: "roadmap_generation",
      run: async () => {
        // Phase R1: LLM 기반 로드맵 생성 (planning/analysis 자동 감지)
        const { generateAiRoadmap } = await import("../llm/actions/generateRoadmap");
        const llmMode = hasNeisData ? "analysis" : "planning";

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
            const { fetchSetekGuides } = await import("./activitySummary");
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
      },
    },
  ];

  // ── 태스크 실행 헬퍼 ──
  const taskRunnerMap = new Map<PipelineTaskKey, () => Promise<TaskRunnerOutput>>();
  for (const { key, run } of taskRunners) {
    taskRunnerMap.set(key, run);
  }

  async function checkCancelled(): Promise<boolean> {
    const { data } = await supabase
      .from("student_record_analysis_pipelines")
      .select("status")
      .eq("id", pipelineId)
      .single();
    if (data?.status === "cancelled") {
      logActionDebug(LOG_CTX, `Pipeline ${pipelineId} cancelled`);
      return true;
    }
    return false;
  }

  async function runTaskWithState(key: PipelineTaskKey): Promise<void> {
    if (tasks[key] === "completed") {
      logActionDebug(LOG_CTX, `Task ${key} already completed — skipping`);
      return;
    }

    tasks[key] = "running";
    await updatePipelineState(supabase, pipelineId, "running", tasks, previews, results, errors);

    try {
      const runner = taskRunnerMap.get(key)!;
      const timeoutMs = PIPELINE_TASK_TIMEOUTS[key];
      const output = await withTaskTimeout(runner(), timeoutMs, key);
      tasks[key] = "completed";
      if (typeof output === "string") {
        previews[key] = output;
      } else {
        previews[key] = output.preview;
        results[key] = output.result;
      }
      logActionDebug(LOG_CTX, `Task ${key} completed: ${previews[key]}`);
    } catch (err) {
      tasks[key] = "failed";
      const msg = err instanceof Error ? err.message : String(err);
      errors[key] = msg;
      logActionError({ ...LOG_CTX, action: `pipeline.${key}` }, err, { pipelineId });
    }

    await updatePipelineState(supabase, pipelineId, "running", tasks, previews, results, errors);
  }

  // ── 3-Phase 병렬 실행 ──

  // Phase 1: 순차 (역량 → 스토리라인 → 엣지 → 가이드배정)
  // guide_matching을 Phase 1 끝으로 이동 — 결과가 setek_guide/activity_summary에 반영되도록
  const phase1Keys: PipelineTaskKey[] = ["competency_analysis", "storyline_generation", "edge_computation", "guide_matching"];
  for (const key of phase1Keys) {
    if (await checkCancelled()) return;
    await runTaskWithState(key);
  }

  if (await checkCancelled()) return;

  // ── 증분 최적화: 역량 분석 100% 캐시 → 이전 파이프라인 결과로 후속 태스크 스킵 ──
  const competencyResult = results.competency_analysis as { allCached?: boolean } | undefined;
  if (competencyResult?.allCached && !existingState) {
    // 이전 성공 파이프라인의 task_results 조회
    const { data: prevPipeline } = await supabase
      .from("student_record_analysis_pipelines")
      .select("tasks, task_previews, task_results")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .neq("id", pipelineId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevPipeline) {
      const prevTasks = (prevPipeline.tasks ?? {}) as Record<string, string>;
      const prevPreviews = (prevPipeline.task_previews ?? {}) as Record<string, string>;
      const prevResults = (prevPipeline.task_results ?? {}) as PipelineTaskResults;
      const phase23Keys: PipelineTaskKey[] = [
        "ai_diagnosis", "course_recommendation", "guide_matching", "bypass_analysis",
        "setek_guide", "activity_summary", "ai_strategy",
        "interview_generation", "roadmap_generation",
      ];
      let allRestored = true;
      for (const key of phase23Keys) {
        if (prevTasks[key] === "completed") {
          tasks[key] = "completed";
          if (prevPreviews[key]) previews[key] = `[캐시] ${prevPreviews[key]}`;
          if (prevResults[key]) results[key] = prevResults[key];
        } else {
          allRestored = false;
        }
      }
      if (allRestored) {
        logActionDebug(LOG_CTX, `Pipeline ${pipelineId}: all records cached → restored ${phase23Keys.length} tasks from previous pipeline`);
        const allCompleted = PIPELINE_TASK_KEYS.every((k) => tasks[k] === "completed");
        await updatePipelineState(supabase, pipelineId, allCompleted ? "completed" : "failed", tasks, previews, results, errors, true);
        return;
      }
    }
  }

  // Phase 2+3: 병렬/순차 실행
  // Prospective 모드: course_recommendation 선행 → coursePlanData 재조회 → 나머지 실행
  // Analysis 모드: 기존 병렬 실행

  if (!hasNeisData) {
    // ── NEIS 없음: Prospective 실행 순서 ──
    // Phase P0: 수강 추천 선행 (추천 과목 DB 저장 → 이후 태스크의 입력)
    await runTaskWithState("course_recommendation");

    // 추천 결과 반영: coursePlanData 재조회
    const { data: refreshedPlans } = await supabase
      .from("student_course_plans")
      .select("*, subject:subject_id ( id, name, subject_type:subject_type_id ( name ), subject_group:subject_group_id ( name ) )")
      .eq("student_id", studentId)
      .order("grade").order("semester").order("priority", { ascending: false });
    if (refreshedPlans) {
      coursePlanData = { plans: refreshedPlans as unknown as import("../course-plan/types").CoursePlanWithSubject[] };
    }

    // Phase P1: 진단 + 가이드매칭 + 우회학과 (병렬)
    await Promise.allSettled([
      runTaskWithState("ai_diagnosis"),
      runTaskWithState("guide_matching"),
      runTaskWithState("bypass_analysis"),
    ]);

    // Phase V2: 3년 school_year 배열 생성 (고1 신입생이면 현재 학년부터 3학년까지)
    const prospectiveBaseYear = calculateSchoolYear();
    const schoolYearsToGenerate: Array<{ grade: number; schoolYear: number }> = [];
    for (let g = studentGrade; g <= 3; g++) {
      schoolYearsToGenerate.push({ grade: g, schoolYear: prospectiveBaseYear - studentGrade + g });
    }

    // Phase P2-guides: 학년별 세특/창체/행특 방향 순차 생성 (LLM rate limit 고려)
    try {
      const { requireAdminOrConsultant: reqAuth } = await import("@/lib/auth/guards");
      const { userId: guideUserId } = await reqAuth();
      const { fetchReportData: fetchReport } = await import("./report");

      for (const { grade: tGrade, schoolYear: tYear } of schoolYearsToGenerate) {
        // 세특 방향
        const { generateSetekGuide } = await import("../llm/actions/generateSetekGuide");
        await generateSetekGuide(studentId, [tGrade], undefined, tYear);

        // 창체 방향 (세특 컨텍스트 전달)
        const { generateProspectiveChangcheGuide } = await import("../llm/actions/generateChangcheGuide");
        const reportForChangche = await fetchReport(studentId);
        if (reportForChangche.success && reportForChangche.data) {
          const { data: setekCtxRows } = await supabase
            .from("student_record_setek_guides")
            .select("direction, keywords")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId)
            .eq("school_year", tYear)
            .eq("source", "ai")
            .limit(4);
          const setekCtx = setekCtxRows && setekCtxRows.length > 0
            ? `## 세특 방향 요약\n${setekCtxRows.map((r) => `- ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`).join("\n")}`
            : undefined;
          await generateProspectiveChangcheGuide(
            studentId, tenantId, guideUserId,
            reportForChangche.data, coursePlanData, undefined, setekCtx, tYear,
          );
        }

        // 행특 방향 (창체 컨텍스트 전달)
        const { generateProspectiveHaengteukGuide } = await import("../llm/actions/generateHaengteukGuide");
        const reportForHaengteuk = await fetchReport(studentId);
        if (reportForHaengteuk.success && reportForHaengteuk.data) {
          const ACTIVITY_LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
          const { data: changcheCtxRows } = await supabase
            .from("student_record_changche_guides")
            .select("activity_type, direction, keywords")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId)
            .eq("school_year", tYear)
            .eq("source", "ai")
            .limit(3);
          const changcheCtx = changcheCtxRows && changcheCtxRows.length > 0
            ? `## 창체 방향 요약\n${changcheCtxRows.map((r) => `- ${ACTIVITY_LABELS[r.activity_type] ?? r.activity_type}: ${r.direction?.slice(0, 100) ?? ""} [${(r.keywords ?? []).slice(0, 3).join(", ")}]`).join("\n")}`
            : undefined;
          await generateProspectiveHaengteukGuide(
            studentId, tenantId, guideUserId,
            reportForHaengteuk.data, coursePlanData, undefined, changcheCtx, tYear,
          );
        }
      }

      tasks["setek_guide"] = "completed";
      previews["setek_guide"] = `${schoolYearsToGenerate.length}개 학년 세특 방향 생성`;
      tasks["changche_guide"] = "completed";
      previews["changche_guide"] = `${schoolYearsToGenerate.length}개 학년 창체 방향 생성`;
      tasks["haengteuk_guide"] = "completed";
      previews["haengteuk_guide"] = `${schoolYearsToGenerate.length}개 학년 행특 방향 생성`;
    } catch (guideErr) {
      const guideMsg = guideErr instanceof Error ? guideErr.message : "가이드 생성 실패";
      tasks["setek_guide"] = tasks["setek_guide"] === "completed" ? "completed" : "failed";
      if (tasks["setek_guide"] === "failed") errors["setek_guide"] = guideMsg;
      tasks["changche_guide"] = tasks["changche_guide"] === "completed" ? "completed" : "failed";
      if (tasks["changche_guide"] === "failed") errors["changche_guide"] = guideMsg;
      tasks["haengteuk_guide"] = tasks["haengteuk_guide"] === "completed" ? "completed" : "failed";
      if (tasks["haengteuk_guide"] === "failed") errors["haengteuk_guide"] = guideMsg;
    }

    // Phase P2-나머지: 전략 + 면접 + 요약 (병렬)
    await Promise.allSettled([
      runTaskWithState("ai_strategy"),
      runTaskWithState("interview_generation"),
      runTaskWithState("activity_summary"),
    ]);

    // Phase P3: 로드맵
    await runTaskWithState("roadmap_generation");

  } else {
    // ── Analysis 실행 순서 (기존) ──
    // Phase 2: 진단 + 독립 태스크 (수강, 가이드, 우회학과)
    const diagnosisPromise = runTaskWithState("ai_diagnosis");

    const phase2Independent = [
      runTaskWithState("course_recommendation"),
      runTaskWithState("bypass_analysis"),
    ];

    // Phase 3: 진단 후 → 방향, 전략, 면접, 요약, 로드맵
    const phase3AfterDiagnosis = diagnosisPromise.then(async () => {
      await Promise.allSettled([
        runTaskWithState("setek_guide"),
        runTaskWithState("ai_strategy"),
        runTaskWithState("interview_generation"),
        runTaskWithState("activity_summary"),
      ]);
      await runTaskWithState("changche_guide");
      await runTaskWithState("haengteuk_guide");
      await runTaskWithState("roadmap_generation");
    });

    await Promise.allSettled([diagnosisPromise, ...phase2Independent, phase3AfterDiagnosis]);
  }

  // 최종 상태 결정
  const allCompleted = PIPELINE_TASK_KEYS.every((k) => tasks[k] === "completed");
  const finalStatus = allCompleted ? "completed" : "failed";

  await updatePipelineState(supabase, pipelineId, finalStatus, tasks, previews, results, errors, true);
}

async function updatePipelineState(
  supabase: SupabaseAdminClient,
  pipelineId: string,
  status: string,
  tasks: Record<string, PipelineTaskStatus>,
  previews: Record<string, string>,
  results: PipelineTaskResults,
  errors: Record<string, string>,
  isFinal = false,
) {
  const update: Record<string, unknown> = {
    status,
    tasks,
    task_previews: previews,
    task_results: Object.keys(results).length > 0 ? results : null,
    error_details: Object.keys(errors).length > 0 ? errors : null,
  };
  if (isFinal) {
    update.completed_at = new Date().toISOString();
  }

  await supabase
    .from("student_record_analysis_pipelines")
    .update(update)
    .eq("id", pipelineId);
}

// ============================================
// 파이프라인 취소
// ============================================

export async function cancelPipeline(
  pipelineId: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    await supabase
      .from("student_record_analysis_pipelines")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", pipelineId)
      .eq("status", "running");

    return createSuccessResponse(undefined);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "cancelPipeline" }, error, { pipelineId });
    return createErrorResponse("파이프라인 취소 실패");
  }
}

// ============================================
// 개별 액션 성공 시 파이프라인 상태 동기화
// ============================================

/**
 * 개별 AI 액션이 파이프라인 외부에서 성공했을 때,
 * 해당 태스크의 파이프라인 상태를 "completed"로 갱신한다.
 * Fire-and-forget: 파이프라인이 없거나 갱신 실패해도 에러를 던지지 않는다.
 */
export async function syncPipelineTaskStatus(
  studentId: string,
  taskKey: PipelineTaskKey,
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    // 최신 파이프라인 조회
    const { data } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, tasks")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;

    const tasks = (data.tasks ?? {}) as Record<string, PipelineTaskStatus>;

    // 이미 completed이거나, 실패하지 않았으면 갱신 불필요
    if (tasks[taskKey] !== "failed") return;

    // 태스크 상태 갱신
    tasks[taskKey] = "completed";

    // 전체 상태 재계산
    const allCompleted = PIPELINE_TASK_KEYS.every((k) => tasks[k] === "completed");
    const overallStatus = allCompleted ? "completed" : data.status;

    await supabase
      .from("student_record_analysis_pipelines")
      .update({
        tasks,
        status: overallStatus,
        ...(allCompleted && !data.status?.includes("completed")
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", data.id);

    logActionDebug(
      { ...LOG_CTX, action: "syncPipelineTask" },
      `Task ${taskKey} synced to completed (pipeline: ${data.id})`,
    );
  } catch {
    // fire-and-forget: 동기화 실패는 무시
  }
}

// ============================================
// 태스크 결과 저장 (수동 UI에서 AI 분석 결과 영속화)
// ============================================

/**
 * 수동 경로에서 AI 분석 결과를 파이프라인 task_results에 저장.
 * 파이프라인이 없으면 새로 생성한다.
 */
export async function saveTaskResult(
  studentId: string,
  tenantId: string,
  taskKey: PipelineTaskKey,
  result: unknown,
): Promise<void> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 최신 파이프라인 조회
    const { data: existing } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, task_results")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // 기존 파이프라인에 결과 머지
      const currentResults = (existing.task_results ?? {}) as PipelineTaskResults;
      currentResults[taskKey] = result;

      await supabase
        .from("student_record_analysis_pipelines")
        .update({ task_results: currentResults })
        .eq("id", existing.id);
    } else {
      // 파이프라인 없으면 새로 생성 (수동 분석만 실행한 경우)
      await supabase.from("student_record_analysis_pipelines").insert({
        student_id: studentId,
        tenant_id: tenantId,
        status: "completed",
        tasks: { [taskKey]: "completed" },
        task_results: { [taskKey]: result },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    }
  } catch {
    // fire-and-forget
  }
}

// ============================================
// Step 7: 학년별 파이프라인 오케스트레이터 (Grade-Aware Pipeline)
// ============================================

// ─── 7-1. runGradePipeline ───────────────────────────────────────────────────

/**
 * 특정 학년에 대한 grade 파이프라인 행 생성.
 * 실제 phase 실행은 API route에서 클라이언트 주도로 수행.
 */
export async function runGradePipeline(
  studentId: string,
  tenantId: string,
  grade: number,
): Promise<ActionResponse<{ pipelineId: string; grade: number }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 속도 제한 검사
    const rateLimitError = await checkPipelineRateLimit(studentId, supabase);
    if (rateLimitError) {
      return createErrorResponse(rateLimitError);
    }

    // 학생 스냅샷
    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    // grade 태스크만 초기화
    const initTasks: Record<string, string> = {};
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "running",
        pipeline_type: "grade",
        grade,
        tasks: initTasks,
        input_snapshot: student ?? {},
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      throw insertError ?? new Error("grade 파이프라인 생성 실패");
    }

    return createSuccessResponse({ pipelineId: pipeline.id, grade });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runGradePipeline" }, error, { studentId, grade });
    return createErrorResponse("grade 파이프라인 시작 실패");
  }
}

// ─── 7-2. runSynthesisPipeline ───────────────────────────────────────────────

/**
 * synthesis 파이프라인 행 생성.
 * 사전 조건: 해당 학생의 grade 파이프라인이 모두 completed이어야 함.
 */
export async function runSynthesisPipeline(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<{ pipelineId: string }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // grade 파이프라인이 모두 completed인지 확인
    const { data: gradePipelines, error: fetchErr } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, grade")
      .eq("student_id", studentId)
      .eq("pipeline_type", "grade")
      .order("created_at", { ascending: false });

    if (fetchErr) throw fetchErr;

    const grades = gradePipelines ?? [];
    const allCompleted = grades.length > 0 && grades.every((p) => p.status === "completed");
    if (!allCompleted) {
      return createErrorResponse(
        "모든 학년 파이프라인이 완료된 후 종합 파이프라인을 실행할 수 있습니다",
      );
    }

    // grade 파이프라인 ID 목록 (synthesis context용)
    const gradePipelineIds = grades.map((p) => p.id as string);

    // 학생 스냅샷
    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    // synthesis 태스크만 초기화
    const initTasks: Record<string, string> = {};
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "running",
        pipeline_type: "synthesis",
        grade: null,
        tasks: initTasks,
        input_snapshot: {
          ...(student ?? {}),
          gradePipelineIds,
        },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      throw insertError ?? new Error("synthesis 파이프라인 생성 실패");
    }

    return createSuccessResponse({ pipelineId: pipeline.id });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runSynthesisPipeline" }, error, { studentId });
    return createErrorResponse("synthesis 파이프라인 시작 실패");
  }
}

// ─── 7-3. runGradeAwarePipeline ─────────────────────────────────────────────

export interface GradeAwarePipelineStartResult {
  /** 학년 → pipelineId 매핑 */
  gradePipelines: Array<{ grade: number; pipelineId: string; status: string }>;
  /** 클라이언트가 즉시 실행해야 할 첫 번째 grade 파이프라인 ID */
  firstPipelineId: string | null;
}

/**
 * 학년별 파이프라인 전체 흐름 초기화 오케스트레이터.
 * - 데이터가 있는 학년들을 탐지하여 grade 파이프라인 행들을 일괄 생성.
 * - 첫 번째 학년만 status: 'running', 나머지는 status: 'pending'.
 * - options.grades로 특정 학년만 한정 가능.
 */
export async function runGradeAwarePipeline(
  studentId: string,
  tenantId: string,
  options?: { grades?: number[] },
): Promise<ActionResponse<GradeAwarePipelineStartResult>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 속도 제한 검사 (전체 파이프라인 기준)
    const rateLimitError = await checkPipelineRateLimit(studentId, supabase);
    if (rateLimitError) {
      return createErrorResponse(rateLimitError);
    }

    // 학생 스냅샷
    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    // 레코드 데이터 조회 → 어떤 학년에 데이터가 있는지 파악
    const [sRes, cRes, hRes] = await Promise.all([
      supabase
        .from("student_record_seteks")
        .select("id, content, imported_content, grade, subject:subject_id(name)")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      supabase
        .from("student_record_changche")
        .select("id, content, imported_content, grade, activity_type")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
      supabase
        .from("student_record_haengteuk")
        .select("id, content, imported_content, grade")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
    ]);

    const allSeteks = (sRes.data ?? []) as CachedSetek[];
    const allChangche = (cRes.data ?? []) as CachedChangche[];
    const allHaengteuk = (hRes.data ?? []) as CachedHaengteuk[];

    const resolvedRecords = resolveRecordData(allSeteks, allChangche, allHaengteuk);
    const { neisGrades, consultingGrades } = deriveGradeCategories(resolvedRecords);

    // 수강계획이 있는 학년도 컨설팅 대상에 포함 (레코드 없어도 슬롯/방향 생성 필요)
    const { data: coursePlanGradeRows } = await supabase
      .from("student_course_plans")
      .select("grade")
      .eq("student_id", studentId)
      .in("plan_status", ["confirmed", "recommended"]);
    const coursePlanGrades = [...new Set(
      (coursePlanGradeRows ?? []).map((r) => r.grade as number).filter((g) => g >= 1 && g <= 3),
    )];

    // 데이터가 있는 학년 = neisGrades + consultingGrades + 수강계획 학년, 오름차순 정렬
    const allGradesWithData = [...new Set([...neisGrades, ...consultingGrades, ...coursePlanGrades])].sort(
      (a, b) => a - b,
    );

    // options.grades로 필터링 (지정된 경우)
    const targetGrades =
      options?.grades && options.grades.length > 0
        ? allGradesWithData.filter((g) => options.grades!.includes(g))
        : allGradesWithData;

    if (targetGrades.length === 0) {
      return createErrorResponse("파이프라인을 실행할 학년 데이터가 없습니다");
    }

    // grade 파이프라인 행 일괄 생성 (첫 번째만 running, 나머지 pending)
    const created: Array<{ grade: number; pipelineId: string; status: string; mode: "analysis" | "design" }> = [];

    for (let i = 0; i < targetGrades.length; i++) {
      const grade = targetGrades[i];
      const isFirst = i === 0;
      const status = isFirst ? "running" : "pending";

      const initTasks: Record<string, string> = {};
      for (const key of GRADE_PIPELINE_TASK_KEYS) {
        initTasks[key] = "pending";
      }

      // NEIS 데이터가 있는 학년 = analysis, 없는 학년 = design
      const gradeMode = neisGrades.includes(grade) ? "analysis" : "design";

      const { data: pipeline, error: insertError } = await supabase
        .from("student_record_analysis_pipelines")
        .insert({
          student_id: studentId,
          tenant_id: tenantId,
          created_by: userId,
          status,
          pipeline_type: "grade",
          grade,
          mode: gradeMode,
          tasks: initTasks,
          input_snapshot: student ?? {},
          started_at: isFirst ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (insertError || !pipeline) {
        throw insertError ?? new Error(`학년 ${grade} 파이프라인 생성 실패`);
      }

      created.push({ grade, pipelineId: pipeline.id, status, mode: gradeMode });
    }

    const firstPipelineId = created[0]?.pipelineId ?? null;

    return createSuccessResponse({
      gradePipelines: created,
      firstPipelineId,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runGradeAwarePipeline" }, error, { studentId });
    return createErrorResponse("학년별 파이프라인 시작 실패");
  }
}

// ─── 7-4. fetchGradeAwarePipelineStatus ─────────────────────────────────────

export interface GradeAwarePipelineStatus {
  gradePipelines: Record<
    number,
    {
      pipelineId: string;
      grade: number;
      status: string;
      mode: "analysis" | "design";
      tasks: Record<string, string>;
      previews: Record<string, string>;
      elapsed: Record<string, number>;
      errors: Record<string, string>;
    }
  >;
  synthesisPipeline: {
    pipelineId: string;
    status: string;
    tasks: Record<string, string>;
    previews: Record<string, string>;
    elapsed: Record<string, number>;
    errors: Record<string, string>;
  } | null;
}

/**
 * 해당 학생의 최근 grade + synthesis 파이프라인 상태를 모두 조회.
 */
export async function fetchGradeAwarePipelineStatus(
  studentId: string,
): Promise<ActionResponse<GradeAwarePipelineStatus>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, pipeline_type, grade, mode, tasks, task_previews, task_results, error_details")
      .eq("student_id", studentId)
      .in("pipeline_type", ["grade", "synthesis"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const gradePipelines: GradeAwarePipelineStatus["gradePipelines"] = {};
    let synthesisPipeline: GradeAwarePipelineStatus["synthesisPipeline"] = null;

    for (const row of rows ?? []) {
      const tasks = (row.tasks ?? {}) as Record<string, string>;
      const previews = (row.task_previews ?? {}) as Record<string, string>;
      const results = (row.task_results ?? {}) as Record<string, Record<string, unknown>>;
      const errors = (row.error_details ?? {}) as Record<string, string>;

      // 태스크별 소요시간 추출
      const elapsed: Record<string, number> = {};
      for (const [k, v] of Object.entries(results)) {
        if (v && typeof v === "object" && "elapsedMs" in v && typeof v.elapsedMs === "number") {
          elapsed[k] = v.elapsedMs;
        }
      }

      if (row.pipeline_type === "grade" && row.grade != null) {
        const gradeNum = row.grade as number;
        // 학년당 가장 최근 파이프라인만 유지 (order by created_at desc 이미 적용)
        if (!(gradeNum in gradePipelines)) {
          gradePipelines[gradeNum] = {
            pipelineId: row.id as string,
            grade: gradeNum,
            status: row.status as string,
            mode: (row.mode === "design" ? "design" : "analysis") as "analysis" | "design",
            tasks,
            previews,
            elapsed,
            errors,
          };
        }
      } else if (row.pipeline_type === "synthesis" && !synthesisPipeline) {
        synthesisPipeline = {
          pipelineId: row.id as string,
          status: row.status as string,
          tasks,
          previews,
          elapsed,
          errors,
        };
      }
    }

    return createSuccessResponse({ gradePipelines, synthesisPipeline });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchGradeAwarePipelineStatus" }, error, { studentId });
    return createErrorResponse("학년별 파이프라인 상태 조회 실패");
  }
}

// ─── 7-5. rerunGradePipelineTasks ───────────────────────────────────────────

/**
 * grade 파이프라인 전용 태스크 재실행.
 * - 지정 태스크 + GRADE_TASK_DEPENDENTS cascade reset.
 * - 해당 학생의 synthesis 파이프라인이 있으면 전체 pending으로 리셋.
 */
export async function rerunGradePipelineTasks(
  pipelineId: string,
  taskKeys: GradePipelineTaskKey[],
): Promise<ActionResponse<{ pipelineId: string }>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data: pipeline, error: fetchErr } = await supabase
      .from("student_record_analysis_pipelines")
      .select("*")
      .eq("id", pipelineId)
      .single();

    if (fetchErr || !pipeline) {
      return createErrorResponse("파이프라인을 찾을 수 없습니다");
    }
    if (pipeline.status === "running") {
      return createErrorResponse("실행 중인 파이프라인은 재실행할 수 없습니다");
    }

    // cascade reset: GRADE_TASK_DEPENDENTS 기반
    const toReset = new Set<GradePipelineTaskKey>(taskKeys);
    for (const key of taskKeys) {
      for (const dep of GRADE_TASK_DEPENDENTS[key] ?? []) {
        toReset.add(dep);
      }
    }

    const tasks = (pipeline.tasks ?? {}) as Record<string, PipelineTaskStatus>;
    for (const key of toReset) {
      tasks[key] = "pending";
    }

    await supabase
      .from("student_record_analysis_pipelines")
      .update({ status: "running", tasks, completed_at: null })
      .eq("id", pipelineId);

    // competency 계열 태스크 재실행 시 analysis_cache 무효화 → LLM 강제 재호출
    const GRADE_COMPETENCY_TASKS: GradePipelineTaskKey[] = [
      "competency_setek",
      "competency_changche",
      "competency_haengteuk",
    ];
    const hasCompetencyReset = GRADE_COMPETENCY_TASKS.some((k) => toReset.has(k));
    if (hasCompetencyReset) {
      await competencyRepo.deleteAnalysisCacheByStudentId(
        pipeline.student_id as string,
        pipeline.tenant_id as string,
      );
    }

    // 해당 학생의 synthesis 파이프라인이 있으면 전체 pending으로 리셋
    const { data: synthPipeline } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, tasks")
      .eq("student_id", pipeline.student_id as string)
      .eq("pipeline_type", "synthesis")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (synthPipeline) {
      const synthTasks: Record<string, PipelineTaskStatus> = {};
      for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
        synthTasks[key] = "pending";
      }
      await supabase
        .from("student_record_analysis_pipelines")
        .update({ status: "pending", tasks: synthTasks, completed_at: null })
        .eq("id", synthPipeline.id as string);
    }

    return createSuccessResponse({ pipelineId });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "rerunGradePipelineTasks" }, error, { pipelineId });
    return createErrorResponse("grade 태스크 재실행 실패");
  }
}
