/**
 * Agent 임베딩 배치 Cron Job
 *
 * pending 상태의 consulting_cases + agent_corrections 임베딩을 배치 생성.
 * 실시간 임베딩 실패 시 여기서 재처리.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedApiKey = process.env.CRON_SECRET;

  if (!expectedApiKey) {
    console.error("[agent-embedding-batch] CRON_SECRET이 설정되지 않았습니다.");
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

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    cases: { success: 0, failed: 0 },
    corrections: { success: 0, failed: 0 },
    errors: [] as string[],
  };

  try {
    // 1. pending 케이스 임베딩 (최대 50건)
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // pending 케이스 ID 조회
    const { data: pendingCases } = await supabase
      .from("consulting_cases")
      .select("id")
      .eq("embedding_status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (pendingCases && pendingCases.length > 0) {
      try {
        const { embedBatchCases } = await import(
          "@/lib/agents/memory/embedding-service"
        );
        const caseIds = pendingCases.map((c: { id: string }) => c.id);
        const caseResult = await embedBatchCases(caseIds);
        results.cases = caseResult;
      } catch (error) {
        results.errors.push(
          `Cases: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 2. pending 교정 임베딩 (최대 50건)
    try {
      const { embedPendingCorrections } = await import(
        "@/lib/agents/memory/embedding-service"
      );
      const correctionResult = await embedPendingCorrections(50);
      results.corrections = correctionResult;
    } catch (error) {
      results.errors.push(
        `Corrections: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const totalProcessed =
      results.cases.success +
      results.cases.failed +
      results.corrections.success +
      results.corrections.failed;

    console.log("[agent-embedding-batch] Results:", results);

    return NextResponse.json({
      success: results.errors.length === 0,
      totalProcessed,
      ...results,
    });
  } catch (error) {
    console.error("[agent-embedding-batch] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Embedding batch failed",
      },
      { status: 500 },
    );
  }
}
