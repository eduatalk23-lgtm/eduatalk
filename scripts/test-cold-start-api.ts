/**
 * Cold Start API 실제 테스트 스크립트
 *
 * 실행: npx tsx scripts/test-cold-start-api.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { runColdStartPipeline } from "../lib/domains/plan/llm/actions/coldStart/pipeline";

async function main() {
  console.log("\n🚀 Cold Start 실제 API 테스트 시작\n");
  console.log("=" .repeat(60));

  // API 키 확인
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("❌ GOOGLE_API_KEY가 설정되지 않았습니다.");
    process.exit(1);
  }
  console.log(`✅ API 키 확인됨: ${apiKey.substring(0, 10)}...`);
  console.log("=" .repeat(60));

  // 시나리오 1: 수학 미적분 개념서
  console.log("\n📚 시나리오 1: 수학 미적분 개념서 추천\n");
  try {
    const result1 = await runColdStartPipeline(
      {
        subjectCategory: "수학",
        subject: "미적분",
        difficulty: "개념",
        contentType: "book",
      },
      { useMock: false }
    );

    if (result1.success) {
      console.log("✅ 성공!");
      console.log(`   검색 쿼리: ${result1.stats.searchQuery}`);
      console.log(`   발견: ${result1.stats.totalFound}개 → 필터 후: ${result1.stats.filtered}개`);
      console.log(`   소요 시간: ${result1.stats.durationMs}ms\n`);

      console.log("📖 추천 목록:");
      result1.recommendations.forEach((rec) => {
        console.log(`   ${rec.rank}. ${rec.title}`);
        console.log(`      타입: ${rec.contentType}, 총 범위: ${rec.totalRange}`);
        console.log(`      점수: ${rec.matchScore}, 챕터: ${rec.chapters.length}개`);
        console.log(`      이유: ${rec.reason}\n`);
      });
    } else {
      console.log(`❌ 실패: ${result1.error}`);
      console.log(`   실패 단계: ${result1.failedAt}`);
    }
  } catch (error) {
    console.error("❌ 에러:", error);
  }

  console.log("\n" + "=" .repeat(60));

  // 시나리오 2: 영어 인강
  console.log("\n📚 시나리오 2: 영어 기본 인강 추천\n");
  try {
    const result2 = await runColdStartPipeline(
      {
        subjectCategory: "영어",
        difficulty: "기본",
        contentType: "lecture",
      },
      {
        useMock: false,
        preferences: { contentType: "lecture", maxResults: 3 }
      }
    );

    if (result2.success) {
      console.log("✅ 성공!");
      console.log(`   검색 쿼리: ${result2.stats.searchQuery}`);
      console.log(`   발견: ${result2.stats.totalFound}개 → 필터 후: ${result2.stats.filtered}개\n`);

      console.log("🎬 추천 목록:");
      result2.recommendations.forEach((rec) => {
        console.log(`   ${rec.rank}. ${rec.title}`);
        console.log(`      강의 수: ${rec.totalRange}강, 점수: ${rec.matchScore}`);
        console.log(`      이유: ${rec.reason}\n`);
      });
    } else {
      console.log(`❌ 실패: ${result2.error}`);

      // Rate limit 체크
      if (result2.error?.includes("429") || result2.error?.includes("quota")) {
        console.log("⚠️ API 호출 한도 초과 - 잠시 후 다시 시도해주세요");
      }
    }
  } catch (error) {
    console.error("❌ 에러:", error);
  }

  console.log("\n" + "=" .repeat(60));
  console.log("\n✨ 테스트 완료\n");
}

main().catch(console.error);
