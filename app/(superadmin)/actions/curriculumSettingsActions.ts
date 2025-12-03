"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CurriculumSetting = {
  id: string;
  key: string;
  value: { start_year: number };
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CurriculumSettingsData = {
  middle_2022: number;
  high_2022: number;
  middle_2015: number;
  high_2015: number;
};

/**
 * 교육과정 설정 조회
 */
export async function getCurriculumSettings(): Promise<{
  success: boolean;
  data?: CurriculumSettingsData;
  error?: string;
}> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    return { success: false, error: "Super Admin만 접근할 수 있습니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .in("key", [
        "curriculum_revision_middle_2022",
        "curriculum_revision_high_2022",
        "curriculum_revision_middle_2015",
        "curriculum_revision_high_2015",
      ]);

    if (error) {
      console.error("[curriculum-settings] 설정 조회 실패", error);
      return { success: false, error: error.message || "설정 조회에 실패했습니다." };
    }

    // 기본값 설정
    const settings: CurriculumSettingsData = {
      middle_2022: 2025,
      high_2022: 2025,
      middle_2015: 2018,
      high_2015: 2018,
    };

    // 데이터베이스에서 조회한 값으로 업데이트
    if (data) {
      for (const item of data) {
        const value = item.value as { start_year: number };
        if (item.key === "curriculum_revision_middle_2022") {
          settings.middle_2022 = value.start_year;
        } else if (item.key === "curriculum_revision_high_2022") {
          settings.high_2022 = value.start_year;
        } else if (item.key === "curriculum_revision_middle_2015") {
          settings.middle_2015 = value.start_year;
        } else if (item.key === "curriculum_revision_high_2015") {
          settings.high_2015 = value.start_year;
        }
      }
    }

    return { success: true, data: settings };
  } catch (error) {
    console.error("[curriculum-settings] 설정 조회 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "설정 조회에 실패했습니다.",
    };
  }
}

/**
 * 교육과정 설정 업데이트
 */
export async function updateCurriculumSettings(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    return { success: false, error: "Super Admin만 접근할 수 있습니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // FormData에서 값 추출
    const middle_2022 = parseInt(formData.get("middle_2022") as string, 10);
    const high_2022 = parseInt(formData.get("high_2022") as string, 10);
    const middle_2015 = parseInt(formData.get("middle_2015") as string, 10);
    const high_2015 = parseInt(formData.get("high_2015") as string, 10);

    // 유효성 검사
    if (isNaN(middle_2022) || isNaN(high_2022) || isNaN(middle_2015) || isNaN(high_2015)) {
      return { success: false, error: "모든 년도를 입력해주세요." };
    }

    if (middle_2022 < 2000 || high_2022 < 2000 || middle_2015 < 2000 || high_2015 < 2000) {
      return { success: false, error: "유효한 년도를 입력해주세요." };
    }

    // 업데이트할 설정 목록
    const updates = [
      {
        key: "curriculum_revision_middle_2022",
        value: { start_year: middle_2022 },
        description: "중학교 2022개정 교육과정 시작년도",
      },
      {
        key: "curriculum_revision_high_2022",
        value: { start_year: high_2022 },
        description: "고등학교 2022개정 교육과정 시작년도",
      },
      {
        key: "curriculum_revision_middle_2015",
        value: { start_year: middle_2015 },
        description: "중학교 2015개정 교육과정 시작년도",
      },
      {
        key: "curriculum_revision_high_2015",
        value: { start_year: high_2015 },
        description: "고등학교 2015개정 교육과정 시작년도",
      },
    ];

    // 각 설정 업데이트 (UPSERT)
    for (const update of updates) {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          {
            key: update.key,
            value: update.value,
            description: update.description,
          },
          {
            onConflict: "key",
          }
        );

      if (error) {
        console.error(`[curriculum-settings] ${update.key} 업데이트 실패`, error);
        return {
          success: false,
          error: error.message || "설정 업데이트에 실패했습니다.",
        };
      }
    }

    revalidatePath("/superadmin/curriculum-settings");
    return { success: true };
  } catch (error) {
    console.error("[curriculum-settings] 설정 업데이트 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "설정 업데이트에 실패했습니다.",
    };
  }
}

