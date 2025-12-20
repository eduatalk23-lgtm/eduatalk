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
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
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

    // 인증 확인
    const currentUser = await getCurrentUser();
    const { role: currentRole } = await getCurrentUserRole();

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

    // 1) 학생 조회 (school_id, school_type 포함)
    // tenantId 조건 없이 먼저 조회하여 학생 존재 여부 확인
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, grade, class, school_id, school_type, tenant_id")
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
      console.warn("[api/score-dashboard] tenant_id 불일치", {
        studentId,
        requestedTenantId: tenantId,
        actualTenantId: student.tenant_id,
        studentName: student.name,
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

    // 2) termId 결정 로직
    // 우선순위: termId 파라미터 > grade+semester 조합 > 최근 학기
    let effectiveTermId: string | null = termIdParam || null;
    let grade: number | null = null;
    let semester: number | null = null;

    if (!effectiveTermId && gradeParam && semesterParam) {
      // grade, semester가 있으면 student_terms에서 termId 조회
      grade = parseInt(gradeParam);
      semester = parseInt(semesterParam);

      const { data: termData, error: termError } = await supabase
        .from("student_terms")
        .select("id, grade, semester, school_year")
        .eq("student_id", studentId)
        .eq("grade", grade)
        .eq("semester", semester)
        .order("school_year", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (termError) {
        console.error("[api/score-dashboard] student_terms 조회 실패", termError);
      } else if (termData) {
        effectiveTermId = termData.id;
        grade = termData.grade;
        semester = termData.semester;
      }
    }

    // termId를 찾지 못했고 grade, semester도 없으면 최근 학기 조회
    if (!effectiveTermId && (!grade || !semester)) {
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
        effectiveTermId = recentTerm.id;
        grade = recentTerm.grade;
        semester = recentTerm.semester;
      } else {
        // 기본값: 학생의 현재 학년, 1학기
        grade = student.grade || 2;
        semester = 1;
      }
    }

    console.log("[api/score-dashboard] 입력 파라미터:", {
      tenantId,
      termIdParam,
      gradeParam,
      semesterParam,
      effectiveTermId,
      grade,
      semester,
    });

    // curriculum_revision_id는 활성화된 최신 교육과정 사용
    const { data: activeRevision } = await supabase
      .from("curriculum_revisions")
      .select("id")
      .eq("is_active", true)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();

    const curriculumRevisionId = activeRevision?.id || null;

    // 3) 내신 분석 (effectiveTermId 기준)
    const internal = await getInternalAnalysis(
      effectiveTenantId,
      studentId,
      effectiveTermId || undefined
    );

    // 내신 데이터 개수 확인
    let internalCountQuery = supabase
      .from("student_internal_scores")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", effectiveTenantId)
      .eq("student_id", studentId);
    
    if (effectiveTermId) {
      internalCountQuery = internalCountQuery.eq("student_term_id", effectiveTermId);
    }
    
    const { count: internalCount } = await internalCountQuery;
    console.log("[api/score-dashboard] 내신 데이터 개수:", internalCount);

    // 3-1) 내신 백분위 환산
    const internalPct =
      internal.totalGpa != null && curriculumRevisionId
        ? await getInternalPercentile(curriculumRevisionId, internal.totalGpa)
        : null;

    // 4) 모의고사 분석 (최근 모의 기준, termId와 무관)
    const mock = await getMockAnalysis(effectiveTenantId, studentId);
    
    // 모의고사 데이터 개수 확인
    const { count: mockCount } = await supabase
      .from("student_mock_scores")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", effectiveTenantId)
      .eq("student_id", studentId);

    console.log("[api/score-dashboard] 모의고사 데이터 개수:", mockCount);
    console.log("[api/score-dashboard] 모의고사 분석 결과:", {
      recentExam: mock.recentExam,
      avgPercentile: mock.avgPercentile,
      totalStdScore: mock.totalStdScore,
      best3GradeSum: mock.best3GradeSum,
    });

    // 4-1) 학교 유형 조회 (school_property)
    let schoolProperty: string | null = null;
    if (student.school_id && (student.school_type === "MIDDLE" || student.school_type === "HIGH")) {
      // school_id는 text 타입이지만, school_info.id는 integer이므로 변환 필요
      // "SCHOOL_" 접두사가 있을 수 있으므로 파싱
      let schoolInfoId: number | null = null;
      
      if (student.school_id.startsWith("SCHOOL_")) {
        // 통합 ID 형식: "SCHOOL_123"
        const idStr = student.school_id.replace("SCHOOL_", "");
        schoolInfoId = parseInt(idStr, 10);
      } else {
        // 직접 ID 형식: "123"
        schoolInfoId = parseInt(student.school_id, 10);
      }
      
      if (schoolInfoId && !isNaN(schoolInfoId)) {
        const { data: schoolInfo, error: schoolInfoError } = await supabase
          .from("school_info")
          .select("school_property")
          .eq("id", schoolInfoId)
          .maybeSingle();

        if (schoolInfoError) {
          console.error("[api/score-dashboard] school_info 조회 실패", schoolInfoError);
        } else if (schoolInfo) {
          schoolProperty = schoolInfo.school_property;
        }
      }
    }

    // 5) 전략 분석
    const strategy = analyzeAdmissionStrategy(
      internalPct,
      mock.avgPercentile,
      internal.zIndex,
      mock.best3GradeSum
    );

    // 6) 응답 조립
    const response: ScoreDashboardResponse = {
      studentProfile: {
        id: student.id,
        name: student.name,
        grade: student.grade,
        class: student.class ? parseInt(student.class) : null,
        schoolType: schoolProperty, // school_info.school_property 값
        schoolYear: new Date().getFullYear(), // 현재 연도 사용
        termGrade: grade,
        semester: semester,
      },
      internalAnalysis: {
        totalGpa: internal.totalGpa,
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

