/**
 * Phase F-3c: getStudentStorylines tool 공유 정의.
 *
 * 학생의 탐구 스토리라인(학년별 연결·로드맵) 조회.
 */

import { z } from "zod";
import { getStorylineTabData } from "@/lib/domains/student-record/service";
import { findStorylinesByStudent } from "@/lib/domains/student-record/repository";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";

const PLAN_TRUNCATE = 200;

function truncate(text: string | null | undefined, limit: number): string {
  if (!text) return "";
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

function resolveDefaultSchoolYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export type StorylineSummary = {
  id: string;
  title: string | null;
  careerField: string | null;
  keywords: string[] | null;
};

export type StorylineRoadmapItem = {
  storylineId: string;
  grade: number;
  semester: number;
  area: string | null;
  planContent: string;
};

export type GetStudentStorylinesOutput =
  | {
      ok: true;
      studentId: string;
      studentName: string | null;
      schoolYear: number;
      storylines: StorylineSummary[];
      roadmapItems: StorylineRoadmapItem[];
    }
  | { ok: false; reason: string };

export const getStudentStorylinesDescription =
  "학생의 탐구 스토리라인과 학년별 로드맵을 조회합니다. '탐구 흐름', '스토리라인', '학년별 계획' 등 탐구 설계 영역 질문 시 호출. 관리자/컨설턴트는 studentName 필수, 학생 본인은 생략.";

export const getStudentStorylinesInputShape = {
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

export const getStudentStorylinesInputSchema = z.object(
  getStudentStorylinesInputShape,
);

export type GetStudentStorylinesInput = z.infer<
  typeof getStudentStorylinesInputSchema
>;

export async function getStudentStorylinesExecute({
  studentName,
  schoolYear,
}: GetStudentStorylinesInput): Promise<GetStudentStorylinesOutput> {
  const target = await resolveStudentTarget({
    studentName: studentName ?? undefined,
  });
  if (!target.ok) return { ok: false, reason: target.reason };

  const year = schoolYear ?? resolveDefaultSchoolYear();

  const [storylineData, storylines] = await Promise.all([
    getStorylineTabData(target.studentId, year, target.tenantId),
    findStorylinesByStudent(target.studentId, target.tenantId),
  ]);

  return {
    ok: true,
    studentId: target.studentId,
    studentName: target.studentName,
    schoolYear: year,
    storylines: storylines.map((s) => ({
      id: s.id,
      title: s.title ?? null,
      careerField: s.career_field ?? null,
      keywords: s.keywords ?? null,
    })),
    roadmapItems: storylineData.roadmapItems.map((r) => ({
      storylineId: r.storyline_id,
      grade: r.grade,
      semester: r.semester,
      area: r.area ?? null,
      planContent: truncate(r.plan_content, PLAN_TRUNCATE),
    })),
  };
}
