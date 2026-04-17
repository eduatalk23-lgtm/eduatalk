/**
 * Phase T-4 scores 리졸버
 *
 * 성적 화면에서 진입한 경우 실제 성적 데이터를 조회하여
 * - snippet: LLM 시스템 프롬프트용 한국어 요약
 * - openerSlots: 템플릿 선공 메시지의 slot 치환값
 * 을 반환.
 *
 * 구체 수치는 프롬프트에 넣지 않음 (토큰 절약 + LLM이 getScores 도구 호출하도록 유도).
 */

import type { CurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInternalScoresByTerm } from "@/lib/data/scoreDetails";
import { getStudentById } from "@/lib/data/students";
import type { HandoffInput, HandoffResolved } from "../validator";

async function fetchStudentName(
  studentId: string,
  tenantId: string,
): Promise<string | null> {
  try {
    const student = await getStudentById(studentId, tenantId);
    const name = (student as unknown as { name?: string | null } | null)?.name;
    return name ?? null;
  } catch {
    return null;
  }
}

async function fetchSelfName(userId: string): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    return (data as unknown as { name?: string | null } | null)?.name ?? null;
  } catch {
    return null;
  }
}

export async function resolveScoresContext(
  input: HandoffInput,
  user: CurrentUser,
): Promise<HandoffResolved> {
  const targetStudentId = input.studentId ?? user.userId;
  const tenantId = user.tenantId;
  if (!tenantId) {
    return {
      snippet: "테넌트 정보 없음.",
      openerSlots: { name: "", grade: "", semester: "", count: "" },
      resolvedStudentId: null,
    };
  }

  let studentName: string | null = null;
  if (input.studentId && user.role !== "student") {
    studentName = await fetchStudentName(targetStudentId, tenantId);
  } else if (user.role === "student") {
    studentName = await fetchSelfName(user.userId);
  }

  let scoreCount = 0;
  try {
    const scores = await getInternalScoresByTerm(
      targetStudentId,
      tenantId,
      input.grade,
      input.semester,
    );
    scoreCount = scores.length;
  } catch {
    // 조회 실패해도 스니펫은 생성 (count 0)
  }

  const gradeLabel = input.grade ? `${input.grade}학년` : "";
  const semesterLabel = input.semester ? `${input.semester}학기` : "";
  const filterLabel =
    [gradeLabel, semesterLabel].filter(Boolean).join(" ") || "전체 기간";

  const snippet = [
    `- 소스: 성적 화면`,
    `- 조회 기준: ${filterLabel}. ${
      scoreCount > 0 ? `총 ${scoreCount}과목.` : "데이터 없음."
    }`,
    `- 사용자는 이 화면을 보다가 질문을 시작했습니다.`,
    `- 구체 수치는 getScores 도구를 호출하여 조회하세요.`,
  ].join("\n");

  return {
    snippet,
    openerSlots: {
      name: studentName ? `${studentName} 학생의 ` : "",
      grade: gradeLabel ? `${gradeLabel} ` : "",
      semester: semesterLabel ? `${semesterLabel} ` : "",
      count: scoreCount > 0 ? ` ${scoreCount}과목` : "",
    },
    resolvedStudentId: targetStudentId,
  };
}
