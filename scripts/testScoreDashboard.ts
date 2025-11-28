/**
 * 성적 대시보드 API 테스트 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/testScoreDashboard.ts [studentId] [tenantId] [termId]
 * 
 * 또는 seed 스크립트에서 출력된 정보를 사용:
 * npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> <termId>
 */

import { config } from "dotenv";
import path from "path";

// .env.local 파일 로드
config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * API 호출 및 결과 출력
 */
async function testScoreDashboard(
  studentId: string,
  tenantId: string,
  termId?: string
) {
  const url = `${BASE_URL}/api/students/${studentId}/score-dashboard?tenantId=${tenantId}${
    termId ? `&termId=${termId}` : ""
  }`;

  console.log(`\n🔍 API 호출: ${url}\n`);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ API 호출 실패:");
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${JSON.stringify(data, null, 2)}`);
      return;
    }

    console.log("=".repeat(80));
    console.log("📊 성적 대시보드 API 응답");
    console.log("=".repeat(80) + "\n");

    // 학생 프로필
    console.log("👤 학생 프로필:");
    console.log(`   ID: ${data.studentProfile?.id}`);
    console.log(`   이름: ${data.studentProfile?.name}`);
    console.log(`   학년: ${data.studentProfile?.grade || "N/A"}`);
    console.log(`   학교 유형: ${data.studentProfile?.schoolType || "N/A"}`);
    console.log("");

    // 내신 분석
    console.log("📚 내신 분석:");
    console.log(`   전체 GPA: ${data.internalAnalysis?.totalGpa?.toFixed(2) || "N/A"}`);
    console.log(`   Z-Index: ${data.internalAnalysis?.zIndex?.toFixed(2) || "N/A"}`);
    console.log("   교과군별 GPA:");
    if (data.internalAnalysis?.subjectStrength) {
      for (const [subject, gpa] of Object.entries(
        data.internalAnalysis.subjectStrength
      )) {
        console.log(`     - ${subject}: ${Number(gpa).toFixed(2)}`);
      }
    }
    console.log("");

    // 모의고사 분석
    console.log("📝 모의고사 분석:");
    if (data.mockAnalysis?.recentExam) {
      console.log(
        `   최근 시험: ${data.mockAnalysis.recentExam.examTitle} (${data.mockAnalysis.recentExam.examDate})`
      );
    } else {
      console.log("   최근 시험: N/A");
    }
    console.log(
      `   평균 백분위: ${data.mockAnalysis?.avgPercentile?.toFixed(2) || "N/A"}`
    );
    console.log(
      `   표준점수 합: ${data.mockAnalysis?.totalStdScore?.toFixed(2) || "N/A"}`
    );
    console.log(
      `   상위 3개 등급 합: ${data.mockAnalysis?.best3GradeSum || "N/A"}`
    );
    console.log("");

    // 전략 분석
    console.log("🎯 수시/정시 전략 분석:");
    console.log(`   전략 유형: ${data.strategyResult?.type || "N/A"}`);
    console.log(`   메시지: ${data.strategyResult?.message || "N/A"}`);
    if (data.strategyResult?.data) {
      console.log("   데이터:");
      console.log(
        `     - 내신 환산 백분위: ${data.strategyResult.data.internalPct?.toFixed(2) || "N/A"}`
      );
      console.log(
        `     - 모의고사 평균 백분위: ${data.strategyResult.data.mockPct?.toFixed(2) || "N/A"}`
      );
      console.log(
        `     - 차이: ${data.strategyResult.data.diff?.toFixed(2) || "N/A"}`
      );
    }
    console.log("");

    console.log("=".repeat(80));
    console.log("✅ API 테스트 완료!");
    console.log("=".repeat(80) + "\n");
  } catch (error: any) {
    console.error("❌ API 호출 중 오류:", error.message);
    console.error(error);
  }
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("❌ 사용법:");
    console.error(
      "   npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> [termId]"
    );
    console.error("\n예시:");
    console.error(
      "   npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> <termId>"
    );
    process.exit(1);
  }

  const [studentId, tenantId, termId] = args;

  await testScoreDashboard(studentId, tenantId, termId);
}

// 스크립트 실행
main().catch((error) => {
  console.error("❌ 스크립트 실행 중 오류:", error);
  process.exit(1);
});

