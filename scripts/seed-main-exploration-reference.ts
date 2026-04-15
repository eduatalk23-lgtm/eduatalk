#!/usr/bin/env npx tsx
/**
 * Phase α 기준 학생 seed 스크립트 (B' — 인제고 1학년 엔드투엔드 검증 선행)
 *
 * 목적:
 *   인제고 1학년 기준 학생(`dev-reference-students.md`)에 대해
 *   Phase α 두 테이블의 최소 1건을 보장해서 Phase β(cap/부스팅)가 실제로 발동하는지
 *   검증할 수 있는 상태를 만든다.
 *     1) student_exploration_levels   — consultant_override seed 1건 (성적 없음)
 *     2) student_main_explorations    — direction=design × hypothesis_root 1건
 *
 * 사용법:
 *   npx tsx scripts/seed-main-exploration-reference.ts              # 인제고 1학년 default
 *   npx tsx scripts/seed-main-exploration-reference.ts --dry-run    # 조회만, write X
 *   npx tsx scripts/seed-main-exploration-reference.ts \
 *     --student-id=<uuid> --tenant-id=<uuid> \
 *     --school-year=2026 --grade=1 --semester=1
 *
 * 동작:
 *   - 동일 slice 에 활성 row 가 이미 있으면 재사용(새로 안 만듦). NO-OP 안전.
 *   - consultant_override 레벨은 성적 데이터 없는 1학년 진입 상황에 맞춘 seed값.
 *     성적 입력 후에는 `upsertExplorationLevelFromGpa({overrideConsultant:false})` 로 갱신 전환 권장.
 */

import { config } from "dotenv";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import {
  getExplorationLevelSnapshot,
  upsertExplorationLevelConsultantOverride,
} from "@/lib/domains/student-record/repository/exploration-level-repository";
import {
  getActiveMainExploration,
  createMainExploration,
  type MainExplorationInput,
  type MainExplorationTierPlan,
} from "@/lib/domains/student-record/repository/main-exploration-repository";

// ─────────────────────────────────────────────────────────────────────────────
// env
// ─────────────────────────────────────────────────────────────────────────────

config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정");
  console.error("   .env.local 확인");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// defaults — 인제고 1학년 (dev-reference-students.md)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  studentId: "35ee94b6-9484-4bee-8100-c761c1c56831",
  tenantId: "84b71a5d-5681-4da3-88d2-91e75ef89015",
  schoolYear: 2026,
  grade: 1 as 1 | 2 | 3,
  semester: 1 as 1 | 2,
  // 성적 미입력 1학년 prospective 기본값: 적정 2, 목표 4 (인서울)
  adequateLevel: 2 as 1 | 2 | 3 | 4 | 5,
  expectedLevel: 4 as 1 | 2 | 3 | 4 | 5,
  schoolTier: "in_seoul",
  careerField: "MED",
  themeLabel: "의학·약학 진로 기반 생명과학 탐구",
  themeKeywords: ["의학", "약학", "생명과학", "세포", "생화학"],
};

