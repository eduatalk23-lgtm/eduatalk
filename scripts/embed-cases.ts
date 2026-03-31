#!/usr/bin/env tsx
// ============================================
// 케이스 메모리 배치 임베딩 스크립트
// Usage:
//   npx tsx scripts/embed-cases.ts [options]
//   --limit=N    최대 처리 건수 (기본: 50)
//   --dry-run    대상만 확인
// ============================================

import { embedBatchCases, embedPendingCorrections } from "../lib/agents/memory/embedding-service";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const isDryRun = args.includes("--dry-run");

const limit = parseInt(limitArg ?? "50", 10);

async function main() {
  console.log(`\n🔍 케이스 메모리 배치 임베딩`);
  console.log(`   최대 건수: ${limit}`);
  console.log(`   모드: ${isDryRun ? "DRY RUN" : "실행"}\n`);

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ Admin client 생성 실패");
    process.exit(1);
  }

  // pending 상태 케이스 조회
  const { data: pendingCases, count } = await supabase
    .from("consulting_cases")
    .select("id, target_major, student_grade", { count: "exact" })
    .eq("embedding_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  console.log(`📋 대기 중: ${count ?? 0}건 (처리 대상: ${pendingCases?.length ?? 0}건)\n`);

  if (!pendingCases || pendingCases.length === 0) {
    console.log("✅ 임베딩할 케이스가 없습니다.\n");
    process.exit(0);
  }

  for (const c of pendingCases) {
    const major = c.target_major ?? "전공 미정";
    const grade = c.student_grade ? `${c.student_grade}학년` : "";
    console.log(`  - ${c.id.slice(0, 8)}... | ${grade} ${major}`);
  }
  console.log("");

  if (isDryRun) {
    console.log("🏁 DRY RUN 완료.\n");
    process.exit(0);
  }

  const caseIds = pendingCases.map((c) => c.id);
  const { success, failed } = await embedBatchCases(caseIds);

  console.log(`\n📊 케이스 결과: 성공 ${success}건 / 실패 ${failed}건`);

  // 교정 피드백 임베딩도 함께 처리
  console.log(`\n🔧 교정 피드백 임베딩 처리 중...`);
  const corrResult = await embedPendingCorrections(limit);
  console.log(`📊 교정 결과: 성공 ${corrResult.success}건 / 실패 ${corrResult.failed}건\n`);

  process.exit(failed > 0 || corrResult.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("치명적 에러:", error);
  process.exit(1);
});
