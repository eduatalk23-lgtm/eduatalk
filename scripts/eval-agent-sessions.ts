#!/usr/bin/env tsx
// ============================================
// 에이전트 세션 배치 평가 스크립트
// Usage:
//   npx tsx scripts/eval-agent-sessions.ts [options]
//   --date=YYYY-MM-DD  평가 대상 날짜 (기본: 어제)
//   --limit=N          최대 평가 건수 (기본: 20)
//   --dry-run          대상만 확인, 평가 실행 안 함
//   --delay=N          요청 간 딜레이 ms (기본: 5000)
// ============================================

import {
  getSessionsForEvaluation,
  evaluateSession,
  saveEvaluation,
} from "../lib/agents/evaluation/evaluator";

const args = process.argv.slice(2);

const dateArg = args.find((a) => a.startsWith("--date="))?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const delayArg = args.find((a) => a.startsWith("--delay="))?.split("=")[1];
const isDryRun = args.includes("--dry-run");

// 기본: 어제 (KST)
function getYesterday(): string {
  const now = new Date();
  now.setHours(now.getHours() + 9); // UTC → KST
  now.setDate(now.getDate() - 1);
  return now.toISOString().split("T")[0];
}

const targetDate = dateArg ?? getYesterday();
const limit = parseInt(limitArg ?? "20", 10);
const delayMs = parseInt(delayArg ?? "5000", 10);

async function main() {
  console.log(`\n🔍 에이전트 세션 평가 스크립트`);
  console.log(`   대상 날짜: ${targetDate}`);
  console.log(`   최대 건수: ${limit}`);
  console.log(`   모드: ${isDryRun ? "DRY RUN (평가 실행 안 함)" : "실행"}\n`);

  // 1. 대상 세션 조회
  const sessions = await getSessionsForEvaluation(targetDate, limit);
  console.log(`📋 평가 대상 세션: ${sessions.length}건\n`);

  if (sessions.length === 0) {
    console.log("✅ 평가할 세션이 없습니다.\n");
    process.exit(0);
  }

  // 세션 목록 출력
  for (const s of sessions) {
    const student = s.students;
    const name = student?.name ?? "미상";
    const grade = student?.grade ? `${student.grade}학년` : "";
    const major = student?.target_major ?? "";
    console.log(`  - ${s.id.slice(0, 8)}... | ${name} ${grade} ${major} | ${s.total_steps}스텝`);
  }
  console.log("");

  if (isDryRun) {
    console.log("🏁 DRY RUN 완료. 실제 평가를 실행하려면 --dry-run을 제거하세요.\n");
    process.exit(0);
  }

  // 2. 순차 평가
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const label = `[${i + 1}/${sessions.length}]`;

    try {
      console.log(`${label} 평가 중: ${session.id.slice(0, 8)}...`);
      const result = await evaluateSession(session);

      if (!result) {
        console.log(`${label} ⏭️ 건너뜀 (대화 내역 부족)`);
        skipped++;
        continue;
      }

      const saved = await saveEvaluation(session.id, result);
      if (saved) {
        console.log(
          `${label} ✅ 완료 | overall=${result.scores.overall} | ` +
          `진단=${result.scores.diagnosis_accuracy} 전략=${result.scores.strategy_realism} ` +
          `고려=${result.scores.student_consideration}`,
        );
        success++;
      } else {
        console.log(`${label} ❌ DB 저장 실패`);
        failed++;
      }
    } catch (error) {
      console.error(`${label} ❌ 에러:`, error instanceof Error ? error.message : error);
      failed++;
    }

    // 요청 간 딜레이 (마지막 제외)
    if (i < sessions.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // 3. 결과 요약
  console.log(`\n📊 평가 결과 요약`);
  console.log(`   성공: ${success}건`);
  console.log(`   실패: ${failed}건`);
  console.log(`   건너뜀: ${skipped}건`);
  console.log(`   총: ${sessions.length}건\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("치명적 에러:", error);
  process.exit(1);
});
