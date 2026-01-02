/**
 * contentId 검증 및 스킵 로직 테스트
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { parseLLMResponse } from "../lib/domains/plan/llm/transformers/responseParser";

// 유효하지 않은 contentId를 포함한 응답
const mockResponseWithInvalidId = JSON.stringify({
  weeklyMatrices: [
    {
      weekNumber: 1,
      weekStart: "2025-01-06",
      weekEnd: "2025-01-06",
      days: [
        {
          date: "2025-01-06",
          dayOfWeek: 1,
          totalMinutes: 120,
          plans: [
            {
              date: "2025-01-06",
              startTime: "09:00",
              endTime: "10:00",
              contentId: "content-1", // 유효
              contentTitle: "수학의 정석",
              subject: "수학",
              estimatedMinutes: 60,
            },
            {
              date: "2025-01-06",
              startTime: "10:00",
              endTime: "11:00",
              contentId: "INVALID-ID", // 유효하지 않음!
              contentTitle: "존재하지 않는 콘텐츠",
              subject: "과학",
              estimatedMinutes: 60,
            },
            {
              date: "2025-01-06",
              startTime: "11:00",
              endTime: "12:00",
              contentId: "content-2", // 유효
              contentTitle: "영어 독해",
              subject: "영어",
              estimatedMinutes: 60,
            }
          ]
        }
      ]
    }
  ],
  totalPlans: 3,
  recommendations: { studyTips: [], warnings: [] }
});

console.log("=".repeat(60));
console.log("contentId 검증 테스트");
console.log("=".repeat(60));

// 유효한 contentId 목록 (INVALID-ID는 포함 안 됨)
const validContentIds = ["content-1", "content-2"];

console.log("\n유효한 contentId 목록:", validContentIds);
console.log("응답에 포함된 contentId: content-1, INVALID-ID, content-2");

const result = parseLLMResponse(
  mockResponseWithInvalidId,
  "test-model",
  { inputTokens: 100, outputTokens: 200 },
  validContentIds
);

console.log("\n=== 파싱 결과 ===");
console.log("성공:", result.success);

if (result.response) {
  console.log("유효한 플랜 수:", result.response.totalPlans);

  console.log("\n파싱된 플랜:");
  for (const day of result.response.weeklyMatrices[0].days) {
    day.plans.forEach(p => {
      console.log(`  - ${p.contentId}: ${p.contentTitle}`);
    });
  }
}

if (result.skippedPlans && result.skippedPlans.length > 0) {
  console.log("\n=== 스킵된 플랜 ===");
  result.skippedPlans.forEach(s => {
    console.log(`  - contentId: ${s.contentId}`);
    console.log(`    이유: ${s.reason}`);
  });
} else {
  console.log("\n스킵된 플랜: 없음");
}

console.log("\n" + "=".repeat(60));
console.log("테스트 완료!");
console.log("=".repeat(60));
