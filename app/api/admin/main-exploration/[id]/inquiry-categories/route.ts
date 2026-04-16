import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  apiSuccess,
  apiBadRequest,
  apiNotFound,
  handleApiError,
} from "@/lib/api";
import {
  getMainExplorationById,
  getMainExplorationCategoryScores,
  upsertMainExplorationCategoryScores,
} from "@/lib/domains/student-record/repository/main-exploration-repository";
import { classifyInquiryCategories } from "@/lib/domains/admission/prediction/inquiry-category-classifier";
import { InquiryCategoryList } from "@/lib/domains/admission/repository/main-inquiry-weights-repository";

/**
 * Phase δ-4 — 컨설턴트 카테고리 수동 지정 API
 *
 * GET  /api/admin/main-exploration/[id]/inquiry-categories
 *   현재 저장값 + classifier v0 초안 preview 반환.
 *
 * POST /api/admin/main-exploration/[id]/inquiry-categories
 *   body: { scores: Record<InquiryCategory, number>, source?: "consultant_override" }
 *   각 점수는 0~1. 누락 카테고리는 0 으로 보정. cap 1.0.
 */

const ScoresSchema = z.object({
  scores: z
    .record(z.string(), z.number().min(0).max(1))
    .refine((s) => Object.keys(s).length > 0, { message: "scores 가 비어있습니다." }),
  source: z
    .enum(["consultant_override", "auto", "hybrid"])
    .optional()
    .default("consultant_override"),
  classifierVersion: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminOrConsultant();
    const { id } = await context.params;

    const mainExp = await getMainExplorationById(id);
    if (!mainExp) return apiNotFound("메인 탐구를 찾을 수 없습니다.");
    if (auth.tenantId && mainExp.tenant_id !== auth.tenantId) {
      return apiNotFound("메인 탐구를 찾을 수 없습니다.");
    }

    const stored = await getMainExplorationCategoryScores(id);
    const classifierPreview = classifyInquiryCategories({
      themeKeywords: Array.isArray(mainExp.theme_keywords)
        ? (mainExp.theme_keywords as string[])
        : [],
      careerField: mainExp.career_field ?? null,
    });

    return apiSuccess({
      mainExplorationId: id,
      themeKeywords: mainExp.theme_keywords,
      careerField: mainExp.career_field,
      stored,
      classifierPreview: {
        scores: classifierPreview.scores,
        reasons: classifierPreview.reasons,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminOrConsultant();
    const { id } = await context.params;

    const mainExp = await getMainExplorationById(id);
    if (!mainExp) return apiNotFound("메인 탐구를 찾을 수 없습니다.");
    if (auth.tenantId && mainExp.tenant_id !== auth.tenantId) {
      return apiNotFound("메인 탐구를 찾을 수 없습니다.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiBadRequest("요청 본문이 JSON 이 아닙니다.");
    }
    const parsed = ScoresSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "잘못된 요청입니다.");
    }

    // 알 수 없는 카테고리는 무시, 누락 카테고리는 0 으로 보정
    const normalizedScores = InquiryCategoryList.reduce(
      (acc, cat) => {
        const v = parsed.data.scores[cat];
        acc[cat] = typeof v === "number" ? Math.min(1.0, Math.max(0, v)) : 0;
        return acc;
      },
      {} as Record<typeof InquiryCategoryList[number], number>,
    );

    const updated = await upsertMainExplorationCategoryScores(id, {
      scores: normalizedScores,
      source: parsed.data.source,
      classifierVersion: parsed.data.classifierVersion ?? null,
      updatedBy: auth.userId,
    });

    return apiSuccess({
      mainExplorationId: id,
      categoryScores: updated.category_scores,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
