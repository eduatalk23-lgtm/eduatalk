/**
 * Supabase 마이그레이션 히스토리 리셋 실행 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/execute-migration-reset.ts
 */

// 환경 변수 로드
import { config } from "dotenv";
import { resolve } from "path";

// .env.local 파일 로드
config({ path: resolve(process.cwd(), ".env.local") });

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function executeMigrationReset() {
  console.log("=== Supabase 마이그레이션 히스토리 리셋 시작 ===\n");

  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    console.error("❌ Supabase Admin Client를 생성할 수 없습니다.");
    console.error("SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되어 있는지 확인하세요.");
    process.exit(1);
  }

  try {
    // 1. 현재 마이그레이션 히스토리 확인
    console.log("1️⃣ 현재 마이그레이션 히스토리 확인 중...");
    const { data: currentMigrations, error: selectError } = await adminClient
      .from("supabase_migrations.schema_migrations")
      .select("*")
      .order("version", { ascending: false });

    if (selectError) {
      console.error("❌ 마이그레이션 히스토리 조회 실패:", selectError.message);
      console.error("테이블이 존재하지 않을 수 있습니다. Supabase Dashboard에서 직접 실행하세요.");
      process.exit(1);
    }

    console.log(`   발견된 마이그레이션 수: ${currentMigrations?.length || 0}`);
    if (currentMigrations && currentMigrations.length > 0) {
      console.log("   최근 마이그레이션:");
      currentMigrations.slice(0, 5).forEach((m: any) => {
        console.log(`     - ${m.version}: ${m.name}`);
      });
    }

    // 2. 확인 요청
    console.log("\n⚠️  경고: 기존 마이그레이션 히스토리가 모두 삭제됩니다.");
    console.log("   데이터는 보존되지만, 마이그레이션 히스토리만 삭제됩니다.\n");

    // 3. 기존 마이그레이션 히스토리 삭제
    console.log("2️⃣ 기존 마이그레이션 히스토리 삭제 중...");
    const { error: deleteError } = await adminClient
      .from("supabase_migrations.schema_migrations")
      .delete()
      .neq("version", "0"); // 모든 레코드 삭제

    if (deleteError) {
      console.error("❌ 마이그레이션 히스토리 삭제 실패:", deleteError.message);
      process.exit(1);
    }

    console.log("   ✓ 기존 마이그레이션 히스토리 삭제 완료");

    // 4. 새로운 초기 마이그레이션 등록
    console.log("\n3️⃣ 새로운 초기 마이그레이션 등록 중...");
    const { error: insertError } = await adminClient
      .from("supabase_migrations.schema_migrations")
      .insert({
        version: "20250131000000",
        name: "initial_schema",
        statements: [],
      });

    if (insertError) {
      console.error("❌ 초기 마이그레이션 등록 실패:", insertError.message);
      process.exit(1);
    }

    console.log("   ✓ 초기 마이그레이션 등록 완료");

    // 5. 확인
    console.log("\n4️⃣ 마이그레이션 히스토리 확인 중...");
    const { data: newMigrations, error: verifyError } = await adminClient
      .from("supabase_migrations.schema_migrations")
      .select("*")
      .order("version", { ascending: false });

    if (verifyError) {
      console.error("❌ 확인 실패:", verifyError.message);
      process.exit(1);
    }

    console.log("   현재 마이그레이션 히스토리:");
    newMigrations?.forEach((m: any) => {
      console.log(`     ✓ ${m.version}: ${m.name}`);
    });

    console.log("\n=== 마이그레이션 히스토리 리셋 완료 ===");
    console.log("\n다음 단계:");
    console.log("1. npx supabase migration list 명령으로 확인");
    console.log("2. 새로운 마이그레이션 생성: npx supabase migration new <name>");
    console.log("3. 마이그레이션 적용: npx supabase db push");
  } catch (error: any) {
    console.error("\n❌ 오류 발생:", error.message);
    console.error("\n대안: Supabase Dashboard > SQL Editor에서 다음 SQL을 실행하세요:");
    console.log("\n" + "=".repeat(60));
    console.log(`
DELETE FROM supabase_migrations.schema_migrations;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);

SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;
    `);
    console.log("=".repeat(60));
    process.exit(1);
  }
}

executeMigrationReset();

