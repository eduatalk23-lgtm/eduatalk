import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { executeExtractTrajectories } from "@/lib/domains/guide/actions/extract-trajectories";

export const maxDuration = 300;

const LOG_CTX = { domain: "guide", action: "extractTrajectoriesRoute" };

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrConsultant();

    const { studentId } = (await request.json()) as { studentId: string };

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await executeExtractTrajectories(studentId);
    return NextResponse.json({ completed: true, ...result });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "궤적 추출에 실패했습니다." },
      { status: 500 },
    );
  }
}
