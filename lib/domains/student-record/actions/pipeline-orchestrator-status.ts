"use server";

// ============================================
// 파이프라인 상태 조회 (7-4)
//   fetchGradeAwarePipelineStatus — grade + synthesis 파이프라인 상태 조회
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type {
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
} from "@/lib/domains/record-analysis/pipeline";
import { GRADE_PIPELINE_TASK_KEYS } from "@/lib/domains/record-analysis/pipeline";
import { resolveRecordData, deriveGradeCategories } from "@/lib/domains/record-analysis/pipeline";
import type { GradeAwarePipelineStatus } from "./pipeline-orchestrator-types";

const LOG_CTX = { domain: "student-record", action: "pipeline-orchestrator" };

// ============================================
// 7-4. fetchGradeAwarePipelineStatus
// ============================================

/**
 * 해당 학생의 최근 grade + synthesis 파이프라인 상태를 모두 조회.
 */
export async function fetchGradeAwarePipelineStatus(
  studentId: string,
): Promise<ActionResponse<GradeAwarePipelineStatus>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // ── Self-healing: analysis 모드 stuck 파이프라인 복구 ─────────────
    // 예전 버그로 Phase 6이 "completed" 마킹을 하지 않아 analysis 모드 파이프라인이
    // 모든 태스크 완료 후에도 status="running"으로 고착될 수 있다. 폴링 호출마다
    // 이를 감지하여 올바르게 "completed"로 승격한다. (최신 코드에서는 Phase 6이
    // 직접 마킹하므로 발생하지 않지만, 기존 stuck 데이터 복구용)
    {
      const { data: stuckGrade } = await supabase
        .from("student_record_analysis_pipelines")
        .select("id, tasks, mode")
        .eq("student_id", studentId)
        .eq("pipeline_type", "grade")
        .eq("status", "running");

      const ANALYSIS_REQUIRED = GRADE_PIPELINE_TASK_KEYS.filter(
        (k) => k !== "draft_generation" && k !== "draft_analysis",
      );

      for (const row of stuckGrade ?? []) {
        if (row.mode !== "analysis") continue;
        const t = (row.tasks ?? {}) as Record<string, string>;
        const allDone = ANALYSIS_REQUIRED.every((k) => t[k] === "completed");
        if (allDone) {
          await supabase
            .from("student_record_analysis_pipelines")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", row.id as string);
        }
      }
    }

    // 좀비 자동 정리 (self-healing):
    // 트랙 D (2026-04-14): 판정 기준을 `started_at` → `updated_at` 으로 변경.
    //   기존: started_at 기준이라 장기 실행 synthesis(10~13분)가 정상 실행 중에도 오판되어 cancel됨.
    //   신규: updated_at 기준 — 각 task 완료/실행 중마다 runTaskWithState가 DB write(heartbeat) 하므로,
    //         **최근 활동이 없는 진짜 좀비**만 잡힌다. 임계값 5분 유지.
    // 조건 불만족 시 PostgreSQL UPDATE는 no-op이므로 오버헤드 적음.
    // 주의: 위의 analysis 복구가 먼저 실행되어야 성공한 파이프라인이 cancelled로 오마킹되지 않는다.
    const zombieThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from("student_record_analysis_pipelines")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("student_id", studentId)
      .eq("status", "running")
      .lt("updated_at", zombieThreshold);

    // M1-c W6 (2026-04-28): limit 40 → 200 상향.
    // 근본 원인: bootstrap/blueprint 쌍이 운영 도중 매 재부트스트랩마다 누적되면서
    // 학생당 수십 row 까지 늘어남. created_at desc + limit(40) 으로 자르면 grade
    // pipeline (학년당 1 row, 학생당 최대 3) 이 신규 bootstrap/blueprint 에 밀려
    // 응답에서 누락 → UI 가 해당 학년 cell 을 "실행 가능" 으로 잘못 표시.
    // 동일 학생 row 가 200 을 넘는 경우는 운영상 비정상이므로 200 으로 충분.
    const { data: rows, error } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, status, pipeline_type, grade, mode, tasks, task_previews, task_results, error_details")
      .eq("student_id", studentId)
      .in("pipeline_type", ["grade", "synthesis", "past_analytics", "blueprint", "bootstrap"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const gradePipelines: GradeAwarePipelineStatus["gradePipelines"] = {};
    let synthesisPipeline: GradeAwarePipelineStatus["synthesisPipeline"] = null;
    let pastAnalyticsPipeline: GradeAwarePipelineStatus["pastAnalyticsPipeline"] = null;
    let blueprintPipeline: GradeAwarePipelineStatus["blueprintPipeline"] = null;
    let bootstrapPipeline: GradeAwarePipelineStatus["bootstrapPipeline"] = null;

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

    // 파이프라인 실행 전에도 학년별 예상 mode 산출 (NEIS 유무 기반)
    const expectedModes: Record<number, "analysis" | "design"> = {};
    const { data: student } = await supabase
      .from("students")
      .select("grade, tenant_id")
      .eq("id", studentId)
      .single();

    if (student) {
      const tenantId = student.tenant_id as string;
      const [sRes, cRes, hRes, cpRes] = await Promise.all([
        supabase.from("student_record_seteks")
          .select("grade, imported_content")
          .eq("student_id", studentId).eq("tenant_id", tenantId).is("deleted_at", null),
        supabase.from("student_record_changche")
          .select("grade, imported_content")
          .eq("student_id", studentId).eq("tenant_id", tenantId),
        supabase.from("student_record_haengteuk")
          .select("grade, imported_content")
          .eq("student_id", studentId).eq("tenant_id", tenantId),
        supabase.from("student_course_plans")
          .select("grade")
          .eq("student_id", studentId).in("plan_status", ["confirmed", "recommended"]),
      ]);

      const resolvedRecords = resolveRecordData(
        (sRes.data ?? []) as CachedSetek[],
        (cRes.data ?? []) as CachedChangche[],
        (hRes.data ?? []) as CachedHaengteuk[],
      );
      const { neisGrades } = deriveGradeCategories(resolvedRecords);
      const coursePlanGrades = [...new Set(
        ((cpRes.data ?? []) as { grade: number }[]).map((r) => r.grade).filter((g) => g >= 1 && g <= 3),
      )];

      // 레코드 또는 수강계획이 있는 모든 학년에 대해 mode 계산
      const allGrades = [...new Set([
        ...Object.keys(resolvedRecords).map(Number),
        ...coursePlanGrades,
      ])].filter((g) => g >= 1 && g <= 3);

      for (const grade of allGrades) {
        expectedModes[grade] = neisGrades.includes(grade) ? "analysis" : "design";
      }
    }

    return createSuccessResponse({
      gradePipelines,
      synthesisPipeline,
      pastAnalyticsPipeline,
      blueprintPipeline,
      bootstrapPipeline,
      expectedModes,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchGradeAwarePipelineStatus" }, error, { studentId });
    return createErrorResponse("학년별 파이프라인 상태 조회 실패");
  }
}
