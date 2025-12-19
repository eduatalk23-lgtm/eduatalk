import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentPhonesBatch } from "@/lib/utils/studentPhoneUtils";
import type { StudentDivision } from "@/lib/constants/students";
import {
  apiSuccess,
  apiBadRequest,
  apiNotFound,
  handleApiError,
} from "@/lib/api";

export type RecipientType = "student" | "mother" | "father";

export type SMSRecipient = {
  studentId: string;
  studentName: string;
  grade: string | null;
  division: StudentDivision | null;
  recipientType: RecipientType;
  phone: string;
};

export type SMSStudentsResponse = {
  recipients: SMSRecipient[];
  total: number;
};

/**
 * SMS 발송용 학생 조회 API
 * GET /api/admin/sms/students
 * Query Parameters:
 *   - search: string (이름/전화번호 검색)
 *   - grades: string (쉼표로 구분, 예: "1,2,3")
 *   - divisions: string (쉼표로 구분, 예: "고등부,중등부,null")
 *   - recipientTypes: string (쉼표로 구분, 예: "mother,father", 필수)
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      return apiNotFound("기관 정보를 찾을 수 없습니다.");
    }

    // Query Parameters 파싱
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const gradesParam = searchParams.get("grades") || "";
    const divisionsParam = searchParams.get("divisions") || "";
    const recipientTypesParam = searchParams.get("recipientTypes") || "";

    // recipientTypes는 필수
    if (!recipientTypesParam) {
      return apiBadRequest("전송 대상자를 선택해주세요.");
    }

    // recipientTypes 파싱
    const recipientTypes = recipientTypesParam
      .split(",")
      .map((t) => t.trim())
      .filter((t): t is RecipientType =>
        t === "student" || t === "mother" || t === "father"
      );

    if (recipientTypes.length === 0) {
      return apiBadRequest("유효한 전송 대상자를 선택해주세요.");
    }

    // grades 파싱
    const grades = gradesParam
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    // divisions 파싱 (null 값 처리)
    const divisionsRaw = divisionsParam
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
    const divisions: (StudentDivision | null)[] = divisionsRaw.map((d) =>
      d === "null" ? null : (d as StudentDivision)
    );

    const supabase = await createSupabaseServerClient();

    // 학생 조회 쿼리 빌드
    let query = supabase
      .from("students")
      .select("id, name, grade, division")
      .eq("is_active", true)
      .order("name", { ascending: true });

    // 학년 필터
    if (grades.length > 0) {
      query = query.in("grade", grades);
    }

    // 구분 필터
    if (divisions.length > 0) {
      // null 값이 포함된 경우 OR 조건 처리
      const hasNull = divisions.includes(null);
      const nonNullDivisions = divisions.filter(
        (d): d is StudentDivision => d !== null
      );

      if (hasNull && nonNullDivisions.length > 0) {
        // null과 특정 구분 모두 포함
        query = query.or(
          `division.is.null,division.in.(${nonNullDivisions.join(",")})`
        );
      } else if (hasNull) {
        // null만
        query = query.is("division", null);
      } else {
        // 특정 구분만
        query = query.in("division", nonNullDivisions);
      }
    }

    // 통합 검색 함수 사용 (이름 + 연락처 검색 지원)
    let students: Array<{
      id: string;
      name: string | null;
      grade: string | null;
      division: StudentDivision | null;
      phone: string | null;
      mother_phone: string | null;
      father_phone: string | null;
    }> = [];

    if (search) {
      // 통합 검색 함수 사용
      const { searchStudentsUnified } = await import("@/lib/data/studentSearch");
      const { getTenantContext } = await import("@/lib/tenant/getTenantContext");
      const tenantContext = await getTenantContext();

      const searchResult = await searchStudentsUnified({
        query: search,
        filters: {
          grade: grades.length > 0 ? grades[0] : undefined, // 첫 번째 학년만 사용 (기존 로직 유지)
          division: divisions.length > 0 ? divisions[0] : undefined,
          isActive: true,
        },
        limit: 1000, // SMS 발송은 많은 학생을 조회할 수 있음
        role: "admin",
        tenantId: tenantContext?.tenantId ?? null,
      });

      students = searchResult.students.map((s) => ({
        id: s.id,
        name: s.name,
        grade: s.grade,
        division: s.division,
        phone: s.phone,
        mother_phone: s.mother_phone,
        father_phone: s.father_phone,
      }));
    } else {
      // 검색어가 없으면 기존 방식 사용
      const { data: studentsData, error: studentsError } = await query;

      if (studentsError) {
        return handleApiError(studentsError, "[api/admin/sms/students] 학생 조회 실패");
      }

      if (!studentsData || studentsData.length === 0) {
        return apiSuccess({
          recipients: [],
          total: 0,
        });
      }

      // 학생 ID 목록 추출
      const studentIds = studentsData.map((s) => s.id);

      // 연락처 정보 일괄 조회
      const phoneDataList = await getStudentPhonesBatch(studentIds);
      const phoneDataMap = new Map(phoneDataList.map((p) => [p.id, p]));

      students = studentsData.map((s) => {
        const phoneData = phoneDataMap.get(s.id);
        return {
          id: s.id,
          name: s.name,
          grade: s.grade,
          division: s.division as StudentDivision | null,
          phone: phoneData?.phone ?? null,
          mother_phone: phoneData?.mother_phone ?? null,
          father_phone: phoneData?.father_phone ?? null,
        };
      });
    }

    // 연락처 단위로 recipients 생성
    const recipients: SMSRecipient[] = [];

    for (const student of students) {
      // 각 recipientType에 대해 연락처가 있으면 추가
      for (const recipientType of recipientTypes) {
        let phone: string | null = null;

        switch (recipientType) {
          case "student":
            phone = student.phone;
            break;
          case "mother":
            phone = student.mother_phone;
            break;
          case "father":
            phone = student.father_phone;
            break;
        }

        // 연락처가 있으면 추가 (통합 검색 함수에서 이미 필터링됨)
        if (phone) {
          recipients.push({
            studentId: student.id,
            studentName: student.name || "이름 없음",
            grade: student.grade || null,
            division: student.division || null,
            recipientType,
            phone,
          });
        }
      }
    }

    return apiSuccess({
      recipients,
      total: recipients.length,
    });
  } catch (error) {
    return handleApiError(error, "[api/admin/sms/students]");
  }
}

