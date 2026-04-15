#!/usr/bin/env npx tsx
/**
 * Phase α + β 기준 학생 엔드투엔드 검증 (B — 인제고 1학년)
 *
 * 목적: seed-main-exploration-reference.ts 가 넣어둔 2건이
 *   1) Phase β G3 cap 필터가 올바르게 좁히는지 (adequate_level=2 → basic only + NULL)
 *   2) Phase β G3 부스팅 pool 을 올바르게 계산하는지 (tier_plan 에 trajectory 없으면 공집합)
 *   3) Phase β G10 resolveAssignmentContext 재현이 8개 필드 중 어떤 필드를 채우는지
 * 를 실측하기 위함.
 *
 * **실 DB write 없음**. 조회만.
 *
 * 검증 대상은 `auto-recommend.ts::resolveRecommendationGridContext` +
 * `assignment.ts::resolveAssignmentContext` 의 로직을 그대로 재현한 것.
 * "use server" 모듈을 CLI 에서 직접 import 하지 않기 위한 조치이며,
 * SSOT 분기 시 이 스크립트도 같이 갱신해야 한다.
 */

import { config } from "dotenv";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import {
  getExplorationLevelSnapshot,
  listExplorationLevelSnapshots,
} from "@/lib/domains/student-record/repository/exploration-level-repository";
import { getActiveMainExploration } from "@/lib/domains/student-record/repository/main-exploration-repository";
import { difficultyToTier } from "@/lib/domains/student-record/main-exploration/tier-mapping";

// ─── env ─────────────────────────────────────────────────────────────────────

config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ env 미설정");
  process.exit(1);
}

// ─── defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  studentId: "35ee94b6-9484-4bee-8100-c761c1c56831",
  tenantId: "84b71a5d-5681-4da3-88d2-91e75ef89015",
  schoolYear: 2026,
  grade: 1 as 1 | 2 | 3,
  semester: 1 as 1 | 2,
};

function getFlag(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=", 2)[1];
}

const args = {
  studentId: getFlag("student-id") ?? DEFAULTS.studentId,
  tenantId: getFlag("tenant-id") ?? DEFAULTS.tenantId,
  schoolYear: Number(getFlag("school-year") ?? DEFAULTS.schoolYear),
  grade: Number(getFlag("grade") ?? DEFAULTS.grade) as 1 | 2 | 3,
  semester: Number(getFlag("semester") ?? DEFAULTS.semester) as 1 | 2,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function banner(title: string) {
  console.log("\n" + "─".repeat(60));
  console.log(title);
  console.log("─".repeat(60));
}

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg: string) {
  console.log(`  ⚠ ${msg}`);
}
function fail(msg: string): never {
  console.error(`  ✗ ${msg}`);
  process.exit(1);
}

// auto-recommend.ts 와 동일 매핑
function levelToAllowedDifficulties(
  level: number,
): ("basic" | "intermediate" | "advanced")[] {
  if (level <= 2) return ["basic"];
  if (level === 3) return ["basic", "intermediate"];
  return ["basic", "intermediate", "advanced"];
}

