/**
 * Phase F-1b: getScores tool 공유 정의.
 *
 * Chat Shell(`app/api/chat/route.ts`)과 MCP 서버(`lib/mcp/server.ts`)가
 * 동일 로직을 재사용. F-1a navigateTo 패턴을 그대로 복제.
 */

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getStudentById } from "@/lib/data/students";
import { getInternalScoresByTerm } from "@/lib/data/scoreDetails";
import { searchStudentsAction } from "@/lib/domains/student/actions/search";

export type ScoreRow = {
  subjectGroup: string;
  subject: string;
  grade: number;
  semester: number;
  rawScore: number | null;
  rankGrade: number | null;
  creditHours: number;
};

export type StudentCandidate = {
  id: string;
  name: string | null;
  grade: number | null;
  schoolName: string | null;
};

export type GetScoresOutput =
  | {
      ok: true;
      studentName?: string | null;
      filter: { grade?: number; semester?: number };
      count: number;
      rows: ScoreRow[];
    }
  | { ok: false; reason: string; candidates?: StudentCandidate[] };

type ResolvedTarget =
  | { ok: true; studentId: string; tenantId: string; studentName: string | null }
  | { ok: false; reason: string; candidates?: StudentCandidate[] };

async function resolveScoresTarget(args: {
  studentName?: string;
}): Promise<ResolvedTarget> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (user.role === "student") {
    const tenantId = user.tenantId;
    if (!tenantId) return { ok: false, reason: "테넌트 정보가 없습니다." };
    const self = await getStudentById(user.userId, tenantId);
    const name = (self as unknown as { name?: string | null } | null)?.name ?? null;
    return { ok: true, studentId: user.userId, tenantId, studentName: name };
  }

  if (user.role === "admin" || user.role === "consultant") {
    if (!user.tenantId) return { ok: false, reason: "테넌트 정보가 없습니다." };
    if (!args.studentName || args.studentName.trim().length === 0) {
      return {
        ok: false,
        reason: "어느 학생의 성적을 조회할까요? 학생 이름을 알려주세요.",
      };
    }

    const result = await searchStudentsAction(args.studentName.trim());
    if (!result.success) {
      return { ok: false, reason: result.error ?? "학생 검색에 실패했습니다." };
    }
    if (result.students.length === 0) {
      return {
        ok: false,
        reason: `'${args.studentName}'과 일치하는 학생을 찾지 못했습니다.`,
      };
    }
    if (result.students.length > 1) {
      return {
        ok: false,
        reason: `'${args.studentName}'과 일치하는 학생이 ${result.students.length}명입니다. 학년·학교·상태로 좁혀 다시 말해주세요.`,
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
    reason: `${user.role} 역할은 성적 조회를 지원하지 않습니다.`,
  };
}

export const getScoresDescription =
  "학생의 내신 성적(student_internal_scores)을 조회합니다. 사용자가 '성적 보여줘', '내신 알려줘', '수학 점수', '1학년 1학기 성적', '김세린 성적' 등 구체 데이터 조회를 요청할 때 호출하세요. 단순 페이지 이동 요청(예: '성적 화면 열어줘')에는 navigateTo를 사용하세요. 관리자/컨설턴트가 호출할 때는 반드시 studentName을 제공해야 합니다. 학생 본인은 studentName을 비워두면 자신의 성적이 조회됩니다.";

// Ollama/Gemma4 가 미지정 필드를 null 로 직렬화하는 경우가 관찰되어
// (MCP JSON-RPC validation 은 optional→undefined 만 허용) null 도 수용.
// execute 에서 null→undefined 로 정규화한다.
export const getScoresInputShape = {
  studentName: z
    .string()
    .nullable()
    .optional()
    .describe(
      "조회할 학생의 이름. 관리자/컨설턴트는 반드시 제공. 학생 본인은 생략. 같은 테넌트에서만 검색됨.",
    ),
  grade: z
    .number()
    .int()
    .min(1)
    .max(3)
    .nullable()
    .optional()
    .describe("필터: 학년 (1/2/3). 생략 시 전체"),
  semester: z
    .number()
    .int()
    .min(1)
    .max(2)
    .nullable()
    .optional()
    .describe("필터: 학기 (1/2). 생략 시 전체"),
} as const;

export const getScoresInputSchema = z.object(getScoresInputShape);

export type GetScoresInput = z.infer<typeof getScoresInputSchema>;

export async function getScoresExecute({
  studentName,
  grade,
  semester,
}: GetScoresInput): Promise<GetScoresOutput> {
  // null → undefined 정규화 (LLM 이 미지정 필드를 null 로 채워 보내는 케이스 대응).
  const normStudentName = studentName ?? undefined;
  const normGrade = grade ?? undefined;
  const normSemester = semester ?? undefined;

  const target = await resolveScoresTarget({ studentName: normStudentName });
  if (!target.ok) {
    return {
      ok: false,
      reason: target.reason,
      candidates: target.candidates,
    };
  }

  const scores = await getInternalScoresByTerm(
    target.studentId,
    target.tenantId,
    normGrade,
    normSemester,
  );

  const rows: ScoreRow[] = scores.map((s) => ({
    subjectGroup: s.subject_group?.name ?? "-",
    subject: s.subject?.name ?? "-",
    grade: s.grade,
    semester: s.semester,
    rawScore: s.raw_score,
    rankGrade: s.rank_grade,
    creditHours: s.credit_hours,
  }));

  return {
    ok: true,
    studentName: target.studentName,
    filter: { grade: normGrade, semester: normSemester },
    count: rows.length,
    rows,
  };
}
