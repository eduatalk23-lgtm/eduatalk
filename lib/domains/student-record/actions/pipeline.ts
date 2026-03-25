"use server";

// ============================================
// AI 초기 분석 파이프라인
// Phase B+E1: 8개 AI 태스크 순차 실행 + DB 상태 추적
// 순서: 역량→스토리라인→엣지→진단→수강→가이드→세특→요약서
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import type {
  PipelineStatus,
  PipelineTaskKey,
  PipelineTaskStatus,
} from "../pipeline-types";
import { PIPELINE_TASK_KEYS } from "../pipeline-types";
import * as competencyRepo from "../competency-repository";
import * as diagnosisRepo from "../diagnosis-repository";
import * as repository from "../repository";
import type { ActivityTagInsert, CompetencyScoreInsert, DiagnosisInsert } from "../types";
import type { HighlightAnalysisResult } from "../llm/types";
import type { RecordSummary } from "../llm/prompts/inquiryLinking";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

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
      tasks,
      taskPreviews: (data.task_previews ?? {}) as Record<string, string>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      taskResults: (data.task_results ?? {}) as Record<string, any>,
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
// 파이프라인 실행
// ============================================

/** AI 초기 분석 파이프라인 실행 (fire-and-forget safe) */
export async function runInitialAnalysisPipeline(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<{ pipelineId: string }>> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 이미 running인 파이프라인이 있는지 체크 (중복 방지)
    const { data: existing } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id")
      .eq("student_id", studentId)
      .in("status", ["pending", "running"])
      .limit(1)
      .maybeSingle();

    if (existing) {
      return createSuccessResponse({ pipelineId: existing.id });
    }

    // 학생 정보 스냅샷
    const { data: student } = await supabase
      .from("students")
      .select("target_major, target_sub_classification_id, grade, school_name")
      .eq("id", studentId)
      .single();

    // 파이프라인 행 생성
    const initTasks: Record<string, string> = {};
    for (const key of PIPELINE_TASK_KEYS) {
      initTasks[key] = "pending";
    }

    const { data: pipeline, error: insertError } = await supabase
      .from("student_record_analysis_pipelines")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        created_by: userId,
        status: "running",
        tasks: initTasks,
        input_snapshot: student ?? {},
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !pipeline) {
      throw insertError ?? new Error("파이프라인 생성 실패");
    }

    const pipelineId = pipeline.id;

    // 비동기로 태스크 실행 (서버에서 계속 실행됨)
    executePipelineTasks(pipelineId, studentId, tenantId, student).catch((err) => {
      logActionError({ ...LOG_CTX, action: "executePipelineTasks" }, err, { pipelineId });
    });

    return createSuccessResponse({ pipelineId });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runInitialAnalysisPipeline" }, error, { studentId });
    return createErrorResponse("파이프라인 시작 실패");
  }
}

// ============================================
// 태스크 실행 (내부)
// ============================================

