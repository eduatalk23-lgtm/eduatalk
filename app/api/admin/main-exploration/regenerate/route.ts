import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  apiSuccess,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";
import {
  createMainExploration,
  getActiveMainExploration,
  upsertMainExplorationCategoryScores,
  type MainExplorationDirection,
  type MainExplorationScope,
  type MainExplorationSemanticRole,
  type MainExplorationSource,
  type MainExplorationTierPlan,
} from "@/lib/domains/student-record/repository/main-exploration-repository";
import { classifyInquiryCategories } from "@/lib/domains/admission/prediction/inquiry-category-classifier";
import { InquiryCategoryList } from "@/lib/domains/admission/repository/main-inquiry-weights-repository";

/**
 * Phase δ-7 — 컨설턴트 메인 탐구 재생성 API.
 *
 * POST /api/admin/main-exploration/regenerate
 *
 * 흐름:
 *   1. 기존 active main_exploration 조회 → parent_version_id 연결
 *   2. createMainExploration 호출 (자동 swap: 기존 deactivate + 새 version insert)
 *   3. category_scores 는 classifier v0 로 재계산 (source="auto", consultant_override 는 별도 API)
 *
 * body:
 *   studentId, tenantId 생략 시 요청자의 tenantId 사용.
 *   scope + direction + trackLabel 로 slice 결정 (기본 scope=overall, direction=design).
 */

const TierEntrySchema = z
  .object({
    theme: z.string().optional(),
    key_questions: z.array(z.string()).optional(),
    suggested_activities: z.array(z.string()).optional(),
    linked_storyline_ids: z.array(z.string()).optional(),
    linked_roadmap_item_ids: z.array(z.string()).optional(),
    linked_narrative_arc_ids: z.array(z.string()).optional(),
    linked_hyperedge_ids: z.array(z.string()).optional(),
    linked_setek_guide_ids: z.array(z.string()).optional(),
    linked_changche_guide_ids: z.array(z.string()).optional(),
    linked_haengteuk_guide_ids: z.array(z.string()).optional(),
    linked_topic_trajectory_ids: z.array(z.string()).optional(),
  })
  .strip();

const BodySchema = z.object({
  studentId: z.string().uuid(),
  schoolYear: z.number().int().min(2000).max(2100),
  grade: z.number().int().min(1).max(3),
  semester: z.union([z.literal(1), z.literal(2)]),
  scope: z.enum(["overall", "track", "grade"]).optional().default("overall"),
  trackLabel: z.string().nullable().optional(),
  direction: z.enum(["analysis", "design"]).optional().default("design"),
  semanticRole: z
    .enum(["hypothesis_root", "aggregation_target", "hybrid_recursion", "consultant_pin"])
    .optional()
    .default("hypothesis_root"),
  source: z.enum(["ai", "consultant", "hybrid"]).optional().default("consultant"),
  pinnedByConsultant: z.boolean().optional().default(false),
  themeLabel: z.string().min(1),
  themeKeywords: z.array(z.string()).optional().default([]),
  careerField: z.string().nullable().optional(),
  tierPlan: z
    .object({
      foundational: TierEntrySchema.optional(),
      development: TierEntrySchema.optional(),
      advanced: TierEntrySchema.optional(),
    })
    .strip()
    .optional(),
  identityAlignmentScore: z.number().min(0).max(100).nullable().optional(),
  exemplarReferenceIds: z.array(z.string()).optional().default([]),
  modelName: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrConsultant({ requireTenant: true });
    const tenantId = auth.tenantId!;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiBadRequest("요청 본문이 JSON 이 아닙니다.");
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "잘못된 요청입니다.");
    }
    const input = parsed.data;

    // 1) 기존 active 조회 (parent_version_id 연결용 — createMainExploration 내부에서도 처리하지만
    //    응답에 이전 버전 id 포함을 위해 미리 조회)
    const prev = await getActiveMainExploration(input.studentId, tenantId, {
      scope: input.scope as MainExplorationScope,
      trackLabel: input.trackLabel ?? null,
      direction: input.direction as MainExplorationDirection,
    });

    // 2) 새 버전 생성 (repo 가 기존 deactivate + version++ 자동 처리)
    const created = await createMainExploration({
      studentId: input.studentId,
      tenantId,
      schoolYear: input.schoolYear,
      grade: input.grade,
      semester: input.semester,
      scope: input.scope as MainExplorationScope,
      trackLabel: input.trackLabel ?? null,
      direction: input.direction as MainExplorationDirection,
      semanticRole: input.semanticRole as MainExplorationSemanticRole,
      source: input.source as MainExplorationSource,
      pinnedByConsultant: input.pinnedByConsultant,
      themeLabel: input.themeLabel,
      themeKeywords: input.themeKeywords,
      careerField: input.careerField ?? null,
      tierPlan: input.tierPlan as MainExplorationTierPlan | undefined,
      identityAlignmentScore: input.identityAlignmentScore ?? null,
      exemplarReferenceIds: input.exemplarReferenceIds,
      modelName: input.modelName ?? null,
    });

    // 3) category_scores 재계산 (source="auto")
    const classifier = classifyInquiryCategories({
      themeKeywords: input.themeKeywords,
      careerField: input.careerField ?? null,
    });
    const normalized = InquiryCategoryList.reduce(
      (acc, cat) => {
        acc[cat] = classifier.scores[cat] ?? 0;
        return acc;
      },
      {} as Record<typeof InquiryCategoryList[number], number>,
    );
    await upsertMainExplorationCategoryScores(created.id, {
      scores: normalized,
      source: "auto",
      classifierVersion: "v0-rule",
      updatedBy: auth.userId,
      reasons: classifier.reasons,
    });

    return apiSuccess({
      mainExplorationId: created.id,
      previousVersionId: prev?.id ?? null,
      version: created.version,
      categoryScores: normalized,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