const SEED_TIER_PLAN: MainExplorationTierPlan = {
  foundational: {
    theme: "생명 현상의 기초 — 세포 구조와 물질대사",
    key_questions: [
      "세포는 어떻게 에너지를 얻고 사용하는가?",
      "효소와 대사 경로가 질병과 어떤 관련이 있는가?",
    ],
    suggested_activities: [
      "교과서 심화 읽기 (세포와 물질대사)",
      "세포 호흡 개념도 작성",
    ],
  },
  development: {
    theme: "질병 기전의 이해 — 생화학·유전학 접근",
    key_questions: [
      "유전자 발현 이상이 어떻게 질병을 유발하는가?",
      "약물은 어떤 경로로 표적 단백질에 작용하는가?",
    ],
    suggested_activities: [
      "질병 사례 보고서 (당뇨·유전병 택 1)",
      "약물 작용 기전 탐구",
    ],
  },
  advanced: {
    theme: "의료 응용 — 신약/진단기술 탐구",
    key_questions: [
      "mRNA 치료제는 기존 약물과 무엇이 다른가?",
      "AI 진단보조가 임상 판단을 어떻게 보완하는가?",
    ],
    suggested_activities: [
      "최신 논문 요약 (신약/진단 택 1)",
      "기술 윤리 관점 에세이",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// args
// ─────────────────────────────────────────────────────────────────────────────

interface Args {
  studentId: string;
  tenantId: string;
  schoolYear: number;
  grade: 1 | 2 | 3;
  semester: 1 | 2;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const getFlag = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit?.split("=", 2)[1];
  };

  const studentId = getFlag("student-id") ?? DEFAULTS.studentId;
  const tenantId = getFlag("tenant-id") ?? DEFAULTS.tenantId;
  const schoolYear = Number(getFlag("school-year") ?? DEFAULTS.schoolYear);
  const grade = Number(getFlag("grade") ?? DEFAULTS.grade) as 1 | 2 | 3;
  const semester = Number(getFlag("semester") ?? DEFAULTS.semester) as 1 | 2;

  if (!Number.isInteger(schoolYear) || schoolYear < 2020 || schoolYear > 2030) {
    throw new Error(`invalid --school-year: ${schoolYear}`);
  }
  if (![1, 2, 3].includes(grade)) throw new Error(`invalid --grade: ${grade}`);
  if (![1, 2].includes(semester)) throw new Error(`invalid --semester: ${semester}`);

  return { studentId, tenantId, schoolYear, grade, semester, dryRun };
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

function banner(title: string) {
  console.log("\n" + "─".repeat(60));
  console.log(title);
  console.log("─".repeat(60));
}

async function main() {
  const args = parseArgs();

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  }) as unknown as SupabaseClient<Database>;

  banner("Phase α reference seed");
  console.log(`  student_id  : ${args.studentId}`);
  console.log(`  tenant_id   : ${args.tenantId}`);
  console.log(`  slice       : ${args.schoolYear}년 ${args.grade}학년 ${args.semester}학기`);
  console.log(`  dry-run     : ${args.dryRun}`);

  // 0. 학생 존재 확인
  const { data: studentRow, error: studentErr } = await admin
    .from("students")
    .select("id, tenant_id, school_name, student_number, grade, target_major")
    .eq("id", args.studentId)
    .maybeSingle();
  if (studentErr) throw studentErr;
  if (!studentRow) {
    console.error(`❌ student not found: ${args.studentId}`);
    process.exit(1);
  }
  if (studentRow.tenant_id !== args.tenantId) {
    console.error(
      `❌ tenant_id mismatch — students.tenant_id=${studentRow.tenant_id}, arg=${args.tenantId}`,
    );
    process.exit(1);
  }
  console.log(
    `  ✓ student: ${studentRow.school_name ?? "(no school)"} ${studentRow.grade ?? "-"}학년 ${studentRow.student_number ?? ""} / target_major=${studentRow.target_major ?? "∅"}`,
  );

  // 1. exploration_levels
  banner("1) student_exploration_levels");
  const slice = { schoolYear: args.schoolYear, semester: args.semester } as const;
  const existingLevel = await getExplorationLevelSnapshot(
    args.studentId,
    args.tenantId,
    slice,
    admin,
  );

  if (existingLevel) {
    console.log(
      `  ✓ 기존 row 존재 (source=${existingLevel.source}, adequate=${existingLevel.adequate_level}, expected=${existingLevel.expected_level}) — NO-OP`,
    );
  } else if (args.dryRun) {
    console.log(
      `  [dry-run] would upsert consultant_override — adequate=${DEFAULTS.adequateLevel} expected=${DEFAULTS.expectedLevel} tier=${DEFAULTS.schoolTier}`,
    );
  } else {
    const inserted = await upsertExplorationLevelConsultantOverride(
      args.studentId,
      args.tenantId,
      { schoolYear: args.schoolYear, semester: args.semester, grade: args.grade },
      {
        adequateLevel: DEFAULTS.adequateLevel,
        expectedLevel: DEFAULTS.expectedLevel,
        overrideReason:
          "1학년 prospective 진입 seed — 성적 데이터 없음, 기본 기대 레벨(인서울) 적용",
        adequateFromGpa: null,
        gpaAverage: null,
        schoolTier: DEFAULTS.schoolTier,
      },
      admin,
    );
    console.log(
      `  ✓ inserted — id=${inserted.id} adequate=${inserted.adequate_level} expected=${inserted.expected_level}`,
    );
  }

  // 2. main_explorations
  banner("2) student_main_explorations");
  const mainSlice = {
    scope: "overall" as const,
    trackLabel: null,
    direction: "design" as const,
  };
  const existingMain = await getActiveMainExploration(
    args.studentId,
    args.tenantId,
    mainSlice,
    admin,
  );

  if (existingMain) {
    console.log(
      `  ✓ 활성 메인 탐구 존재 — id=${existingMain.id} v${existingMain.version} theme="${existingMain.theme_label}" — NO-OP`,
    );
  } else if (args.dryRun) {
    console.log(
      `  [dry-run] would create — scope=overall direction=design role=hypothesis_root theme="${DEFAULTS.themeLabel}"`,
    );
  } else {
    const input: MainExplorationInput = {
      studentId: args.studentId,
      tenantId: args.tenantId,
      pipelineId: null,
      schoolYear: args.schoolYear,
      grade: args.grade,
      semester: args.semester,
      scope: "overall",
      trackLabel: null,
      direction: "design",
      semanticRole: "hypothesis_root",
      source: "consultant",
      pinnedByConsultant: false,
      themeLabel: DEFAULTS.themeLabel,
      themeKeywords: DEFAULTS.themeKeywords,
      careerField: DEFAULTS.careerField,
      tierPlan: SEED_TIER_PLAN,
      identityAlignmentScore: null,
      exemplarReferenceIds: [],
      modelName: null,
    };
    const created = await createMainExploration(input, { isActive: true }, admin);
    console.log(
      `  ✓ created — id=${created.id} v${created.version} role=${created.semantic_role} theme="${created.theme_label}"`,
    );
  }

  banner("done");
}

main().catch((err) => {
  console.error("\n❌ seed failed");
  console.error(err);
  process.exit(1);
});
