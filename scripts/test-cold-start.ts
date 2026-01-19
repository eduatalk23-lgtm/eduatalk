/**
 * Cold Start 파이프라인 테스트 스크립트
 * 실행: npx tsx scripts/test-cold-start.ts
 */

import { runColdStartPipeline } from "../lib/domains/plan/llm/actions/coldStart";

async function main() {
  console.log("=== Cold Start 파이프라인 테스트 ===\n");

  const input = {
    subjectCategory: "수학" as const,
    subject: "미적분",
    difficulty: "개념" as const,
    contentType: "lecture" as const, // 인강 중심
  };

  console.log("입력 조건:");
  console.log(JSON.stringify(input, null, 2));
  console.log("\n파이프라인 실행 중...\n");

  try {
    const result = await runColdStartPipeline(input, {
      saveToDb: false, // 테스트이므로 DB 저장 안 함
      enableFallback: true,
      useMock: true, // API 키 없이 Mock 데이터로 테스트
    });

    if (result.success) {
      console.log("✅ 성공!\n");
      console.log("=== 추천 결과 ===");
      console.log(`총 ${result.recommendations.length}개 추천\n`);

      result.recommendations.forEach((rec, i) => {
        console.log(`[${i + 1}] ${rec.title}`);
        console.log(`    타입: ${rec.contentType}`);
        console.log(`    총 범위: ${rec.totalRange}${rec.contentType === "book" ? "페이지" : "강"}`);
        console.log(`    점수: ${rec.matchScore}`);
        console.log(`    추천 이유: ${rec.reason}`);
        if (rec.author) console.log(`    저자/강사: ${rec.author}`);
        if (rec.publisher) console.log(`    출판사/플랫폼: ${rec.publisher}`);
        if (rec.chapters && rec.chapters.length > 0) {
          console.log(`    목차 (${rec.chapters.length}개 단원):`);
          rec.chapters.slice(0, 5).forEach((ch) => {
            console.log(`      - ${ch.title} (${ch.startRange}-${ch.endRange})`);
          });
          if (rec.chapters.length > 5) {
            console.log(`      ... 외 ${rec.chapters.length - 5}개`);
          }
        }
        console.log("");
      });

      console.log("=== 통계 ===");
      console.log(JSON.stringify(result.stats, null, 2));
    } else {
      console.log("❌ 실패");
      console.log("에러:", result.error);
      if (result.failedAt) {
        console.log("실패 단계:", result.failedAt);
      }
    }
  } catch (error) {
    console.error("실행 중 오류 발생:", error);
  }
}

main();
