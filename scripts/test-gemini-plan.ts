/**
 * Gemini API 플랜 생성 테스트 스크립트 (웹 검색 포함)
 *
 * 실행: npx tsx scripts/test-gemini-plan.ts
 * 옵션:
 *   - npx tsx scripts/test-gemini-plan.ts fast      # 빠른 모델 (기본값)
 *   - npx tsx scripts/test-gemini-plan.ts standard  # 표준 모델
 *   - npx tsx scripts/test-gemini-plan.ts advanced  # 고급 모델
 */

import dotenv from "dotenv";
import path from "path";

// .env.local 먼저 로드
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// 환경 변수 확인
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY가 .env.local에 설정되지 않았습니다.");
  console.log("\n설정 방법:");
  console.log("1. .env.local 파일을 열고");
  console.log("2. GOOGLE_API_KEY=your_api_key_here 추가");
  console.log("\nAPI 키 발급: https://aistudio.google.com/apikey");
  process.exit(1);
}

console.log("✅ GOOGLE_API_KEY 확인됨");

import { getGeminiProvider } from "../lib/domains/plan/llm/providers/gemini";
import type { ModelTier } from "../lib/domains/plan/llm/types";

// 테스트 데이터
const TEST_SYSTEM_PROMPT = `당신은 학생의 학습 계획을 생성하는 AI 튜터입니다.
학생의 상황과 목표에 맞는 맞춤형 학습 계획을 제안해 주세요.

응답 형식:
- 명확하고 실행 가능한 계획
- 시간 배분 포함
- 동기 부여 메시지 포함`;

const TEST_USER_MESSAGE = `아래 학생의 학습 계획을 세워주세요:

학생 정보:
- 이름: 김민수
- 학년: 고등학교 2학년
- 목표: 서울대학교 컴퓨터공학과 진학

과목 상황:
- 수학: 상위 15% (강점)
- 영어: 상위 30% (보통)
- 국어: 상위 50% (약점)

학습 기간: 2026년 1월 15일 ~ 1월 21일 (1주일)
하루 가용 학습 시간: 4시간

추가 요청:
- 최신 수능 트렌드를 반영해 주세요
- 국어 성적 향상에 중점을 두어주세요`;

