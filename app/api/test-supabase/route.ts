import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * Supabase 연결 테스트 API
 * GET /api/test-supabase
 */
export async function GET() {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      environment: {
        url: env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        anonKeyLength: env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      tests: [] as Array<{
        name: string;
        status: "success" | "error";
        message: string;
        details?: any;
      }>,
    };

    // 테스트 1: Public Client 연결 테스트
    try {
      const publicClient = createSupabasePublicClient();
      const { data, error } = await publicClient.from("_prisma_migrations").select("id").limit(1);
      
      if (error) {
        results.tests.push({
          name: "Public Client 연결",
          status: "error",
          message: error.message,
          details: error,
        });
      } else {
        results.tests.push({
          name: "Public Client 연결",
          status: "success",
          message: "Public Client로 데이터베이스 연결 성공",
        });
      }
    } catch (error: any) {
      results.tests.push({
        name: "Public Client 연결",
        status: "error",
        message: error.message || "알 수 없는 오류",
        details: String(error),
      });
    }

    // 테스트 2: Admin Client 연결 테스트
    try {
      const adminClient = createSupabaseAdminClient();
      if (!adminClient) {
        results.tests.push({
          name: "Admin Client 연결",
          status: "error",
          message: "Service Role Key가 설정되지 않았습니다",
        });
      } else {
        const { data, error } = await adminClient.from("_prisma_migrations").select("id").limit(1);
        
        if (error) {
          results.tests.push({
            name: "Admin Client 연결",
            status: "error",
            message: error.message,
            details: error,
          });
        } else {
          results.tests.push({
            name: "Admin Client 연결",
            status: "success",
            message: "Admin Client로 데이터베이스 연결 성공",
          });
        }
      }
    } catch (error: any) {
      results.tests.push({
        name: "Admin Client 연결",
        status: "error",
        message: error.message || "알 수 없는 오류",
        details: String(error),
      });
    }

    // 테스트 3: 간단한 쿼리 테스트 (students 테이블이 있다고 가정)
    try {
      const publicClient = createSupabasePublicClient();
      // 존재할 가능성이 높은 테이블로 테스트
      const { data, error, count } = await publicClient
        .from("students")
        .select("*", { count: "exact", head: true });
      
      if (error) {
        results.tests.push({
          name: "데이터베이스 쿼리 테스트",
          status: "error",
          message: error.message,
          details: { code: error.code, hint: error.hint },
        });
      } else {
        results.tests.push({
          name: "데이터베이스 쿼리 테스트",
          status: "success",
          message: `쿼리 성공 (students 테이블: ${count ?? 0}개 행)`,
        });
      }
    } catch (error: any) {
      results.tests.push({
        name: "데이터베이스 쿼리 테스트",
        status: "error",
        message: error.message || "알 수 없는 오류",
      });
    }

    // 전체 결과 요약
    const successCount = results.tests.filter((t) => t.status === "success").length;
    const totalCount = results.tests.length;
    const allSuccess = successCount === totalCount;

    return NextResponse.json(
      {
        ...results,
        summary: {
          total: totalCount,
          success: successCount,
          failed: totalCount - successCount,
          allPassed: allSuccess,
        },
      },
      { status: allSuccess ? 200 : 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "테스트 실행 중 오류 발생",
        message: error.message,
        details: String(error),
      },
      { status: 500 }
    );
  }
}

