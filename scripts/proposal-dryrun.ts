#!/usr/bin/env npx tsx
/**
 * α4 Proposal Engine dry-run CLI (Sprint 2, 2026-04-20)
 *
 * Perception Trigger → rule_v1 엔진을 실행해 제안 결과만 콘솔에 덤프.
 * DB 쓰기 **없음**. LLM 호출 **없음**. 완전 read-only.
 *
 * 사용법:
 *   npx tsx scripts/proposal-dryrun.ts --student=<uuid>
 *   npx tsx scripts/proposal-dryrun.ts --tenant=<uuid>
 *   npx tsx scripts/proposal-dryrun.ts --all
 *
 * 출력:
 *   학생별 1 block 덤프. Perception severity + 제안 N건 + 각 제안의 요약.
 *   Perception not triggered → "skipped not_triggered" / snapshot 부재 → "skipped no_prior_snapshot".
 *
 * 목적:
 *   - Sprint 4 김세린·인제고 실측 준비
 *   - rule_v1 매핑표의 실제 분포 (제안 0건 / 1~5건) 확인
 *   - 영역 다양성 가드(F16) 실제 학생 데이터 검증
 *   - LLM 통합(Sprint 3) 진입 전 규칙 엔진의 한계·강점 체감
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필수 (admin client)
 */

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { runPerceptionTrigger } from "../lib/domains/student-record/actions/perception-scheduler";
import { buildStudentState } from "../lib/domains/student-record/state/build-student-state";
import { buildRuleProposal } from "../lib/domains/student-record/state/rule-proposal";
import type { StudentState } from "../lib/domains/student-record/types/student-state";
import type { ProposalItem } from "../lib/domains/student-record/types/proposal";

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
    "[proposal-dryrun] 하나 이상의 대상 지정 필수: --all / --tenant=<uuid> / --student=<uuid>",
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

function summarizeItem(it: ProposalItem): string {
  const areaKo =
    it.targetArea === "academic"
      ? "학업"
      : it.targetArea === "career"
        ? "진로"
        : "공동체";
  const horizonKo =
    it.horizon === "immediate"
      ? "즉시"
      : it.horizon === "this_semester"
        ? "이번학기"
        : it.horizon === "next_semester"
          ? "다음학기"
          : "장기";
  return `#${it.rank} [${areaKo}·${horizonKo}] ${it.name}`;
}