async function runGeminiTest(modelTier: ModelTier = "fast", enableWebSearch = false) {
  console.log("\n" + "=".repeat(70));
  console.log(`🚀 Gemini API 테스트 시작`);
  console.log(`   모델 티어: ${modelTier}`);
  console.log(`   웹 검색: ${enableWebSearch ? "✅ 활성화 (Grounding)" : "❌ 비활성화"}`);
  console.log("=".repeat(70));

  const provider = getGeminiProvider();

  // 상태 확인
  const status = provider.getStatus();
  console.log(`\n[1] Provider 상태 확인:`);
  console.log(`   사용 가능: ${status.available ? "✅" : "❌"}`);
  console.log(`   API 키: ${status.hasApiKey ? "✅ 설정됨" : "❌ 없음"}`);

  if (!status.available) {
    console.error(`   오류: ${status.errorMessage}`);
    return;
  }

  // 모델 설정
  const config = provider.getModelConfig(modelTier);
  console.log(`\n[2] 모델 설정:`);
  console.log(`   모델 ID: ${config.modelId}`);
  console.log(`   최대 토큰: ${config.maxTokens}`);
  console.log(`   Temperature: ${config.temperature}`);

  // 비용 정보
  const costInfo = provider.getCostInfo(modelTier);
  console.log(`\n[3] 비용 정보 (1M 토큰당):`);
  console.log(`   입력: $${costInfo.inputCostPer1M}`);
  console.log(`   출력: $${costInfo.outputCostPer1M}`);

  // API 호출
  console.log(`\n[4] API 호출 중...`);
  const startTime = Date.now();

  try {
    const result = await provider.createMessage({
      system: TEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: TEST_USER_MESSAGE }],
      modelTier,
      grounding: enableWebSearch
        ? {
            enabled: true,
            mode: "dynamic",
            dynamicThreshold: 0.3,
          }
        : undefined,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n[5] 응답 완료: ${elapsed}초`);
    console.log(`   입력 토큰: ~${result.usage.inputTokens}`);
    console.log(`   출력 토큰: ~${result.usage.outputTokens}`);
    console.log(`   종료 이유: ${result.stopReason}`);

    // 비용 계산
    const inputCost = (result.usage.inputTokens / 1_000_000) * costInfo.inputCostPer1M;
    const outputCost = (result.usage.outputTokens / 1_000_000) * costInfo.outputCostPer1M;
    const totalCost = inputCost + outputCost;
    console.log(`   예상 비용: $${totalCost.toFixed(6)}`);

    // 웹 검색 결과
    if (result.groundingMetadata) {
      console.log(`\n[6] 🔍 웹 검색 결과 (Grounding):`);
      console.log(`   검색 쿼리: ${result.groundingMetadata.searchQueries.join(", ")}`);
      console.log(`   검색 결과 수: ${result.groundingMetadata.webResults.length}`);

      if (result.groundingMetadata.webResults.length > 0) {
        console.log(`   검색된 소스:`);
        result.groundingMetadata.webResults.slice(0, 5).forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.title || "(제목 없음)"}`);
          console.log(`      URL: ${r.url}`);
        });
      }
    } else if (enableWebSearch) {
      console.log(`\n[6] ⚠️ 웹 검색이 활성화되었지만 검색 결과가 없습니다.`);
      console.log(`   모델이 검색이 불필요하다고 판단했거나, 오류가 발생했을 수 있습니다.`);
    }

    // 응답 내용
    console.log(`\n${"─".repeat(70)}`);
    console.log(`📝 생성된 응답:`);
    console.log(`${"─".repeat(70)}`);
    console.log(result.content);
    console.log(`${"─".repeat(70)}`);

    console.log("\n" + "=".repeat(70));
    console.log("✅ 테스트 완료!");
    console.log("=".repeat(70) + "\n");

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ API 호출 오류 (${elapsed}초 후):`);

    if (error instanceof Error) {
      console.error(`   메시지: ${error.message}`);

      if (error.message.includes("429") || error.message.includes("quota")) {
        console.log("\n💡 Rate Limit 오류입니다. 잠시 후 다시 시도해 주세요.");
        console.log("   Free Tier는 분당 15 요청 제한이 있습니다.");
      }
    } else {
      console.error(error);
    }
  }
}

// 스트리밍 테스트
async function runStreamingTest(modelTier: ModelTier = "fast") {
  console.log("\n" + "=".repeat(70));
  console.log(`🌊 스트리밍 테스트 시작 (모델: ${modelTier})`);
  console.log("=".repeat(70));

  const provider = getGeminiProvider();
  const startTime = Date.now();

  try {
    console.log("\n스트리밍 응답:\n");

    const result = await provider.streamMessage({
      system: "당신은 친절한 AI 어시스턴트입니다.",
      messages: [{ role: "user", content: "안녕하세요! 오늘 날씨가 어떤가요?" }],
      modelTier,
      onText: (text) => {
        process.stdout.write(text);
      },
      onComplete: (result) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n\n[완료] ${elapsed}초, 토큰: ${result.usage.outputTokens}`);
      },
      onError: (error) => {
        console.error("\n스트리밍 오류:", error.message);
      },
    });

    console.log("\n✅ 스트리밍 테스트 완료!");

  } catch (error) {
    console.error("\n❌ 스트리밍 오류:", error);
  }
}

// 메인 실행
const args = process.argv.slice(2);
const tier = (args.find(arg => ["fast", "standard", "advanced"].includes(arg)) as ModelTier) || "fast";
const enableWebSearch = args.includes("--web") || args.includes("-w");
const streamMode = args.includes("--stream") || args.includes("-s");

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║           🤖 Gemini AI 플랜 생성 테스트 스크립트                   ║
╠═══════════════════════════════════════════════════════════════════╣
║ 사용법:                                                           ║
║   npx tsx scripts/test-gemini-plan.ts [옵션]                      ║
║                                                                   ║
║ 옵션:                                                             ║
║   fast      : Gemini 2.0 Flash (빠름, 저렴)                       ║
║   standard  : Gemini 2.0 Flash (표준)                             ║
║   advanced  : Gemini 1.5 Pro (고급, 비쌈)                         ║
║   --web, -w : 웹 검색 활성화 (Grounding)                          ║
║   --stream, -s : 스트리밍 모드 테스트                             ║
║                                                                   ║
║ 예시:                                                             ║
║   npx tsx scripts/test-gemini-plan.ts                             ║
║   npx tsx scripts/test-gemini-plan.ts standard --web              ║
║   npx tsx scripts/test-gemini-plan.ts fast --stream               ║
╚═══════════════════════════════════════════════════════════════════╝
`);

if (streamMode) {
  runStreamingTest(tier);
} else {
  runGeminiTest(tier, enableWebSearch);
}
