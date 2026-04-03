import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { runSynthesisPipeline } from "@/lib/domains/student-record/actions/pipeline";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.synthesis.run" };

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

    const result = await runSynthesisPipeline(studentId, tenantId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ pipelineId: result.data.pipelineId });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "Synthesis 파이프라인 시작 실패" },
      { status: 500 },
    );
  }
}
