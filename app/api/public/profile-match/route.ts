import { type NextRequest } from "next/server";
import { apiSuccess, apiBadRequest } from "@/lib/api/response";
import { matchUniversityProfiles } from "@/lib/domains/record-analysis/eval/university-profile-matcher";
import { createRateLimiter, applyRateLimit } from "@/lib/middleware/rate-limit";

const limiter = createRateLimiter({ maxRequests: 30, prefix: "rl:profile-match" });

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, limiter);
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiBadRequest("유효한 JSON 본문이 필요합니다.");
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("competencyScores" in body) ||
    typeof (body as Record<string, unknown>).competencyScores !== "object" ||
    (body as Record<string, unknown>).competencyScores === null
  ) {
    return apiBadRequest(
      "competencyScores 객체가 필요합니다. 예: { \"competencyScores\": { \"academic_achievement\": 85, \"research_ability\": 70 } }",
    );
  }

  const scores = (body as { competencyScores: Record<string, unknown> }).competencyScores;

  // 값이 모두 숫자인지 검증
  const numericScores: Record<string, number> = {};
  for (const [key, value] of Object.entries(scores)) {
    if (typeof value !== "number" || value < 0 || value > 100) {
      return apiBadRequest(
        `competencyScores.${key} 값은 0~100 사이의 숫자여야 합니다.`,
      );
    }
    numericScores[key] = value;
  }

  if (Object.keys(numericScores).length === 0) {
    return apiBadRequest("최소 1개의 역량 점수가 필요합니다.");
  }

  const analysis = matchUniversityProfiles("anonymous", numericScores);
  return apiSuccess(analysis);
}