function collectLinkedTrajectoryIds(tierPlan: unknown): string[] {
  if (!tierPlan || typeof tierPlan !== "object") return [];
  const out = new Set<string>();
  for (const tier of ["foundational", "development", "advanced"] as const) {
    const entry = (tierPlan as Record<string, unknown>)[tier];
    if (!entry || typeof entry !== "object") continue;
    const ids = (entry as Record<string, unknown>).linked_topic_trajectory_ids;
    if (Array.isArray(ids)) {
      for (const id of ids) if (typeof id === "string") out.add(id);
    }
  }
  return [...out];
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  }) as unknown as SupabaseClient<Database>;

  banner("Phase β 재현 검증 — 인제고 1학년");
  console.log(
    `  student=${args.studentId} slice=${args.schoolYear}년 ${args.grade}학년 ${args.semester}학기`,
  );

  // 1. seed 재조회
  banner("1) seed 재조회");
  const level = await getExplorationLevelSnapshot(
    args.studentId,
    args.tenantId,
    { schoolYear: args.schoolYear, semester: args.semester },
    admin,
  );
  if (!level) fail("student_exploration_levels row 없음 — seed 스크립트 먼저 실행");
  pass(
    `level — source=${level!.source} adequate=${level!.adequate_level} expected=${level!.expected_level} tier=${level!.school_tier ?? "∅"}`,
  );

  const allLevels = await listExplorationLevelSnapshots(
    args.studentId,
    args.tenantId,
    admin,
  );
  pass(`level snapshots 총 ${allLevels.length}건`);

  const designMain = await getActiveMainExploration(
    args.studentId,
    args.tenantId,
    { scope: "overall", trackLabel: null, direction: "design" },
    admin,
  );
  const analysisMain = await getActiveMainExploration(
    args.studentId,
    args.tenantId,
    { scope: "overall", trackLabel: null, direction: "analysis" },
    admin,
  );
  const active = designMain ?? analysisMain;
  if (!active) fail("활성 main_exploration 없음");
  pass(
    `main — id=${active!.id} direction=${active!.direction} role=${active!.semantic_role} v${active!.version} theme="${active!.theme_label}"`,
  );

  // 2. G3 cap 필터 시뮬
  banner("2) G3 cap 필터 시뮬레이션");
  const allowed = levelToAllowedDifficulties(level!.adequate_level);
  console.log(`  adequate_level=${level!.adequate_level} → allowedDifficulties=${JSON.stringify(allowed)}`);

  const [totalCountResp, allowedCountResp, blockedCountResp, nullCountResp] =
    await Promise.all([
      admin.from("exploration_guides").select("id", { count: "exact", head: true }),
      admin
        .from("exploration_guides")
        .select("id", { count: "exact", head: true })
        .in("difficulty_level", allowed),
      admin
        .from("exploration_guides")
        .select("id", { count: "exact", head: true })
        .not("difficulty_level", "is", null)
        .not("difficulty_level", "in", `(${allowed.map((a) => `"${a}"`).join(",")})`),
      admin
        .from("exploration_guides")
        .select("id", { count: "exact", head: true })
        .is("difficulty_level", null),
    ]);

  const total = totalCountResp.count ?? 0;
  const allowedN = allowedCountResp.count ?? 0;
  const blockedN = blockedCountResp.count ?? 0;
  const nullN = nullCountResp.count ?? 0;
  const poolN = allowedN + nullN; // cap 정책: allowed OR NULL
  const blockRatio = total > 0 ? ((blockedN / total) * 100).toFixed(1) : "–";
  pass(`exploration_guides 총 ${total}건`);
  pass(
    `  allowed(${allowed.join(",")})=${allowedN}  NULL=${nullN}  → pool=${poolN}`,
  );
  pass(`  blocked(intermediate/advanced)=${blockedN} (${blockRatio}%)`);
  if (poolN === 0) warn("pool 이 0 — cap 이 모든 가이드를 차단함");

  // 3. G3 부스팅 시뮬
  banner("3) G3 부스팅 시뮬레이션");
  const trajectoryIds = collectLinkedTrajectoryIds(active!.tier_plan);
  if (trajectoryIds.length === 0) {
    pass(
      "tier_plan.linked_topic_trajectory_ids 공집합 — 부스팅 미적용 (seed 상태로 의도된 결과)",
    );
  } else {
    const { data: trajectories } = await admin
      .from("student_record_topic_trajectories")
      .select("topic_cluster_id")
      .in("id", trajectoryIds);
    const clusterIds = new Set(
      (trajectories ?? [])
        .map((t) => t.topic_cluster_id)
        .filter((c): c is string => c != null),
    );
    pass(
      `tier_plan linked trajectories=${trajectoryIds.length} → boosted clusters=${clusterIds.size}`,
    );
  }

  // 4. G10 resolveAssignmentContext 재현 — 샘플 가이드 1건
  banner("4) G10 resolveAssignmentContext 샘플");
  const { data: sampleGuide } = await admin
    .from("exploration_guides")
    .select("id, title, difficulty_level, topic_cluster_id")
    .in("difficulty_level", allowed)
    .not("topic_cluster_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!sampleGuide) {
    warn("difficulty+topic_cluster 모두 세팅된 샘플 가이드 없음 — 재현 skip");
  } else {
    const d = sampleGuide.difficulty_level;
    const isAllowedTriple =
      d === "basic" || d === "intermediate" || d === "advanced";
    const difficulty = isAllowedTriple ? d : null;
    const tier = difficultyToTier(difficulty);
    pass(
      `guide.id=${sampleGuide.id.slice(0, 8)}… title="${(sampleGuide.title ?? "").slice(0, 30)}"`,
    );
    console.log("  resolveAssignmentContext 재현 결과:");
    console.log(`    difficulty_level         : ${difficulty ?? "∅"}`);
    console.log(`    topic_cluster_id         : ${sampleGuide.topic_cluster_id?.slice(0, 8) ?? "∅"}…`);
    console.log(`    student_level_at_assign  : ${level!.adequate_level}`);
    console.log(`    main_exploration_id      : ${active!.id.slice(0, 8)}…`);
    console.log(`    main_exploration_tier    : ${tier ?? "∅"}  (difficulty=${difficulty} → tier)`);
    console.log(`    semester                 : ${args.semester}`);
    console.log(`    school_year              : ${args.schoolYear}`);
    console.log(`    assignment_source        : consultant (default)`);

    // CHECK 제약 예측
    const capFloor = difficulty === "basic" ? 1 : difficulty === "intermediate" ? 3 : 4;
    const wouldViolate = difficulty != null && level!.adequate_level < capFloor;
    if (wouldViolate) {
      warn(
        `CHECK 위반 예상 — difficulty=${difficulty} floor=${capFloor} > student_level=${level!.adequate_level}`,
      );
      warn("  → override_reason 없이 INSERT 시 DB 에러");
    } else {
      pass(
        `CHECK 통과 예상 — difficulty=${difficulty} floor=${capFloor} <= student_level=${level!.adequate_level}`,
      );
    }
  }

  banner("verify done");
}

main().catch((err) => {
  console.error("\n❌ verify failed");
  console.error(err);
  process.exit(1);
});
