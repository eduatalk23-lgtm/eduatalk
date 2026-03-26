"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

interface GuideTargetArea {
  targetSubjectId: string | null;
  targetActivityType: "autonomy" | "club" | "career" | null;
}

/**
 * 가이드별 대상 영역(과목/창체) 도출.
 * exploration_guide_subject_mappings에서 첫 번째 subject_id를 반환.
 * 파이프라인 Task 6 및 auto-recommend에서 사용.
 */
export async function resolveGuideTargetArea(
  guideIds: string[],
): Promise<Map<string, GuideTargetArea>> {
  const result = new Map<string, GuideTargetArea>();
  if (guideIds.length === 0) return result;

  const supabase = await createSupabaseServerClient();

  const { data: mappings } = await supabase
    .from("exploration_guide_subject_mappings")
    .select("guide_id, subject_id")
    .in("guide_id", guideIds);

  // guide_id별 첫 번째 subject_id 매핑
  const subjectByGuide = new Map<string, string>();
  for (const m of mappings ?? []) {
    if (!subjectByGuide.has(m.guide_id)) {
      subjectByGuide.set(m.guide_id, m.subject_id);
    }
  }

  for (const guideId of guideIds) {
    result.set(guideId, {
      targetSubjectId: subjectByGuide.get(guideId) ?? null,
      targetActivityType: null,
    });
  }

  return result;
}
