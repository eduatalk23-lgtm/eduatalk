
/**
 * Gemini API 통합 테스트 스크립트 (Service-Logic Based)
 *
 * 이 스크립트는 실제 서비스 코드(Prompt Builder, Parser 등)를 직접 Import하여
 * DB 연결 없이 Mock Data로 전체 파이프라인(Request -> Prompt -> API -> Response -> Parsing)을 검증합니다.
 *
 * 실행: npx tsx scripts/test-integration-gemini.ts
 */

import dotenv from "dotenv";
import path from "path";

// 1. 환경 변수 로드
console.log("📝 환경 변수 로드 중...");
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY가 설정되지 않았습니다.");
  process.exit(1);
}

// 2. 실제 서비스 로직 Import
import {
  buildLLMRequest,
  type BuildRequestOptions,
} from "../lib/domains/plan/llm/transformers/requestBuilder";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  estimatePromptTokens,
} from "../lib/domains/plan/llm/prompts/planGeneration";
import { parseLLMResponse } from "../lib/domains/plan/llm/transformers/responseParser";
import { getGeminiProvider } from "../lib/domains/plan/llm/providers/gemini";

// 3. Mock Data 정의
const mockStudent = {
  id: "test-student-id",
  name: "김민수",
  grade: 2, // 고2
  target_university: "서울대학교",
  target_major: "컴퓨터공학과",
};

const mockScores = [
  { subject: "수학", subject_category: "미적분", grade: 2, percentile: 89, is_weak: false }, // 강점 (상위 11%)
  { subject: "영어", subject_category: undefined, grade: 3, percentile: 75, is_weak: false }, // 보통
  { subject: "국어", subject_category: "언어와 매체", grade: 4, percentile: 55, is_weak: true }, // 약점 (취약)
];

const mockContents = [
  {
    id: "content-math-1",
    title: "수학의 정석 실력편 (미적분)",
    subject: "수학",
    subject_category: "미적분",
    content_type: "book",
    total_pages: 300,
    estimated_hours: 20,
    priority: "high",
  },
  {
    id: "content-eng-1",
    title: "수능특강 영어",
    subject: "영어",
    content_type: "book",
    total_pages: 200,
    estimated_hours: 15,
    priority: "medium",
  },
  {
    id: "content-kor-1",
    title: "마닳 (국어 기출)",
    subject: "국어",
    subject_category: "국어",
    content_type: "book",
    estimated_hours: 25,
    priority: "high", // 약점 과목이라 높음
  },
  {
    id: "content-math-lecture",
    title: "현우진 뉴런 (미적분)",
    subject: "수학",
    subject_category: "미적분",
    content_type: "lecture",
    total_lectures: 30,
    estimated_hours: 30,
    priority: "high",
  },
];

const mockSettings = {
  startDate: "2026-02-01",
  endDate: "2026-02-07",
  dailyStudyMinutes: 240, // 4시간
  prioritizeWeakSubjects: true, // 취약 과목 우선
  includeReview: true,
  reviewRatio: 0.2, // 20% 복습
  excludeDays: [], // 없음
};

