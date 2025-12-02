"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { revalidatePath } from "next/cache";

/**
 * 사용자 권한 변경
 * 학생 ↔ 학부모 전환
 */
export async function changeUserRole(
  newRole: "student" | "parent"
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await getCurrentUserRole();

  if (!userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // 현재 사용자 정보 조회
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "사용자 정보를 찾을 수 없습니다." };
    }

    // user_metadata에서 tenant_id 가져오기
    let tenantId = (user.user_metadata?.tenant_id as string) || null;

    // tenant_id가 없으면 기본 tenant 조회
    if (!tenantId) {
      const { data: defaultTenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id")
        .eq("name", "Default Tenant")
        .maybeSingle();

      if (tenantError) {
        console.error("[userRole] Default Tenant 조회 실패:", tenantError);
        return {
          success: false,
          error: "기본 기관 정보를 조회할 수 없습니다.",
        };
      }

      if (!defaultTenant) {
        console.error("[userRole] Default Tenant가 존재하지 않습니다.");
        return {
          success: false,
          error:
            "기본 기관 정보가 설정되지 않았습니다. 관리자에게 문의하세요.",
        };
      }

      tenantId = defaultTenant.id;
    }

    if (newRole === "student") {
      // 학부모 → 학생 전환
      // 1. parent_users 테이블에서 레코드 삭제
      const { error: deleteParentError } = await supabase
        .from("parent_users")
        .delete()
        .eq("id", userId);

      if (deleteParentError && deleteParentError.code !== "PGRST116") {
        console.error("[userRole] 학부모 레코드 삭제 실패:", deleteParentError);
        // 레코드가 없어도 계속 진행
      }

      // 2. students 테이블에 레코드 생성 (기본 정보만)
      // 학생 정보는 /settings에서 입력하도록 안내
      const displayName = (user.user_metadata?.display_name as string) || "이름 없음";
      const { error: createStudentError } = await supabase
        .from("students")
        .upsert({
          id: userId,
          user_id: userId,
          tenant_id: tenantId,
          name: displayName, // name은 필수 필드
          grade: null,
          school_id: null,
          school_type: null,
        });

      if (createStudentError) {
        console.error("[userRole] 학생 레코드 생성 실패:", createStudentError);
        return {
          success: false,
          error: createStudentError.message || "학생 권한 변경에 실패했습니다.",
        };
      }

      // 3. user_metadata 업데이트
      await supabase.auth.updateUser({
        data: {
          signup_role: "student",
        },
      });
    } else {
      // 학생 → 학부모 전환
      // 1. students 테이블에서 레코드 삭제 (id 또는 user_id로 조회)
      let deleteStudentError = null;
      
      // id로 먼저 시도
      const { error: error1 } = await supabase
        .from("students")
        .delete()
        .eq("id", userId);
      
      if (error1) {
        // user_id로 시도
        const { error: error2 } = await supabase
          .from("students")
          .delete()
          .eq("user_id", userId);
        
        deleteStudentError = error2;
      }

      if (deleteStudentError && deleteStudentError.code !== "PGRST116") {
        console.error("[userRole] 학생 레코드 삭제 실패:", deleteStudentError);
        // 레코드가 없어도 계속 진행
      }

      // 2. parent_users 테이블에 레코드 생성
      const { error: createParentError } = await supabase
        .from("parent_users")
        .upsert({
          id: userId,
          tenant_id: tenantId,
          relationship: null,
          occupation: null,
        });

      if (createParentError) {
        console.error("[userRole] 학부모 레코드 생성 실패:", createParentError);
        return {
          success: false,
          error: createParentError.message || "학부모 권한 변경에 실패했습니다.",
        };
      }

      // 3. user_metadata 업데이트
      await supabase.auth.updateUser({
        data: {
          signup_role: "parent",
        },
      });
    }

    revalidatePath("/settings");
    revalidatePath("/parent/settings");

    return { success: true };
  } catch (error) {
    console.error("[userRole] 권한 변경 중 오류:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "권한 변경 중 오류가 발생했습니다.",
    };
  }
}

