/**
 * LLM 플랜 생성 실제 API 테스트 스크립트
 *
 * 실행: npx tsx scripts/test-llm-plan.ts
 */

import dotenv from "dotenv";
import path from "path";

// .env.local 먼저 로드 (동기적으로)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// 환경 변수 확인
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY가 .env.local에 설정되지 않았습니다.");
  process.exit(1);
}

import { createMessage, getModelConfig, estimateCost } from "../lib/domains/plan/llm/client";
import { SYSTEM_PROMPT, buildUserPrompt, estimatePromptTokens } from "../lib/domains/plan/llm/prompts/planGeneration";
import { buildLLMRequest, validateRequest } from "../lib/domains/plan/llm/transformers/requestBuilder";
import { parseLLMResponse, validateQualityMetrics } from "../lib/domains/plan/llm/transformers/responseParser";
import type { ModelTier } from "../lib/domains/plan/llm/types";

// 테스트 데이터
const testStudent = {
  id: "test-student-1",
  name: "김테스트",
  grade: 11,
  school_name: "테스트고등학교",
  target_university: "서울대학교",
  target_major: "컴퓨터공학과",
};

const testScores = [
  { subject: "수학", subject_category: "수학", grade: 3, percentile: 85, score: 78 },
  { subject: "영어", subject_category: "영어", grade: 2, percentile: 92, score: 88 },
  { subject: "국어", subject_category: "국어", grade: 4, percentile: 72, score: 65 },
];

const testContents = [
  {
    id: "content-1",
    title: "수학의 정석 - 미적분",
    subject: "수학",
    subject_category: "수학",
    content_type: "book" as const,
    total_pages: 350,
    estimated_hours: 50,
    difficulty: "medium" as const,
  },
  {
    id: "content-2",
    title: "영어 독해 마스터",
    subject: "영어",
    subject_category: "영어",
    content_type: "lecture" as const,
    total_lectures: 30,
    estimated_hours: 30,
    difficulty: "medium" as const,
  },
  {
    id: "content-3",
    title: "국어 문학 완성",
    subject: "국어",
    subject_category: "국어",
    content_type: "book" as const,
    total_pages: 200,
    estimated_hours: 25,
    difficulty: "easy" as const,
  },
];

const testSettings = {
  startDate: "2025-01-06", // 다음 월요일
  endDate: "2025-01-12", // 일요일까지 (1주일)
  dailyStudyMinutes: 180,
  excludeDays: [0], // 일요일 제외
  prioritizeWeakSubjects: true,
  balanceSubjects: true,
  includeReview: true,
  reviewRatio: 0.2,
};

