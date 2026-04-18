"use server";

/**
 * Phase B-3 이월: @mention 학생 조회
 *
 * admin/consultant 에 한해 본인 tenant 학생 부분 매칭. 상위 8명만 반환.
 * 다른 role 은 빈 배열 반환(가드 미통과 → 메뉴 자체가 렌더되지 않음).
 */

import { searchStudentsAction } from "@/lib/domains/student/actions/search";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";

export type MentionCandidate = {
  id: string;
  name: string;
  grade: number | null;
  school: string | null;
};

export type MentionLookupResult =
  | { ok: true; candidates: MentionCandidate[] }
  | { ok: false; reason: "forbidden" | "failed" };

export async function lookupMentionCandidates(
  query: string,
): Promise<MentionLookupResult> {
  const { role } = await getCachedUserRole();
  if (role !== "admin" && role !== "consultant" && role !== "superadmin") {
    return { ok: false, reason: "forbidden" };
  }

  const trimmed = query.trim();
  // 빈 쿼리도 허용 — 첫 진입 시 최근 접근 학생 상위 N 노출
  const result = await searchStudentsAction(trimmed, { isActive: true });
  if (!result.success) {
    return { ok: false, reason: "failed" };
  }
  const candidates: MentionCandidate[] = result.students
    .filter((s) => s.name && s.name.length > 0)
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      name: s.name ?? "",
      grade: s.grade,
      school: s.school_name,
    }));
  return { ok: true, candidates };
}
