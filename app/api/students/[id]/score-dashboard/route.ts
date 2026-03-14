/**
 * 학생 성적 대시보드 API
 * 
 * GET /api/students/:id/score-dashboard?tenantId=...&grade=...&semester=...
 * 
 * 내신 분석 + 모의고사 분석 + 수시/정시 전략 분석 결과를 반환합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";
import { getMockAnalysis } from "@/lib/scores/mockAnalysis";
import {
  getInternalPercentile,
  analyzeAdmissionStrategy,
} from "@/lib/scores/admissionStrategy";

/**
 * 학생 성적 대시보드 응답 타입
 */
type ScoreDashboardResponse = {
  studentProfile: {
    id: string;
    name: string;
    grade: number | null;
    class: number | null;
    schoolType: string | null;
    schoolYear: number | null;
    termGrade: number | null;
    semester: number | null;
  };
  internalAnalysis: {
    totalGpa: number | null;
    adjustedGpa: number | null;
    zIndex: number | null;
    subjectStrength: Record<string, number>;
  };
  mockAnalysis: {
    recentExam: { examDate: string; examTitle: string } | null;
    avgPercentile: number | null;
    totalStdScore: number | null;
    best3GradeSum: number | null;
  };
  strategyResult: {
    type: string;
    message: string;
    data: {
      internalPct: number | null;
      mockPct: number | null;
      diff: number | null;
    };
  };
};

