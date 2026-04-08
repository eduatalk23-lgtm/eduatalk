import { type NextRequest } from "next/server";
import { apiSuccess, apiBadRequest } from "@/lib/api/response";
import {
  computeScoreAnalysis,
  type ScoreComputationInput,
} from "@/lib/domains/score/computation";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";

const limiter = createRateLimiter({ maxRequests: 30, prefix: "rl:gpa" });

interface SubjectInput {
  rawScore: number | null;
  avgScore?: number | null;
  stdDev?: number | null;
  rankGrade?: number | null;
  achievementLevel?: string | null;
  ratioA?: number | null;
  ratioB?: number | null;
  ratioC?: number | null;
  ratioD?: number | null;
  ratioE?: number | null;
  totalStudents?: number | null;
  classRank?: number | null;
  subjectCategory?: "regular" | "career" | "experiment";
  gradeSystem?: 5 | 9;
  achievementScale?: "3-level" | "5-level";
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, limiter);
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiBadRequest("유효한 JSON 본문이 필요���니다.");
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("subjects" in body) ||
    !Array.isArray((body as Record<string, unknown>).subjects)
  ) {
    return apiBadRequest(
      "subjects 배열이 필요합니다. 예: { \"subjects\": [{ \"rawScore\": 85, \"achievementLevel\": \"A\" }] }",
    );
  }

  const subjects = (body as { subjects: SubjectInput[] }).subjects;

  if (subjects.length === 0) {
    return apiBadRequest("최소 1개의 과목이 필요합니다.");
  }
  if (subjects.length > 50) {
    return apiBadRequest("과목은 최대 50개까지 입력 가능합니다.");
  }

  const results = subjects.map((s, i) => {
    const input: ScoreComputationInput = {
      rawScore: s.rawScore ?? null,
      avgScore: s.avgScore ?? null,
      stdDev: s.stdDev ?? null,
      rankGrade: s.rankGrade ?? null,
      achievementLevel: s.achievementLevel ?? null,
      ratioA: s.ratioA ?? null,
      ratioB: s.ratioB ?? null,
      ratioC: s.ratioC ?? null,
      ratioD: s.ratioD ?? null,
      ratioE: s.ratioE ?? null,
      totalStudents: s.totalStudents ?? null,
      classRank: s.classRank ?? null,
      subjectCategory: s.subjectCategory ?? "regular",
      gradeSystem: s.gradeSystem ?? 9,
      achievementScale: s.achievementScale,
    };

    return {
      index: i,
      ...computeScoreAnalysis(input),
    };
  });

  // 9등급 평균 (null 제외)
  const validGrades = results
    .map((r) => r.adjustedGrade ?? r.convertedGrade9)
    .filter((g): g is number => g !== null);

  const averageGrade =
    validGrades.length > 0
      ? Math.round((validGrades.reduce((a, b) => a + b, 0) / validGrades.length) * 100) / 100
      : null;

  return apiSuccess({
    subjects: results,
    averageGrade,
    count: results.length,
  });
}
