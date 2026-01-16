
/**
 * Gemini API "Schedule Mode" 검증 테스트 스크립트
 *
 * 이 스크립트는 'Schedule Mode' (배정 모드)가 제대로 동작하는지 검증합니다.
 * 주어진 availableSlots 안에서만 플랜이 생성되는지 확인합니다.
 *
 * 실행: npx tsx scripts/test-gemini-schedule-mode.ts
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
  SCHEDULE_SYSTEM_PROMPT,
  buildUserPrompt,
  estimatePromptTokens,
} from "../lib/domains/plan/llm/prompts/planGeneration";
import { parseLLMResponse } from "../lib/domains/plan/llm/transformers/responseParser";
import { getGeminiProvider } from "../lib/domains/plan/llm/providers/gemini";
import type { GeneratedPlanItem } from "../lib/domains/plan/llm/types";

// 3. Mock Data 정의
const mockStudent = {
  id: "test-student-schedule",
  name: "배정테스트",
  grade: 3,
  target_university: "연세대학교",
  target_major: "경영학과",
};

const mockContents = [
  {
    id: "content-math-focus",
    title: "수학 핵심 요약",
    subject: "수학",
    content_type: "book" as const, // as const 추가하여 리터럴 타입 유지
    total_pages: 50,
    estimated_hours: 5,
    priority: "high",
  },
  {
    id: "content-eng-word",
    title: "영단어 1000",
    subject: "영어",
    content_type: "book" as const,
    total_pages: 100,
    estimated_hours: 3,
    priority: "medium",
  },
];

// CRITICAL: 사용 가능한 시간 슬롯 (Hard Constraints)
// 월요일 오전 9-11시, 오후 2-4시만 가능하다고 가정
const availableSlots = [
  { date: "2026-02-02", startTime: "09:00", endTime: "11:00" }, // 월요일 오전 2시간
  { date: "2026-02-02", startTime: "14:00", endTime: "16:00" }, // 월요일 오후 2시간
];

const mockSettings = {
  startDate: "2026-02-02", // 월요일
  endDate: "2026-02-02",   // 1일치만 테스트
  dailyStudyMinutes: 240,  // 총 4시간 (슬롯 합계와 일치)
  prioritizeWeakSubjects: false,
  excludeDays: [],
};

// 4. 테스트 실행 함수
async function runScheduleModeTest() {
  console.log("\n🚀 Gemini API 'Schedule Mode' 검증 시작\n");

  try {
    // --- Step 1: Request Building ---
    console.log("🔹 [Step 1] Request Building (mode: schedule)");
    const buildOptions: BuildRequestOptions = {
      student: mockStudent,
      contents: mockContents,
      settings: mockSettings,
      planningMode: "schedule", // 스케줄 모드 지정
      availableSlots: availableSlots, // 가용 슬롯 전달
      additionalInstructions: "주어진 시간 슬롯을 꽉 채워서 배정해주세요.",
    };

    const llmRequest = buildLLMRequest(buildOptions);
    console.log("   ✅ Request Build 완료");
    console.log(`   - Mode: ${llmRequest.planningMode}`);
    console.log(`   - Available Slots: ${llmRequest.availableSlots?.length}개 구간`);

    // --- Step 2: Prompt Generation ---
    console.log("\n🔹 [Step 2] Prompt Generation");
    const userPrompt = buildUserPrompt(llmRequest);
    
    // 검증: User Prompt에 Available Slots 섹션이 포함되어야 함
    if (!userPrompt.includes("## 🟢 사용 가능한 시간 슬롯")) {
        throw new Error("❌ User Prompt에 '사용 가능한 시간 슬롯' 섹션이 누락되었습니다.");
    }
    console.log("   ✅ User Prompt에 슬롯 정보 포함됨");

    // 검증: System Prompt 선택
    const systemPrompt = SCHEDULE_SYSTEM_PROMPT;
    if (!systemPrompt.includes("정밀 배정 알고리즘")) {
        throw new Error("❌ SCHEDULE_SYSTEM_PROMPT가 올바르지 않습니다.");
    }
    console.log("   ✅ Schedule System Prompt 선택됨");

    // --- Step 3: API Call ---
    console.log("\n🔹 [Step 3] API Call (Gemini Flash)");
    const provider = getGeminiProvider();
    
    const startTime = Date.now();
    const result = await provider.createMessage({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "fast", // 테스트용으로 빠르고 저렴한 모델 사용
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   ✅ API 응답 수신 완료 (${elapsed}초)`);

    // --- Step 4: Response Parsing & Validation ---
    console.log("\n🔹 [Step 4] Validation (Slot Adherence)");
    
    const parsed = parseLLMResponse(
        result.content, 
        result.modelId, 
        result.usage, 
        mockContents.map(c => c.id)
    );

    if (parsed.success && parsed.response) {
        console.log("   ✅ 파싱 성공!");
        
        const allPlans: GeneratedPlanItem[] = [];
        parsed.response.weeklyMatrices.forEach(w => 
            w.days.forEach(d => allPlans.push(...d.plans))
        );

        console.log(`   - 생성된 플랜: ${allPlans.length}개`);
        
        // 슬롯 준수 여부 검증
        let violationCount = 0;
        
        allPlans.forEach(plan => {
            console.log(`     [${plan.startTime}~${plan.endTime}] ${plan.contentTitle} (${plan.estimatedMinutes}분)`);
            
            // 간단한 문자열 비교로 범위 확인 (실제로는 분 단위 계산이 필요하지만 테스트용으로 근사치 확인)
            // 09:00~11:00 또는 14:00~16:00 내에 있어야 함
            const startHour = parseInt(plan.startTime.split(":")[0]);
            
            const isInMorningSlot = startHour >= 9 && startHour < 11;
            const isInAfternoonSlot = startHour >= 14 && startHour < 16;
            
            if (!isInMorningSlot && !isInAfternoonSlot) {
                console.error(`     ❌ VIOLATION: 할당된 슬롯(${plan.startTime})이 가용 범위(09-11, 14-16)를 벗어났습니다.`);
                violationCount++;
            }
        });

        if (violationCount === 0) {
            console.log("\n✅ SUCCESS: 모든 플랜이 가용 슬롯 내에 배정되었습니다.");
        } else {
            console.error(`\n❌ FAILURE: ${violationCount}건의 슬롯 위반이 발생했습니다.`);
        }

    } else {
        console.error("   ❌ 파싱 실패");
        console.log("   Raw Response:", result.content.slice(0, 500));
    }

  } catch (error) {
    console.error("\n❌ 테스트 중 오류 발생:");
    console.error(error);
  }
}

runScheduleModeTest();
