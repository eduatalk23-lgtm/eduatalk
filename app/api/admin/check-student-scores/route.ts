import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSchoolScoreSummary, getMockScoreSummary, getRiskIndexBySubject } from "@/lib/scheduler/scoreLoader";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");
    const studentIdParam = searchParams.get("student_id");
    
    const supabase = await createSupabaseServerClient();
    
    let studentId: string | null = null;
    let targetEmail: string | null = null;
    
    // student_id가 직접 제공된 경우 우선 사용
    if (studentIdParam) {
      studentId = studentIdParam;
      targetEmail = email || null;
    } else if (email) {
      // 이메일이 제공된 경우: 현재 로그인한 사용자와 비교하거나
      // students 테이블에서 찾기 시도
      const currentUser = await getCurrentUser();
      
      if (currentUser?.email === email) {
        // 현재 로그인한 사용자의 이메일과 일치
        studentId = currentUser.userId;
        targetEmail = email;
      } else {
        // 다른 사용자의 이메일인 경우 - students 테이블에서 찾기 시도
        // (students 테이블에 email 컬럼이 있다고 가정)
        const { data: student, error: studentError } = await supabase
          .from("students")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        
        if (studentError || !student) {
          // students 테이블에 email이 없거나 찾을 수 없는 경우
          // 현재 로그인한 사용자의 데이터만 조회 가능하도록 제한
          return NextResponse.json(
            { 
              error: "권한 없음", 
              details: "다른 사용자의 데이터를 조회하려면 student_id 파라미터를 사용하거나 관리자 권한이 필요합니다.",
              hint: "student_id를 직접 지정하거나, 해당 이메일로 로그인한 상태에서 요청하세요.",
              currentUserEmail: currentUser?.email || null,
              availableStudentIds: "테이블에 있는 student_id를 확인하려면 student_id 파라미터 없이 요청하세요."
            },
            { status: 403 }
          );
        }
        
        studentId = student.id;
        targetEmail = email;
      }
    } else {
      // 이메일이 제공되지 않은 경우: 현재 로그인한 사용자의 데이터 조회
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        return NextResponse.json(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        );
      }
      
      studentId = currentUser.userId;
      targetEmail = currentUser.email || null;
    }
    
    if (!studentId) {
      return NextResponse.json(
        { error: "사용자 ID를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    
    // 1. 내신 성적 조회
    const selectSchoolScores = () =>
      supabase
        .from("student_school_scores")
        .select("*")
        .eq("student_id", studentId)
        .order("grade", { ascending: true })
        .order("semester", { ascending: true })
        .order("created_at", { ascending: false });
    
    let { data: schoolScores, error: schoolError } = await selectSchoolScores();
    
    // fallback: student_id 컬럼이 없는 경우
    if (schoolError && schoolError.code === "42703") {
      ({ data: schoolScores, error: schoolError } = await supabase
        .from("student_school_scores")
        .select("*")
        .order("grade", { ascending: true })
        .order("semester", { ascending: true })
        .order("created_at", { ascending: false }));
    }
    
    if (schoolError) {
      console.error("[check-student-scores] 내신 성적 조회 오류:", schoolError);
    }
    
    // 2. 모의고사 성적 조회
    const selectMockScores = () =>
      supabase
        .from("student_mock_scores")
        .select("*")
        .eq("student_id", studentId)
        .order("grade", { ascending: true })
        .order("test_date", { ascending: false });
    
    let { data: mockScores, error: mockError } = await selectMockScores();
    
    // fallback: student_id 컬럼이 없는 경우
    if (mockError && mockError.code === "42703") {
      ({ data: mockScores, error: mockError } = await supabase
        .from("student_mock_scores")
        .select("*")
        .order("grade", { ascending: true })
        .order("test_date", { ascending: false }));
    }
    
    if (mockError) {
      console.error("[check-student-scores] 모의고사 성적 조회 오류:", mockError);
    }
    
    // 디버깅: 테이블에 데이터가 있는지 확인 (student_id 무관)
    // 모든 student_id 목록 조회
    const { data: allSchoolScores, error: allSchoolError } = await supabase
      .from("student_school_scores")
      .select("id, student_id, subject_group, grade_score")
      .limit(10);
    
    const { data: allMockScores, error: allMockError } = await supabase
      .from("student_mock_scores")
      .select("id, student_id, subject_group, percentile")
      .limit(10);
    
    // 고유한 student_id 목록 조회
    const { data: uniqueStudentIds, error: uniqueError } = await supabase
      .from("student_school_scores")
      .select("student_id")
      .limit(100);
    
    const uniqueIds = uniqueStudentIds 
      ? Array.from(new Set(uniqueStudentIds.map(s => s.student_id).filter(Boolean)))
      : [];
    
    console.log("[check-student-scores] 테이블 전체 샘플:", {
      schoolScoresSample: allSchoolScores?.length || 0,
      mockScoresSample: allMockScores?.length || 0,
      uniqueStudentIds: uniqueIds.length,
      schoolScoresSampleData: allSchoolScores?.slice(0, 3),
      mockScoresSampleData: allMockScores?.slice(0, 3),
    });
    
    // 3. 추천 시스템 요약 데이터
    const [schoolSummary, mockSummary, riskIndex] = await Promise.all([
      getSchoolScoreSummary(studentId),
      getMockScoreSummary(studentId),
      getRiskIndexBySubject(studentId),
    ]);
    
    // 4. 과목별 분석
    const allSubjects = new Set<string>();
    schoolSummary.forEach((_, subject) => allSubjects.add(subject));
    mockSummary.forEach((_, subject) => allSubjects.add(subject));
    
    const requiredSubjects = ["국어", "수학", "영어"];
    const subjectAnalysis = Array.from(allSubjects).map(subject => {
      const school = schoolSummary.get(subject);
      const mock = mockSummary.get(subject);
      const risk = riskIndex.get(subject);
      
      const schoolCount = schoolScores?.filter(s => 
        s.subject_group?.toLowerCase().trim() === subject
      ).length || 0;
      const mockCount = mockScores?.filter(s => 
        s.subject_group?.toLowerCase().trim() === subject
      ).length || 0;
      
      const hasSchool = school && school.recentGrade !== null;
      const hasMock = mock && (mock.recentPercentile !== null || mock.recentGrade !== null);
      const hasMultipleSchool = school && school.averageGrade !== null && school.gradeVariance > 0;
      const hasMultipleMock = mock && mock.averagePercentile !== null;
      
      let level = "없음";
      if (hasMultipleSchool && hasMultipleMock) {
        level = "최적";
      } else if (hasMultipleSchool || hasMultipleMock) {
        level = "좋음";
      } else if (hasSchool || hasMock) {
        level = "기본";
      }
      
      return {
        subject,
        level,
        schoolCount,
        mockCount,
        hasSchool,
        hasMock,
        hasMultipleSchool,
        hasMultipleMock,
        schoolSummary: school ? {
          recentGrade: school.recentGrade,
          averageGrade: school.averageGrade,
          gradeVariance: school.gradeVariance,
        } : null,
        mockSummary: mock ? {
          recentPercentile: mock.recentPercentile,
          averagePercentile: mock.averagePercentile,
          recentGrade: mock.recentGrade,
          averageGrade: mock.averageGrade,
        } : null,
        riskScore: risk?.riskScore || null,
        riskReasons: risk?.reasons || [],
      };
    });
    
    // 5. 개선 권장사항
    const recommendations: string[] = [];
    
    if (schoolSummary.size === 0 && mockSummary.size === 0) {
      recommendations.push("성적 데이터가 전혀 없습니다. 최소 1개 과목의 성적을 입력해주세요.");
    } else {
      if (schoolSummary.size === 0) {
        recommendations.push("내신 성적이 없습니다. 내신 성적을 입력하면 더 정확한 추천을 받을 수 있습니다.");
      }
      if (mockSummary.size === 0) {
        recommendations.push("모의고사 성적이 없습니다. 모의고사 성적을 입력하면 위험도 분석이 가능합니다.");
      }
      
      requiredSubjects.forEach(subject => {
        const lowerSubject = subject.toLowerCase();
        const analysis = subjectAnalysis.find(a => a.subject === lowerSubject);
        if (!analysis) {
          recommendations.push(`필수 과목 "${subject}"의 성적 데이터가 없습니다.`);
        } else if (!analysis.hasSchool && !analysis.hasMock) {
          recommendations.push(`필수 과목 "${subject}"의 성적 데이터가 없습니다.`);
        } else if (analysis.hasSchool && !analysis.hasMultipleSchool) {
          recommendations.push(`필수 과목 "${subject}"의 내신 성적을 2개 이상 입력하면 평균 계산이 가능합니다.`);
        } else if (analysis.hasMock && !analysis.hasMultipleMock) {
          recommendations.push(`필수 과목 "${subject}"의 모의고사 성적을 2개 이상 입력하면 평균 계산이 가능합니다.`);
        }
      });
    }
    
    return NextResponse.json({
      email: targetEmail,
      studentId,
      debug: {
        queryStudentId: studentId,
        schoolError: schoolError ? {
          message: schoolError.message,
          code: schoolError.code,
          details: schoolError.details,
        } : null,
        mockError: mockError ? {
          message: mockError.message,
          code: mockError.code,
          details: mockError.details,
        } : null,
        tableSample: {
          schoolScoresCount: allSchoolScores?.length || 0,
          mockScoresCount: allMockScores?.length || 0,
          uniqueStudentIds: uniqueIds,
          schoolScoresSample: allSchoolScores?.slice(0, 3).map(s => ({
            id: s.id,
            student_id: s.student_id,
            subject_group: s.subject_group,
          })),
          mockScoresSample: allMockScores?.slice(0, 3).map(m => ({
            id: m.id,
            student_id: m.student_id,
            subject_group: m.subject_group,
          })),
        },
      },
      summary: {
        schoolScoresCount: schoolScores?.length || 0,
        mockScoresCount: mockScores?.length || 0,
        schoolSummaryCount: schoolSummary.size,
        mockSummaryCount: mockSummary.size,
        riskIndexCount: riskIndex.size,
        allSubjectsCount: allSubjects.size,
      },
      schoolScores: schoolScores || [],
      mockScores: mockScores || [],
      subjectAnalysis,
      recommendations,
      requiredSubjectsCoverage: requiredSubjects.map(subject => {
        const lowerSubject = subject.toLowerCase();
        return {
          subject,
          hasData: allSubjects.has(lowerSubject),
          analysis: subjectAnalysis.find(a => a.subject === lowerSubject) || null,
        };
      }),
    });
  } catch (error) {
    console.error("[admin/check-student-scores] 오류:", error);
    return NextResponse.json(
      { error: "데이터 조회 실패", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

