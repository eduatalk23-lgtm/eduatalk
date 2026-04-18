/**
 * Phase F-3d: getStudentOverview tool 공유 정의.
 *
 * 학생 종합 프로필(기본정보 + 선택 플래그별 기록/진단/스토리라인 요약) 조회.
 * 리포트 맥락 구성용.
 */

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRecordTabData, getStorylineTabData } from "@/lib/domains/student-record/service";
import { findCompetencyScores } from "@/lib/domains/student-record/repository/competency-repository";
import { findDiagnosisPair } from "@/lib/domains/student-record/repository/diagnosis-repository";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";

function resolveDefaultSchoolYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

type RecordSummarySection = {
  setekCount: number;
  personalSetekCount: number;
  changcheCount: number;
  hasHaengteuk: boolean;
  readingCount: number;
  subjects: Array<string | null>;
};

type DiagnosisSection = {
  competencyScores: Array<{
    item: string;
    grade: string | number | null;
    source: string;
  }>;
  overallGrade: string | null;
  strengths: string[];
  weaknesses: string[];
  targetMajorMatch: string[];
};

type StorylineSection = Array<{
  title: string | null;
  careerField: string | null;
  keywords: string[] | null;
}>;

export type StudentOverview = {
  name: string | null;
  grade: number | null;
  className: string | null;
  schoolName: string | null;
  targetMajor: string | null;
  recordSummary?: RecordSummarySection;
  diagnosis?: DiagnosisSection;
  storylines?: StorylineSection;
};

export type GetStudentOverviewOutput =
  | {
      ok: true;
      studentId: string;
      schoolYear: number;
      overview: StudentOverview;
      /** 부분 실패 섹션(디버깅용). */
      partialFailures: string[];
    }
  | { ok: false; reason: string };

export const getStudentOverviewDescription =
  "학생의 종합 프로필을 조회합니다. 기본정보(이름·학년·반·학교·목표전공) 는 항상 반환. includeRecords/Diagnosis/Storylines 플래그로 기록·진단·스토리라인 요약을 선택 포함. 리포트 생성 전 맥락 구성에 활용. 관리자/컨설턴트는 studentName 필수, 학생 본인은 생략.";

export const getStudentOverviewInputShape = {
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
  includeRecords: z
    .boolean()
    .nullable()
    .optional()
    .describe("생기부 기록 요약 포함(세특·창체·독서 개수 등). 기본 false."),
  includeDiagnosis: z
    .boolean()
    .nullable()
    .optional()
    .describe("진단 요약 포함(역량 점수 + 종합등급·강점·약점). 기본 false."),
  includeStorylines: z
    .boolean()
    .nullable()
    .optional()
    .describe("스토리라인 요약 포함. 기본 false."),
} as const;

export const getStudentOverviewInputSchema = z.object(
  getStudentOverviewInputShape,
);

export type GetStudentOverviewInput = z.infer<
  typeof getStudentOverviewInputSchema
>;

export async function getStudentOverviewExecute({
  studentName,
  schoolYear,
  includeRecords,
  includeDiagnosis,
  includeStorylines,
}: GetStudentOverviewInput): Promise<GetStudentOverviewOutput> {
  const target = await resolveStudentTarget({
    studentName: studentName ?? undefined,
  });
  if (!target.ok) return { ok: false, reason: target.reason };

  const year = schoolYear ?? resolveDefaultSchoolYear();

  const supabase = await createSupabaseServerClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, grade, class, school_name, target_major, user_profiles(name)")
    .eq("id", target.studentId)
    .eq("tenant_id", target.tenantId)
    .maybeSingle();

  if (studentError || !student) {
    return { ok: false, reason: "학생 기본 정보를 찾을 수 없습니다." };
  }

  const profile = student.user_profiles as unknown as
    | { name: string | null }
    | null;

  const overview: StudentOverview = {
    name: profile?.name ?? target.studentName,
    grade: student.grade ?? null,
    className: student.class ?? null,
    schoolName: student.school_name ?? null,
    targetMajor: student.target_major ?? null,
  };

  const sectionNames: string[] = [];
  const sectionPromises: Promise<void>[] = [];

  if (includeRecords) {
    sectionNames.push("records");
    sectionPromises.push(
      getRecordTabData(target.studentId, year, target.tenantId).then((data) => {
        overview.recordSummary = {
          setekCount: data.seteks.length,
          personalSetekCount: data.personalSeteks.length,
          changcheCount: data.changche.length,
          hasHaengteuk: data.haengteuk !== null,
          readingCount: data.readings.length,
          subjects: data.seteks.map((s) => s.subject_id ?? null),
        };
      }),
    );
  }

  if (includeDiagnosis) {
    sectionNames.push("diagnosis");
    sectionPromises.push(
      Promise.all([
        findCompetencyScores(target.studentId, year, target.tenantId),
        findDiagnosisPair(target.studentId, year, target.tenantId),
      ]).then(([scores, diagPair]) => {
        const diag = diagPair.consultant ?? diagPair.ai;
        overview.diagnosis = {
          competencyScores: scores.map((s) => ({
            item: s.competency_item,
            grade: s.grade_value,
            source: s.source,
          })),
          overallGrade: diag?.overall_grade ?? null,
          strengths: diag?.strengths ?? [],
          weaknesses: diag?.weaknesses ?? [],
          targetMajorMatch: diag?.recommended_majors ?? [],
        };
      }),
    );
  }

  if (includeStorylines) {
    sectionNames.push("storylines");
    sectionPromises.push(
      getStorylineTabData(target.studentId, year, target.tenantId).then(
        (data) => {
          overview.storylines = data.storylines.map((s) => ({
            title: s.title ?? null,
            careerField: s.career_field ?? null,
            keywords: s.keywords ?? null,
          }));
        },
      ),
    );
  }

  const settled = await Promise.allSettled(sectionPromises);
  const partialFailures: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "rejected") partialFailures.push(sectionNames[i]);
  });

  return {
    ok: true,
    studentId: target.studentId,
    schoolYear: year,
    overview,
    partialFailures,
  };
}
