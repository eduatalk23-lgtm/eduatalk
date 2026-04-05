/**
 * 좀비 파이프라인 타임아웃 처리 Cron Job
 *
 * 실행 조건: 외부 트리거 (Vercel Hobby 플랜 daily cron 제한으로 vercel.json에 미등록)
 * 동작:
 *   1. student_record_analysis_pipelines 테이블에서
 *      status = 'running' AND updated_at < now() - 60분 인 행 조회
 *   2. 해당 행의 status → 'timeout', completed_at → 현재 시간으로 업데이트
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
    const sixtyMinutesAgo = new Date(
      Date.now() - 60 * 60 * 1000
    ).toISOString();

    // 60분 이상 running 상태인 파이프라인 조회
    const { data: stuckPipelines, error: selectError } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id")
      .eq("status", "running")
      .lt("updated_at", sixtyMinutesAgo);

    if (selectError) {
      console.error("[pipeline-timeout] 조회 오류:", selectError.message);
      return NextResponse.json(
        { error: selectError.message },
        { status: 500 }
      );
    }

    const rows = (stuckPipelines ?? []) as PipelineRow[];

    if (rows.length === 0) {
      return NextResponse.json({ processed: 0, pipelineIds: [] });
    }

    const pipelineIds = rows.map((r) => r.id);
    const now = new Date().toISOString();

    // timeout 상태로 일괄 업데이트
    const { error: updateError } = await supabase
      .from("student_record_analysis_pipelines")
      .update({ status: "timeout", completed_at: now })
      .in("id", pipelineIds);

    if (updateError) {
      console.error("[pipeline-timeout] 업데이트 오류:", updateError.message);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    logActionWarn(
      LOG_CTX,
      `Stuck 파이프라인 ${pipelineIds.length}건 timeout 처리: ${pipelineIds.join(", ")}`
    );

    return NextResponse.json({
      processed: pipelineIds.length,
      pipelineIds,
    });
  } catch (error) {
    console.error("[pipeline-timeout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pipeline timeout cleanup failed" },
      { status: 500 }
    );
  }
}
