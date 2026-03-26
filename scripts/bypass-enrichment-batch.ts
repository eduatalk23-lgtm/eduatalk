#!/usr/bin/env npx tsx
/**
 * 우회학과 교육과정 배치 enrichment 스크립트
 *
 * 주요 대학의 교육과정 미보유 학과를 웹 검색으로 확충.
 *
 * 사용법:
 *   npx tsx scripts/bypass-enrichment-batch.ts [options]
 *
 * 옵션:
 *   --dry-run         실제 API 호출 없이 대상만 확인
 *   --mid=<분류>       특정 중분류만 처리 (기본: 전기·전자·컴퓨터)
 *   --limit=N          처리 대상 제한 (기본: 전체)
 *   --delay=N          요청 간 딜레이 ms (기본: 3000)
 *   --all-mid          전체 중분류 처리
 *
 * 예시:
 *   npx tsx scripts/bypass-enrichment-batch.ts --dry-run
 *   npx tsx scripts/bypass-enrichment-batch.ts --mid=전기·전자·컴퓨터 --limit=10
 *   npx tsx scripts/bypass-enrichment-batch.ts --all-mid --limit=50
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TOP_UNIVERSITIES = [
  "서울대학교", "연세대학교", "고려대학교", "성균관대학교", "서강대학교",
  "한양대학교", "중앙대학교", "경희대학교", "한국외국어대학교", "서울시립대학교",
  "건국대학교", "동국대학교", "숙명여자대학교", "이화여자대학교", "부산대학교",
  "인하대학교", "아주대학교", "숭실대학교", "광운대학교", "세종대학교",
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const allMid = args.includes("--all-mid");
  const midArg = args.find((a) => a.startsWith("--mid="))?.split("=")[1];
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const delayArg = args.find((a) => a.startsWith("--delay="))?.split("=")[1];

  const limit = limitArg ? parseInt(limitArg, 10) : Infinity;
  const delay = delayArg ? parseInt(delayArg, 10) : 3000;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 대상 학과 조회
  let query = supabase
    .from("university_departments")
    .select("id, university_name, department_name, mid_classification")
    .in("university_name", TOP_UNIVERSITIES);

  if (!allMid) {
    const mid = midArg ?? "전기·전자·컴퓨터";
    query = query.eq("mid_classification", mid);
  }

  const { data: allDepts } = await query;
  if (!allDepts || allDepts.length === 0) {
    console.log("대상 학과 없음");
    return;
  }

  // 교육과정 보유 학과 제외
  const { data: withCurr } = await supabase
    .from("department_curriculum")
    .select("department_id")
    .in("department_id", allDepts.map((d) => d.id));

  const hasCurr = new Set((withCurr ?? []).map((c) => c.department_id));
  const targets = allDepts.filter((d) => !hasCurr.has(d.id)).slice(0, limit);

  console.log(`\n=== 우회학과 교육과정 배치 enrichment ===`);
  console.log(`대상: ${targets.length}개 학과 (전체 ${allDepts.length}개 중 교육과정 미보유)`);
  console.log(`모드: ${dryRun ? "DRY-RUN" : "LIVE"}\n`);

  for (const dept of targets) {
    console.log(`  ${dept.university_name} ${dept.department_name} [${dept.mid_classification}]`);
  }

  if (dryRun) {
    console.log(`\n--dry-run 모드: 실제 API 호출 없이 종료`);
    return;
  }

  // enrichment 실행
  const { enrichDepartmentCurriculum } = await import(
    "../lib/domains/bypass-major/enrichment/service"
  );

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < targets.length; i++) {
    const dept = targets[i];
    const label = `[${i + 1}/${targets.length}] ${dept.university_name} ${dept.department_name}`;

    try {
      const result = await enrichDepartmentCurriculum(dept.id, { maxTier: 3 });
      if (result && result.coursesAdded > 0) {
        console.log(`  ✓ ${label}: ${result.coursesAdded}건 (${result.tier}, confidence=${result.confidence})`);
        success++;
      } else if (result?.cached) {
        console.log(`  - ${label}: 캐시 (기존 데이터 유효)`);
        skipped++;
      } else {
        console.log(`  ✗ ${label}: 교육과정 추출 실패`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ ${label}: ${err}`);
      failed++;
    }

    // rate limit 대기
    if (i < targets.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${success}, 실패: ${failed}, 스킵: ${skipped}`);
}

main().catch(console.error);