async function executePipelineTasks(
  pipelineId: string,
  studentId: string,
  tenantId: string,
  studentSnapshot: Record<string, unknown> | null,
) {
  const supabase = await createSupabaseServerClient();
  const tasks: Record<string, PipelineTaskStatus> = {};
  const previews: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: Record<string, any> = {};
  const errors: Record<string, string> = {};

  // Phase E2: edge_computation에서 수집 → 후속 태스크에서 context별 프롬프트 생성
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let computedEdges: any[] = [];

  // C2: 태스크 간 공유 레코드 캐시 (중복 DB 조회 방지)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cachedSeteks: any[] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cachedChangche: any[] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cachedHaengteuk: any[] | null = null;

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

  for (const key of PIPELINE_TASK_KEYS) {
    tasks[key] = "pending";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskRunners: Array<{ key: PipelineTaskKey; run: () => Promise<string | { preview: string; result: any }> }> = [
    // ── 1. 역량 분석 (가장 먼저: 태그+등급 생성 → 진단/가이드의 입력) ──
    {
      key: "competency_analysis",
      run: async () => {
        const { analyzeSetekWithHighlight } = await import("../llm/actions/analyzeWithHighlight");
        let succeeded = 0;
        let failed = 0;
        const allResults = new Map<string, HighlightAnalysisResult>();
        const currentSchoolYear = calculateSchoolYear();

        // 개별 레코드 분석 + 태그 저장 헬퍼
        async function analyzeAndSave(
          recordType: "setek" | "personal_setek" | "changche" | "haengteuk",
          recordId: string,
          content: string,
          grade: number,
          subjectName?: string,
        ) {
          // 기존 AI 태그 정리
          await competencyRepo.deleteAiActivityTagsByRecord(recordType, recordId, tenantId);

          const result = await analyzeSetekWithHighlight({ recordType, content, subjectName, grade });
          if (!result.success) {
            failed++;
            logActionDebug(LOG_CTX, `competency_analysis: ${recordType} ${recordId} failed — ${result.error}`);
            return;
          }

          // 태그 DB 저장
          const tagInputs: ActivityTagInsert[] = [];
          for (const section of result.data.sections) {
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

          // 분석 결과 캐시 저장 (하이라이트 영속화)
          await competencyRepo.upsertAnalysisCache({
            tenant_id: tenantId,
            student_id: studentId,
            record_type: recordType,
            record_id: recordId,
            source: "ai",
            analysis_result: result.data,
          });

          allResults.set(recordId, result.data);
          succeeded++;
        }

        // 1. 세특 분석 (결과를 캐시에 저장 → storyline_generation에서 재사용)
        if (!cachedSeteks) {
          const { data } = await supabase
            .from("student_record_seteks")
            .select("id, content, grade, subject:subject_id(name)")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId)
            .is("deleted_at", null);
          cachedSeteks = data ?? [];
        }
        for (const s of cachedSeteks) {
          const content = s.content as string;
          if (!content || content.trim().length < 20) continue;
          const subj = s.subject as unknown as { name: string } | null;
          try {
            await analyzeAndSave("setek", s.id, content, s.grade, subj?.name);
          } catch (err) {
            failed++;
            logActionError({ ...LOG_CTX, action: "pipeline.competency.setek" }, err, { recordId: s.id });
          }
        }

        // 2. 창체 분석 (결과를 캐시에 저장 → storyline_generation에서 재사용)
        if (!cachedChangche) {
          const { data } = await supabase
            .from("student_record_changche")
            .select("id, content, grade, activity_type")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          cachedChangche = data ?? [];
        }
        for (const c of cachedChangche) {
          const content = c.content as string;
          if (!content || content.trim().length < 20) continue;
          try {
            await analyzeAndSave("changche", c.id, content, c.grade);
          } catch (err) {
            failed++;
            logActionError({ ...LOG_CTX, action: "pipeline.competency.changche" }, err, { recordId: c.id });
          }
        }

        // 3. 행특 분석 (결과를 캐시에 저장)
        if (!cachedHaengteuk) {
          const { data } = await supabase
            .from("student_record_haengteuk")
            .select("id, content, grade")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          cachedHaengteuk = data ?? [];
        }
        for (const h of cachedHaengteuk) {
          const content = h.content as string;
          if (!content || content.trim().length < 20) continue;
          try {
            await analyzeAndSave("haengteuk", h.id, content, h.grade);
          } catch (err) {
            failed++;
            logActionError({ ...LOG_CTX, action: "pipeline.competency.haengteuk" }, err, { recordId: h.id });
          }
        }

        // 4. 루브릭 기반 종합 등급 저장 (Bottom-Up)
        if (allResults.size > 0) {
          const {
            aggregateCompetencyGrades,
            computeCourseEffortGrades,
            computeCourseAchievementGrades,
          } = await import("../rubric-matcher");
          const { calculateCourseAdequacy: calcAdequacy } = await import("../course-adequacy");

          const allGrades: Array<{ item: string; grade: string; reasoning?: string; rubricScores?: { questionIndex: number; grade: string; reasoning: string }[] }> =
            [...allResults.values()].flatMap((d) => d.competencyGrades);

          // F1: 교과 이수/성취도 결정론적 산정 (AI 추측 제거)
          const tgtMajor = (snapshot?.target_major as string) ?? null;
          if (tgtMajor) {
            // 이수 과목 + 성적 조회
            const { data: scoreRows } = await supabase
              .from("student_internal_scores")
              .select("subject:subject_id(name), rank_grade")
              .eq("student_id", studentId);
            const subjectScores = (scoreRows ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((s: any) => ({
                subjectName: (s.subject as { name: string } | null)?.name ?? "",
                rankGrade: (s.rank_grade as number) ?? 5,
              }))
              .filter((s) => s.subjectName);
            const takenNames = [...new Set(subjectScores.map((s) => s.subjectName))];

            const enrollYear = calculateSchoolYear() - studentGrade + 1;
            const curYear = enrollYear >= 2025 ? 2022 : 2015;
            const adequacy = calcAdequacy(tgtMajor, takenNames, null, curYear);

            if (adequacy) {
              // 교과 이수 노력 (이수율 기반)
              allGrades.push(computeCourseEffortGrades(adequacy));
              // 교과 성취도 (성적 기반)
              allGrades.push(computeCourseAchievementGrades(adequacy.taken, subjectScores));
            }
          }

          const aggregated = aggregateCompetencyGrades(allGrades);

          const scorePromises = aggregated.map((ag) =>
            competencyRepo.upsertCompetencyScore({
              tenant_id: tenantId,
              student_id: studentId,
              school_year: currentSchoolYear,
              scope: "yearly",
              competency_area: ag.area,
              competency_item: ag.item,
              grade_value: ag.finalGrade,
              notes: `[AI] ${ag.recordCount}건 ${ag.method === "rubric" ? "루브릭 기반" : "레코드"} 종합`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rubric_scores: ag.rubricScores as any,
              source: "ai",
              status: "suggested",
            } as CompetencyScoreInsert),
          );
          await Promise.allSettled(scorePromises);
        }

        const parts = [`${succeeded}건 성공`];
        if (failed > 0) parts.push(`${failed}건 실패`);
        return `역량 분석 ${parts.join(", ")} (세특+창체+행특)`;
      },
    },

    // ── 2. 스토리라인 감지 (진단보다 먼저 — 엣지 계산의 입력) ──
    {
      key: "storyline_generation",
      run: async () => {
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
          cachedSeteks = data ?? [];
        }
        // grade 기준 정렬 (원래 order("grade") 대체)
        const sortedSeteks = [...cachedSeteks].sort((a, b) => a.grade - b.grade);
        for (const s of sortedSeteks) {
          const content = s.content as string;
          if (!content || content.trim().length < 20) continue;
          const subj = s.subject as unknown as { name: string } | null;
          records.push({ index: idx++, id: s.id, grade: s.grade, subject: subj?.name ?? "과목 미정", type: "setek", content });
        }

        if (!cachedChangche) {
          const { data } = await supabase
            .from("student_record_changche")
            .select("id, content, grade, activity_type")
            .eq("student_id", studentId)
            .eq("tenant_id", tenantId);
          cachedChangche = data ?? [];
        }
        const sortedChangche = [...cachedChangche].sort((a, b) => a.grade - b.grade);
        for (const c of sortedChangche) {
          const content = c.content as string;
          if (!content || content.trim().length < 20) continue;
          records.push({ index: idx++, id: c.id, grade: c.grade, subject: c.activity_type ?? "창체", type: "changche", content });
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

        // 기존 AI 스토리라인 삭제 (재실행 시 중복 방지)
        const existingStorylines = await repository.findStorylinesByStudent(studentId, tenantId);
        const aiStorylines = existingStorylines.filter((s) => s.title.startsWith("[AI]"));
        for (const existing of aiStorylines) {
          await repository.deleteStorylineById(existing.id);
        }

        // sort_order 계산 (수동 스토리라인 뒤에 배치)
        const manualStorylines = existingStorylines.filter((s) => !s.title.startsWith("[AI]"));
        const baseSortOrder = manualStorylines.length > 0
          ? Math.max(...manualStorylines.map((s) => s.sort_order)) + 1
          : 0;

        let savedCount = 0;
        for (let i = 0; i < suggestedStorylines.length; i++) {
          const sl = suggestedStorylines[i];
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

            // 연결된 레코드 링크 저장
            const linkedIds = new Set<string>();
            for (const connIdx of sl.connectionIndices) {
              const conn = connections[connIdx];
              if (!conn) continue;
              for (const recIdx of [conn.fromIndex, conn.toIndex]) {
                const rec = records[recIdx];
                if (!rec || linkedIds.has(rec.id)) continue;
                linkedIds.add(rec.id);
                await repository.insertStorylineLink({
                  storyline_id: storylineId,
                  record_type: rec.type,
                  record_id: rec.id,
                  grade: rec.grade,
                  connection_note: conn.reasoning,
                  sort_order: linkedIds.size - 1,
                });
              }
            }
            savedCount++;
          } catch (err) {
            logActionError({ ...LOG_CTX, action: "pipeline.storyline" }, err, { title: sl.title });
          }
        }

        const preview = `${savedCount}건 스토리라인 생성 (${connections.length}건 연결)`;
        return { preview, result: result.data };
      },
    },

    // ── 3. 엣지 계산 (태그+스토리라인 → 7종 엣지 영속화) ──
    {
      key: "edge_computation",
      run: async () => {
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
            (scoreRows ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((s: any) => (s.subject as { name: string } | null)?.name)
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
              offeredSubjects = (offered ?? [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((o: any) => (o.subject as { name: string } | null)?.name)
                .filter((n): n is string => !!n);
            }
          }

          const enrollmentYear = calculateSchoolYear() - studentGrade + 1;
          const curriculumYear = enrollmentYear >= 2025 ? 2022 : 2015;
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

        if (scores.length === 0 && tags.length === 0) {
          return "역량 데이터 없음 — 건너뜀";
        }

        const { generateAiDiagnosis } = await import("../llm/actions/generateDiagnosis");
        // Phase E2: 엣지 데이터 → 진단 프롬프트에 투입
        let diagnosisEdgeSection: string | undefined;
        if (computedEdges.length > 0) {
          const { buildEdgePromptSection } = await import("../edge-summary");
          diagnosisEdgeSection = buildEdgePromptSection(computedEdges, "diagnosis");
        }
        const result = await generateAiDiagnosis(scores, tags, {
          targetMajor: (snapshot?.target_major as string) ?? undefined,
          schoolName: (snapshot?.school_name as string) ?? undefined,
        }, diagnosisEdgeSection);
        if (!result.success) throw new Error(result.error);

        await diagnosisRepo.upsertDiagnosis({
          tenant_id: tenantId,
          student_id: studentId,
          school_year: currentSchoolYear,
          overall_grade: result.data.overallGrade,
          record_direction: result.data.recordDirection,
          direction_strength: result.data.directionStrength as "strong" | "moderate" | "weak",
          strengths: result.data.strengths,
          weaknesses: result.data.weaknesses,
          recommended_majors: result.data.recommendedMajors,
          strategy_notes: result.data.strategyNotes,
          source: "ai",
          status: "draft",
        } as DiagnosisInsert);

        return `종합진단 생성 (등급: ${result.data.overallGrade}, 방향: ${result.data.directionStrength})`;
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
            const { error: insertErr } = await supabase
              .from("exploration_guide_assignments")
              .insert(newGuides.map((g) => ({
                tenant_id: tenantId,
                student_id: studentId,
                guide_id: g.id,
                assigned_by: null,
                school_year: currentSchoolYear,
                grade: studentGrade,
                status: "assigned",
                student_notes: `[AI] 파이프라인 자동 배정 (${g.match_reason})`,
              })));
            if (!insertErr) assigned = newGuides.length;
          }
        }
        return `${assigned}건 가이드 배정 (${guides.length}건 추천)`;
      },
    },

    // ── 7. 세특 방향 가이드 (진단+엣지 활용) ──
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
        const result = await generateSetekGuide(studentId, undefined, guideEdgeSection);
        if (!result.success) throw new Error(result.error);
        const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
        return guides ? `${guides.length}과목 방향 생성` : "세특 방향 생성 완료";
      },
    },

    // ── 8. 활동 요약서 (스토리라인+엣지 활용) ──
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
        const result = await generateActivitySummary(studentId, grades, summaryEdgeSection);
        if (!result.success) throw new Error(result.error);
        return "활동 요약서 생성 완료";
      },
    },

    // ── 9. 보완전략 자동 제안 (진단 약점 + 부족 역량 → AI 전략 생성) ──
    {
      key: "ai_strategy",
      run: async () => {
        const currentSchoolYear = calculateSchoolYear();

        // 1. 진단에서 약점 추출
        const diagnosis = await diagnosisRepo.findDiagnosis(
          studentId, currentSchoolYear, tenantId, "ai",
        );
        const weaknesses = (diagnosis?.weaknesses as string[]) ?? [];

        // 2. 부족 역량 (B- 이하)
        const scores = await competencyRepo.findCompetencyScores(
          studentId, currentSchoolYear, tenantId, "ai",
        );
        const { COMPETENCY_ITEMS: CI } = await import("../constants");
        const weakCompetencies = scores
          .filter((s) => ["B", "B-", "C"].includes(s.grade_value))
          .map((s) => ({
            item: s.competency_item as import("../types").CompetencyItemCode,
            grade: s.grade_value as import("../types").CompetencyGrade,
            label: CI.find((i) => i.code === s.competency_item)?.label ?? s.competency_item,
          }));

        if (weaknesses.length === 0 && weakCompetencies.length === 0) {
          return "약점/부족역량 없음 — 건너뜀";
        }

        // 3. 기존 전략 (중복 방지)
        const existing = await diagnosisRepo.findStrategies(studentId, currentSchoolYear, tenantId);
        const existingContents = existing.map((s) => s.strategy_content.slice(0, 60));

        // 4. AI 보완전략 제안
        const { suggestStrategies } = await import("../llm/actions/suggestStrategies");
        const result = await suggestStrategies({
          weaknesses,
          weakCompetencies,
          grade: studentGrade,
          targetMajor: (snapshot?.target_major as string) ?? undefined,
          existingStrategies: existingContents,
        });
        if (!result.success) throw new Error(result.error);

        // 5. DB 저장
        let saved = 0;
        for (const suggestion of result.data.suggestions) {
          await diagnosisRepo.insertStrategy({
            student_id: studentId,
            tenant_id: tenantId,
            school_year: currentSchoolYear,
            grade: studentGrade,
            target_area: suggestion.targetArea,
            strategy_content: suggestion.strategyContent,
            priority: suggestion.priority,
            status: "planned",
          });
          saved++;
        }

        return `${saved}건 보완전략 제안됨`;
      },
    },
  ];

  // 순차 실행 (rate limiter가 자동 큐잉)
  for (const { key, run } of taskRunners) {
    // 취소 여부 확인 — 매 태스크 시작 전 DB 상태 체크
    const { data: currentPipeline } = await supabase
      .from("student_record_analysis_pipelines")
      .select("status")
      .eq("id", pipelineId)
      .single();

    if (currentPipeline?.status === "cancelled") {
      // 남은 태스크를 pending 그대로 두고 즉시 종료
      logActionDebug(LOG_CTX, `Pipeline ${pipelineId} cancelled — stopping at task ${key}`);
      return;
    }

    tasks[key] = "running";
    await updatePipelineState(supabase, pipelineId, "running", tasks, previews, results, errors);

    try {
      const output = await run();
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

  // 최종 상태 결정
  const allCompleted = PIPELINE_TASK_KEYS.every((k) => tasks[k] === "completed");
  const anyFailed = PIPELINE_TASK_KEYS.some((k) => tasks[k] === "failed");
  const finalStatus = allCompleted ? "completed" : anyFailed ? "failed" : "completed";

  await updatePipelineState(supabase, pipelineId, finalStatus, tasks, previews, results, errors, true);
}

async function updatePipelineState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pipelineId: string,
  status: string,
  tasks: Record<string, PipelineTaskStatus>,
  previews: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: Record<string, any>,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentResults = (existing.task_results ?? {}) as Record<string, any>;
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
