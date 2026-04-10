"use server";

// ============================================
// Phase 2 Wave 5.2 — 행특 ↔ 탐구 가이드 링크 fetch
//
// student_record_haengteuk_guide_links 테이블(Phase 2 Wave 4.2)에서
// 학생의 모든 학년 × 평가항목 링크를 조회한다.
//
// 이 테이블은 database.types.ts 재생성 전 상태이므로 해당 SELECT는
// 캐스트로 우회한다 (phase-s2-haengteuk-linking.ts 의 linksTable 패턴 참고).
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "student-record", action: "fetchHaengteukGuideLinks" };

/**
 * UI 표시용 링크 row.
 * assignment 는 조회 완료 후 JS join 으로 붙인다.
 */
export interface HaengteukGuideLinkRow {
  /** 부모 행특 가이드 id (student_record_haengteuk_guides.id) */
  haengteuk_guide_id: string;
  /** 해당 부모 가이드의 학년도 */
  school_year: number;
  /** 평가 항목명 (8개 중 하나) */
  evaluation_item: string;
  /** 매칭된 배정 id */
  exploration_guide_assignment_id: string;
  /** 0~1 */
  relevance_score: number;
  /** 1~2 문장 근거 */
  reasoning: string;
  /** 'ai' | 'manual' */
  source: string;
  /** 배정 + 가이드 메타 (JS join) */
  assignment: {
    id: string;
    status: string;
    target_activity_type: string | null;
    ai_recommendation_reason: string | null;
    student_notes: string | null;
    exploration_guides: {
      id: string;
      title: string;
      guide_type: string | null;
    } | null;
  } | null;
}

// 임시 shape (database.types.ts 미반영)
interface LinkRowShape {
  haengteuk_guide_id: string;
  evaluation_item: string;
  exploration_guide_assignment_id: string;
  relevance_score: number;
  reasoning: string;
  source: string;
}

/**
 * 학생의 모든 행특-가이드 링크를 반환.
 * 파이프라인이 링크를 만들지 않았거나 행특이 없으면 빈 배열.
 */
export async function fetchHaengteukGuideLinksAction(
  studentId: string,
): Promise<ActionResponse<HaengteukGuideLinkRow[]>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 1) 학생 행특 가이드 (학년도 join 용)
    const { data: haengteukGuides, error: hgErr } = await supabase
      .from("student_record_haengteuk_guides")
      .select("id, school_year")
      .eq("student_id", studentId);
    if (hgErr) {
      logActionError(LOG_CTX, hgErr, { studentId });
      return createErrorResponse("행특 가이드 조회 실패");
    }
    if (!haengteukGuides || haengteukGuides.length === 0) {
      return createSuccessResponse([]);
    }
    const hgIds = haengteukGuides.map((h) => h.id);
    const yearByHgId = new Map<string, number>(
      haengteukGuides.map((h) => [h.id, h.school_year] as const),
    );

    // 2) 링크 조회 — database.types.ts 미반영 → 캐스트 우회
    const linksClient = supabase.from("student_record_haengteuk_guide_links" as never) as unknown as {
      select(cols: string): {
        in(col: string, vals: string[]): Promise<{
          data: LinkRowShape[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    const { data: linkRows, error: linkErr } = await linksClient
      .select(
        "haengteuk_guide_id, evaluation_item, exploration_guide_assignment_id, relevance_score, reasoning, source",
      )
      .in("haengteuk_guide_id", hgIds);
    if (linkErr) {
      logActionError(LOG_CTX, linkErr, { studentId });
      return createErrorResponse("가이드 링크 조회 실패");
    }
    const links = linkRows ?? [];
    if (links.length === 0) {
      return createSuccessResponse([]);
    }

    // 3) 배정 + 가이드 메타 JOIN
    const assignmentIds = Array.from(
      new Set(links.map((l) => l.exploration_guide_assignment_id)),
    );
    const { data: assignments, error: aErr } = await supabase
      .from("exploration_guide_assignments")
      .select(
        `id, status, target_activity_type, ai_recommendation_reason, student_notes,
         exploration_guides!inner(id, title, guide_type)`,
      )
      .in("id", assignmentIds);
    if (aErr) {
      logActionError(LOG_CTX, aErr, { studentId });
      return createErrorResponse("배정 메타 조회 실패");
    }

    interface AssignmentJoinShape {
      id: string;
      status: string;
      target_activity_type: string | null;
      ai_recommendation_reason: string | null;
      student_notes: string | null;
      exploration_guides:
        | { id: string; title: string; guide_type: string | null }
        | Array<{ id: string; title: string; guide_type: string | null }>
        | null;
    }
    const assignmentMap = new Map<string, HaengteukGuideLinkRow["assignment"]>();
    for (const a of (assignments ?? []) as AssignmentJoinShape[]) {
      const guideRaw = a.exploration_guides;
      const guide = Array.isArray(guideRaw) ? guideRaw[0] ?? null : guideRaw;
      assignmentMap.set(a.id, {
        id: a.id,
        status: a.status,
        target_activity_type: a.target_activity_type,
        ai_recommendation_reason: a.ai_recommendation_reason,
        student_notes: a.student_notes,
        exploration_guides: guide,
      });
    }

    // 4) 평탄화 + school_year 주입
    const out: HaengteukGuideLinkRow[] = links.map((l) => ({
      haengteuk_guide_id: l.haengteuk_guide_id,
      school_year: yearByHgId.get(l.haengteuk_guide_id) ?? 0,
      evaluation_item: l.evaluation_item,
      exploration_guide_assignment_id: l.exploration_guide_assignment_id,
      relevance_score: l.relevance_score,
      reasoning: l.reasoning,
      source: l.source,
      assignment: assignmentMap.get(l.exploration_guide_assignment_id) ?? null,
    }));
    // relevance_score 내림차순
    out.sort((a, b) => b.relevance_score - a.relevance_score);

    return createSuccessResponse(out);
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId });
    return createErrorResponse("가이드 링크 조회에 실패했습니다.");
  }
}
