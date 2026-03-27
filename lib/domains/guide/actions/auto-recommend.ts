"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "guide", action: "autoRecommend" } as const;

export interface RecommendedGuide {
  id: string;
  title: string;
  guide_type: string | null;
  book_title: string | null;
  match_reason: "classification" | "subject" | "both";
}

/**
 * DB 기반 가이드 자동 추천 (벡터 검색 X, API 할당량 소모 없음)
 *
 * classificationId → exploration_guide_classification_mappings
 * subjectName → subjects → exploration_guide_subject_mappings
 * 이미 배정된 가이드 제외, approved + is_latest 필터
 */
export async function autoRecommendGuidesAction(input: {
  studentId: string;
  classificationId?: number | null;
  subjectName?: string | null;
  limit?: number;
}): Promise<ActionResponse<RecommendedGuide[]>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const limit = input.limit ?? 5;

    // 1. classification 기반 guide_id 조회
    const classGuideIds = new Set<string>();
    if (input.classificationId) {
      const { data: cm } = await supabase
        .from("exploration_guide_classification_mappings")
        .select("guide_id")
        .eq("classification_id", input.classificationId);
      for (const r of cm ?? []) classGuideIds.add(r.guide_id);
    }

    // 2. subject 기반 guide_id 조회
    const subjectGuideIds = new Set<string>();
    if (input.subjectName) {
      // subjects 테이블에서 이름으로 id 조회
      const { data: subjectRows } = await supabase
        .from("subjects")
        .select("id")
        .eq("name", input.subjectName)
        .limit(1);

      if (subjectRows && subjectRows.length > 0) {
        const { data: sm } = await supabase
          .from("exploration_guide_subject_mappings")
          .select("guide_id")
          .eq("subject_id", subjectRows[0].id);
        for (const r of sm ?? []) subjectGuideIds.add(r.guide_id);
      }
    }

    // 3. UNION + match_reason 결정
    const guideReasonMap = new Map<string, "classification" | "subject" | "both">();
    for (const id of classGuideIds) {
      guideReasonMap.set(id, subjectGuideIds.has(id) ? "both" : "classification");
    }
    for (const id of subjectGuideIds) {
      if (!guideReasonMap.has(id)) {
        guideReasonMap.set(id, "subject");
      }
    }

    if (guideReasonMap.size === 0) {
      return createSuccessResponse([]);
    }

    // 4. 이미 배정된 가이드 제외
    const { data: assigned } = await supabase
      .from("exploration_guide_assignments")
      .select("guide_id")
      .eq("student_id", input.studentId);
    const assignedIds = new Set((assigned ?? []).map((a) => a.guide_id));

    const candidateIds = [...guideReasonMap.keys()].filter((id) => !assignedIds.has(id));
    if (candidateIds.length === 0) {
      return createSuccessResponse([]);
    }

    // 5. approved 필터 + 메타 JOIN
    const { data: guides } = await supabase
      .from("exploration_guides")
      .select("id, title, guide_type, book_title")
      .in("id", candidateIds)
      .eq("status", "approved")
      .eq("is_latest", true)
      .limit(limit);

    const result: RecommendedGuide[] = (guides ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      guide_type: g.guide_type,
      book_title: g.book_title,
      match_reason: guideReasonMap.get(g.id) ?? "classification",
    }));

    // "both" 우선 정렬
    result.sort((a, b) => {
      const order = { both: 0, classification: 1, subject: 2 };
      return order[a.match_reason] - order[b.match_reason];
    });

    return createSuccessResponse(result);
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId: input.studentId });
    return createErrorResponse("가이드 추천 조회에 실패했습니다.");
  }
}
