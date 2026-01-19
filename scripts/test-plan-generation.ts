/**
 * 학습 플랜 생성 테스트 스크립트
 * 실행: npx tsx scripts/test-plan-generation.ts
 */

import { generatePlanWithAI } from "../lib/domains/plan/llm/actions/generatePlan";

async function main() {
  console.log("=== 학습 플랜 생성 테스트 ===\n");

  // Mock 콘텐츠 (Cold Start 결과를 시뮬레이션)
  const mockContents = [
    {
      id: "mock-content-1",
      title: "미적분 개념강의 - 완성",
      contentType: "lecture" as const,
      subject: "미적분",
      subjectCategory: "수학",
      totalRange: 45,
      chapters: [
        { title: "1. 수열의 극한", startRange: 1, endRange: 10 },
        { title: "2. 급수", startRange: 11, endRange: 18 },
        { title: "3. 함수의 극한", startRange: 19, endRange: 26 },
        { title: "4. 함수의 연속", startRange: 27, endRange: 32 },
        { title: "5. 미분계수와 도함수", startRange: 33, endRange: 38 },
        { title: "6. 적분", startRange: 39, endRange: 45 },
      ],
    },
  ];

  // 오늘부터 한달
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const input = {
    contentIds: ["mock-content-1"],
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    dailyStudyMinutes: 60, // 하루 1시간
    planningMode: "strategy" as const,
    excludeDays: [0], // 일요일 제외
    prioritizeWeakSubjects: true,
    balanceSubjects: false,
    includeReview: true,
    reviewRatio: 0.2,
    dryRun: true, // DB에 저장하지 않음
  };

  console.log("입력 조건:");
  console.log(JSON.stringify(input, null, 2));
  console.log("\n플랜 생성 중...\n");

  try {
    const result = await generatePlanWithAI(input);

    if (result.success && result.data) {
      console.log("✅ 성공!\n");
      console.log("=== 생성된 플랜 ===");
      console.log(`총 ${result.data.totalPlans}개 학습 일정\n`);

      result.data.weeklyMatrices.forEach((week) => {
        console.log(`\n📅 ${week.weekNumber}주차 (${week.weekStart} ~ ${week.weekEnd})`);
        console.log(`요약: ${week.weeklySummary}\n`);

        week.days.forEach((day) => {
          if (day.plans.length === 0) return;

          console.log(`  [${day.date}] ${day.dailySummary}`);
          day.plans.forEach((plan) => {
            console.log(
              `    ${plan.startTime}-${plan.endTime} | ${plan.contentTitle} ${plan.rangeDisplay}${plan.isReview ? " (복습)" : ""}`
            );
          });
        });
      });

      if (result.data.recommendations) {
        console.log("\n=== AI 추천 사항 ===");
        console.log("학습 팁:", result.data.recommendations.studyTips?.join(", "));
        console.log("주의사항:", result.data.recommendations.warnings?.join(", "));
      }
    } else {
      console.log("❌ 실패");
      console.log("에러:", result.error);
    }
  } catch (error) {
    console.error("실행 중 오류 발생:", error);
  }
}

main();
