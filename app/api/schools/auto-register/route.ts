import { NextRequest } from "next/server";
import { getSchoolByName, getRegions } from "@/lib/data/schools";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

type School = {
  id: string;
  name: string;
  type: string;
  region: string | null;
};

type AutoRegisterResponse = {
  school: School;
};

/**
 * 학교 자동 등록 API
 * POST /api/schools/auto-register
 * 학교 선택 시 DB에 없으면 자동으로 등록
 *
 * @body { name: string, type: string, region?: string }
 * @returns
 * 성공: { success: true, data: { school: School } }
 * 에러: { success: false, error: { code, message } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, region } = body;

    if (!name || !type) {
      return apiBadRequest("학교명과 타입은 필수입니다.");
    }

    if (!["중학교", "고등학교", "대학교"].includes(type)) {
      return apiBadRequest("올바른 학교 타입을 선택하세요. (중학교, 고등학교, 대학교)");
    }

    // 기존 학교 확인
    const existing = await getSchoolByName(name, type);

    if (existing) {
      return apiSuccess<AutoRegisterResponse>({
        school: {
          id: existing.id,
          name: existing.name,
          type: existing.type,
          region: existing.region,
        },
      });
    }

    // 지역 매칭 (region 텍스트로 region_id 찾기)
    let regionId: string | null = null;
    if (region) {
      const regions = await getRegions();
      const matchedRegion = regions.find((r) => r.name === region);
      if (matchedRegion) {
        regionId = matchedRegion.id;
      }
    }

    // 새로 등록
    const supabase = await createSupabaseServerClient();
    const { data: newSchool, error } = await supabase
      .from("schools")
      .insert({
        name,
        type,
        region_id: regionId,
      })
      .select("id, name, type")
      .single();

    if (error) {
      return handleApiError(error, "[api/schools/auto-register] 등록 실패");
    }

    // 지역 정보 포함하여 반환
    const schoolWithRegion = await getSchoolByName(name, type);

    return apiSuccess<AutoRegisterResponse>({
      school: schoolWithRegion
        ? {
            id: schoolWithRegion.id,
            name: schoolWithRegion.name,
            type: schoolWithRegion.type,
            region: schoolWithRegion.region,
          }
        : {
            id: newSchool.id,
            name: newSchool.name,
            type: newSchool.type,
            region: null,
          },
    });
  } catch (error) {
    return handleApiError(error, "[api/schools/auto-register]");
  }
}
