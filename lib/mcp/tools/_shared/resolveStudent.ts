/**
 * Phase F-3: MCP read tool 공통 — "조회 대상 학생 해결".
 *
 * 역할별 전략:
 * - student: 항상 self (user.userId = studentId).
 * - admin/consultant/superadmin: studentName 필수 → tenant 내 학생 검색.
 * - parent: 현재 미지원 (향후 parent_student_links 조회로 확장 가능).
 *
 * `getScores`·`analyzeRecord` 에서 중복되던 로직을 통합.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getStudentById } from "@/lib/data/students";
import { searchStudentsAction } from "@/lib/domains/student/actions/search";

export type StudentTargetCandidate = {
  id: string;
  name: string | null;
  grade: number | null;
  schoolName: string | null;
};

export type StudentTarget =
  | {
      ok: true;
      studentId: string;
      tenantId: string;
      studentName: string | null;
    }
  | {
      ok: false;
      reason: string;
      candidates?: StudentTargetCandidate[];
    };

export async function resolveStudentTarget(args: {
  studentName?: string | null;
}): Promise<StudentTarget> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (user.role === "student") {
    const tenantId = user.tenantId;
    if (!tenantId) return { ok: false, reason: "테넌트 정보가 없습니다." };
    const self = await getStudentById(user.userId, tenantId);
    const name = (self as unknown as { name?: string | null } | null)?.name ?? null;
    return { ok: true, studentId: user.userId, tenantId, studentName: name };
  }

  if (
    user.role === "admin" ||
    user.role === "consultant" ||
    user.role === "superadmin"
  ) {
    if (!user.tenantId) return { ok: false, reason: "테넌트 정보가 없습니다." };
    const name = args.studentName?.trim();
    if (!name) {
      return {
        ok: false,
        reason: "어느 학생의 정보를 조회할까요? 학생 이름을 알려주세요.",
      };
    }
    const result = await searchStudentsAction(name);
    if (!result.success) {
      return { ok: false, reason: result.error ?? "학생 검색에 실패했습니다." };
    }
    if (result.students.length === 0) {
      return { ok: false, reason: `'${name}'과 일치하는 학생을 찾지 못했습니다.` };
    }
    if (result.students.length > 1) {
      return {
        ok: false,
        reason: `'${name}'과 일치하는 학생이 ${result.students.length}명입니다. 학년·학교로 좁혀 다시 말해주세요.`,
        candidates: result.students.slice(0, 10).map((s) => ({
          id: s.id,
          name: s.name,
          grade: s.grade,
          schoolName: s.school_name,
        })),
      };
    }
    const picked = result.students[0];
    return {
      ok: true,
      studentId: picked.id,
      tenantId: user.tenantId,
      studentName: picked.name ?? null,
    };
  }

  return {
    ok: false,
    reason: `${user.role} 역할은 학생 정보 조회를 지원하지 않습니다.`,
  };
}
