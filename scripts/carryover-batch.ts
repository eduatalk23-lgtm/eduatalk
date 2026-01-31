#!/usr/bin/env npx tsx
/**
 * 미완료 플랜 이월 배치 처리 CLI 스크립트
 *
 * 어제까지의 미완료 daily 플랜을 unfinished로 이동하고
 * carryover_count를 증가시킵니다.
 *
 * 사용법:
 *   npx tsx scripts/carryover-batch.ts [options]
 *
 * 옵션:
 *   --dry-run           실제 처리 없이 대상만 확인
 *   --tenant=ID         특정 테넌트만 처리
 *   --student=ID        특정 학생만 처리 (tenant 필수)
 *   --cutoff=YYYY-MM-DD 기준 날짜 (기본: 오늘)
 *
 * 예시:
 *   npx tsx scripts/carryover-batch.ts --dry-run
 *   npx tsx scripts/carryover-batch.ts --tenant=xxx --student=yyy
 *   npx tsx scripts/carryover-batch.ts --cutoff=2025-01-31
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// .env 파일 로드 (로컬 개발용)
config({ path: ".env.local" });
config(); // fallback to .env
import type { Database } from "../lib/supabase/database.types";

// ─────────────────────────────────────────────────────────────────────────────
// 환경 변수 검증
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 환경 변수가 설정되지 않았습니다:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Admin 클라이언트 생성 (RLS 우회)
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// CLI 인자 파싱
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const isDryRun = args.includes("--dry-run");

const tenantArg = args.find((arg) => arg.startsWith("--tenant="));
const tenantId = tenantArg ? tenantArg.split("=")[1] : undefined;

const studentArg = args.find((arg) => arg.startsWith("--student="));
const studentId = studentArg ? studentArg.split("=")[1] : undefined;

const cutoffArg = args.find((arg) => arg.startsWith("--cutoff="));
const cutoffDate = cutoffArg
  ? cutoffArg.split("=")[1]
  : new Date().toISOString().split("T")[0];

// 학생 ID가 있으면 테넌트 ID도 필수
if (studentId && !tenantId) {
  console.error("❌ --student 옵션 사용 시 --tenant도 필요합니다.");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

function log(message: string): void {
  console.log(message);
}

function logSection(title: string): void {
  console.log("\n" + "─".repeat(60));
  console.log(title);
  console.log("─".repeat(60));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `${minutes}분 ${remainingSeconds}초`
    : `${remainingSeconds}초`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

interface IncompletePlan {
  id: string;
  student_id: string;
  tenant_id: string;
  plan_date: string;
  content_title: string | null;
  custom_title: string | null;
  carryover_count: number | null;
  carryover_from_date: string | null;
}

interface CarryoverResult {
  tenantId: string;
  studentId: string;
  processedCount: number;
  plans: Array<{
    id: string;
    title: string;
    fromDate: string;
    newCarryoverCount: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 미완료 플랜 조회
// ─────────────────────────────────────────────────────────────────────────────

async function getIncompletePlans(): Promise<IncompletePlan[]> {
  let query = supabase
    .from("student_plan")
    .select(
      `
      id,
      student_id,
      tenant_id,
      plan_date,
      content_title,
      custom_title,
      carryover_count,
      carryover_from_date
    `
    )
    .eq("container_type", "daily")
    .eq("is_active", true)
    .neq("status", "completed")
    .lt("plan_date", cutoffDate)
    .order("tenant_id")
    .order("student_id")
    .order("plan_date");

  // 필터 적용
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`플랜 조회 실패: ${error.message}`);
  }

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 이월 처리
// ─────────────────────────────────────────────────────────────────────────────

async function processCarryover(
  plans: IncompletePlan[]
): Promise<CarryoverResult[]> {
  const results: CarryoverResult[] = [];
  const now = new Date().toISOString();

  // 테넌트/학생별로 그룹화
  const grouped = new Map<string, IncompletePlan[]>();
  for (const plan of plans) {
    const key = `${plan.tenant_id}:${plan.student_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(plan);
  }

  // 각 그룹 처리
  for (const [key, studentPlans] of grouped) {
    const [tId, sId] = key.split(":");
    const result: CarryoverResult = {
      tenantId: tId,
      studentId: sId,
      processedCount: 0,
      plans: [],
    };

    for (const plan of studentPlans) {
      const newCarryoverCount = (plan.carryover_count ?? 0) + 1;
      const originalDate = plan.carryover_from_date ?? plan.plan_date;

      const { error } = await supabase
        .from("student_plan")
        .update({
          container_type: "unfinished",
          carryover_count: newCarryoverCount,
          carryover_from_date: originalDate,
          updated_at: now,
        })
        .eq("id", plan.id);

      if (error) {
        log(`  ⚠️ 플랜 ${plan.id} 업데이트 실패: ${error.message}`);
        continue;
      }

      result.processedCount++;
      result.plans.push({
        id: plan.id,
        title: plan.custom_title ?? plan.content_title ?? "제목 없음",
        fromDate: plan.plan_date,
        newCarryoverCount,
      });
    }

    if (result.processedCount > 0) {
      results.push(result);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 이벤트 로깅 (plan_events 테이블)
// ─────────────────────────────────────────────────────────────────────────────

async function logCarryoverEvents(results: CarryoverResult[]): Promise<void> {
  const now = new Date().toISOString();
  const events = [];

  for (const result of results) {
    for (const plan of result.plans) {
      events.push({
        tenant_id: result.tenantId,
        student_id: result.studentId,
        plan_id: plan.id,
        event_type: "carryover",
        created_at: now,
        metadata: {
          from_date: plan.fromDate,
          to_container: "unfinished",
          carryover_count: plan.newCarryoverCount,
          batch_processed: true,
        },
      });
    }
  }

  if (events.length === 0) return;

  // 배치로 삽입 (100개씩)
  const batchSize = 100;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const { error } = await supabase.from("plan_events").insert(batch);

    if (error) {
      log(`  ⚠️ 이벤트 로깅 실패 (${i}-${i + batch.length}): ${error.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 실행
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();

  logSection("미완료 플랜 이월 배치");

  log(`기준 날짜: ${cutoffDate} (이 날짜 이전의 미완료 플랜 처리)`);
  log(`모드: ${isDryRun ? "드라이런 (미리보기)" : "실제 처리"}`);
  if (tenantId) log(`테넌트 필터: ${tenantId}`);
  if (studentId) log(`학생 필터: ${studentId}`);

  // 미완료 플랜 조회
  logSection("미완료 플랜 조회");

  const incompletePlans = await getIncompletePlans();

  if (incompletePlans.length === 0) {
    log("✅ 이월할 미완료 플랜이 없습니다.");
    return;
  }

  log(`발견된 미완료 플랜: ${incompletePlans.length}개`);

  // 드라이런: 대상만 표시
  if (isDryRun) {
    logSection("이월 대상 목록 (드라이런)");

    // 테넌트/학생별로 그룹화하여 표시
    const grouped = new Map<string, IncompletePlan[]>();
    for (const plan of incompletePlans) {
      const key = `${plan.tenant_id}:${plan.student_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(plan);
    }

    let index = 1;
    for (const [key, plans] of grouped) {
      const [tId, sId] = key.split(":");
      log(`\n[${tId.slice(0, 8)}...] 학생 ${sId.slice(0, 8)}... (${plans.length}개)`);
      for (const plan of plans.slice(0, 5)) {
        // 최대 5개만 표시
        const title = plan.custom_title ?? plan.content_title ?? "제목 없음";
        const carryover = plan.carryover_count ?? 0;
        log(
          `  ${String(index++).padStart(3)}. ${plan.plan_date} | ${title.slice(0, 30)} | 이월횟수: ${carryover}`
        );
      }
      if (plans.length > 5) {
        log(`  ... 외 ${plans.length - 5}개`);
        index += plans.length - 5;
      }
    }

    logSection("드라이런 완료");
    log(`총 ${incompletePlans.length}개 플랜이 이월 대상입니다.`);
    log(`실제 실행하려면 --dry-run 옵션을 제거하세요.`);
    return;
  }

  // 실제 처리
  logSection("이월 처리 실행");

  const results = await processCarryover(incompletePlans);

  // 이벤트 로깅
  await logCarryoverEvents(results);

  // 결과 출력
  logSection("처리 완료");

  let totalProcessed = 0;
  for (const result of results) {
    totalProcessed += result.processedCount;
    log(
      `  - 학생 ${result.studentId.slice(0, 8)}...: ${result.processedCount}개 이월`
    );
  }

  const duration = Date.now() - startTime;

  log("");
  log(`✅ 총 ${totalProcessed}개 플랜 이월 완료`);
  log(`⏱️  소요 시간: ${formatDuration(duration)}`);
}

// 실행
main().catch((error) => {
  console.error("❌ 스크립트 실행 실패:", error);
  process.exit(1);
});
