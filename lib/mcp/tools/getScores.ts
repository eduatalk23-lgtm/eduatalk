/**
 * Phase F-1b: getScores tool 공유 정의.
 *
 * Chat Shell(`app/api/chat/route.ts`)과 MCP 서버(`lib/mcp/server.ts`)가
 * 동일 로직을 재사용. F-1a navigateTo 패턴을 그대로 복제.
 */

import { z } from "zod";
import { getInternalScoresByTerm } from "@/lib/data/scoreDetails";
import {
  resolveStudentTarget,
  type StudentTargetCandidate,
} from "@/lib/mcp/tools/_shared/resolveStudent";

export type ScoreRow = {
  /**
   * C-3 Sprint 2: `student_internal_scores.id` — writeback 대상 식별자.
   * C-2 이전에 생성된 artifact 스냅샷에는 없을 수 있어 optional. 없으면 applyArtifactEdit 서버 액션에서 거부.
   */
  id?: string;
  subjectGroup: string;
  subject: string;
  grade: number;
  semester: number;
  rawScore: number | null;
  rankGrade: number | null;
  creditHours: number;
};

/** 후방 호환: F-3e 이전 export 명. 신규 코드는 StudentTargetCandidate 사용. */
export type StudentCandidate = StudentTargetCandidate;

export type GetScoresOutput =
  | {
      ok: true;
      studentName?: string | null;
      filter: { grade?: number; semester?: number };
      count: number;
      rows: ScoreRow[];
    }
  | { ok: false; reason: string; candidates?: StudentCandidate[] };

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

  const target = await resolveStudentTarget({ studentName: normStudentName });
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
    id: s.id,
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
