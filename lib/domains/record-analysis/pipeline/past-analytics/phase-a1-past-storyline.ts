// ============================================
// A1: Past Storyline — NEIS 기반 과거 서사 생성
//
// 4축×3층 통합 아키텍처 A층(Past Analytics). 2026-04-16 D.
//
// 입력: 확정된 NEIS 레코드만 (imported_content / confirmed_content).
// 출력: scope='past' storyline 영속화. 1학년만 존재(records<2)면 자동 skip.
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { PipelineContext, TaskRunnerOutput } from "../pipeline-types";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

export function assertPastAnalyticsCtx(
  ctx: PipelineContext,
): asserts ctx is PipelineContext & { pipelineType: "past_analytics" } {
  if (ctx.pipelineType !== "past_analytics") {
    throw new Error(`assertPastAnalyticsCtx: expected past_analytics pipeline, got ${ctx.pipelineType}`);
  }
}

export async function runPastStorylineGeneration(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertPastAnalyticsCtx(ctx);
  const { pipelineId, studentId, tenantId, neisGrades } = ctx;

  const neisYears = neisGrades ?? [];
  if (neisYears.length === 0) {
    return "NEIS 학년 없음 — Past Storyline 건너뜀";
  }

  logActionDebug(LOG_CTX, "A1 Past Storyline 시작", { pipelineId, neisGrades: neisYears });

  try {
    const { generatePastStoryline } = await import(
      "../../llm/actions/generatePastStoryline"
    );
    const result = await generatePastStoryline(studentId, tenantId, neisYears);

    if (!result.success) {
      logActionError(LOG_CTX, `Past Storyline 실패: ${result.error}`, { pipelineId });
      throw new Error(result.error);
    }

    const { storylines, connections, savedCount } = result.data;

    return {
      preview: `Past Storyline ${savedCount}건 생성 (연결 ${connections.length}건, NEIS ${neisYears.length}개 학년)`,
      result: {
        storylineCount: savedCount,
        connectionCount: connections.length,
        storylineTitles: storylines.map((s) => s.title).slice(0, 5),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logActionError(LOG_CTX, `A1 Past Storyline 실패: ${msg}`, { pipelineId });
    throw err;
  }
}
