import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  searchStudentsUnified,
  type StudentSearchParams,
} from "@/lib/data/studentSearch";
import type { StudentDivision } from "@/lib/constants/students";

/**
 * 학생 통합 검색 API
 * GET /api/students/search
 * 
 * Query Parameters:
 *   - q: string (검색어, 필수)
 *   - type: "name" | "phone" | "all" (검색 타입, 선택)
 *   - grade: string (학년 필터, 선택)
 *   - class: string (반 필터, 선택)
 *   - division: string (구분 필터, 선택)
 *   - isActive: boolean (활성 상태 필터, 선택)
 *   - limit: number (결과 제한, 기본값: 50)
 *   - offset: number (페이지 오프셋, 기본값: 0)
 *   - excludeIds: string (제외할 학생 ID, 쉼표로 구분, 선택)
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
        },
        { status: 401 }
      );
    }

    // 권한 확인 (admin 또는 parent만 접근 가능)
    if (role !== "admin" && role !== "parent" && role !== "consultant") {
      return NextResponse.json(
        {
          success: false,
          error: "접근 권한이 없습니다.",
        },
        { status: 403 }
      );
    }

    // Tenant Context 조회
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId ?? null;

    // Query Parameters 파싱
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const searchType = searchParams.get("type") as
      | "name"
      | "phone"
      | "all"
      | null;
    const grade = searchParams.get("grade") || undefined;
    const classFilter = searchParams.get("class") || undefined;
    const divisionParam = searchParams.get("division") || undefined;
    const isActiveParam = searchParams.get("isActive");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const excludeIdsParam = searchParams.get("excludeIds");

    // 검색어 필수 확인
    if (!query.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "검색어를 입력해주세요.",
        },
        { status: 400 }
      );
    }

    // 필터 파싱
    const filters: StudentSearchParams["filters"] = {};
    
    if (grade) {
      filters.grade = grade;
    }
    if (classFilter) {
      filters.class = classFilter;
    }
    if (divisionParam) {
      filters.division =
        divisionParam === "null"
          ? null
          : (divisionParam as StudentDivision);
    }
    if (isActiveParam !== null && isActiveParam !== undefined) {
      filters.isActive = isActiveParam === "true";
    }

    // 페이지네이션 파싱
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // 제외할 학생 ID 파싱
    const excludeStudentIds = excludeIdsParam
      ? excludeIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : [];

    // 검색 실행
    const searchParams_: StudentSearchParams = {
      query,
      searchType: searchType || undefined,
      filters,
      limit: Math.min(limit, 100), // 최대 100개로 제한
      offset,
      role: role === "consultant" ? "admin" : role,
      excludeStudentIds,
      tenantId,
    };

    const result = await searchStudentsUnified(searchParams_);

    return NextResponse.json({
      success: true,
      data: {
        students: result.students,
        total: result.total,
      },
    });
  } catch (error: unknown) {
    console.error("[API] 학생 검색 오류:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "학생 검색 중 오류가 발생했습니다.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

