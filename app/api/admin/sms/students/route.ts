import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentPhonesBatch } from "@/lib/utils/studentPhoneUtils";
import type { StudentDivision } from "@/lib/constants/students";

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
      return NextResponse.json(
        {
          recipients: [],
          total: 0,
          error: "기관 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    // Query Parameters 파싱
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const gradesParam = searchParams.get("grades") || "";
    const divisionsParam = searchParams.get("divisions") || "";
    const recipientTypesParam = searchParams.get("recipientTypes") || "";

    // recipientTypes는 필수
    if (!recipientTypesParam) {
      return NextResponse.json(
        {
          recipients: [],
          total: 0,
          error: "전송 대상자를 선택해주세요.",
        },
        { status: 400 }
      );
    }

    // recipientTypes 파싱
    const recipientTypes = recipientTypesParam
      .split(",")
      .map((t) => t.trim())
      .filter((t): t is RecipientType =>
        t === "student" || t === "mother" || t === "father"
      );

    if (recipientTypes.length === 0) {
      return NextResponse.json(
        {
          recipients: [],
          total: 0,
          error: "유효한 전송 대상자를 선택해주세요.",
        },
        { status: 400 }
      );
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

    // 검색 필터 (이름)
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: students, error: studentsError } = await query;

    if (studentsError) {
      console.error("[SMS Students API] 학생 조회 실패:", studentsError);
      return NextResponse.json(
        {
          recipients: [],
          total: 0,
          error: "학생 정보를 조회하는 중 오류가 발생했습니다.",
        },
        { status: 500 }
      );
    }

    if (!students || students.length === 0) {
      return NextResponse.json({
        recipients: [],
        total: 0,
      });
    }

    // 학생 ID 목록 추출
    const studentIds = students.map((s) => s.id);

    // 연락처 정보 일괄 조회
    const phoneDataList = await getStudentPhonesBatch(studentIds);
    const phoneDataMap = new Map(phoneDataList.map((p) => [p.id, p]));

    // 연락처 단위로 recipients 생성
    const recipients: SMSRecipient[] = [];

    for (const student of students) {
      const phoneData = phoneDataMap.get(student.id);
      if (!phoneData) continue;

      // 각 recipientType에 대해 연락처가 있으면 추가
      for (const recipientType of recipientTypes) {
        let phone: string | null = null;

        switch (recipientType) {
          case "student":
            phone = phoneData.phone;
            break;
          case "mother":
            phone = phoneData.mother_phone;
            break;
          case "father":
            phone = phoneData.father_phone;
            break;
        }

        // 연락처가 있고, 검색어가 있으면 전화번호로도 검색
        if (phone) {
          const matchesSearch =
            !search ||
            student.name?.toLowerCase().includes(search.toLowerCase()) ||
            phone.includes(search);

          if (matchesSearch) {
            recipients.push({
              studentId: student.id,
              studentName: student.name || "이름 없음",
              grade: student.grade || null,
              division: (student.division as StudentDivision) || null,
              recipientType,
              phone,
            });
          }
        }
      }
    }

    return NextResponse.json({
      recipients,
      total: recipients.length,
    });
  } catch (error: unknown) {
    console.error("[SMS Students API] 오류:", error);

    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    return NextResponse.json(
      {
        recipients: [],
        total: 0,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

