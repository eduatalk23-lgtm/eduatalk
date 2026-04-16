// ============================================
// Full Pipeline Orchestration HTTP Route (2026-04-16, #5)
// POST /api/admin/pipeline/full-run
//
// runFullOrchestration 서버 액션을 HTTP 경계로 노출.
// 학년 카테고리 판정 + 5 파이프라인 INSERT(grade analysis/past/blueprint/grade design)만 수행.
// Phase 실행과 Synthesis INSERT는 클라이언트(`runFullSequence`)가 주도.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { runFullOrchestration } from "@/lib/domains/student-record/actions/pipeline-orchestrator-full";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.full-run" };

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrConsultant();

    const { studentId, tenantId } = (await request.json()) as {
      studentId: string;
      tenantId: string;
    };

    if (!studentId || !tenantId) {
      return NextResponse.json(
        { error: "studentId, tenantId 필수" },
        { status: 400 },
      );
    }

    const result = await runFullOrchestration(studentId, tenantId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "전체 파이프라인 시작 실패" },
      { status: 500 },
    );
  }
}
