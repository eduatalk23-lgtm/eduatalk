"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActivityType = "autonomy" | "club" | "career";

export interface GuideTargetArea {
  /** 대상 과목 (세특 슬롯 auto-link용) */
  targetSubjectId: string | null;
  /** 대상 창체 활동 유형 (창체 슬롯 auto-link용) */
  targetActivityType: ActivityType | null;
}

/**
 * 가이드별 대상 영역(과목 / 창체) 도출.
 *
 * 세특 영역:
 *   - exploration_guide_subject_mappings 의 첫 subject_id를 targetSubjectId로 사용
 *
 * 창체 영역 (Phase 2 Wave 3.3 — Decision #2/#5 / 옛 하드코딩 null 제거):
 *   1. exploration_guide_activity_mappings 우선 — 명시적 매핑이 있으면 사용
 *   2. 매핑 없으면 guide_type으로 추론:
 *        reflection_program          → autonomy
 *        club_deep_dive              → club
 *        career_exploration_project  → career
 *
 * 파이프라인 phase-s2-edges.ts 의 runGuideMatching이 슬롯 auto-link 시 사용.
 */
export async function resolveGuideTargetArea(
  guideIds: string[],
): Promise<Map<string, GuideTargetArea>> {
  const result = new Map<string, GuideTargetArea>();
  if (guideIds.length === 0) return result;

  const supabase = await createSupabaseServerClient();

  // 1. subject_mappings — 세특 영역 (기존)
  const { data: subjectRows } = await supabase
    .from("exploration_guide_subject_mappings")
    .select("guide_id, subject_id")
    .in("guide_id", guideIds);

  const subjectByGuide = new Map<string, string>();
  for (const m of subjectRows ?? []) {
    if (!subjectByGuide.has(m.guide_id)) {
      subjectByGuide.set(m.guide_id, m.subject_id);
    }
  }

  // 2. activity_mappings — 창체 영역 (신규 Wave 1.1 테이블)
  const { data: activityRows } = await supabase
    .from("exploration_guide_activity_mappings")
    .select("guide_id, activity_type")
    .in("guide_id", guideIds);

  const activityByGuide = new Map<string, ActivityType>();
  for (const m of activityRows ?? []) {
    if (!activityByGuide.has(m.guide_id)) {
      activityByGuide.set(m.guide_id, m.activity_type as ActivityType);
    }
  }

  // 3. guide_type 추론 fallback (activity_mappings 없는 가이드용)
  const missingActivityIds = guideIds.filter((id) => !activityByGuide.has(id));
  if (missingActivityIds.length > 0) {
    const { data: typeRows } = await supabase
      .from("exploration_guides")
      .select("id, guide_type")
      .in("id", missingActivityIds);

    for (const r of typeRows ?? []) {
      const inferred = inferActivityFromGuideType(r.guide_type as string);
      if (inferred) {
        activityByGuide.set(r.id, inferred);
      }
    }
  }

  // 4. 결과 병합
  for (const guideId of guideIds) {
    result.set(guideId, {
      targetSubjectId: subjectByGuide.get(guideId) ?? null,
      targetActivityType: activityByGuide.get(guideId) ?? null,
    });
  }

  return result;
}

/**
 * guide_type 으로부터 activity_type 추론.
 * Phase 2 Wave 1.1 에서 추가된 3종 신규 유형은 1:1 대응.
 * 기존 5종(reading/topic_exploration/...)은 activity 매핑 없음 → null.
 */
function inferActivityFromGuideType(guideType: string): ActivityType | null {
  switch (guideType) {
    case "reflection_program":
      return "autonomy";
    case "club_deep_dive":
      return "club";
    case "career_exploration_project":
      return "career";
    default:
      return null;
  }
}
