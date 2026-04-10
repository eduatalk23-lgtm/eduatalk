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

export type ActivityType = "autonomy" | "club" | "career";

/**
 * 매칭 사유 라벨.
 *
 * 후방 호환:
 *   - "both" — 레거시 (classification + subject 동시 매칭). phase-s2-edges.ts 가
 *     이 값을 priority 키로 사용하므로 보존. Wave 4 (D1 runGuideMatching 대수술) 에서 제거 예정.
 *
 * 신규 (Phase 2 Wave 3.2):
 *   - "activity" — activity_type 단독 매칭 (창체 영역)
 *   - "classification+activity" — KEDI 분류 + activity_type
 *   - "subject+activity" — 과목 + activity_type
 *   - "all" — 3축 모두 매칭
 */
export type MatchReason =
  | "classification"
  | "subject"
  | "both" // legacy: classification + subject (보존)
  | "activity"
  | "classification+activity"
  | "subject+activity"
  | "all"
  | "sequel"; // Phase A: 이미 배정된 가이드의 다음 단계

export interface RecommendedGuide {
  id: string;
  title: string;
  guide_type: string | null;
  book_title: string | null;
  match_reason: MatchReason;
}

/**
 * DB 기반 가이드 자동 추천 (벡터 검색 X, API 할당량 소모 없음)
 *
 * 매칭 축 (Phase 2 Wave 3.2 시점, Decision #2/#5 반영):
 *   1. classification — exploration_guide_classification_mappings (KEDI 소분류)
 *   2. subject        — subjects → exploration_guide_subject_mappings (교과 매칭, 세특용)
 *   3. activity_type  — exploration_guide_activity_mappings (autonomy/club/career, 창체용)
 *
 * 이미 배정된 가이드 제외, approved + is_latest 필터.
 *
 * 호출자가 activity_type 만 지정하면 창체 영역 가이드만 매칭됨 (subject 없는 매칭).
 * runGuideMatching(synthesis Phase 2)에서 세특·창체 영역별로 분리 호출 가능.
 */
export async function autoRecommendGuidesAction(input: {
  studentId: string;
  classificationId?: number | null;
  subjectName?: string | null;
  activityType?: ActivityType | null;
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
    // Wave 5.1e: `.limit(1)` 제거 → 동명 subject_id 가 여러 개인 경우(2022 개정
    //   교육과정 전환 잔재)에도 **모든** subject_id 의 매핑을 합집합으로 수집.
    //   예: "수학과제 탐구" 가 진로선택/융합선택 2종으로 등록돼 있을 때 한쪽만
    //   뽑아 가이드를 못 찾는 비결정적 버그를 차단.
    const subjectGuideIds = new Set<string>();
    if (input.subjectName) {
      const { data: subjectRows } = await supabase
        .from("subjects")
        .select("id")
        .eq("name", input.subjectName);

      if (subjectRows && subjectRows.length > 0) {
        const subjectIds = subjectRows.map((r) => r.id);
        const { data: sm } = await supabase
          .from("exploration_guide_subject_mappings")
          .select("guide_id")
          .in("subject_id", subjectIds);
        for (const r of sm ?? []) subjectGuideIds.add(r.guide_id);
      }
    }

    // 3. activity_type 기반 guide_id 조회 (Phase 2 Wave 3.2 신규)
    const activityGuideIds = new Set<string>();
    if (input.activityType) {
      const { data: am } = await supabase
        .from("exploration_guide_activity_mappings")
        .select("guide_id")
        .eq("activity_type", input.activityType);
      for (const r of am ?? []) activityGuideIds.add(r.guide_id);
    }

    // 3.5. Phase A: 이미 배정된 가이드의 sequel 타겟 추가
    const sequelGuideIds = new Set<string>();
    if (input.studentId) {
      const { data: existingAssigns } = await supabase
        .from("exploration_guide_assignments")
        .select("guide_id")
        .eq("student_id", input.studentId);
      const assignedGuideIds = (existingAssigns ?? []).map((a) => a.guide_id);
      if (assignedGuideIds.length > 0) {
        const { data: sequels } = await supabase
          .from("exploration_guide_sequels")
          .select("to_guide_id")
          .in("from_guide_id", assignedGuideIds)
          .gte("confidence", 0.5);
        for (const s of sequels ?? []) sequelGuideIds.add(s.to_guide_id);
      }
    }

    // 4. UNION + match_reason 결정 (3축 비트마스크 → 라벨)
    const guideReasonMap = new Map<string, MatchReason>();
    const allIds = new Set<string>([
      ...classGuideIds,
      ...subjectGuideIds,
      ...activityGuideIds,
      ...sequelGuideIds,
    ]);

    for (const id of allIds) {
      const c = classGuideIds.has(id);
      const s = subjectGuideIds.has(id);
      const a = activityGuideIds.has(id);
      const sq = sequelGuideIds.has(id);
      let reason: MatchReason;
      if (c && s && a) reason = "all";
      else if (c && s) reason = "both"; // 레거시 호환 — phase-s2-edges priority
      else if (c && a) reason = "classification+activity";
      else if (s && a) reason = "subject+activity";
      else if (c) reason = "classification";
      else if (s) reason = "subject";
      else if (a) reason = "activity";
      else if (sq) reason = "sequel";
      else reason = "classification";
      guideReasonMap.set(id, reason);
    }

    if (guideReasonMap.size === 0) {
      return createSuccessResponse([]);
    }

    // 5. 이미 배정된 가이드 제외
    const { data: assigned } = await supabase
      .from("exploration_guide_assignments")
      .select("guide_id")
      .eq("student_id", input.studentId);
    const assignedIds = new Set((assigned ?? []).map((a) => a.guide_id));

    const candidateIds = [...guideReasonMap.keys()].filter(
      (id) => !assignedIds.has(id),
    );
    if (candidateIds.length === 0) {
      return createSuccessResponse([]);
    }

    // 6. approved 필터 + 메타 JOIN
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

    // 매치 강도 우선 정렬: 3축 모두 > 2축 > 1축
    const REASON_ORDER: Record<MatchReason, number> = {
      all: 0,
      both: 1, // legacy: classification + subject
      "classification+activity": 1,
      "subject+activity": 1,
      sequel: 1, // Phase A: sequel은 2축 매칭과 동급
      classification: 2,
      subject: 2,
      activity: 2,
    };
    result.sort(
      (a, b) => REASON_ORDER[a.match_reason] - REASON_ORDER[b.match_reason],
    );

    return createSuccessResponse(result);
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId: input.studentId });
    return createErrorResponse("가이드 추천 조회에 실패했습니다.");
  }
}
