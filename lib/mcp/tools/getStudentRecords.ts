/**
 * Phase F-3: getStudentRecords tool 공유 정의.
 *
 * 학생의 생기부 기록(세특/개인세특/창체/행특/독서) 을 요약 반환 — read-only.
 * 기존 Agent tool(`data-tools.ts`) 을 MCP 로 승격.
 */

import { z } from "zod";
import { getRecordTabData } from "@/lib/domains/student-record/service";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";

const CONTENT_TRUNCATE_LIMIT = 300;

function truncate(text: string | null | undefined, limit: number): string {
  if (!text) return "";
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

function resolveDefaultSchoolYear(): number {
  const now = new Date();
  // 한국 학년도: 3 월 시작. 1~2 월 은 전년도.
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export type StudentRecordSummary = {
  schoolYear: number;
  seteks: Array<{
    subjectId: string | null;
    grade: number;
    semester: number;
    content: string;
  }>;
  personalSeteks: Array<{
    title: string | null;
    grade: number;
    content: string;
  }>;
  changche: Array<{
    activityType: string | null;
    grade: number;
    content: string;
  }>;
  haengteuk: { content: string } | null;
  readings: Array<{
    bookTitle: string | null;
    author: string | null;
    subjectArea: string | null;
    notes: string;
  }>;
  /** 모든 섹션이 비어 있으면 true — UI 에서 "기록 없음" 안내. */
  isEmpty: boolean;
};

export type GetStudentRecordsOutput =
  | {
      ok: true;
      studentId: string;
      studentName: string | null;
      summary: StudentRecordSummary;
    }
  | { ok: false; reason: string };

export const getStudentRecordsDescription =
  "학생의 생기부 기록(세특·개인 세특·창체·행특·독서) 요약을 조회합니다. 각 항목 본문은 300자로 절삭. '생기부 내용', '세특 보여줘', '독서 기록' 등 기록 조회 질문 시 호출. 관리자/컨설턴트는 studentName 필수, 학생 본인은 생략. schoolYear 미지정 시 현재 학년도.";

export const getStudentRecordsInputShape = {
  studentName: z
    .string()
    .nullable()
    .optional()
    .describe(
      "조회할 학생의 이름. admin/consultant 는 반드시 제공. 학생 본인은 생략.",
    ),
  schoolYear: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .nullable()
    .optional()
    .describe("조회할 학년도. 생략 시 현재 학년도."),
} as const;

export const getStudentRecordsInputSchema = z.object(
  getStudentRecordsInputShape,
);

export type GetStudentRecordsInput = z.infer<
  typeof getStudentRecordsInputSchema
>;

export async function getStudentRecordsExecute({
  studentName,
  schoolYear,
}: GetStudentRecordsInput): Promise<GetStudentRecordsOutput> {
  const target = await resolveStudentTarget({
    studentName: studentName ?? undefined,
  });
  if (!target.ok) return { ok: false, reason: target.reason };

  const year = schoolYear ?? resolveDefaultSchoolYear();

  const data = await getRecordTabData(target.studentId, year, target.tenantId);

  const seteks = data.seteks.map((s) => ({
    subjectId: s.subject_id ?? null,
    grade: s.grade,
    semester: s.semester,
    content: truncate(s.content, CONTENT_TRUNCATE_LIMIT),
  }));
  const personalSeteks = data.personalSeteks.map((s) => ({
    title: s.title ?? null,
    grade: s.grade,
    content: truncate(s.content, CONTENT_TRUNCATE_LIMIT),
  }));
  const changche = data.changche.map((c) => ({
    activityType: c.activity_type ?? null,
    grade: c.grade,
    content: truncate(c.content, CONTENT_TRUNCATE_LIMIT),
  }));
  const haengteuk = data.haengteuk
    ? { content: truncate(data.haengteuk.content, CONTENT_TRUNCATE_LIMIT) }
    : null;
  const readings = data.readings.map((r) => ({
    bookTitle: r.book_title ?? null,
    author: r.author ?? null,
    subjectArea: r.subject_area ?? null,
    notes: truncate(r.notes, CONTENT_TRUNCATE_LIMIT),
  }));

  const isEmpty =
    seteks.length === 0 &&
    personalSeteks.length === 0 &&
    changche.length === 0 &&
    !haengteuk &&
    readings.length === 0;

  return {
    ok: true,
    studentId: target.studentId,
    studentName: target.studentName,
    summary: {
      schoolYear: year,
      seteks,
      personalSeteks,
      changche,
      haengteuk,
      readings,
      isEmpty,
    },
  };
}
