#!/usr/bin/env npx tsx
/**
 * α4 Proposal Engine dry-run CLI (Sprint 2 + Sprint 3, 2026-04-20)
 *
 * Perception Trigger → rule_v1 또는 llm_v1 엔진을 실행해 제안 결과를 콘솔에 덤프.
 *
 * 기본: DB 쓰기 없음, LLM 호출 없음, 완전 read-only (rule_v1).
 * --engine=llm_v1: 실제 LLM 호출 발생. **비용 주의** (Gemini 2.5 Pro ~$0.05/call).
 *
 * 사용법:
 *   npx tsx scripts/proposal-dryrun.ts --student=<uuid>
 *   npx tsx scripts/proposal-dryrun.ts --tenant=<uuid> --engine=llm_v1
 *   npx tsx scripts/proposal-dryrun.ts --all --engine=llm_v1 --tier=standard_only
 *
 * 옵션:
 *   --engine=rule_v1 (기본) | llm_v1
 *   --tier=auto (기본, standard→advanced) | standard_only | advanced_first
 *
 * 출력:
 *   학생별 1 block 덤프. Perception severity + 제안 N건 + 각 제안 요약.
 *   llm_v1 경로는 추가로 model / tier / usage / costUsd 표시.
 *
 * 목적:
 *   - Sprint 4 김세린·인제고 실측 준비
 *   - rule_v1 매핑표의 실제 분포 확인 (제안 0건 / 1~5건)
 *   - 영역 다양성 가드(F16) 실제 학생 데이터 검증
 *   - llm_v1 실호출 테스트 (엔진 플래그 명시 시)
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필수 (admin client)
 *   LLM_PROVIDER_OVERRIDE 등 ai-sdk 설정은 호출 시 환경 그대로 사용
 */

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { runPerceptionTrigger } from "../lib/domains/student-record/actions/perception-scheduler";
import { runProposalJob } from "../lib/domains/student-record/actions/proposal-scheduler";
import { buildStudentState } from "../lib/domains/student-record/state/build-student-state";
import { buildRuleProposal } from "../lib/domains/student-record/state/rule-proposal";
import { runLlmProposal } from "../lib/domains/student-record/state/llm-proposal";
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
const engineArg = (arg("engine") ?? "rule_v1").toLowerCase();
const tierArg = (arg("tier") ?? "auto").toLowerCase();

if (!flagAll && !tenantId && !studentId) {
  console.error(
    "[proposal-dryrun] 하나 이상의 대상 지정 필수: --all / --tenant=<uuid> / --student=<uuid>",
  );
  process.exit(1);
}

if (engineArg !== "rule_v1" && engineArg !== "llm_v1") {
  console.error(`[proposal-dryrun] --engine 값 오류: ${engineArg} (rule_v1 | llm_v1)`);
  process.exit(1);
}
if (!["auto", "standard_only", "advanced_first"].includes(tierArg)) {
  console.error(
    `[proposal-dryrun] --tier 값 오류: ${tierArg} (auto | standard_only | advanced_first)`,
  );
  process.exit(1);
}
const engineMode = engineArg as "rule_v1" | "llm_v1";
const tierPref = tierArg as "auto" | "standard_only" | "advanced_first";

const forceTrigger = args.includes("--force-trigger");
const persist = args.includes("--persist");

