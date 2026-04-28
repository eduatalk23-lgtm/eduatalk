"use server";

// ============================================
// 파이프라인 상태 조회 (7-4)
//   fetchGradeAwarePipelineStatus — grade + synthesis 파이프라인 상태 조회
//
// 폴링 핫패스. 비용 최소화 원칙:
//   - self-healing / zombie cleanup → pipeline-orchestrator-cleanup.ts (트리거 시점만)
//   - expectedModes 산출 → pipeline-orchestrator-modes.ts (별도 query, staleTime 5분)
//
// 본 함수는 student_record_analysis_pipelines 1회 SELECT 만 수행.
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import { GRADE_PIPELINE_TASK_KEYS } from "@/lib/domains/record-analysis/pipeline";
import type { GradeAwarePipelineStatus, AiGuideProgress } from "./pipeline-orchestrator-types";

const LOG_CTX = { domain: "student-record", action: "pipeline-orchestrator" };

// ============================================
// 7-4. fetchGradeAwarePipelineStatus
// ============================================

/**
 * 해당 학생의 최근 grade + synthesis 파이프라인 상태를 모두 조회.
 *
 * 주의: self-healing / zombie / expectedModes 는 본 함수 책임이 아니다.
 *   - cleanupStalePipelinesForStudent() — 패널 마운트·run* 트리거 시점에 호출
 *   - fetchExpectedModes() — 별도 query (staleTime 5분)
 */
