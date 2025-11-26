/**
 * Supabase 연결 테스트 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/test-supabase-connection.ts
 */

import { createSupabasePublicClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

async function testSupabaseConnection() {
  console.log("🔍 Supabase 연결 테스트 시작...\n");

  // 환경 변수 확인
  console.log("📋 환경 변수 확인:");
  console.log(`  - URL: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`  - Anon Key: ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`);
  console.log(`  - Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ 설정됨" : "❌ 설정되지 않음"}\n`);

  // 테스트 1: Public Client
  console.log("1️⃣ Public Client 연결 테스트...");
  try {
    const publicClient = createSupabasePublicClient();
    const { data, error } = await publicClient.from("_prisma_migrations").select("id").limit(1);
    
    if (error) {
      console.log("  ❌ 실패:", error.message);
      console.log("  상세:", error);
    } else {
      console.log("  ✅ 성공: Public Client로 데이터베이스 연결 성공");
    }
  } catch (error: any) {
    console.log("  ❌ 오류:", error.message);
  }

  console.log();

  // 테스트 2: Admin Client
  console.log("2️⃣ Admin Client 연결 테스트...");
  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.log("  ⚠️  Service Role Key가 설정되지 않아 Admin Client를 생성할 수 없습니다");
    } else {
      const { data, error } = await adminClient.from("_prisma_migrations").select("id").limit(1);
      
      if (error) {
        console.log("  ❌ 실패:", error.message);
        console.log("  상세:", error);
      } else {
        console.log("  ✅ 성공: Admin Client로 데이터베이스 연결 성공");
      }
    }
  } catch (error: any) {
    console.log("  ❌ 오류:", error.message);
  }

  console.log();

  // 테스트 3: 실제 테이블 쿼리
  console.log("3️⃣ 데이터베이스 쿼리 테스트...");
  try {
    const publicClient = createSupabasePublicClient();
    const { data, error, count } = await publicClient
      .from("students")
      .select("*", { count: "exact", head: true });
    
    if (error) {
      console.log("  ❌ 실패:", error.message);
      console.log("  코드:", error.code);
      if (error.hint) console.log("  힌트:", error.hint);
    } else {
      console.log(`  ✅ 성공: students 테이블 조회 성공 (${count ?? 0}개 행)`);
    }
  } catch (error: any) {
    console.log("  ❌ 오류:", error.message);
  }

  console.log();
  console.log("✨ 테스트 완료!");
}

// 스크립트 실행
testSupabaseConnection().catch((error) => {
  console.error("❌ 테스트 실행 중 오류:", error);
  process.exit(1);
});

