"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode } from "@/lib/errors";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import type { CurriculumSettingsData } from "../types";

/**
 * 교육과정 설정 조회
 */
async function _getCurriculumSettings(): Promise<CurriculumSettingsData> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    throw new AppError(
      "Super Admin만 접근할 수 있습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

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
    throw new AppError(
      error.message || "설정 조회에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
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

  return settings;
}

export const getCurriculumSettings = withActionResponse(_getCurriculumSettings);

/**
 * 교육과정 설정 업데이트
 */
async function _updateCurriculumSettings(formData: FormData): Promise<void> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    throw new AppError(
      "Super Admin만 접근할 수 있습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // FormData에서 값 추출
  const middle_2022 = parseInt(formData.get("middle_2022") as string, 10);
  const high_2022 = parseInt(formData.get("high_2022") as string, 10);
  const middle_2015 = parseInt(formData.get("middle_2015") as string, 10);
  const high_2015 = parseInt(formData.get("high_2015") as string, 10);

  // 유효성 검사
  if (
    isNaN(middle_2022) ||
    isNaN(high_2022) ||
    isNaN(middle_2015) ||
    isNaN(high_2015)
  ) {
    throw new AppError(
      "모든 년도를 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (
    middle_2022 < 2000 ||
    high_2022 < 2000 ||
    middle_2015 < 2000 ||
    high_2015 < 2000
  ) {
    throw new AppError(
      "유효한 년도를 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
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
    const { error } = await supabase.from("system_settings").upsert(
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
      throw new AppError(
        error.message || "설정 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }

  revalidatePath("/superadmin/curriculum-settings");
}

export const updateCurriculumSettings = withActionResponse(
  _updateCurriculumSettings
);