export async function fetchGradeAwarePipelineStatus(
  studentId: string,
): Promise<ActionResponse<GradeAwarePipelineStatus>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // M1-c W6 (2026-04-28): limit 40 → 200 상향.
    // 근본 원인: bootstrap/blueprint 쌍이 운영 도중 매 재부트스트랩마다 누적되면서
    // 학생당 수십 row 까지 늘어남. created_at desc + limit(40) 으로 자르면 grade
    // pipeline (학년당 1 row, 학생당 최대 3) 이 신규 bootstrap/blueprint 에 밀려
    // 응답에서 누락 → UI 가 해당 학년 cell 을 "실행 가능" 으로 잘못 표시.
    // 동일 학생 row 가 200 을 넘는 경우는 운영상 비정상이므로 200 으로 충분.
    //
    // B1: task_results JSONB 컬럼은 태스크별 LLM 출력 전체를 담고 있어 크기가 크다.
    // 클라이언트가 실제로 사용하는 값은 elapsedMs(태스크 소요시간) 1개 필드뿐.
    // SELECT 절에서 task_results 를 제외하고, elapsed 는 별도 컬럼(task_results_elapsed)
    // 없이 task_results 컬럼 대신 Supabase PostgREST JSON path expression 을 사용한다.
    //
    // Supabase JS client 는 JSONB 컬럼에서 특정 path 만 추출하는 SELECT 문법을 지원하지 않으므로
    // 옵션 B 적용: task_results 컬럼 자체는 SELECT 하되, JS 레이어에서 elapsedMs 를 추출한 후
    // row 객체에서 task_results 를 삭제하여 Server Action 직렬화 payload 를 절감한다.
    const { data: rawRows, error } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, pipeline_type, grade, mode, tasks, task_previews, task_results, error_details")
      .eq("student_id", studentId)
      .in("pipeline_type", ["grade", "synthesis", "past_analytics", "blueprint", "bootstrap"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    // B1: task_results 에서 elapsedMs 만 추출하고 원본은 제거 (Server Action 직렬화 payload trim).
    // task_results 는 LLM 출력 전체를 담아 크기가 크나, 클라이언트 소비처는 elapsedMs 1필드뿐.
    const rows = rawRows.map((row) => {
      const resultsRaw = (row.task_results ?? {}) as Record<string, Record<string, unknown>>;
      const elapsed: Record<string, number> = {};
      for (const [k, v] of Object.entries(resultsRaw)) {
        if (v && typeof v === "object" && "elapsedMs" in v && typeof v.elapsedMs === "number") {
          elapsed[k] = v.elapsedMs;
        }
      }
      return { ...row, task_results: null, _elapsed: elapsed };
    });

    const gradePipelines: GradeAwarePipelineStatus["gradePipelines"] = {};
    let synthesisPipeline: GradeAwarePipelineStatus["synthesisPipeline"] = null;
    let pastAnalyticsPipeline: GradeAwarePipelineStatus["pastAnalyticsPipeline"] = null;
    let blueprintPipeline: GradeAwarePipelineStatus["blueprintPipeline"] = null;
    let bootstrapPipeline: GradeAwarePipelineStatus["bootstrapPipeline"] = null;

    for (const row of rows) {
      const tasks = (row.tasks ?? {}) as Record<string, string>;
      const previews = (row.task_previews ?? {}) as Record<string, string>;
      const elapsed = row._elapsed;
      const errors = (row.error_details ?? {}) as Record<string, string>;

      if (row.pipeline_type === "grade" && row.grade != null) {
        const gradeNum = row.grade as number;
        // 학년당 가장 최근 파이프라인만 유지 (order by created_at desc 이미 적용)
        if (!(gradeNum in gradePipelines)) {
          // 하위 호환: 기존 7-task 파이프라인에 신규 키 보정
          // 이미 completed인 파이프라인은 신규 태스크도 completed로 간주 (P7/P8은 해당 시점에 없었으므로)
          const isCompleted = row.status === "completed";
          for (const key of GRADE_PIPELINE_TASK_KEYS) {
            if (!(key in tasks)) {
              tasks[key] = isCompleted ? "completed" : "pending";
            }
          }
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
      } else if (row.pipeline_type === "synthesis") {
        // M1-c W6 (2026-04-28): synthesis row 채택 + task-level union.
        //
        // 동기: 사용자가 새 synthesis 트리거 → 일부 task completed 후 cancel/fail →
        // 다시 새 row 생성 → 또 일부 completed... 패턴이 반복되면 매 row 마다 다른
        // task 가 completed. 가장 최근 row 1건만 보면 직전 run 의 LLM 산출물(diagnosis/
        // strategy/interview 등)이 가려짐 — DB 에는 영속되어 있는데도.
        //
        // 정책:
        //  1) latest 가 cancelled/failed + task 전부 pending 인 "공허한 row" 면 skip.
        //  2) 그 외 latest 채택 (status/pipelineId 베이스).
        //  3) 후속(과거) row 의 completed task 중 latest 에 없는 것을 union — preview/
        //     elapsed 도 함께. errors 는 latest 우선 (덮어쓰지 않음).
        if (!synthesisPipeline) {
          const taskValues = Object.values(tasks);
          const allPending = taskValues.length > 0 && taskValues.every((v) => v === "pending");
          const isAborted = row.status === "cancelled" || row.status === "failed";
          if (!(isAborted && allPending)) {
            synthesisPipeline = {
              pipelineId: row.id as string,
              status: row.status as string,
              tasks,
              previews,
              elapsed,
              errors,
            };
          }
        } else {
          // task-level union: latest 에 미완료(pending/failed) 인 task 가 prev 에서 completed 면 채움.
          for (const [k, v] of Object.entries(tasks)) {
            if (v === "completed" && synthesisPipeline.tasks[k] !== "completed") {
              synthesisPipeline.tasks[k] = "completed";
              if (previews[k]) synthesisPipeline.previews[k] = previews[k];
              if (elapsed[k] != null) synthesisPipeline.elapsed[k] = elapsed[k];
            }
          }
        }
      } else if (row.pipeline_type === "past_analytics" && !pastAnalyticsPipeline) {
        pastAnalyticsPipeline = {
          pipelineId: row.id as string,
          status: row.status as string,
          tasks,
          previews,
          elapsed,
          errors,
        };
      } else if (row.pipeline_type === "blueprint" && !blueprintPipeline) {
        blueprintPipeline = {
          pipelineId: row.id as string,
          status: row.status as string,
          tasks,
          previews,
          elapsed,
          errors,
        };
      } else if (row.pipeline_type === "bootstrap" && !bootstrapPipeline) {
        bootstrapPipeline = {
          pipelineId: row.id as string,
          status: row.status as string,
          tasks,
          previews,
          elapsed,
          errors,
        };
      }
    }

    // P0-2: 가이드 본문 생성 진행률 합산 (synthesis 존재 시에만).
    // ai-guide-gen 이 비동기로 setek/changche/haengteuk 가이드 본문을 채우므로
    // synthesis task='completed' 와 별도로 본문 진행률을 UI 에 노출.
    let aiGuideProgress: AiGuideProgress | null = null;
    if (synthesisPipeline) {
      try {
        const { data: guideRows } = await supabase
          .from("exploration_guides")
          .select("status")
          .eq("source_type", "ai_pipeline_design")
          .eq("is_latest", true)
          .filter("ai_generation_meta->>studentId", "eq", studentId);

        const counts: AiGuideProgress = {
          total: guideRows?.length ?? 0,
          completed: 0,
          queued: 0,
          generating: 0,
          failed: 0,
        };
        for (const r of guideRows ?? []) {
          const s = (r as { status: string }).status;
          if (s === "pending_approval" || s === "approved") counts.completed += 1;
          else if (s === "queued_generation") counts.queued += 1;
          else if (s === "ai_generating") counts.generating += 1;
          else if (s === "ai_failed") counts.failed += 1;
        }
        aiGuideProgress = counts;
      } catch {
        // 비치명적 — 진행률만 누락하고 본 status 응답은 정상 반환.
        aiGuideProgress = null;
      }
    }

    return createSuccessResponse({
      gradePipelines,
      synthesisPipeline,
      pastAnalyticsPipeline,
      blueprintPipeline,
      bootstrapPipeline,
      aiGuideProgress,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchGradeAwarePipelineStatus" }, error, { studentId });
    return createErrorResponse("학년별 파이프라인 상태 조회 실패");
  }
}
