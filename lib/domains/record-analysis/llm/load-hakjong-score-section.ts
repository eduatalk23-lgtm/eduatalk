// ============================================
// 격차 D: action 내부 hakjongScoreSection 로드 헬퍼
//
// generateSetekGuide / generateChangcheGuide / generateHaengteukGuide 의
// 6 함수(3 retrospective + 3 prospective)가 동일하게 호출하여
// 가이드 프롬프트에 학종 3요소 약점 축 정보를 주입한다.
//
// 빈 snapshot / 미계산 hakjongScore → undefined (no-op).
// best-effort: 로드 실패 시 undefined 반환 (가이드 생성 계속).
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { findLatestSnapshot } from "@/lib/domains/student-record/repository/student-state-repository";
import { buildHakjongScoreSection } from "./hakjong-score-section";
import type { HakjongScore } from "@/lib/domains/student-record/types/student-state";

/**
 * 학생의 최신 student_state_snapshot 에서 hakjongScore 를 로드해
 * 가이드 프롬프트용 마크다운 섹션으로 변환.
 *
 * 빈/미계산 / 로드 실패 시 undefined.
 */
export async function loadHakjongScoreSection(
  studentId: string,
  tenantId: string,
  supabase?: SupabaseClient,
): Promise<string | undefined> {
  try {
    const snap = await findLatestSnapshot(
      studentId,
      tenantId,
      supabase as Parameters<typeof findLatestSnapshot>[2],
    );
    if (!snap?.snapshot_data) return undefined;
    const state = snap.snapshot_data as unknown as { hakjongScore?: HakjongScore | null };
    return buildHakjongScoreSection(state.hakjongScore ?? null);
  } catch {
    return undefined;
  }
}
