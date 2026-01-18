/**
 * 전체 플랜 생성 플로우 테스트 (학생 연결 없이)
 *
 * 플로우:
 * 1. 콜드 스타트 → 콘텐츠 추천
 * 2. 추천 결과 → 가상 ContentInfo 생성
 * 3. SchedulerEngine → 플랜 스케줄링
 * 4. 결과 출력
 *
 * 실행: npx tsx scripts/test-full-plan-flow.ts
 */

import * as fs from "fs";
import * as path from "path";

// .env.local 파일을 직접 파싱
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});
Object.assign(process.env, envVars);

import { runColdStartPipeline } from "../lib/domains/plan/llm/actions/coldStart/pipeline";
import { SchedulerEngine, type SchedulerContext } from "../lib/scheduler/SchedulerEngine";
import type { ContentInfo, BlockInfo } from "../lib/plan/scheduler";

async function main() {
  console.log("\n🚀 전체 플랜 생성 플로우 테스트 (학생 연결 없이)\n");
  console.log("=".repeat(70));

  // 환경변수 확인
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("❌ GOOGLE_API_KEY가 설정되지 않았습니다.");
    process.exit(1);
  }
  console.log("✅ API 키 확인됨");
  console.log("=".repeat(70));

  // ============================================================
  // Step 1: 콜드 스타트 → 콘텐츠 추천
  // ============================================================
  console.log("\n📚 Step 1: 콜드 스타트 콘텐츠 추천\n");

  const coldStartResult = await runColdStartPipeline(
    {
      subjectCategory: "수학",
      subject: "미적분",
      difficulty: "개념",
      contentType: "book",
    },
    { useMock: false, saveToDb: true, tenantId: null }
  );

  if (!coldStartResult.success) {
    console.error(`❌ 콜드 스타트 실패: ${coldStartResult.error}`);
    process.exit(1);
  }

  console.log("✅ 콜드 스타트 성공!");
  console.log(`   검색 쿼리: ${coldStartResult.stats.searchQuery}`);
  console.log(`   추천 개수: ${coldStartResult.recommendations.length}개\n`);

  coldStartResult.recommendations.forEach((rec, i) => {
    console.log(`   ${i + 1}. ${rec.title}`);
    console.log(`      타입: ${rec.contentType}, 범위: ${rec.totalRange}`);
  });

  // DB 저장 결과 출력
  if (coldStartResult.persistence) {
    console.log("\n   📦 DB 저장 결과:");
    console.log(`      새로 저장: ${coldStartResult.persistence.newlySaved}개`);
    console.log(`      중복 스킵: ${coldStartResult.persistence.duplicatesSkipped}개`);
    if (coldStartResult.persistence.savedIds.length > 0) {
      console.log(`      저장된 ID: ${coldStartResult.persistence.savedIds.slice(0, 3).join(", ")}${coldStartResult.persistence.savedIds.length > 3 ? "..." : ""}`);
    }
    if (coldStartResult.persistence.errors.length > 0) {
      console.log(`      ⚠️ 오류: ${coldStartResult.persistence.errors.length}건`);
      coldStartResult.persistence.errors.forEach((err) => {
        console.log(`         - ${err.title}: ${err.error}`);
      });
    }
  }

  console.log("\n" + "=".repeat(70));

  // ============================================================
  // Step 2: 가상 ContentInfo 생성
  // ============================================================
  console.log("\n📦 Step 2: 가상 ContentInfo 생성\n");

  // 현실적인 학습 범위 계산
  // - 30일 기간, 일일 180분 기준
  // - 책: 페이지당 약 4분, 강의: 회차당 약 30분
  // - 첫 번째 콘텐츠만 선택 (집중 학습)
  const PAGES_PER_MINUTE = 0.25; // 4분에 1페이지
  const LECTURES_PER_MINUTE = 1 / 30; // 30분에 1강
  const DAILY_MINUTES = 180;
  const STUDY_DAYS = 22; // 30일 중 약 22일 학습 (주말 제외 일부)
  const TOTAL_AVAILABLE_MINUTES = DAILY_MINUTES * STUDY_DAYS;

  // 첫 번째 콘텐츠만 선택하여 현실적인 범위로 조정
  const firstRec = coldStartResult.recommendations[0];
  const maxRange = firstRec.contentType === "book"
    ? Math.floor(TOTAL_AVAILABLE_MINUTES * PAGES_PER_MINUTE)
    : Math.floor(TOTAL_AVAILABLE_MINUTES * LECTURES_PER_MINUTE);
  const adjustedRange = Math.min(firstRec.totalRange, maxRange);

  console.log("📊 현실적 범위 계산:");
  console.log(`   총 가용 시간: ${TOTAL_AVAILABLE_MINUTES}분 (${STUDY_DAYS}일 × ${DAILY_MINUTES}분)`);
  console.log(`   ${firstRec.contentType === "book" ? "페이지" : "강의"}당 시간: ${firstRec.contentType === "book" ? "4분" : "30분"}`);
  console.log(`   최대 가능 범위: ${maxRange}, 조정된 범위: ${adjustedRange}\n`);

  // SchedulerEngine이 사용하는 ContentInfo 형식 (lib/plan/scheduler.ts)
  const contents: ContentInfo[] = [{
    content_id: "virtual-1",
    content_type: firstRec.contentType as "book" | "lecture",
    start_range: 1,
    end_range: adjustedRange,
    total_amount: adjustedRange,
    subject: "미적분",
    subject_category: "수학",
  }];

  // 타이틀 매핑 (출력용)
  const titleMap: Record<string, string> = {
    "virtual-1": firstRec.title,
  };

  console.log("✅ ContentInfo 생성 완료:");
  contents.forEach((c) => {
    console.log(`   - ${titleMap[c.content_id]} (${c.content_type})`);
    console.log(`     ID: ${c.content_id}, 범위: 1-${c.end_range} (${c.total_amount})`);
  });

  console.log("\n" + "=".repeat(70));

  // ============================================================
  // Step 3: 스케줄링 컨텍스트 설정
  // ============================================================
  console.log("\n📅 Step 3: 스케줄링 컨텍스트 설정\n");

  const today = new Date();
  const startDate = today.toISOString().split("T")[0];
  const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // 기본 블록 설정 (1일 3시간)
  const blocks: BlockInfo[] = [
    {
      id: "block-1",
      name: "오전 학습",
      dayOfWeek: [1, 2, 3, 4, 5], // 월~금
      startTime: "09:00",
      endTime: "10:30",
      duration: 90,
    },
    {
      id: "block-2",
      name: "오후 학습",
      dayOfWeek: [1, 2, 3, 4, 5], // 월~금
      startTime: "14:00",
      endTime: "15:30",
      duration: 90,
    },
    {
      id: "block-3",
      name: "주말 학습",
      dayOfWeek: [6], // 토요일
      startTime: "10:00",
      endTime: "13:00",
      duration: 180,
    },
  ];

  const context: SchedulerContext = {
    periodStart: startDate,
    periodEnd: endDate,
    exclusions: [], // 제외일 없음
    blocks,
    academySchedules: [], // 학원 일정 없음
    contents,
    options: {
      studyDayRatio: 6,  // 학습일 6일
      reviewDayRatio: 1, // 복습일 1일
      dailyStudyMinutes: 180,
    },
  };

  console.log("✅ 스케줄링 컨텍스트 설정 완료:");
  console.log(`   기간: ${startDate} ~ ${endDate} (30일)`);
  console.log(`   블록: ${blocks.length}개`);
  console.log(`   콘텐츠: ${contents.length}개`);
  console.log(`   일일 학습: 180분`);
  console.log(`   학습:복습 비율: 6:1`);

  console.log("\n" + "=".repeat(70));

  // ============================================================
  // Step 4: SchedulerEngine 실행
  // ============================================================
  console.log("\n🔧 Step 4: SchedulerEngine 실행\n");

  const engine = new SchedulerEngine(context);

  // SchedulerEngine 내부 디버그 로그 억제
  const originalLog = console.log;
  const originalWarn = console.warn;
  const filterSchedulerLog = (...args: unknown[]) => {
    const msg = String(args[0] || "");
    if (!msg.includes("[SchedulerEngine") && !msg.includes("rangeMap")) {
      originalLog(...args);
    }
  };
  const filterSchedulerWarn = (...args: unknown[]) => {
    const msg = String(args[0] || "");
    if (!msg.includes("[SchedulerEngine") && !msg.includes("rangeMap")) {
      originalWarn(...args);
    }
  };
  console.log = filterSchedulerLog;
  console.warn = filterSchedulerWarn;

  originalLog("   플랜 생성 중...");
  const allPlans = engine.generate();

  // 로그 복원
  console.log = originalLog;
  console.warn = originalWarn;
  console.log(`   ✅ 총 플랜: ${allPlans.length}개 생성됨`);

  // 실패 원인 확인 (그룹화하여 요약)
  const failures = engine.getFailureReasons();
  if (failures.length > 0) {
    // 타입별로 그룹화
    const failuresByType = failures.reduce((acc, f) => {
      acc[f.type] = (acc[f.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`\n   ⚠️ 경고 요약: ${failures.length}개`);
    Object.entries(failuresByType).forEach(([type, count]) => {
      const description = type === "insufficient_time"
        ? "시간 부족 (콘텐츠량 > 가용 시간)"
        : type;
      console.log(`      - ${description}: ${count}건`);
    });

    // 첫 번째 insufficient_time 경고의 상세 정보 표시
    const firstInsufficient = failures.find((f) => f.type === "insufficient_time");
    if (firstInsufficient && "requiredMinutes" in firstInsufficient) {
      console.log(`\n   💡 개선 제안:`);
      console.log(`      - 학습 기간 연장 또는 콘텐츠 범위 축소`);
      console.log(`      - 일일 학습 블록 추가`);
    }
  }

  console.log("\n" + "=".repeat(70));

  // ============================================================
  // Step 5: 결과 출력
  // ============================================================
  console.log("\n📋 Step 5: 스케줄링 결과\n");

  // 날짜별 그룹화
  const plansByDate = new Map<string, typeof allPlans>();
  allPlans.forEach((plan) => {
    const existing = plansByDate.get(plan.plan_date) || [];
    existing.push(plan);
    plansByDate.set(plan.plan_date, existing);
  });

  // 첫 7일만 출력
  const sortedDates = Array.from(plansByDate.keys()).sort().slice(0, 7);

  console.log("📅 첫 7일 학습 계획:\n");
  sortedDates.forEach((date) => {
    const plans = plansByDate.get(date)!;
    const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][new Date(date).getDay()];
    const isReview = plans.some((p) => p.date_type === "review");

    console.log(`   ${date} (${dayOfWeek}) ${isReview ? "📝 복습일" : "📖 학습일"}`);
    plans.forEach((plan) => {
      const title = titleMap[plan.content_id]?.substring(0, 25) || plan.content_id;
      const rangeStr = plan.content_type === "book"
        ? `p.${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`
        : `${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}강`;

      console.log(`      └─ ${title} (${rangeStr})`);
    });
  });

  // 통계 요약
  console.log("\n📊 통계 요약:");
  const totalPages = allPlans
    .filter((p) => p.content_type === "book")
    .reduce((sum, p) => sum + (p.planned_end_page_or_time - p.planned_start_page_or_time + 1), 0);
  const totalLectures = allPlans
    .filter((p) => p.content_type === "lecture")
    .reduce((sum, p) => sum + (p.planned_end_page_or_time - p.planned_start_page_or_time + 1), 0);

  console.log(`   총 학습일: ${plansByDate.size}일`);
  console.log(`   총 플랜: ${allPlans.length}개`);
  console.log(`   총 페이지: ${totalPages}페이지`);
  console.log(`   총 강의: ${totalLectures}강`);

  console.log("\n" + "=".repeat(70));
  console.log("\n✨ 전체 플로우 테스트 완료!\n");

  console.log("🎯 다음 단계:");
  console.log("   1. 이 플랜을 DB에 저장하려면 학생 연결 필요");
  console.log("   2. UI에서 플랜 생성 위저드 사용");
  console.log("   3. 또는 generatePlanWithAI() 호출\n");
}

main().catch(console.error);
