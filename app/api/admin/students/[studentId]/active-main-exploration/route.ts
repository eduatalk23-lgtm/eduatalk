import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { apiSuccess, apiNotFound, handleApiError } from "@/lib/api";
import { listActiveMainExplorations } from "@/lib/domains/student-record/repository/main-exploration-repository";

/**
 * Phase δ-4 보조 — 학생의 활성 메인 탐구(overall) id 조회.
 *
 * GET /api/admin/students/[studentId]/active-main-exploration?direction=design|analysis
 *
 * design 우선, 없으면 analysis 폴백.
 * scope=overall 만 반환 (다축 메인 탐구는 별도 엔드포인트에서 다룰 예정).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireAdminOrConsultant({ requireTenant: true });
    const { studentId } = await context.params;
    const tenantId = auth.tenantId!;

    const directionParam = req.nextUrl.searchParams.get("direction");
    const preferDesign = directionParam !== "analysis";

    const active = await listActiveMainExplorations(studentId, tenantId);
    if (active.length === 0) {
      return apiNotFound("활성 메인 탐구가 없습니다.");
    }

    const overall = active.filter((m) => m.scope === "overall");
    const picked = preferDesign
      ? (overall.find((m) => m.direction === "design") ??
          overall.find((m) => m.direction === "analysis"))
      : (overall.find((m) => m.direction === "analysis") ??
          overall.find((m) => m.direction === "design"));

    if (!picked) return apiNotFound("scope=overall 활성 메인 탐구가 없습니다.");

    // Phase 3 (2026-04-18): origin + edited_by_consultant_at 노출.
    //   UI 뱃지("AI 자동 생성 초안" / "컨설턴트 수정됨") 렌더용.
    return apiSuccess({
      id: picked.id,
      scope: picked.scope,
      direction: picked.direction,
      themeLabel: picked.theme_label,
      themeKeywords: picked.theme_keywords,
      careerField: picked.career_field,
      version: picked.version,
      origin: picked.origin ?? null,
      editedByConsultantAt: picked.edited_by_consultant_at ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
