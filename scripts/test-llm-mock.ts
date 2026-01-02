/**
 * Mock LLM 응답으로 파서 테스트
 *
 * Claude Code CLI를 활용한 테스트 - 실제 API 호출 없이 파싱 로직 검증
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { parseLLMResponse, validateQualityMetrics, toDBPlanDataList } from "../lib/domains/plan/llm/transformers/responseParser";

// Claude가 생성할 것으로 예상되는 응답
const mockLLMResponse = JSON.stringify({
  weeklyMatrices: [
    {
      weekNumber: 1,
      weekStart: "2025-01-06",
      weekEnd: "2025-01-08",
      days: [
        {
          date: "2025-01-06",
          dayOfWeek: 1,
          totalMinutes: 120,
          plans: [
            {
              date: "2025-01-06",
              dayOfWeek: 1,
              startTime: "09:00",
              endTime: "10:00",
              contentId: "content-1",
              contentTitle: "수학의 정석",
              subject: "수학",
              rangeStart: 1,
              rangeEnd: 20,
              rangeDisplay: "p.1-20",
              estimatedMinutes: 60,
              isReview: false,
              priority: "high",
              notes: "취약 과목 우선 배치"
            },
            {
              date: "2025-01-06",
              dayOfWeek: 1,
              startTime: "10:00",
              endTime: "11:00",
              contentId: "content-2",
              contentTitle: "영어 독해",
              subject: "영어",
              rangeStart: 1,
              rangeEnd: 2,
              rangeDisplay: "1-2강",
              estimatedMinutes: 60,
              isReview: false,
              priority: "medium"
            }
          ],
          dailySummary: "수학 취약 과목 집중 학습"
        },
        {
          date: "2025-01-07",
          dayOfWeek: 2,
          totalMinutes: 120,
          plans: [
            {
              date: "2025-01-07",
              dayOfWeek: 2,
              startTime: "09:00",
              endTime: "10:00",
              contentId: "content-1",
              contentTitle: "수학의 정석",
              subject: "수학",
              rangeStart: 21,
              rangeEnd: 40,
              rangeDisplay: "p.21-40",
              estimatedMinutes: 60,
              isReview: false,
              priority: "high"
            },
            {
              date: "2025-01-07",
              dayOfWeek: 2,
              startTime: "10:00",
              endTime: "11:00",
              contentId: "content-2",
              contentTitle: "영어 독해",
              subject: "영어",
              rangeStart: 3,
              rangeEnd: 4,
              rangeDisplay: "3-4강",
              estimatedMinutes: 60,
              isReview: false,
              priority: "medium"
            }
          ]
        },
        {
          date: "2025-01-08",
          dayOfWeek: 3,
          totalMinutes: 120,
          plans: [
            {
              date: "2025-01-08",
              dayOfWeek: 3,
              startTime: "09:00",
              endTime: "10:00",
              contentId: "content-1",
              contentTitle: "수학의 정석",
              subject: "수학",
              rangeStart: 1,
              rangeEnd: 20,
              rangeDisplay: "p.1-20",
              estimatedMinutes: 60,
              isReview: true,
              priority: "high",
              notes: "1일차 복습"
            },
            {
              date: "2025-01-08",
              dayOfWeek: 3,
              startTime: "10:00",
              endTime: "11:00",
              contentId: "content-2",
              contentTitle: "영어 독해",
              subject: "영어",
              rangeStart: 5,
              rangeEnd: 6,
              rangeDisplay: "5-6강",
              estimatedMinutes: 60,
              isReview: false,
              priority: "medium"
            }
          ]
        }
      ],
      weeklySummary: "수학 취약 과목 집중 + 영어 병행"
    }
  ],
  totalPlans: 6,
  recommendations: {
    studyTips: [
      "수학은 오전에 집중력이 높을 때 학습하세요",
      "영어 독해는 소리 내어 읽으면 효과적입니다"
    ],
    warnings: [
      "수학 진도가 빠르니 이해 안 되면 반복하세요"
    ],
    focusAreas: ["수학 기초 개념", "영어 독해력"]
  }
}, null, 2);

async function runMockTest() {
  console.log("=".repeat(60));
  console.log("Mock LLM 응답 파싱 테스트");
  console.log("=".repeat(60));

  // 1. 파싱 테스트
  console.log("\n[1] 응답 파싱 중...");
  const contentIds = ["content-1", "content-2"];
  const result = parseLLMResponse(
    mockLLMResponse,
    "claude-3-5-haiku-mock",
    { inputTokens: 1000, outputTokens: 800 },
    contentIds
  );

  console.log("   파싱 성공:", result.success);

  if (!result.success || !result.response) {
    console.error("   파싱 실패:", result.error);
    return;
  }

  console.log("   총 플랜 수:", result.response.totalPlans);
  console.log("   주간 매트릭스:", result.response.weeklyMatrices.length, "주");
  console.log("   신뢰도:", result.response.meta.confidence.toFixed(2));

  // 2. 일별 플랜 출력
  console.log("\n[2] 생성된 플랜 요약:");
  for (const matrix of result.response.weeklyMatrices) {
    console.log(`\n   ${matrix.weekNumber}주차 (${matrix.weekStart} ~ ${matrix.weekEnd}):`);
    for (const day of matrix.days) {
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      console.log(`   ${day.date} (${dayNames[day.dayOfWeek]}): ${day.plans.length}개 플랜, ${day.totalMinutes}분`);
      day.plans.forEach(p => {
        const review = p.isReview ? " [복습]" : "";
        console.log(`      - ${p.startTime}-${p.endTime}: ${p.subject} - ${p.rangeDisplay}${review}`);
      });
    }
  }

  // 3. 품질 메트릭 검증
  console.log("\n[3] 품질 메트릭 검증:");
  const quality = validateQualityMetrics(
    result.response,
    {
      startDate: "2025-01-06",
      endDate: "2025-01-08",
      dailyStudyMinutes: 120,
      prioritizeWeakSubjects: true,
      includeReview: true,
      reviewRatio: 0.2,
    },
    [
      { subject: "수학", isWeak: true },
      { subject: "영어", isWeak: false },
    ]
  );

  console.log("   유효:", quality.isValid);
  if (quality.metrics.weakSubjectRatio !== undefined) {
    console.log("   취약 과목 오전 배치율:", (quality.metrics.weakSubjectRatio * 100).toFixed(1) + "%");
  }
  if (quality.metrics.reviewRatio !== undefined) {
    console.log("   복습 비율:", (quality.metrics.reviewRatio * 100).toFixed(1) + "%");
  }
  if (quality.warnings.length > 0) {
    console.log("   경고:");
    quality.warnings.forEach(w => console.log(`      - ${w.message}`));
  }

  // 4. DB 저장 형식 변환 테스트
  console.log("\n[4] DB 저장 형식 변환:");
  const dbPlans = toDBPlanDataList(result.response);
  console.log("   변환된 플랜 수:", dbPlans.length);
  console.log("   첫 번째 플랜:");
  const first = dbPlans[0];
  console.log("      plan_date:", first.plan_date);
  console.log("      start_time:", first.start_time);
  console.log("      content_id:", first.content_id);
  console.log("      subject:", first.subject);
  console.log("      ai_generated:", first.ai_generated);

  // 5. AI 추천 사항
  console.log("\n[5] AI 추천 사항:");
  const rec = result.response.recommendations;
  if (rec.studyTips?.length) {
    console.log("   학습 팁:");
    rec.studyTips.forEach(t => console.log(`      - ${t}`));
  }
  if (rec.warnings?.length) {
    console.log("   주의사항:");
    rec.warnings.forEach(w => console.log(`      - ${w}`));
  }

  // 6. 스킵된 플랜 확인
  if (result.skippedPlans?.length) {
    console.log("\n[6] 스킵된 플랜:");
    result.skippedPlans.forEach(s => console.log(`      - ${s.reason}`));
  } else {
    console.log("\n[6] 스킵된 플랜: 없음");
  }

  console.log("\n" + "=".repeat(60));
  console.log("테스트 완료! 파싱 로직이 정상 동작합니다.");
  console.log("=".repeat(60));
}

runMockTest();
