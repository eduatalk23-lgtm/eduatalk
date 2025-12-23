/**
 * student_divisions 테이블 존재 여부 확인 스크립트
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function checkTable() {
  console.log("🔍 student_divisions 테이블 확인 중...\n");

  // Admin 클라이언트로 확인
  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    console.log("✅ Admin 클라이언트 생성 성공");
    const { data, error } = await adminClient
      .from("student_divisions")
      .select("count")
      .limit(1);

    if (error) {
      console.error("❌ Admin 클라이언트 조회 실패:", error.message);
      console.error("   에러 코드:", error.code);
      console.error("   에러 상세:", error.details);
      console.error("   에러 힌트:", error.hint);
    } else {
      console.log("✅ Admin 클라이언트로 테이블 조회 성공");
      console.log("   데이터:", data);
    }
  } else {
    console.log("⚠️  Admin 클라이언트 생성 실패 (Service Role Key 없음)");
  }

  // Server 클라이언트로 확인
  console.log("\n---\n");
  const serverClient = await createSupabaseServerClient();
  console.log("✅ Server 클라이언트 생성 성공");
  
  const { data: serverData, error: serverError } = await serverClient
    .from("student_divisions")
    .select("count")
    .limit(1);

  if (serverError) {
    console.error("❌ Server 클라이언트 조회 실패:", serverError.message);
    console.error("   에러 코드:", serverError.code);
    console.error("   에러 상세:", serverError.details);
    console.error("   에러 힌트:", serverError.hint);
  } else {
    console.log("✅ Server 클라이언트로 테이블 조회 성공");
    console.log("   데이터:", serverData);
  }

  // 직접 쿼리로 확인
  console.log("\n---\n");
  if (adminClient) {
    const { data: queryData, error: queryError } = await adminClient.rpc(
      "exec_sql",
      {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'student_divisions';
        `,
      }
    );

    if (queryError) {
      console.log("⚠️  직접 쿼리 실행 실패 (정상일 수 있음):", queryError.message);
    } else {
      console.log("✅ 직접 쿼리 결과:", queryData);
    }
  }
}

checkTable().catch(console.error);




