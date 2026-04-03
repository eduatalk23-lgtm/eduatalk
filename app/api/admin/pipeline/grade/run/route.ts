import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { runGradeAwarePipeline } from "@/lib/domains/student-record/actions/pipeline";

export const maxDuration = 300;

const LOG_CTX = { domain: "student-record", action: "pipeline.grade.run" };

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrConsultant();

    const body = (await request.json()) as {
      studentId: string;
      tenantId: string;
      grades?: number[];
    };

    const { studentId, tenantId, grades } = body;

    if (!studentId || !tenantId) {
      return NextResponse.json(
        { error: "studentId, tenantId 필수" },
        { status: 400 },
      );
    }

    const result = await runGradeAwarePipeline(studentId, tenantId, grades ? { grades } : undefined);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      gradePipelines: result.data.gradePipelines,
      firstPipelineId: result.data.firstPipelineId,
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json({ error: "grade 파이프라인 시작 실패" }, { status: 500 });
  }
}
