#!/usr/bin/env npx tsx
/**
 * α4 Perception Trigger dry-run CLI (2026-04-20 C 실측 검증)
 *
 * snapshot 2개 (latest + prev) 를 조회해 diff + trigger 판정 결과를 콘솔에 덤프.
 * DB 쓰기 없음. LLM 호출 없음. 완전 read-only.
 *
 * 사용법:
 *   npx tsx scripts/perception-trigger-dryrun.ts --student=<uuid>
 *   npx tsx scripts/perception-trigger-dryrun.ts --tenant=<uuid>
 *   npx tsx scripts/perception-trigger-dryrun.ts --all
 *
 * 출력:
 *   학생별 1 block 덤프. severity + triggered + reasons + delta 요약.
 *   snapshot 2개 미만 학생은 "skipped no_prior_snapshot" 표기.
 *
 * 목적:
 *   - Perception 임계값 v1 실측 분포 확인 (severity 비율)
 *   - 임계값 v2 튜닝 근거 수집
 *   - CI/cron 확장 시 원형
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필수 (admin client)
 */

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { runPerceptionTrigger } from "../lib/domains/student-record/actions/perception-scheduler";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 인자 파싱
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function arg(name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

const flagAll = args.includes("--all");
const tenantId = arg("tenant");
const studentId = arg("student");

if (!flagAll && !tenantId && !studentId) {
  console.error(
    "[perception-dryrun] 하나 이상의 대상 지정 필수: --all / --tenant=<uuid> / --student=<uuid>",
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

interface StudentRow {
  id: string;
  tenant_id: string;
}

async function main(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("[perception-dryrun] admin client 생성 실패 (env 누락)");
    process.exit(1);
  }

  let query = supabase.from("students").select("id, tenant_id");
  if (studentId) query = query.eq("id", studentId);
  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  if (error) {
    console.error(`[perception-dryrun] 학생 조회 실패: ${error.message}`);
    process.exit(1);
  }

  const students = (data ?? []) as StudentRow[];
  if (students.length === 0) {
    console.log("[perception-dryrun] 대상 학생 없음. 종료.");
    return;
  }

  console.log(`[perception-dryrun] 대상 학생 ${students.length}명\n`);

  const bucket = { none: 0, low: 0, medium: 0, high: 0, skipped: 0, error: 0 };

  for (const s of students) {
    const label = `${s.id.slice(0, 8)}…`;
    try {
      const result = await runPerceptionTrigger(s.id, s.tenant_id, {
        source: "manual",
        client: supabase,
      });

      if (result.status === "skipped") {
        if (result.reason === "no_prior_snapshot") bucket.skipped++;
        else bucket.error++;
        console.log(
          `· ${label}\n  skipped ${result.reason}${result.error ? ` — ${result.error}` : ""}\n`,
        );
        continue;
      }

      bucket[result.severity]++;
      const d = result.diff;
      const deltaParts: string[] = [];
      if (d.hakjongScoreDelta !== null && d.hakjongScoreDelta !== 0) {
        deltaParts.push(`학종${d.hakjongScoreDelta > 0 ? "+" : ""}${d.hakjongScoreDelta}`);
      }
      if (d.competencyChanges.length > 0) deltaParts.push(`역량${d.competencyChanges.length}축`);
      if (d.newRecordIds.length > 0) deltaParts.push(`신규${d.newRecordIds.length}건`);
      if (d.auxChanges.volunteerHoursDelta > 0) deltaParts.push(`봉사+${d.auxChanges.volunteerHoursDelta}h`);
      if (d.auxChanges.awardsAdded > 0) deltaParts.push(`수상+${d.auxChanges.awardsAdded}`);
      if (d.auxChanges.integrityChanged) deltaParts.push("출결");
      if (d.staleBlueprint) deltaParts.push("⚠stale");

      console.log(
        `· ${label}\n` +
          `  ${d.from.label} → ${d.to.label}\n` +
          `  severity=${result.severity} triggered=${result.triggered}\n` +
          (deltaParts.length > 0 ? `  delta: ${deltaParts.join(" / ")}\n` : "  delta: (없음)\n") +
          (result.reasons.length > 0
            ? result.reasons.map((r) => `    - ${r}`).join("\n") + "\n"
            : ""),
      );
    } catch (err) {
      bucket.error++;
      console.log(
        `· ${label}\n  error — ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  // 요약
  console.log("─".repeat(60));
  console.log(`총 ${students.length}명 판정 분포:`);
  console.log(`  none     ${bucket.none}`);
  console.log(`  low      ${bucket.low}`);
  console.log(`  medium   ${bucket.medium}`);
  console.log(`  high     ${bucket.high}`);
  console.log(`  skipped  ${bucket.skipped} (snapshot < 2)`);
  console.log(`  error    ${bucket.error}`);

  // GITHUB_STEP_SUMMARY
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const { appendFileSync } = await import("node:fs");
    const lines = [
      "## Perception Trigger dry-run 요약",
      "",
      `- 대상: ${students.length}명`,
      `- none: ${bucket.none}`,
      `- low: ${bucket.low}`,
      `- medium: ${bucket.medium}`,
      `- high: ${bucket.high}`,
      `- skipped (snapshot<2): ${bucket.skipped}`,
      `- error: ${bucket.error}`,
      "",
    ];
    appendFileSync(summaryPath, lines.join("\n"));
  }
}

main().catch((err) => {
  console.error(`[perception-dryrun] 치명적 에러: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});
