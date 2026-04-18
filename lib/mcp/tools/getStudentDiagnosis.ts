/**
 * Phase F-3b: getStudentDiagnosis tool 공유 정의.
 *
 * 학생 역량 진단 데이터(10 역량 등급 + 활동 태그 + AI·컨설턴트 진단 + 보완전략) 조회.
 * 4 repository 병렬 호출 + Promise.allSettled 로 부분 실패 허용.
 */

import { z } from "zod";
import {
  findCompetencyScores,
  findActivityTags,
} from "@/lib/domains/student-record/repository/competency-repository";
import {
  findDiagnosisPair,
  findStrategies,
} from "@/lib/domains/student-record/repository/diagnosis-repository";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";

const EVIDENCE_TRUNCATE = 100;
const STRATEGY_TRUNCATE = 200;
const MAX_TAGS_PER_POLARITY = 10;
const MAX_STRATEGIES = 5;

function truncate(text: string | null | undefined, limit: number): string {
  if (!text) return "";
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

function resolveDefaultSchoolYear(): number {
  const now = new Date();
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

export type DiagnosisSummary = {
  overallGrade: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommendedMajors?: string[] | null;
};

export type GetStudentDiagnosisOutput =
  | {
      ok: true;
      studentId: string;
      studentName: string | null;
      schoolYear: number;
      competencyScores: Array<{
        item: string;
        grade: string | number | null;
        source: string;
      }>;
      activityTagCount: number;
      positiveTags: Array<{ item: string; evidence: string }>;
      negativeTags: Array<{ item: string; evidence: string }>;
      aiDiagnosis: DiagnosisSummary | null;
      consultantDiagnosis: DiagnosisSummary | null;
      strategies: Array<{
        targetArea: string | null;
        content: string;
        status: string | null;
      }>;
      /** 부분 실패가 있었던 repository 이름 목록(디버깅용). */
      partialFailures: string[];
    }
  | { ok: false; reason: string };

export const getStudentDiagnosisDescription =
  "학생의 역량 진단 데이터를 조회합니다. 10 역량 등급, 활동 태그(긍정/부정 각 최대 10건), AI·컨설턴트 진단(종합등급·강점·약점·추천 전공), 보완전략(최대 5건)을 반환. '역량 진단', '강점/약점 요약', '보완 전략' 등 진단 영역 질문 시 호출. 관리자/컨설턴트는 studentName 필수, 학생 본인은 생략.";

export const getStudentDiagnosisInputShape = {
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

export const getStudentDiagnosisInputSchema = z.object(
  getStudentDiagnosisInputShape,
);

export type GetStudentDiagnosisInput = z.infer<
  typeof getStudentDiagnosisInputSchema
>;

export async function getStudentDiagnosisExecute({
  studentName,
  schoolYear,
}: GetStudentDiagnosisInput): Promise<GetStudentDiagnosisOutput> {
  const target = await resolveStudentTarget({
    studentName: studentName ?? undefined,
  });
  if (!target.ok) return { ok: false, reason: target.reason };

  const year = schoolYear ?? resolveDefaultSchoolYear();

  const [scoresRes, tagsRes, diagRes, stratRes] = await Promise.allSettled([
    findCompetencyScores(target.studentId, year, target.tenantId),
    findActivityTags(target.studentId, target.tenantId),
    findDiagnosisPair(target.studentId, year, target.tenantId),
    findStrategies(target.studentId, year, target.tenantId),
  ]);

  const scores = scoresRes.status === "fulfilled" ? scoresRes.value : [];
  const tags = tagsRes.status === "fulfilled" ? tagsRes.value : [];
  const diagPair =
    diagRes.status === "fulfilled"
      ? diagRes.value
      : { ai: null, consultant: null };
  const strategies = stratRes.status === "fulfilled" ? stratRes.value : [];

  const queryNames = [
    "competencyScores",
    "activityTags",
    "diagnosisPair",
    "strategies",
  ];
  const partialFailures: string[] = [];
  [scoresRes, tagsRes, diagRes, stratRes].forEach((r, i) => {
    if (r.status === "rejected") partialFailures.push(queryNames[i]);
  });

  return {
    ok: true,
    studentId: target.studentId,
    studentName: target.studentName,
    schoolYear: year,
    competencyScores: scores.map((s) => ({
      item: s.competency_item,
      grade: s.grade_value,
      source: s.source,
    })),
    activityTagCount: tags.length,
    positiveTags: tags
      .filter((t) => t.evaluation === "positive")
      .slice(0, MAX_TAGS_PER_POLARITY)
      .map((t) => ({
        item: t.competency_item,
        evidence: truncate(t.evidence_summary, EVIDENCE_TRUNCATE),
      })),
    negativeTags: tags
      .filter((t) => t.evaluation === "negative")
      .slice(0, MAX_TAGS_PER_POLARITY)
      .map((t) => ({
        item: t.competency_item,
        evidence: truncate(t.evidence_summary, EVIDENCE_TRUNCATE),
      })),
    aiDiagnosis: diagPair.ai
      ? {
          overallGrade: diagPair.ai.overall_grade ?? null,
          strengths: diagPair.ai.strengths ?? null,
          weaknesses: diagPair.ai.weaknesses ?? null,
          recommendedMajors: diagPair.ai.recommended_majors ?? null,
        }
      : null,
    consultantDiagnosis: diagPair.consultant
      ? {
          overallGrade: diagPair.consultant.overall_grade ?? null,
          strengths: diagPair.consultant.strengths ?? null,
          weaknesses: diagPair.consultant.weaknesses ?? null,
        }
      : null,
    strategies: strategies.slice(0, MAX_STRATEGIES).map((s) => ({
      targetArea: s.target_area ?? null,
      content: truncate(s.strategy_content, STRATEGY_TRUNCATE),
      status: s.status ?? null,
    })),
    partialFailures,
  };
}
