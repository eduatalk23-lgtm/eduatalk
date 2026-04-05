/**
 * 좀비 파이프라인 타임아웃 처리 Cron Job
 *
 * 실행 조건: GitHub Actions (6시간마다) 또는 수동 트리거
 * 동작:
 *   1. status = 'running' AND updated_at < now() - 60분 → timeout 처리
 *   2. status = 'pending' AND updated_at < now() - 30분 → timeout 처리
 *   3. 처리 건수 및 pipelineId 목록 로깅 후 응답 반환
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionWarn } from "@/lib/logging/actionLogger";

export const runtime = "nodejs";

const LOG_CTX = "cron/pipeline-timeout";

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedApiKey = process.env.CRON_SECRET;

  if (!expectedApiKey) {
    console.error("[pipeline-timeout] CRON_SECRET이 설정되지 않았습니다.");
    return false;
  }

  if (!apiKey) return false;

  try {
    const bufA = Buffer.from(apiKey);
    const bufB = Buffer.from(expectedApiKey);
    if (bufA.length !== bufB.length) {
      const randomBuf = randomBytes(bufA.length);
      timingSafeEqual(bufA, randomBuf);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

interface PipelineRow {
  id: string;
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const now = new Date().toISOString();
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // 1) 60분 이상 running 상태인 파이프라인
    const { data: runningStuck, error: runningError } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id")
      .eq("status", "running")
      .lt("updated_at", sixtyMinutesAgo);

    if (runningError) {
      console.error("[pipeline-timeout] running 조회 오류:", runningError.message);
      return NextResponse.json({ error: runningError.message }, { status: 500 });
    }

    // 2) 30분 이상 pending 상태인 파이프라인 (정상이면 즉시 running 전환)
    const { data: pendingStuck, error: pendingError } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id")
      .eq("status", "pending")
      .lt("updated_at", thirtyMinutesAgo);

    if (pendingError) {
      console.error("[pipeline-timeout] pending 조회 오류:", pendingError.message);
      return NextResponse.json({ error: pendingError.message }, { status: 500 });
    }

    const runningIds = ((runningStuck ?? []) as PipelineRow[]).map((r) => r.id);
    const pendingIds = ((pendingStuck ?? []) as PipelineRow[]).map((r) => r.id);
    const allIds = [...runningIds, ...pendingIds];

    if (allIds.length === 0) {
      return NextResponse.json({
        processed: 0,
        runningTimedOut: 0,
        pendingTimedOut: 0,
        pipelineIds: [],
      });
    }

    // timeout 상태로 일괄 업데이트
    const { error: updateError } = await supabase
      .from("student_record_analysis_pipelines")
      .update({ status: "timeout", completed_at: now })
      .in("id", allIds);

    if (updateError) {
      console.error("[pipeline-timeout] 업데이트 오류:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (runningIds.length > 0) {
      logActionWarn(
        LOG_CTX,
        `Running stuck 파이프라인 ${runningIds.length}건 timeout: ${runningIds.join(", ")}`,
      );
    }
    if (pendingIds.length > 0) {
      logActionWarn(
        LOG_CTX,
        `Pending stuck 파이프라인 ${pendingIds.length}건 timeout: ${pendingIds.join(", ")}`,
      );
    }

    return NextResponse.json({
      processed: allIds.length,
      runningTimedOut: runningIds.length,
      pendingTimedOut: pendingIds.length,
      pipelineIds: allIds,
    });
  } catch (error) {
    console.error("[pipeline-timeout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pipeline timeout cleanup failed" },
      { status: 500 },
    );
  }
}
