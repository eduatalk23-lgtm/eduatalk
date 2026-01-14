"use server";

/**
 * Plan Round Calculation Action
 *
 * 동일 콘텐츠의 플랜 생성 회차를 계산하는 Server Action
 *
 * @module lib/domains/admin-plan/actions/getPlanRound
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAuthContext, isAdminContext } from "@/lib/auth/strategies";
import { logActionError } from "@/lib/utils/serverActionLogger";

export interface GetPlanRoundInput {
  studentId: string;
  contentId: string;
  contentType: "book" | "lecture" | "custom";
}

export interface GetPlanRoundResult {
  round: number;
  error?: string;
}

/**
 * 특정 콘텐츠의 플랜 생성 회차 계산
 *
 * 동일 학생, 동일 콘텐츠의 기존 플랜 그룹 수를 조회하여
 * 새로 생성할 플랜의 회차를 반환합니다.
 *
 * @param input - 학생 ID, 콘텐츠 ID, 콘텐츠 타입
 * @returns 회차 번호 (기존 플랜 수 + 1)
 *
 * @example
 * const result = await getPlanRoundAction({
 *   studentId: "student-123",
 *   contentId: "content-456",
 *   contentType: "book",
 * });
 * // => { round: 2 } // 기존에 1개 있었으면 2회차
 */
export async function getPlanRoundAction(
  input: GetPlanRoundInput
): Promise<GetPlanRoundResult> {
  try {
    const auth = await resolveAuthContext({ studentId: input.studentId });

    if (!isAdminContext(auth)) {
      return { round: 1, error: "관리자 권한이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 동일 콘텐츠의 기존 plan_contents 조회 (삭제되지 않은 plan_groups에 속한 것만)
    const { data, error } = await supabase
      .from("plan_contents")
      .select(
        `
        id,
        plan_groups!inner (
          id,
          student_id,
          deleted_at
        )
      `
      )
      .eq("content_id", input.contentId)
      .eq("content_type", input.contentType)
      .eq("plan_groups.student_id", input.studentId)
      .is("plan_groups.deleted_at", null);

    if (error) {
      logActionError("getPlanRound.getPlanRoundAction", `조회 실패: ${error.message}`);
      return { round: 1, error: error.message };
    }

    // 기존 플랜 수 + 1 = 새 회차
    const round = (data?.length ?? 0) + 1;

    return { round };
  } catch (err) {
    logActionError("getPlanRound.getPlanRoundAction", `오류: ${err instanceof Error ? err.message : String(err)}`);
    return { round: 1, error: "회차 계산 중 오류가 발생했습니다." };
  }
}

/**
 * 여러 콘텐츠의 회차를 일괄 계산 (배치 최적화)
 *
 * @param studentId - 학생 ID
 * @param contents - 콘텐츠 목록 (contentId, contentType)
 * @returns 콘텐츠 ID별 회차 Map
 */
export async function getBatchPlanRoundsAction(
  studentId: string,
  contents: Array<{ contentId: string; contentType: "book" | "lecture" | "custom" }>
): Promise<Map<string, number>> {
  const roundMap = new Map<string, number>();

  if (contents.length === 0) {
    return roundMap;
  }

  try {
    const auth = await resolveAuthContext({ studentId });

    if (!isAdminContext(auth)) {
      // 권한 없으면 모두 1회차로
      contents.forEach((c) => roundMap.set(c.contentId, 1));
      return roundMap;
    }

    const supabase = await createSupabaseServerClient();
    const contentIds = contents.map((c) => c.contentId);

    // 모든 콘텐츠의 기존 플랜 수를 한 번에 조회
    const { data, error } = await supabase
      .from("plan_contents")
      .select(
        `
        content_id,
        content_type,
        plan_groups!inner (
          id,
          student_id,
          deleted_at
        )
      `
      )
      .in("content_id", contentIds)
      .eq("plan_groups.student_id", studentId)
      .is("plan_groups.deleted_at", null);

    if (error) {
      logActionError("getPlanRound.getBatchPlanRoundsAction", `조회 실패: ${error.message}`);
      contents.forEach((c) => roundMap.set(c.contentId, 1));
      return roundMap;
    }

    // 콘텐츠별 기존 플랜 수 계산
    const countMap = new Map<string, number>();
    data?.forEach((item) => {
      const key = item.content_id;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    });

    // 회차 계산 (기존 수 + 1)
    contents.forEach((c) => {
      const existingCount = countMap.get(c.contentId) ?? 0;
      roundMap.set(c.contentId, existingCount + 1);
    });

    return roundMap;
  } catch (err) {
    logActionError("getPlanRound.getBatchPlanRoundsAction", `오류: ${err instanceof Error ? err.message : String(err)}`);
    contents.forEach((c) => roundMap.set(c.contentId, 1));
    return roundMap;
  }
}
