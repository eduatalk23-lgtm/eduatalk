#!/usr/bin/env npx tsx
/**
 * α1-3-d: 학생 StudentState snapshot 일괄 빌드 + 영속화 CLI
 *
 * 사용법:
 *   npx tsx scripts/build-student-state-snapshot.ts --all
 *   npx tsx scripts/build-student-state-snapshot.ts --tenant=<uuid>
 *   npx tsx scripts/build-student-state-snapshot.ts --student=<uuid>
 *   npx tsx scripts/build-student-state-snapshot.ts --student=<uuid> --dry-run
 *
 * Workflow: .github/workflows/student-state-snapshot.yml (daily 03:30 KST)
 *
 * 특징:
 *   - 학생별 try/catch — 한 명 실패해도 나머지 계속.
 *   - 실패 목록은 stderr + GITHUB_STEP_SUMMARY 에 출력.
 *   - trigger_source='nightly_cron' 로 metric event 기록 — α6 Reflection 이 집계.
 *   - dry-run 시 build 만 하고 upsert 없음.
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필수 (admin client)
 */

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { buildStudentState } from "../lib/domains/student-record/state/build-student-state";
import { upsertSnapshot } from "../lib/domains/student-record/repository/student-state-repository";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 인자 파싱
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function arg(name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

const flagAll = args.includes("--all");
const flagDryRun = args.includes("--dry-run");
const tenantId = arg("tenant");
const studentId = arg("student");
const concurrency = Number(arg("concurrency") ?? "3");

if (!flagAll && !tenantId && !studentId) {
  console.error(
    "[snapshot-cli] 하나 이상의 대상 지정 필수: --all / --tenant=<uuid> / --student=<uuid>",
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

interface OutcomeSuccess {
  kind: "ok";
  studentId: string;
  completenessRatio: number;
  elapsedMs: number;
}
interface OutcomeFailure {
  kind: "error";
  studentId: string;
  tenantId: string;
  error: string;
}
type Outcome = OutcomeSuccess | OutcomeFailure;

async function main(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("[snapshot-cli] admin client 생성 실패 (env 누락)");
    process.exit(1);
  }

  // 대상 학생 조회
  let query = supabase.from("students").select("id, tenant_id");
  if (studentId) query = query.eq("id", studentId);
  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  if (error) {
    console.error(`[snapshot-cli] 학생 조회 실패: ${error.message}`);
    process.exit(1);
  }

  const students = (data ?? []) as StudentRow[];
  if (students.length === 0) {
    console.log("[snapshot-cli] 대상 학생 없음. 종료.");
    return;
  }

  console.log(
    `[snapshot-cli] 대상 학생 ${students.length}명 — dry-run=${flagDryRun} concurrency=${concurrency}`,
  );

  const outcomes: Outcome[] = [];
  const startMs = Date.now();

  // 제한된 동시성으로 처리
  let idx = 0;
  async function worker() {
    while (idx < students.length) {
      const i = idx++;
      const s = students[i];
      const t0 = Date.now();
      try {
        const state = await buildStudentState(
          s.id,
          s.tenant_id,
          undefined,
          { client: supabase, includeTrajectory: false },
        );
        if (!flagDryRun) {
          await upsertSnapshot(state, { triggerSource: "nightly_cron" }, supabase);
        }
        outcomes.push({
          kind: "ok",
          studentId: s.id,
          completenessRatio: state.metadata.completenessRatio,
          elapsedMs: Date.now() - t0,
        });
      } catch (err) {
        outcomes.push({
          kind: "error",
          studentId: s.id,
          tenantId: s.tenant_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker()),
  );

  // 요약 출력
  const okCount = outcomes.filter((o) => o.kind === "ok").length;
  const errCount = outcomes.filter((o) => o.kind === "error").length;
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log(
    `[snapshot-cli] 완료: ${okCount} ok / ${errCount} err / ${elapsed}s`,
  );

  // 실패 상세
  const failures = outcomes.filter((o): o is OutcomeFailure => o.kind === "error");
  if (failures.length > 0) {
    console.error("[snapshot-cli] 실패 학생:");
    for (const f of failures) {
      console.error(`  - ${f.studentId} (tenant=${f.tenantId}): ${f.error}`);
    }
  }

  // GITHUB_STEP_SUMMARY 기록
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const { appendFileSync } = await import("node:fs");
    const lines = [
      "## StudentState Snapshot 빌드 요약",
      "",
      `- 대상: ${students.length}명`,
      `- 성공: ${okCount}`,
      `- 실패: ${errCount}`,
      `- 소요: ${elapsed}s`,
      `- Dry-run: ${flagDryRun}`,
      "",
    ];
    if (failures.length > 0) {
      lines.push("### 실패 목록", "");
      for (const f of failures.slice(0, 20)) {
        lines.push(`- \`${f.studentId}\` (tenant=\`${f.tenantId}\`) — ${f.error}`);
      }
      if (failures.length > 20) lines.push(`- … 외 ${failures.length - 20}건`);
    }
    appendFileSync(summaryPath, lines.join("\n") + "\n");
  }

  // 실패가 전체의 20% 를 초과하면 workflow 실패
  if (students.length > 0 && errCount / students.length > 0.2) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("[snapshot-cli] fatal:", err);
  process.exit(1);
});
