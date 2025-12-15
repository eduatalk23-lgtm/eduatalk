import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ConsentData, ConsentMetadata, ConsentType } from "@/lib/types/auth";

/**
 * 사용자 약관 동의 정보 저장
 * @param userId 사용자 ID
 * @param consents 약관 동의 데이터
 * @param metadata 선택적 메타데이터 (IP 주소, User Agent)
 * @param useAdmin 회원가입 시에는 세션이 없으므로 Admin 클라이언트 사용
 */
export async function saveUserConsents(
  userId: string,
  consents: ConsentData,
  metadata?: ConsentMetadata,
  useAdmin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // 회원가입 시에는 세션이 없으므로 Admin 클라이언트 사용 (RLS 우회)
    const supabase = useAdmin
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();

    if (!supabase) {
      console.error("[userConsents] 클라이언트 생성 실패");
      return {
        success: false,
        error: "서버 설정 오류입니다. 관리자에게 문의하세요.",
      };
    }

    // 약관 동의 데이터를 배열로 변환
    const consentRecords: Array<{
      user_id: string;
      consent_type: ConsentType;
      consented: boolean;
      ip_address?: string | null;
      user_agent?: string | null;
    }> = [
      {
        user_id: userId,
        consent_type: "terms",
        consented: consents.terms,
        ip_address: metadata?.ip_address || null,
        user_agent: metadata?.user_agent || null,
      },
      {
        user_id: userId,
        consent_type: "privacy",
        consented: consents.privacy,
        ip_address: metadata?.ip_address || null,
        user_agent: metadata?.user_agent || null,
      },
      {
        user_id: userId,
        consent_type: "marketing",
        consented: consents.marketing,
        ip_address: metadata?.ip_address || null,
        user_agent: metadata?.user_agent || null,
      },
    ];

    // 약관 동의 정보 저장 (UPSERT 사용하여 중복 시 업데이트)
    const { error } = await supabase.from("user_consents").upsert(consentRecords, {
      onConflict: "user_id,consent_type",
    });

    if (error) {
      console.error("[userConsents] 약관 동의 저장 실패:", {
        userId,
        error: error.message,
        code: error.code,
      });
      return {
        success: false,
        error: error.message || "약관 동의 정보 저장에 실패했습니다.",
      };
    }

    console.log("[userConsents] 약관 동의 저장 성공:", { userId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[userConsents] 약관 동의 저장 예외:", {
      userId,
      error: errorMessage,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 사용자의 약관 동의 정보 조회
 * @param userId 사용자 ID
 */
export async function getUserConsents(userId: string): Promise<{
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
} | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("user_consents")
      .select("consent_type, consented")
      .eq("user_id", userId);

    if (error) {
      console.error("[userConsents] 약관 동의 조회 실패:", {
        userId,
        error: error.message,
        code: error.code,
      });
      return null;
    }

    // 데이터를 객체로 변환
    const consents = {
      terms: false,
      privacy: false,
      marketing: false,
    };

    data?.forEach((record) => {
      if (record.consent_type === "terms") {
        consents.terms = record.consented;
      } else if (record.consent_type === "privacy") {
        consents.privacy = record.consented;
      } else if (record.consent_type === "marketing") {
        consents.marketing = record.consented;
      }
    });

    return consents;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[userConsents] 약관 동의 조회 예외:", {
      userId,
      error: errorMessage,
    });
    return null;
  }
}

