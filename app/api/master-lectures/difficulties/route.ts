import { NextRequest } from "next/server";
import { getDifficultiesForMasterLectures } from "@/lib/data/contentMasters";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export async function GET(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId || null;

    const difficulties = await getDifficultiesForMasterLectures(tenantId);

    return Response.json({
      success: true,
      data: difficulties,
    });
  } catch (error) {
    console.error("[api/master-lectures/difficulties] 난이도 목록 조회 실패:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "난이도 목록 조회에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