// 4. 테스트 실행 함수
async function runIntegrationTest() {
  console.log("\n🚀 Gemini API 통합 테스트 시작 (Service Logic Based)\n");

  try {
    // --- Step 1: Request Building ---
    console.log("🔹 [Step 1] Request Building (Builder 호출)");
    const buildOptions: BuildRequestOptions = {
      student: mockStudent,
      scores: mockScores,
      contents: mockContents,
      settings: mockSettings,
      weakSubjects: ["국어"], // 명시적 취약 과목
      additionalInstructions: "서울대 컴공 목표이므로 수학 심화 학습 중요. 국어 비문학 집중.",
    };

    const llmRequest = buildLLMRequest(buildOptions);
    console.log("   ✅ Request Build 완료");
    console.log(`   - Student: ${llmRequest.student.name}`);
    console.log(`   - Contents: ${llmRequest.contents.length}개`);
    console.log(`   - Settings: ${llmRequest.settings.startDate} ~ ${llmRequest.settings.endDate}`);

    // --- Step 2: Prompt Generation ---
    console.log("\n🔹 [Step 2] Prompt Generation (Prompt Builder 호출)");
    const userPrompt = buildUserPrompt(llmRequest);
    
    // 토큰 추정
    const tokens = estimatePromptTokens(llmRequest);
    console.log("   ✅ Prompt 생성 완료");
    console.log(`   - System Prompt 길이: ${SYSTEM_PROMPT.length}자`);
    console.log(`   - User Prompt 길이: ${userPrompt.length}자`);
    console.log(`   - 예상 토큰: Total ~${tokens.totalTokens} (System: ~${tokens.systemTokens}, User: ~${tokens.userTokens})`);

    // --- Step 3: API Call ---
    console.log("\n🔹 [Step 3] API Call (Gemini Provider 호출)");
    const provider = getGeminiProvider();
    const modelTier = "fast"; // gemini-flash-latest

    console.log(`   Target Model: ${modelTier} (Gemini Flash)`);
    console.log("   ⏳ Calling API... (Please wait)");

    const startTime = Date.now();
    const result = await provider.createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
      grounding: { enabled: true, mode: "dynamic" }, // Grounding 활성화
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`   ✅ API 응답 수신 완료 (${elapsed}초)`);
    console.log(`   - Input Tokens: ${result.usage.inputTokens}`);
    console.log(`   - Output Tokens: ${result.usage.outputTokens}`);
    
    if (result.groundingMetadata) {
        console.log(`   🔍 Grounding Used: Yes`);
        console.log(`      Queries: ${result.groundingMetadata.searchQueries.join(", ")}`);
    }

    // --- Step 4: Response Parsing ---
    console.log("\n🔹 [Step 4] Response Parsing (Parser 호출)");
    
    // 유효한 Content ID 목록 (검증용)
    const validContentIds = mockContents.map(c => c.id);
    
    const parsed = parseLLMResponse(
        result.content, 
        result.modelId, 
        result.usage, 
        validContentIds
    );

    if (parsed.success && parsed.response) {
        console.log("   ✅ 파싱 성공!");
        console.log(`   - Total Plans: ${parsed.response.totalPlans}`);
        console.log(`   - Weekly Matrices: ${parsed.response.weeklyMatrices.length}주차`);
        
        if (parsed.response.recommendations) {
            console.log("\n   💡 AI Recommendations:");
            parsed.response.recommendations.studyTips?.slice(0, 3).forEach(tip => console.log(`      - ${tip}`));
        }

        // 첫날 플랜 예시 출력
        const firstDay = parsed.response.weeklyMatrices[0]?.days[0];
        if (firstDay) {
            console.log(`\n   📅 First Day Plan (${firstDay.date}):`);
            firstDay.plans.forEach(plan => {
                const icon = plan.subject === "수학" ? "📐" : (plan.subject === "국어" ? "📚" : "📖");
                const type = plan.contentType === "lecture" ? "[강의]" : "[교재]";
                console.log(`      ${plan.startTime}-${plan.endTime} ${icon} ${type} ${plan.contentTitle} (${plan.rangeDisplay})`);
            });
        }
        
        // 검증 로직 통과 여부 확인
        if (parsed.skippedPlans && parsed.skippedPlans.length > 0) {
            console.warn(`\n   ⚠️ Skipped Plans (Validation Failed): ${parsed.skippedPlans.length}건`);
            parsed.skippedPlans.forEach(p => console.warn(`      - ${p.reason} (Content: ${p.contentId})`));
        }

    } else {
        console.error("   ❌ 파싱 실패");
        console.error(`   Error: ${parsed.error}`);
        console.log("   Raw Response Preview:", result.content.slice(0, 200) + "...");
    }

    console.log("\n✨ 통합 테스트 완료");

  } catch (error) {
    console.error("\n❌ 테스트 중 오류 발생:");
    if (error instanceof Error) {
        console.error(error.message);
        if(error.stack) console.error(error.stack);
    } else {
        console.error(error);
    }
    process.exit(1);
  }
}

// 스크립트 실행
runIntegrationTest();