async function runTest(modelTier: ModelTier = "fast") {
  console.log("\n" + "=".repeat(60));
  console.log(`LLM 플랜 생성 테스트 (모델: ${modelTier})`);
  console.log("=".repeat(60));

  // 1. 요청 빌드
  console.log("\n[1] 요청 빌드 중...");
  const llmRequest = buildLLMRequest({
    student: testStudent,
    scores: testScores,
    weakSubjects: ["국어"], // 국어가 취약 과목
    contents: testContents,
    settings: testSettings,
    additionalInstructions: "시험이 2주 후에 있으므로 집중 학습이 필요합니다.",
  });

  // 2. 유효성 검사
  console.log("[2] 요청 유효성 검사 중...");
  const validation = validateRequest(llmRequest);
  if (!validation.valid) {
    console.error("유효성 검사 실패:", validation.errors);
    return;
  }
  console.log("   유효성 검사 통과");

  // 3. 토큰 추정
  console.log("[3] 토큰 추정 중...");
  const tokenEstimate = estimatePromptTokens(llmRequest);
  console.log(`   시스템 토큰: ~${tokenEstimate.systemTokens}`);
  console.log(`   사용자 토큰: ~${tokenEstimate.userTokens}`);
  console.log(`   총 토큰: ~${tokenEstimate.totalTokens}`);

  // 4. 모델 설정 확인
  const config = getModelConfig(modelTier);
  console.log(`\n[4] 모델 설정:`);
  console.log(`   모델: ${config.modelId}`);
  console.log(`   최대 토큰: ${config.maxTokens}`);
  console.log(`   Temperature: ${config.temperature}`);

  // 5. API 호출
  console.log("\n[5] Claude API 호출 중...");
  const startTime = Date.now();

  try {
    const userPrompt = buildUserPrompt(llmRequest);

    const result = await createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   응답 시간: ${elapsed}초`);
    console.log(`   입력 토큰: ${result.usage.inputTokens}`);
    console.log(`   출력 토큰: ${result.usage.outputTokens}`);
    console.log(`   종료 이유: ${result.stopReason}`);

    // 6. 비용 계산
    const cost = estimateCost(result.usage.inputTokens, result.usage.outputTokens, modelTier);
    console.log(`   예상 비용: $${cost.toFixed(6)}`);

    // 7. 응답 파싱
    console.log("\n[6] 응답 파싱 중...");
    const contentIds = testContents.map(c => c.id);
    const parsed = parseLLMResponse(
      result.content,
      result.modelId,
      result.usage,
      contentIds
    );

    if (!parsed.success) {
      console.error("파싱 실패:", parsed.error);
      console.log("\n원본 응답:");
      console.log(result.content.substring(0, 500) + "...");
      return;
    }

    console.log("   파싱 성공!");
    console.log(`   총 플랜 수: ${parsed.response!.totalPlans}`);
    console.log(`   주간 매트릭스: ${parsed.response!.weeklyMatrices.length}주`);

    if (parsed.skippedPlans?.length) {
      console.log(`   스킵된 플랜: ${parsed.skippedPlans.length}개`);
      parsed.skippedPlans.forEach(s => console.log(`     - ${s.reason}`));
    }

    // 8. 품질 메트릭 검증
    console.log("\n[7] 품질 메트릭 검증 중...");
    const quality = validateQualityMetrics(
      parsed.response!,
      testSettings,
      testScores.map(s => ({ ...s, isWeak: s.subject === "국어" }))
    );

    console.log(`   유효: ${quality.isValid}`);
    if (quality.metrics.weakSubjectRatio !== undefined) {
      console.log(`   취약 과목 오전 배치율: ${(quality.metrics.weakSubjectRatio * 100).toFixed(1)}%`);
    }
    if (quality.metrics.reviewRatio !== undefined) {
      console.log(`   복습 비율: ${(quality.metrics.reviewRatio * 100).toFixed(1)}%`);
    }
    if (quality.warnings.length > 0) {
      console.log("   경고:");
      quality.warnings.forEach(w => console.log(`     - ${w.message}`));
    }

    // 9. 일별 플랜 요약
    console.log("\n[8] 생성된 플랜 요약:");
    for (const matrix of parsed.response!.weeklyMatrices) {
      console.log(`\n   ${matrix.weekNumber}주차 (${matrix.weekStart} ~ ${matrix.weekEnd}):`);
      for (const day of matrix.days) {
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        console.log(`   ${day.date} (${dayNames[day.dayOfWeek]}): ${day.plans.length}개 플랜, ${day.totalMinutes}분`);
        day.plans.forEach(p => {
          const review = p.isReview ? " [복습]" : "";
          console.log(`      - ${p.startTime}-${p.endTime}: ${p.subject} - ${p.contentTitle}${review}`);
        });
      }
    }

    // 10. 추천 사항
    if (parsed.response!.recommendations) {
      const rec = parsed.response!.recommendations;
      console.log("\n[9] AI 추천 사항:");
      if (rec.studyTips?.length) {
        console.log("   학습 팁:");
        rec.studyTips.forEach(t => console.log(`   - ${t}`));
      }
      if (rec.warnings?.length) {
        console.log("   주의사항:");
        rec.warnings.forEach(w => console.log(`   - ${w}`));
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("테스트 완료!");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\nAPI 호출 오류:", error);
    if (error instanceof Error) {
      console.error("메시지:", error.message);
    }
  }
}

// 실행
const tier = (process.argv[2] as ModelTier) || "fast";
runTest(tier);
