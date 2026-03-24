"use server";

// ============================================
// AI 초기 분석 파이프라인
// Phase B: 5개 AI 태스크 순차 실행 + DB 상태 추적
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
import { COMPETENCY_ITEMS } from "../constants";
import * as competencyRepo from "../competency-repository";
import type { ActivityTagInsert, CompetencyScoreInsert, CompetencyGrade } from "../types";
import type { HighlightAnalysisResult } from "../llm/types";

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

    return createSuccessResponse<PipelineStatus>({
      id: data.id,
      studentId: data.student_id,
      status: data.status,
      tasks: (data.tasks ?? {}) as Record<PipelineTaskKey, PipelineTaskStatus>,
      taskPreviews: (data.task_previews ?? {}) as Record<string, string>,
      errorDetails: data.error_details as Record<string, string> | null,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
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
  const errors: Record<string, string> = {};

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

  const taskRunners: Array<{ key: PipelineTaskKey; run: () => Promise<string> }> = [
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
        // 추천된 가이드를 실제로 배정 (exploration_guide_assignments)
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
    {
      key: "setek_guide",
      run: async () => {
        const { generateSetekGuide } = await import("../llm/actions/generateSetekGuide");
        const result = await generateSetekGuide(studentId);
        if (!result.success) throw new Error(result.error);
        const guides = (result.data as { guides?: Array<{ subjectName: string }> })?.guides;
        return guides ? `${guides.length}과목 방향 생성` : "세특 방향 생성 완료";
      },
    },
    {
      key: "activity_summary",
      run: async () => {
        const { generateActivitySummary } = await import("../llm/actions/generateActivitySummary");
        const grades = Array.from({ length: studentGrade }, (_, i) => i + 1);
        const result = await generateActivitySummary(studentId, grades);
        if (!result.success) throw new Error(result.error);
        return "활동 요약서 생성 완료";
      },
    },
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

          allResults.set(recordId, result.data);
          succeeded++;
        }

        // 1. 세특 분석
        const { data: seteks } = await supabase
          .from("student_record_seteks")
          .select("id, content, grade, subject:subject_id(name)")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);
        for (const s of (seteks ?? [])) {
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

        // 2. 창체 분석
        const { data: changche } = await supabase
          .from("student_record_changche")
          .select("id, content, grade, activity_type")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId);
        for (const c of (changche ?? [])) {
          const content = c.content as string;
          if (!content || content.trim().length < 20) continue;
          try {
            await analyzeAndSave("changche", c.id, content, c.grade);
          } catch (err) {
            failed++;
            logActionError({ ...LOG_CTX, action: "pipeline.competency.changche" }, err, { recordId: c.id });
          }
        }

        // 3. 행특 분석
        const { data: haengteuk } = await supabase
          .from("student_record_haengteuk")
          .select("id, content, grade")
          .eq("student_id", studentId)
          .eq("tenant_id", tenantId);
        for (const h of (haengteuk ?? [])) {
          const content = h.content as string;
          if (!content || content.trim().length < 20) continue;
          try {
            await analyzeAndSave("haengteuk", h.id, content, h.grade);
          } catch (err) {
            failed++;
            logActionError({ ...LOG_CTX, action: "pipeline.competency.haengteuk" }, err, { recordId: h.id });
          }
        }

        // 4. 종합 등급 저장 (최빈값 기반)
        if (allResults.size > 0) {
          const gradeVotes = new Map<string, Map<string, number>>();
          for (const data of allResults.values()) {
            for (const g of data.competencyGrades) {
              if (!gradeVotes.has(g.item)) gradeVotes.set(g.item, new Map());
              const votes = gradeVotes.get(g.item)!;
              votes.set(g.grade, (votes.get(g.grade) ?? 0) + 1);
            }
          }

          const GRADE_RANK: Record<string, number> = { "A+": 0, "A-": 1, "B+": 2, "B": 3, "B-": 4, "C": 5 };
          const scorePromises: Promise<unknown>[] = [];
          for (const [item, votes] of gradeVotes) {
            let bestGrade = "B";
            let bestCount = 0;
            for (const [grade, count] of votes) {
              if (count > bestCount || (count === bestCount && (GRADE_RANK[grade] ?? 99) < (GRADE_RANK[bestGrade] ?? 99))) {
                bestGrade = grade;
                bestCount = count;
              }
            }
            const area = COMPETENCY_ITEMS.find((i) => i.code === item)?.area;
            if (!area) continue;
            scorePromises.push(competencyRepo.upsertCompetencyScore({
              tenant_id: tenantId,
              student_id: studentId,
              school_year: currentSchoolYear,
              scope: "yearly",
              competency_area: area,
              competency_item: item,
              grade_value: bestGrade as CompetencyGrade,
              notes: `[AI] ${bestCount}건 레코드 종합`,
              source: "ai",
              status: "suggested",
            } as CompetencyScoreInsert));
          }
          await Promise.allSettled(scorePromises);
        }

        const parts = [`${succeeded}건 성공`];
        if (failed > 0) parts.push(`${failed}건 실패`);
        return `역량 분석 ${parts.join(", ")} (세특+창체+행특)`;
      },
    },
  ];

  // 순차 실행 (rate limiter가 자동 큐잉)
  for (const { key, run } of taskRunners) {
    tasks[key] = "running";
    await updatePipelineState(supabase, pipelineId, "running", tasks, previews, errors);

    try {
      const preview = await run();
      tasks[key] = "completed";
      previews[key] = preview;
      logActionDebug(LOG_CTX, `Task ${key} completed: ${preview}`);
    } catch (err) {
      tasks[key] = "failed";
      const msg = err instanceof Error ? err.message : String(err);
      errors[key] = msg;
      logActionError({ ...LOG_CTX, action: `pipeline.${key}` }, err, { pipelineId });
    }

    await updatePipelineState(supabase, pipelineId, "running", tasks, previews, errors);
  }

  // 최종 상태 결정
  const allCompleted = PIPELINE_TASK_KEYS.every((k) => tasks[k] === "completed");
  const anyFailed = PIPELINE_TASK_KEYS.some((k) => tasks[k] === "failed");
  const finalStatus = allCompleted ? "completed" : anyFailed ? "failed" : "completed";

  await updatePipelineState(supabase, pipelineId, finalStatus, tasks, previews, errors, true);
}

async function updatePipelineState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pipelineId: string,
  status: string,
  tasks: Record<string, PipelineTaskStatus>,
  previews: Record<string, string>,
  errors: Record<string, string>,
  isFinal = false,
) {
  const update: Record<string, unknown> = {
    status,
    tasks,
    task_previews: previews,
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