/**
 * 학생 성적 대시보드 API
 * 
 * 변경사항 (2025-01-XX):
 * - termId 파라미터 지원 추가
 * - grade, semester가 있으면 student_terms에서 termId 조회
 * - student_internal_scores 테이블 기준으로 내신 분석
 * - student_school_scores 참조 제거
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const tenantIdParam = searchParams.get("tenantId");
    const termIdParam = searchParams.get("termId");
    const gradeParam = searchParams.get("grade");
    const semesterParam = searchParams.get("semester");

    // tenantId는 "null" 문자열일 수 있으므로 처리
    const tenantId = tenantIdParam === "null" || tenantIdParam === "undefined" ? null : tenantIdParam;

    // Phase 0: 인증 확인 (병렬)
    const [currentUser, { role: currentRole }] = await Promise.all([
      getCurrentUser(),
      getCachedUserRole(),
    ]);

    // 학생 권한 검증: 학생은 자신의 데이터만 조회 가능
    if (currentRole === "student" && currentUser?.userId !== studentId) {
      console.warn("[api/score-dashboard] 학생 권한 검증 실패", {
        currentUserId: currentUser?.userId,
        requestedStudentId: studentId,
        role: currentRole,
      });

      return NextResponse.json(
        { 
          error: "Forbidden",
          details: "Students can only access their own data",
          currentUserId: currentUser?.userId,
          requestedStudentId: studentId,
        },
        { status: 403 }
      );
    }

    // Supabase 클라이언트 선택
    // 관리자/부모 역할이거나 개발 환경에서는 Admin Client 사용 (RLS 우회)
    // 학생이 자신의 데이터를 조회할 때도 Admin Client 사용 (RLS 우회)
    // 서버 컴포넌트에서 fetch 호출 시 인증 정보가 없을 때도 Admin Client 사용
    const useAdminClient =
      currentRole === "admin" ||
      currentRole === "parent" ||
      process.env.NODE_ENV === "development" ||
      (currentRole === "student" && currentUser?.userId === studentId) ||
      (!currentUser && !currentRole); // 인증 정보가 없을 때도 Admin Client 사용

    let supabase;
    if (useAdminClient) {
      const adminClient = createSupabaseAdminClient();
      if (!adminClient) {
        // Service Role Key가 없으면 경고 로그
        console.warn("[api/score-dashboard] Admin Client 생성 실패 (Service Role Key 없음), Server Client 사용", {
          currentRole,
          studentId,
          currentUserId: currentUser?.userId,
          nodeEnv: process.env.NODE_ENV,
        });
        supabase = await createSupabaseServerClient();
      } else {
        supabase = adminClient;
      }
    } else {
      supabase = await createSupabaseServerClient();
    }

    // 1) 학생 조회 (school_id, school_type 포함, name은 user_profiles에서)
    // tenantId 조건 없이 먼저 조회하여 학생 존재 여부 확인
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, grade, class, school_id, school_type, tenant_id, user_profiles(name)")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      console.error("[api/score-dashboard] 학생 조회 실패", {
        error: studentError,
        code: studentError.code,
        message: studentError.message,
        studentId,
        currentUserId: currentUser?.userId,
        currentRole,
        useAdminClient,
      });

      return NextResponse.json(
        { 
          error: "Failed to fetch student", 
          details: studentError.message,
          studentId,
        },
        { status: 500 }
      );
    }

    if (!student) {
      console.warn("[api/score-dashboard] 학생을 찾을 수 없음", {
        studentId,
        currentUserId: currentUser?.userId,
        currentRole,
        useAdminClient,
      });

      return NextResponse.json(
        { 
          error: "Student not found",
          details: `Student with id ${studentId} does not exist`,
          studentId,
        },
        { status: 404 }
      );
    }

    // tenantId 검증: 요청한 tenantId가 있으면 학생의 tenant_id와 일치하는지 확인
    if (tenantId && student.tenant_id && tenantId !== student.tenant_id) {
      const studentProfile = student.user_profiles as unknown as { name: string | null } | null;
      console.warn("[api/score-dashboard] tenant_id 불일치", {
        studentId,
        requestedTenantId: tenantId,
        actualTenantId: student.tenant_id,
        studentName: studentProfile?.name,
      });
      // 경고만 하고 학생의 실제 tenant_id 사용 (보안상 경고는 남기지만 계속 진행)
    }

    // effectiveTenantId 결정: 요청한 tenantId 또는 학생의 실제 tenant_id
    const effectiveTenantId = tenantId || student.tenant_id;
    
    if (!effectiveTenantId) {
      return NextResponse.json(
        { error: "Tenant ID not found for student" },
        { status: 400 }
      );
    }

    // Phase 2: termId 결정 + curriculum_revisions + 모의고사 + school_info (병렬)
    const resolveTerm = async (): Promise<{
      effectiveTermId: string | null;
      grade: number | null;
      semester: number | null;
    }> => {
      let termId: string | null = termIdParam || null;
      let g: number | null = null;
      let s: number | null = null;

      if (!termId && gradeParam && semesterParam) {
        g = parseInt(gradeParam);
        s = parseInt(semesterParam);

        const { data: termData, error: termError } = await supabase
          .from("student_terms")
          .select("id, grade, semester, school_year")
          .eq("student_id", studentId)
          .eq("grade", g)
          .eq("semester", s)
          .order("school_year", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (termError) {
          console.error("[api/score-dashboard] student_terms 조회 실패", termError);
        } else if (termData) {
          return { effectiveTermId: termData.id, grade: termData.grade, semester: termData.semester };
        }
      }

      if (!termId && (!g || !s)) {
        const { data: recentTerm } = await supabase
          .from("student_terms")
          .select("id, grade, semester, school_year")
          .eq("student_id", studentId)
          .order("school_year", { ascending: false })
          .order("grade", { ascending: false })
          .order("semester", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentTerm) {
          return { effectiveTermId: recentTerm.id, grade: recentTerm.grade, semester: recentTerm.semester };
        }
        return { effectiveTermId: null, grade: student.grade || 2, semester: 1 };
      }

      return { effectiveTermId: termId, grade: g, semester: s };
    };

    const resolveSchoolProperty = async (): Promise<string | null> => {
      if (!student.school_id || (student.school_type !== "MIDDLE" && student.school_type !== "HIGH")) {
        return null;
      }

      let schoolInfoId: number | null = null;
      if (student.school_id.startsWith("SCHOOL_")) {
        const idStr = student.school_id.replace("SCHOOL_", "");
        schoolInfoId = parseInt(idStr, 10);
      } else {
        schoolInfoId = parseInt(student.school_id, 10);
      }

      if (!schoolInfoId || isNaN(schoolInfoId)) return null;

      const { data: schoolInfo, error: schoolInfoError } = await supabase
        .from("school_info")
        .select("school_property")
        .eq("id", schoolInfoId)
        .maybeSingle();

      if (schoolInfoError) {
        console.error("[api/score-dashboard] school_info 조회 실패", schoolInfoError);
        return null;
      }
      return schoolInfo?.school_property ?? null;
    };

    const [termResult, revisionResult, mock, schoolProperty] = await Promise.all([
      resolveTerm(),
      supabase
        .from("curriculum_revisions")
        .select("id")
        .eq("is_active", true)
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getMockAnalysis(effectiveTenantId, studentId),
      resolveSchoolProperty(),
    ]);

    const { effectiveTermId, grade, semester } = termResult;
    const curriculumRevisionId = revisionResult.data?.id || null;

    // Phase 3: 내신 분석 (termId 의존)
    const internal = await getInternalAnalysis(
      effectiveTenantId,
      studentId,
      effectiveTermId || undefined
    );

    // Phase 4: 내신 백분위 환산 (순수 수학)
    const internalPct =
      internal.totalGpa != null && curriculumRevisionId
        ? await getInternalPercentile(curriculumRevisionId, internal.totalGpa)
        : null;

    // Phase 5: 전략 분석 (순수 함수)
    const strategy = analyzeAdmissionStrategy(
      internalPct,
      mock.avgPercentile,
      internal.zIndex,
      mock.best3GradeSum
    );

    // 6) 응답 조립
    const profileData = student.user_profiles as unknown as { name: string | null } | null;
    const response: ScoreDashboardResponse = {
      studentProfile: {
        id: student.id,
        name: profileData?.name ?? "",
        grade: student.grade,
        class: student.class ? parseInt(student.class) : null,
        schoolType: schoolProperty, // school_info.school_property 값
        schoolYear: new Date().getFullYear(), // 현재 연도 사용
        termGrade: grade,
        semester: semester,
      },
      internalAnalysis: {
        totalGpa: internal.totalGpa,
        adjustedGpa: internal.adjustedGpa,
        zIndex: internal.zIndex,
        subjectStrength: internal.subjectStrength,
      },
      mockAnalysis: mock,
      strategyResult: strategy,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/score-dashboard] 에러 발생", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

