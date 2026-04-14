"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";

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
 * 세특 영역 (Phase 2 Wave 5.1d — 학생 과목 풀 우선):
 *   - `preferredSubjectIds` 가 주어지면, subject_mappings 중 이 풀에 속한 것을 **우선** 선택
 *   - 풀에 매칭 없으면 null (= 세특 slot auto-link 불가, orphan 방지)
 *   - `preferredSubjectIds` 미지정 시 레거시 동작: 첫 매핑 사용
 *
 *   이유: 학생이 실제로 이수하거나 계획한 과목과 무관한 subject_id 로 배정되면
 *        UI의 세특 row 필터(`target_subject_id === row.subjectId`)에 영원히 안 걸린다.
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
  opts: {
    preferredSubjectIds?: Set<string>;
    /**
     * P3 라스트마일(2026-04-14): synthesis pipeline에서 방금 admin 으로 INSERT한
     *   셸 가이드(status='queued_generation')의 subject_mappings 를 조회해야 하는데,
     *   server client(사용자 권한)는 RLS로 read 차단됨. admin client 전달 시 우회.
     */
    adminClient?: SupabaseAdminClient;
  } = {},
): Promise<Map<string, GuideTargetArea>> {
  const result = new Map<string, GuideTargetArea>();
  if (guideIds.length === 0) return result;

  const supabase = opts.adminClient ?? (await createSupabaseServerClient());
  const preferred = opts.preferredSubjectIds;

  // 1. subject_mappings — 세특 영역
  const { data: subjectRows } = await supabase
    .from("exploration_guide_subject_mappings")
    .select("guide_id, subject_id")
    .in("guide_id", guideIds);

  // guide_id → 첫 매핑 (legacy fallback)
  const firstByGuide = new Map<string, string>();
  // guide_id → preferred 풀에 속한 첫 매핑 (신규 경로)
  const preferredByGuide = new Map<string, string>();
  for (const m of subjectRows ?? []) {
    if (!firstByGuide.has(m.guide_id)) {
      firstByGuide.set(m.guide_id, m.subject_id);
    }
    if (preferred && preferred.has(m.subject_id) && !preferredByGuide.has(m.guide_id)) {
      preferredByGuide.set(m.guide_id, m.subject_id);
    }
  }

  const subjectByGuide = new Map<string, string | null>();
  for (const guideId of guideIds) {
    if (preferred) {
      // preferred 풀이 주어졌으면 풀에 있는 매핑만 유효. 없으면 null → orphan 방지
      subjectByGuide.set(guideId, preferredByGuide.get(guideId) ?? null);
    } else {
      // legacy: 첫 매핑 사용
      subjectByGuide.set(guideId, firstByGuide.get(guideId) ?? null);
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
 * 학생이 실제로 이수/계획한 subject_id 풀을 모은다.
 * - seteks (deleted_at IS NULL)
 * - course_plans (confirmed / recommended)
 *
 * Wave 5.1f: `gradeFilter` 옵션 추가. 설계 학년(consultingGrades)에 속한
 *   row 만 포함하도록 제한. 탐구 가이드는 본질상 설계 학년 전용이므로
 *   runGuideMatching 에서 이 필터를 적용한다.
 *
 * runGuideMatching 에서 resolveGuideTargetArea 호출 시 preferredSubjectIds 로 전달.
 */
export async function collectStudentSubjectPool(
  studentId: string,
  opts: { gradeFilter?: Set<number> } = {},
): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();
  const pool = new Set<string>();
  const gradeFilter = opts.gradeFilter;

  const { data: seteks } = await supabase
    .from("student_record_seteks")
    .select("subject_id, grade")
    .eq("student_id", studentId)
    .is("deleted_at", null);
  for (const s of seteks ?? []) {
    if (!s.subject_id) continue;
    if (gradeFilter && !gradeFilter.has(s.grade ?? -1)) continue;
    pool.add(s.subject_id);
  }

  const { data: plans } = await supabase
    .from("student_course_plans")
    .select("subject_id, plan_status, grade")
    .eq("student_id", studentId)
    .in("plan_status", ["confirmed", "recommended"]);
  for (const p of plans ?? []) {
    if (!p.subject_id) continue;
    if (gradeFilter && !gradeFilter.has(p.grade ?? -1)) continue;
    pool.add(p.subject_id);
  }

  return pool;
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