if (engineMode === "llm_v1") {
  console.warn(
    "[proposal-dryrun] ⚠ --engine=llm_v1 — 실제 LLM 호출 발생. 비용 주의. OpenAI/Gemini 예산 확인.",
  );
}
if (forceTrigger) {
  console.warn(
    "[proposal-dryrun] ⚠ --force-trigger — Perception 결과 무시하고 synthetic trigger 로 rule/llm 엔진 강제 실행. 실측용, 운영 금지.",
  );
}
if (persist) {
  console.warn(
    "[proposal-dryrun] ⚠ --persist — proposal_jobs / proposal_items 실제 DB 저장. UI Drawer 에서 리뷰 가능.",
  );
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
    zero_candidates: 0, // triggered 인데 후보 0
    not_triggered: 0,
    no_prior_snapshot: 0,
    error: 0,
  };
  const itemCountDistribution = [0, 0, 0, 0, 0, 0]; // index = item 수 0~5

  // llm_v1 전용 집계
  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let llmSuccessCount = 0;
  let llmFallbackCount = 0;

  for (const s of students) {
    const label = `${s.id.slice(0, 8)}…`;

    try {
      // 1) Perception 판정 (force-trigger 면 스킵 가능)
      let perception = await runPerceptionTrigger(s.id, s.tenant_id, {
        source: "manual",
        client: supabase,
      });

      if (perception.status === "skipped") {
        if (!forceTrigger) {
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
        // force-trigger: synthetic evaluated result 주입
        perception = {
          status: "evaluated",
          source: "snapshot",
          triggered: true,
          severity: "medium",
          reasons: ["synthetic force-trigger (real perception skipped)"],
          diff: {
            from: {
              schoolYear: 2025,
              grade: 1,
              semester: 2,
              label: "forced from",
              builtAt: "2025-12-01T00:00:00Z",
            },
            to: {
              schoolYear: 2026,
              grade: 2,
              semester: 1,
              label: "forced to",
              builtAt: new Date().toISOString(),
            },
            hakjongScoreDelta: 0,
            competencyChanges: [],
            newRecordIds: [],
            staleBlueprint: false,
            auxChanges: {
              volunteerHoursDelta: 0,
              awardsAdded: 0,
              integrityChanged: false,
            },
          },
          trigger: {
            shouldTrigger: true,
            severity: "medium",
            reasons: ["synthetic force-trigger (실측 전용)"],
            signals: [
              {
                kind: "new_records",
                weight: "medium",
                detail: "forced synthetic",
              },
            ],
          },
        };
      }

      if (!perception.triggered) {
        if (!forceTrigger) {
          bucket.not_triggered++;
          console.log(
            `· ${label}\n  skipped not_triggered (severity=${perception.severity})\n`,
          );
          continue;
        }
        // force-trigger: 기존 diff 는 유지하되 synthetic trigger signal 주입
        perception = {
          ...perception,
          triggered: true,
          severity: "medium",
          reasons: [
            ...perception.reasons,
            "synthetic force-trigger on top of real perception",
          ],
          trigger: {
            shouldTrigger: true,
            severity: "medium",
            reasons: ["synthetic force-trigger"],
            signals: [
              {
                kind: "new_records",
                weight: "medium",
                detail: "forced synthetic",
              },
            ],
          },
        };
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

      // 3) 엔진 실행
      const remaining =
        state.blueprintGap?.remainingSemesters ??
        (3 - state.asOf.grade) * 2 + (state.asOf.semester === 1 ? 1 : 0);

      const ruleInput = {
        diff: perception.diff,
        trigger: perception.trigger,
        state,
        gap: state.blueprintGap ?? null,
        remainingSemesters: remaining,
      };

      let items: readonly ProposalItem[];
      let llmMeta: {
        engine: string;
        model: string | null;
        tier: string | null;
        costUsd: number | null;
        inputTokens: number | null;
        outputTokens: number | null;
        error: string | null;
      } | null = null;
      let persistedJobId: string | null = null;

      if (persist) {
        // scheduler 경유 — proposal_jobs + proposal_items 영속화
        const schedulerResult = await runProposalJob({
          studentId: s.id,
          tenantId: s.tenant_id,
          perception,
          state,
          gap: state.blueprintGap ?? null,
          options: {
            engine: engineMode,
            tierPreference: tierPref,
            client: supabase,
          },
        });

        if (schedulerResult.status === "completed") {
          persistedJobId = schedulerResult.jobId;
          // scheduler 는 items 자체를 반환하지 않음 → DB 재조회 대신 빈 표시
          // UI Drawer 에서 확인 유도
          items = [];
          llmMeta =
            engineMode === "llm_v1"
              ? {
                  engine: schedulerResult.engine,
                  model: null, // scheduler 응답에 model 은 없음, metadata 조회 필요 (생략)
                  tier: null,
                  costUsd: null,
                  inputTokens: null,
                  outputTokens: null,
                  error: null,
                }
              : null;
          bucket.generated++;
          itemCountDistribution[Math.min(5, schedulerResult.itemCount)]++;

          console.log(
            `· ${label}\n` +
              `  ${perception.diff.from.label} → ${perception.diff.to.label}\n` +
              `  severity=${perception.severity} → ${schedulerResult.itemCount}건 생성 [engine=${schedulerResult.engine}] jobId=${persistedJobId}\n` +
              `  (persist 모드 — 상세는 admin UI Drawer 확인)\n`,
          );
          continue;
        } else {
          bucket.zero_candidates++;
          console.log(
            `· ${label}\n  scheduler skipped — reason=${schedulerResult.reason}${schedulerResult.error ? ` err=${schedulerResult.error}` : ""}\n`,
          );
          continue;
        }
      }

      // non-persist 경로 (기존)
      if (engineMode === "llm_v1") {
        const result = await runLlmProposal(ruleInput, {
          tierPreference: tierPref,
        });
        items = result.items;
        llmMeta = {
          engine: result.engine,
          model: result.model,
          tier: result.tier,
          costUsd: result.costUsd,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          error: result.error,
        };
        if (result.engine === "llm_v1") {
          totalCostUsd += result.costUsd ?? 0;
          totalInputTokens += result.usage?.inputTokens ?? 0;
          totalOutputTokens += result.usage?.outputTokens ?? 0;
          llmSuccessCount++;
        } else {
          llmFallbackCount++;
        }
      } else {
        items = buildRuleProposal(ruleInput);
      }

      if (items.length === 0) {
        bucket.zero_candidates++;
        itemCountDistribution[0]++;
        console.log(
          `· ${label}\n  severity=${perception.severity} → 후보 0건 (engine=${engineMode}, gap=${state.blueprintGap ? "있음" : "없음"})${llmMeta?.error ? `\n  LLM error: ${llmMeta.error}` : ""}\n`,
        );
        continue;
      }

      bucket.generated++;
      itemCountDistribution[items.length]++;

      // 영역 다양성 스냅샷
      const areaCount = { academic: 0, career: 0, community: 0 };
      for (const it of items) areaCount[it.targetArea]++;

      const llmLine = llmMeta
        ? `\n  engine=${llmMeta.engine} model=${llmMeta.model ?? "—"} tier=${llmMeta.tier ?? "—"} cost=${llmMeta.costUsd !== null ? `$${llmMeta.costUsd.toFixed(4)}` : "—"} in=${llmMeta.inputTokens ?? "—"} out=${llmMeta.outputTokens ?? "—"}${llmMeta.error ? ` error="${llmMeta.error}"` : ""}`
        : "";

      console.log(
        `· ${label}\n` +
          `  ${perception.diff.from.label} → ${perception.diff.to.label}\n` +
          `  severity=${perception.severity} → ${items.length}건 [학업${areaCount.academic}/진로${areaCount.career}/공동체${areaCount.community}]` +
          llmLine +
          "\n" +
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
  console.log(`총 ${students.length}명 — ${engineMode} dry-run 요약:`);
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

  if (engineMode === "llm_v1") {
    console.log();
    console.log("llm_v1 비용·호출:");
    console.log(`  LLM 성공        ${llmSuccessCount}`);
    console.log(`  rule_v1 fallback ${llmFallbackCount}`);
    console.log(`  총 input tokens  ${totalInputTokens.toLocaleString()}`);
    console.log(`  총 output tokens ${totalOutputTokens.toLocaleString()}`);
    console.log(`  총 비용         $${totalCostUsd.toFixed(4)}`);
    if (llmSuccessCount > 0) {
      console.log(
        `  평균 비용/호출   $${(totalCostUsd / llmSuccessCount).toFixed(4)}`,
      );
    }
  }

  // GITHUB_STEP_SUMMARY
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const { appendFileSync } = await import("node:fs");
    const lines = [
      `## Proposal Engine ${engineMode} dry-run 요약`,
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
    ];
    if (engineMode === "llm_v1") {
      lines.push(
        "",
        "### llm_v1 비용·호출",
        `- LLM 성공: ${llmSuccessCount}`,
        `- rule_v1 fallback: ${llmFallbackCount}`,
        `- 총 input tokens: ${totalInputTokens.toLocaleString()}`,
        `- 총 output tokens: ${totalOutputTokens.toLocaleString()}`,
        `- 총 비용: $${totalCostUsd.toFixed(4)}`,
      );
    }
    lines.push("");
    appendFileSync(summaryPath, lines.join("\n"));
  }
}

main().catch((err) => {
  console.error(
    `[proposal-dryrun] 치명적 에러: ${err instanceof Error ? err.stack : err}`,
  );
  process.exit(1);
});
