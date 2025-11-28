/**
 * Supabase 연결 테스트 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/test-supabase-connection.ts
 */

import { createClient } from "@supabase/supabase-js";

async function testSupabaseConnection() {
  console.log("🔍 Supabase 연결 테스트 시작...\n");

  // 환경 변수 확인 (env.ts를 직접 import하지 않고 process.env로 확인)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("📋 환경 변수 확인:");
  console.log(`  - NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "✅ 설정됨" : "❌ 설정되지 않음"}`);
  if (supabaseUrl) {
    console.log(`    값: ${supabaseUrl}`);
  }
  console.log(`  - NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "✅ 설정됨" : "❌ 설정되지 않음"}`);
  if (supabaseAnonKey) {
    console.log(`    값: ${supabaseAnonKey.substring(0, 20)}...`);
  }
  console.log(`  - SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? "✅ 설정됨" : "❌ 설정되지 않음 (선택사항)"}\n`);

  // 환경 변수 미설정 시 안내
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("⚠️  환경 변수가 설정되지 않았습니다.\n");
    console.log("📝 해결 방법:");
    console.log("  1. 프로젝트 루트에 .env.local 파일 생성");
    console.log("  2. 다음 내용 추가:");
    console.log("     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co");
    console.log("     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here");
    console.log("  3. Supabase Dashboard에서 프로젝트 URL과 API 키 확인");
    console.log("     → Settings → API\n");
    console.log("📚 자세한 내용은 docs/supabase-connection-guide.md 참고\n");
    process.exit(1);
  }

  // 테스트 1: Public Client
  console.log("1️⃣ Public Client 연결 테스트...");
  try {
    const publicClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await publicClient.from("_prisma_migrations").select("id").limit(1);
    
    if (error) {
      console.log("  ❌ 실패:", error.message);
      if (error.code) console.log("  코드:", error.code);
      if (error.hint) console.log("  힌트:", error.hint);
      if (error.details) console.log("  상세:", error.details);
    } else {
      console.log("  ✅ 성공: Public Client로 데이터베이스 연결 성공");
    }
  } catch (error: any) {
    console.log("  ❌ 오류:", error.message);
    if (error.stack) {
      console.log("  스택:", error.stack.split("\n")[0]);
    }
  }

  console.log();

  // 테스트 2: Admin Client
  console.log("2️⃣ Admin Client 연결 테스트...");
  try {
    if (!serviceRoleKey) {
      console.log("  ⚠️  Service Role Key가 설정되지 않아 Admin Client를 생성할 수 없습니다");
      console.log("  💡 Admin Client는 RLS를 우회하므로 서버 사이드 작업에 유용합니다");
    } else {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const { data, error } = await adminClient.from("_prisma_migrations").select("id").limit(1);
      
      if (error) {
        console.log("  ❌ 실패:", error.message);
        if (error.code) console.log("  코드:", error.code);
        if (error.hint) console.log("  힌트:", error.hint);
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
    const publicClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // 여러 테이블 시도 (하나라도 성공하면 OK)
    const testTables = ["students", "users", "profiles"];
    let successCount = 0;
    let lastError: any = null;

    for (const tableName of testTables) {
      const { data, error, count } = await publicClient
        .from(tableName)
        .select("*", { count: "exact", head: true });
      
      if (error) {
        lastError = error;
        continue;
      } else {
        console.log(`  ✅ ${tableName} 테이블 조회 성공 (${count ?? 0}개 행)`);
        successCount++;
        break; // 하나라도 성공하면 중단
      }
    }

    if (successCount === 0) {
      console.log("  ⚠️  테이블 조회 실패 (RLS 정책 또는 테이블이 없을 수 있음)");
      if (lastError) {
        console.log("  마지막 오류:", lastError.message);
        if (lastError.code) console.log("  코드:", lastError.code);
      }
      console.log("  💡 Public Client는 RLS 정책의 영향을 받습니다.");
      console.log("  💡 Admin Client로 테스트하려면 SUPABASE_SERVICE_ROLE_KEY를 설정하세요.");
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

