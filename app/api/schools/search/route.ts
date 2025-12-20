import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";
import {
  getSchoolByUnifiedId,
  searchAllSchools,
  type SchoolSimple,
} from "@/lib/data/schools";

type School = {
  id: string;
  name: string;
  type: string | null;
  region: string | null;
};

// 학교 타입 매핑 (한글 -> 영문)
const SCHOOL_TYPE_MAP: Record<string, "MIDDLE" | "HIGH" | "UNIVERSITY"> = {
  "중학교": "MIDDLE",
  "고등학교": "HIGH",
  "대학교": "UNIVERSITY",
};

// 학교 타입 매핑 (영문 -> 한글)
const SCHOOL_TYPE_REVERSE_MAP: Record<"MIDDLE" | "HIGH" | "UNIVERSITY", string> = {
  MIDDLE: "중학교",
  HIGH: "고등학교",
  UNIVERSITY: "대학교",
};

/**
 * 학교 검색 API
 * GET /api/schools/search?q=검색어&type=대학교
 *
 * @returns
 * 성공: { success: true, data: { schools: School[] } }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "";
    const name = searchParams.get("name");

    // ID로 조회
    if (id) {
      const school = await getSchoolByUnifiedId(id);

      if (!school) {
        return apiSuccess({ schools: [] });
      }

      return apiSuccess({
        schools: [
          {
            id: school.id,
            name: school.name,
            type: SCHOOL_TYPE_REVERSE_MAP[school.school_type] as string,
            region: school.region,
          },
        ],
      });
    }

    // 학교명으로 직접 조회
    if (name) {
      const results = await searchAllSchools({
        query: name,
        limit: 1,
      });

      if (results.length === 0) {
        return apiSuccess({ schools: [] });
      }

      const school = results[0];
      return apiSuccess({
        schools: [
          {
            id: school.id,
            name: school.name,
            type: SCHOOL_TYPE_REVERSE_MAP[school.schoolType] as string,
            region: school.region,
          },
        ],
      });
    }

    // 타입 검증
    if (type && !["중학교", "고등학교", "대학교"].includes(type)) {
      return apiBadRequest("유효하지 않은 학교 타입입니다.", {
        validTypes: ["중학교", "고등학교", "대학교"],
      });
    }

    // 검색 쿼리
    const schoolType = type ? SCHOOL_TYPE_MAP[type] : undefined;
    const results = await searchAllSchools({
      query: query.trim(),
      schoolType,
      limit: 50,
    });

    // API 응답 형식에 맞게 변환
    const schools: School[] = results.map((school) => ({
      id: school.id,
      name: school.name,
      type: SCHOOL_TYPE_REVERSE_MAP[school.schoolType] as string,
      region: school.region,
    }));

    return apiSuccess({ schools });
  } catch (error) {
    return handleApiError(error, "[api/schools/search] 오류");
  }
}
