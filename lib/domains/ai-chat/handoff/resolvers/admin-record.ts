/**
 * Phase T-1 후속: admin-record 리졸버
 *
 * /admin/students/[id]/record 에서 진입 시 학생 기본 정보 + 생기부
 * 메타(학년/진로희망 등)를 스니펫으로 반환.
 *
 * 구체 항목 조회는 프롬프트가 아닌 도구 호출에 위임 — 현재 getScores 만
 * 도구로 노출됨. 생기부 도구는 Phase E-1 에서 추가 예정(analyzeRecord).
 * 그 전까지는 스니펫에 학생 식별만 담아 LLM 이 질문을 자연스럽게 받을 수 있게 함.
 */

import type { CurrentUser } from "@/lib/auth/getCurrentUser";
import { getStudentById } from "@/lib/data/students";
import type { HandoffInput, HandoffResolved } from "../validator";

export async function resolveAdminRecordContext(
  input: HandoffInput,
  user: CurrentUser,
): Promise<HandoffResolved> {
  if (!input.studentId || !user.tenantId) {
    return {
      snippet: "학생 또는 테넌트 정보 없음.",
      openerSlots: { name: "", grade: "", semester: "", count: "" },
      resolvedStudentId: input.studentId ?? null,
    };
  }

  let studentName: string | null = null;
  let studentGrade: number | null = null;
  let schoolName: string | null = null;

  try {
    const student = await getStudentById(input.studentId, user.tenantId);
    if (student) {
      const detail = student as unknown as {
        name?: string | null;
        grade?: number | null;
        school_name?: string | null;
      };
      studentName = detail.name ?? null;
      studentGrade = detail.grade ?? null;
      schoolName = detail.school_name ?? null;
    }
  } catch {
    // 조회 실패해도 스니펫 생성 계속
  }

  const nameLabel = studentName ? `${studentName} 학생` : "학생";
  const gradeLabel = studentGrade ? `${studentGrade}학년` : "";
  const schoolLabel = schoolName ? ` (${schoolName})` : "";

  // NOTE: 학생 이름 라인을 "이 대화의 대상 학생" 으로 명시.
  // getScores 등 도구 호출 시 AI 가 이 학생 이름을 자동으로 studentName 으로 사용하도록
  // 시스템 프롬프트 규칙과 맞물림.
  const snippet = [
    `- 소스: 생기부 관리 화면 (/admin/students/${input.studentId}/record)`,
    `- **이 대화의 대상 학생**: ${studentName ?? "(이름 미확보)"}${schoolLabel}${gradeLabel ? ` · ${gradeLabel}` : ""}`,
    `- 컨설턴트/관리자가 이 학생의 생기부를 검토하며 질문을 시작했습니다.`,
    studentName
      ? `- 도구 호출 시 studentName 은 "${studentName}" 을 사용하고 사용자에게 재질문하지 마세요.`
      : `- 학생 이름이 확보되지 않은 경우에만 사용자에게 질문하세요.`,
    `- 구체 세특·활동 내용 도구는 아직 미노출. 일반 개선 방향·전략 중심으로 답변.`,
  ].join("\n");

  return {
    snippet,
    openerSlots: {
      name: studentName ? `${studentName} 학생의 ` : "",
      grade: gradeLabel ? `${gradeLabel} ` : "",
      semester: "",
      count: "",
    },
    resolvedStudentId: input.studentId,
  };
}