async function main(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("[proposal-dryrun] admin client 생성 실패 (env 누락)");
    process.exit(1);
  }

  let query = supabase.from("students").select("id, tenant_id");
  if (studentId) query = query.eq("id", studentId);
  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  if (error) {
    console.error(`[proposal-dryrun] 학생 조회 실패: ${error.message}`);
    process.exit(1);
  }

  const students = (data ?? []) as StudentRow[];
  if (students.length === 0) {
    console.log("[proposal-dryrun] 대상 학생 없음. 종료.");
    return;
  }

  console.log(`[proposal-dryrun] 대상 학생 ${students.length}명\n`);

  const bucket = {
    generated: 0, // 제안 ≥ 1건
    zero_candidates: 0, // triggered 인데 rule_v1 후보 0
    not_triggered: 0,
    no_prior_snapshot: 0,
    error: 0,
  };
  const itemCountDistribution = [0, 0, 0, 0, 0, 0]; // index = item 수 0~5

  for (const s of students) {
    const label = `${s.id.slice(0, 8)}…`;

    try {
      // 1) Perception 판정
      const perception = await runPerceptionTrigger(s.id, s.tenant_id, {
        source: "manual",
        client: supabase,
      });

      if (perception.status === "skipped") {
        if (perception.reason === "no_prior_snapshot") {
          bucket.no_prior_snapshot++;
          console.log(`· ${label}\n  skipped no_prior_snapshot\n`);
        } else {
          bucket.error++;
          console.log(
            `· ${label}\n  error — ${perception.error ?? "unknown"}\n`,
          );
        }
        continue;
      }

      if (!perception.triggered) {
        bucket.not_triggered++;
        console.log(
          `· ${label}\n  skipped not_triggered (severity=${perception.severity})\n`,
        );
        continue;
      }

      // 2) StudentState 재빌드 (dry-run 이므로 snapshot 저장 안 함)
      let state: StudentState;
      try {
        state = await buildStudentState(s.id, s.tenant_id, undefined, {
          client: supabase,
        });
      } catch (err) {
        bucket.error++;
        console.log(
          `· ${label}\n  state build error — ${err instanceof Error ? err.message : String(err)}\n`,
        );
        continue;
      }

      // 3) rule_v1 실행
      const remaining =
        state.blueprintGap?.remainingSemesters ??
        (3 - state.asOf.grade) * 2 + (state.asOf.semester === 1 ? 1 : 0);

      const items = buildRuleProposal({
        diff: perception.diff,
        trigger: perception.trigger,
        state,
        gap: state.blueprintGap ?? null,
        remainingSemesters: remaining,
      });

      if (items.length === 0) {
        bucket.zero_candidates++;
        itemCountDistribution[0]++;
        console.log(
          `· ${label}\n  severity=${perception.severity} → rule_v1 후보 0건 (gap=${state.blueprintGap ? "있음" : "없음"})\n`,
        );
        continue;
      }

      bucket.generated++;
      itemCountDistribution[items.length]++;

      // 영역 다양성 스냅샷
      const areaCount = { academic: 0, career: 0, community: 0 };
      for (const it of items) areaCount[it.targetArea]++;

      console.log(
        `· ${label}\n` +
          `  ${perception.diff.from.label} → ${perception.diff.to.label}\n` +
          `  severity=${perception.severity} → ${items.length}건 [학업${areaCount.academic}/진로${areaCount.career}/공동체${areaCount.community}]\n` +
          items.map((it) => `    ${summarizeItem(it)}`).join("\n") +
          "\n",
      );
    } catch (err) {
      bucket.error++;
      console.log(
        `· ${label}\n  error — ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  // ─── 요약 ─────────────────────────────────────────────────────
  console.log("─".repeat(60));
  console.log(`총 ${students.length}명 — rule_v1 dry-run 요약:`);
  console.log(`  generated        ${bucket.generated} (제안 ≥1건)`);
  console.log(`  zero_candidates  ${bucket.zero_candidates} (triggered 인데 후보 0)`);
  console.log(`  not_triggered    ${bucket.not_triggered}`);
  console.log(`  no_prior_snapshot ${bucket.no_prior_snapshot}`);
  console.log(`  error            ${bucket.error}`);
  console.log();
  console.log("item 수 분포 (generated 내):");
  for (let n = 1; n <= 5; n++) {
    console.log(`  ${n}건: ${itemCountDistribution[n]}`);
  }

  // GITHUB_STEP_SUMMARY
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const { appendFileSync } = await import("node:fs");
    const lines = [
      "## Proposal Engine rule_v1 dry-run 요약",
      "",
      `- 대상: ${students.length}명`,
      `- generated: ${bucket.generated}`,
      `- zero_candidates: ${bucket.zero_candidates}`,
      `- not_triggered: ${bucket.not_triggered}`,
      `- no_prior_snapshot: ${bucket.no_prior_snapshot}`,
      `- error: ${bucket.error}`,
      "",
      "### item 수 분포",
      ...[1, 2, 3, 4, 5].map((n) => `- ${n}건: ${itemCountDistribution[n]}`),
      "",
    ];
    appendFileSync(summaryPath, lines.join("\n"));
  }
}

main().catch((err) => {
  console.error(
    `[proposal-dryrun] 치명적 에러: ${err instanceof Error ? err.stack : err}`,
  );
  process.exit(1);
});
